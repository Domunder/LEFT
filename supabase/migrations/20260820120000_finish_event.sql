-- LEFT — ending an event.
--
-- `events.status` has carried 'processing' and 'ready' since the initial schema
-- with nothing to write either. `start_event()` moves setup -> live; this is the
-- other end of that arc.
--
-- Three things live here:
--   1. a fix to commit_reservation()'s clip ordering,
--   2. finish_event()  — live -> processing, when the budget is spent,
--   3. compile_film()  — processing -> ready. **A stub.** See its comment.


-- ---------------------------------------------------------------------------
-- 1. Clips are ordered by when recording STARTED, not when it stopped.
-- ---------------------------------------------------------------------------
-- `clips.recorded_at` defaults to now(), and the row is inserted by
-- commit_reservation(), which runs when the recording *stops*. So the running
-- order was stop-order: two members starting together, one filming 30s and one
-- 5s, came out reversed. Screen 14 promises "everyone's clips together, in
-- order", and this is what makes that true.
--
-- The reservation was taken when recording began, so its created_at is the start
-- time, and this function already holds that row. Nothing downstream changes —
-- clips_event_recorded_idx and listClips already sort on this column; the values
-- simply become correct.
--
-- Existing rows are left alone. A settled reservation's created_at could
-- backfill them, but events filmed before this are already finished or
-- abandoned, and rewriting history to fix an order nobody is waiting on is not
-- worth the risk of touching charged rows.

create or replace function public.commit_reservation(
  p_reservation_id uuid,
  p_actual_seconds numeric,
  p_storage_path   text default null
)
returns table (clip_id uuid, charged_seconds integer, remaining_after integer)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r        public.budget_reservations%rowtype;
  v_charge integer;
  v_clip   uuid;
begin
  select * into r
    from public.budget_reservations
   where id = p_reservation_id
     and user_id = auth.uid()
     and settled_at is null
   for update;

  if not found then
    raise exception 'reservation not found, already settled, or not yours'
      using errcode = 'P0002';
  end if;

  if p_actual_seconds <= 0 then
    raise exception 'p_actual_seconds must be positive' using errcode = '22023';
  end if;

  perform 1 from public.events where id = r.event_id for update;

  v_charge := least(ceil(p_actual_seconds)::integer, r.seconds);

  update public.budget_reservations set settled_at = now() where id = r.id;

  update public.events
     set used_seconds = used_seconds + v_charge
   where id = r.event_id;

  insert into public.clips (
    event_id, user_id, storage_path, duration_seconds, status, recorded_at
  )
  values (
    r.event_id,
    auth.uid(),
    p_storage_path,
    least(p_actual_seconds, r.seconds),
    (case when p_storage_path is null then 'pending' else 'uploaded' end)::public.clip_status,
    -- When the camera started rolling, not when it stopped.
    r.created_at
  )
  returning id into v_clip;

  return query select v_clip, v_charge, public.remaining_seconds(r.event_id);
end;
$$;


-- ---------------------------------------------------------------------------
-- 2. finish_event() — the group has run out of time.
-- ---------------------------------------------------------------------------
-- Called by whichever member's phone notices the budget is gone first. Every
-- other phone learns about it from the realtime UPDATE on public.events and
-- follows to screen 14 on its own — which is what makes the event end for the
-- whole group rather than for the one person who happened to be filming.
--
-- A function rather than an UPDATE policy, for start_event()'s reason: the
-- host's policy checks only host_id = auth.uid(), so it would accept any
-- transition in any direction. The legal one is a single arrow.
--
-- Any *member* may call it, not just the host. The host may have put their phone
-- away; the budget is shared and so is the ending.

create or replace function public.finish_event(p_event_id uuid)
returns public.events
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_event
    from public.events
   where id = p_event_id
   for update;

  if not found then
    raise exception 'no such event' using errcode = 'P0002';
  end if;

  if not public.is_event_member(p_event_id, auth.uid()) then
    raise exception 'you are not a member of this event' using errcode = '42501';
  end if;

  -- Already ending or ended. Several phones racing to report the same empty
  -- budget is the expected case, not an error — hand back the row unchanged so
  -- every caller sees the same truth.
  if v_event.status in ('processing', 'ready') then
    return v_event;
  end if;

  if v_event.status <> 'live' then
    raise exception 'this event has not started' using errcode = 'P0002';
  end if;

  -- The budget must genuinely be spent. Without this any member could end
  -- everyone else's event at will, and the client asking is not evidence:
  -- remaining_seconds() is the single authority on what is left, holds included.
  if public.remaining_seconds(p_event_id) > 0 then
    raise exception 'this event still has filming time left' using errcode = 'P0001';
  end if;

  update public.events
     set status = 'processing'
   where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;

revoke all on function public.finish_event(uuid) from public, anon;
grant execute on function public.finish_event(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 3. compile_film() — A STUB. It does not make a film.
-- ---------------------------------------------------------------------------
-- Read this before building anything on top of it.
--
-- **No video is produced.** This flips processing -> ready and nothing else.
-- There is no output file, no `films` table and no output_path column, because
-- there is nothing to put in one.
--
-- Why it is a stub rather than an implementation: concatenating clips needs
-- ffmpeg or an equivalent media pipeline. Supabase edge functions run Deno and
-- cannot execute native binaries, and Postgres certainly cannot. Nothing in this
-- project can currently stitch two mp4s together.
--
-- A real implementation would, elsewhere:
--   - read the event's clips in recorded_at order (which item 1 above now makes
--     genuinely chronological),
--   - concatenate them, applying the tier's resolution and watermark rules,
--   - upload the result to a `films` bucket,
--   - record its path on the event, and only then set status = 'ready'.
--
-- It is called by the client from screen 14. A scheduler (pg_cron) is where real
-- compilation would belong — work taking minutes should not hang off whether
-- someone kept the app open — but for a function that returns immediately it
-- would be a moving part with nothing to move.

create or replace function public.compile_film(p_event_id uuid)
returns public.events
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_event
    from public.events
   where id = p_event_id
   for update;

  if not found then
    raise exception 'no such event' using errcode = 'P0002';
  end if;

  if not public.is_event_member(p_event_id, auth.uid()) then
    raise exception 'you are not a member of this event' using errcode = '42501';
  end if;

  -- Not ours to act on, in either direction: an event still filming has no film
  -- to make, and one already ready has had it made. Both return unchanged, so
  -- every member's screen 14 can call this without coordinating.
  if v_event.status <> 'processing' then
    return v_event;
  end if;

  update public.events
     set status = 'ready'
   where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;

revoke all on function public.compile_film(uuid) from public, anon;
grant execute on function public.compile_film(uuid) to authenticated;
