-- LEFT — real films, rendered by Shotstack.
--
-- The previous migration (`film_is_a_sequence`) recorded a decision: no video
-- file would ever be produced, because concatenating clips needs ffmpeg and
-- nothing in this project can run it. 17 played the clips back to back instead.
--
-- **That constraint is now bought rather than engineered around.** Shotstack is
-- a rendering API: POST a JSON timeline of clips, it returns an mp4. It runs the
-- ffmpeg we cannot, so the pipeline that migration declined to build is one HTTP
-- call and a callback.
--
-- **The sequence is not being removed.** It stays as the fallback and as the
-- immediate experience, which is what makes this safe to ship:
--
--   * `compile_film()` still moves processing -> ready the moment every clip has
--     landed, and 17 is watchable then, exactly as before. Nobody waits on a
--     render.
--   * The render runs behind that, and when it lands 17 upgrades from "clips
--     played in sequence" to "one file". No cuts, instant seeking, one signature
--     instead of a re-signing schedule.
--   * A render that fails, or never comes back, changes nothing a user can see.
--     The film is still watchable. `film_status` says 'failed' and the sequence
--     carries on doing what it has always done.
--
-- So `events.status` keeps its meaning from the last migration — "every clip that
-- is coming has arrived" — and the new `film_status` tracks the render as a
-- separate, entirely optional axis. The two are deliberately not merged: one is
-- about the group's footage being complete, the other about a third party's
-- queue, and stalling the first on the second is the mistake this design exists
-- to avoid.
--
-- What is new here:
--   1. `film_render_status` and the columns on `public.events` that track a render
--   2. the `films` bucket the rendered mp4 lands in
--   3. `claim_film_render()` — the atomic "exactly one render per event" gate


-- ---------------------------------------------------------------------------
-- 1. Where an event's render has got to.
-- ---------------------------------------------------------------------------
-- 'none'      no render has been asked for (every event that predates this)
-- 'queued'    claimed by one caller; the Shotstack request may not be sent yet
-- 'rendering' Shotstack has accepted it and given us a render id
-- 'ready'     the mp4 is in the films bucket and `film_path` points at it
-- 'failed'    Shotstack refused, errored, or the copy back failed
--
-- 'queued' and 'rendering' are separate because the gap between them is a real
-- failure window: a caller that claims the render and then dies before Shotstack
-- accepts it would otherwise be indistinguishable from one waiting on a
-- callback. See the staleness escape in claim_film_render().

create type public.film_render_status as enum (
  'none', 'queued', 'rendering', 'ready', 'failed'
);

alter table public.events
  -- Path in the `films` bucket: `{event_id}/film.mp4`. Null until a render lands.
  add column film_path              text,
  add column film_status            public.film_render_status not null default 'none',
  -- Shotstack's render id. The callback carries it and nothing else that
  -- identifies the event, so it is how a callback finds its row.
  add column film_render_id         text,
  -- The rendered file's real length, as Shotstack measured it. Close to but not
  -- identical to `used_seconds`, which is what the group was *charged*.
  add column film_duration_seconds  numeric(8, 2),
  -- Why the last attempt failed, for support and for the retry decision. Not
  -- shown to users: it is Shotstack's language, not ours.
  add column film_error             text,
  -- When the current attempt was claimed. Read by the staleness escape below.
  add column film_requested_at      timestamptz,
  add column film_ready_at          timestamptz;

-- The callback's only lookup. Partial: most rows never render, and indexing
-- their nulls buys nothing.
create index events_film_render_id_idx
  on public.events (film_render_id)
  where film_render_id is not null;


-- ---------------------------------------------------------------------------
-- 2. The films bucket.
-- ---------------------------------------------------------------------------
-- Private, like `clips`, and for the same reason: this is a group's own footage
-- and a public URL would be a permanent capability handed to anyone who saw it.
-- The path convention matches the clips bucket's first segment so the same
-- membership check works — `{event_id}/film.mp4`.
--
-- **Nothing but the service role ever writes here.** There is deliberately no
-- insert, update or delete policy for `authenticated`: the only writer is the
-- shotstack-callback function, and a client that could put a file at
-- `{event_id}/film.mp4` could replace a group's film with anything it liked.
--
-- The size limit is generous because the output is not: the largest tier caps a
-- film at 10 minutes (mobile/src/lib/pricing.ts), and 4K at that length is the
-- worst case this has to hold.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'films',
  'films',
  false,
  2147483648, -- 2 GB
  array['video/mp4']
)
on conflict (id) do nothing;

create policy "films bucket: members can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'films'
    and public.is_event_member(
      nullif((storage.foldername(name))[1], '')::uuid,
      (select auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- 3. claim_film_render() — exactly one render per event.
-- ---------------------------------------------------------------------------
-- Screen 14 runs on every member's phone and they all call compile_film()
-- without coordinating, which is fine because that function is idempotent. A
-- render is not: every call costs money and produces a different file. So the
-- claim has to be atomic, and this is it — `for update` serialises the racing
-- phones and exactly one of them comes back true.
--
-- Returns whether the caller won the claim. False is the ordinary outcome for
-- everybody else, not an error: their phone simply does not send the request.
--
-- **The staleness escape.** A caller that claims a render and then dies — the
-- app killed, the function timing out, Shotstack never calling back — would
-- otherwise strand the event in 'queued' or 'rendering' forever with the claim
-- held by nobody. Past `p_stale_after` the claim is up for grabs again. This is
-- the whole retry story: no queue and no scheduler, just a lock that expires, in
-- the same spirit as `budget_reservations.expires_at`.
--
-- Any member may claim, like finish_event() and compile_film() — the film
-- belongs to the group, not to whoever happens to be the host.

create or replace function public.claim_film_render(
  p_event_id    uuid,
  p_stale_after interval default interval '30 minutes'
)
returns boolean
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

  -- Nothing to render until every clip that is coming has arrived. That is
  -- precisely what 'ready' has meant since the film_is_a_sequence migration.
  if v_event.status <> 'ready' then
    return false;
  end if;

  -- Already rendered. The film exists; asking again would replace a good file
  -- with an identical one and bill for the privilege.
  if v_event.film_status = 'ready' then
    return false;
  end if;

  -- Someone else holds a live claim. Only a stale one may be taken over.
  if v_event.film_status in ('queued', 'rendering')
     and v_event.film_requested_at is not null
     and v_event.film_requested_at > now() - p_stale_after then
    return false;
  end if;

  update public.events
     set film_status       = 'queued',
         film_requested_at = now(),
         -- The abandoned attempt's identifiers are not this one's. Cleared so a
         -- late callback from it cannot land on the render replacing it.
         film_render_id    = null,
         film_error        = null
   where id = p_event_id;

  return true;
end;
$$;

revoke all on function public.claim_film_render(uuid, interval) from public, anon;
grant execute on function public.claim_film_render(uuid, interval) to authenticated;

comment on function public.claim_film_render(uuid, interval) is
  'Atomically claims the right to render this event''s film. True for exactly '
  'one caller; false for everyone racing it. Stale claims expire so a dead '
  'attempt can be retried. Any member may call it.';

comment on column public.events.film_path is
  'Path in the films bucket once a render has landed. Null means 17 plays the '
  'clips in sequence, which is always a valid film.';
