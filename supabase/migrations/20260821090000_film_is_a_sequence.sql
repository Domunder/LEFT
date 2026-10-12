-- LEFT — the film is a sequence of clips, not a compiled file.
--
-- The previous migration shipped `compile_film()` as an explicit stub, with a
-- comment describing the ffmpeg pipeline that would one day replace it. That
-- pipeline is not being built, and this migration records the decision so the
-- next reader does not go looking for it.
--
-- **Why not.** Concatenating clips needs ffmpeg or an equivalent media pipeline.
-- Supabase edge functions run Deno and cannot execute native binaries; Postgres
-- certainly cannot. Doing it properly means an external worker — a container
-- somewhere running ffmpeg, a job queue, a films bucket, a retry story and a
-- per-tier watermark and resolution pass. That is a real piece of
-- infrastructure, and until it exists the app was charging for a film it could
-- not produce: screen 14 sat on a cosmetic delay and screen 17 showed a poster
-- reading "Your film is still being put together" forever.
--
-- **What happens instead.** Screen 17 plays the event's clips back to back in
-- `recorded_at` order. Same footage, same order, no file. `recorded_at` already
-- holds recording *start* rather than commit time — a fix made in the previous
-- migration precisely so this order would be right — so the sequence is
-- genuinely chronological across members filming at the same time.
--
-- **The function keeps its name and its behaviour.** Only its meaning changes:
--
--   'processing' -> 'ready'  now means "every clip that is coming has arrived;
--                             the film can be watched end to end"
--
-- rather than "a video file has been produced". Renaming it would churn
-- `types/database.ts`, `lib/events.ts`, `film-status.ts`, the budget-invariant
-- checks and every screen that routes on `'ready'`, for nothing a user could
-- see. It is flagged here and at each call site instead.
--
-- Screen 14 now waits for `clips.status` to reach 'uploaded' across the event
-- before calling this — a real wait, where the old delay was theatre — and gives
-- up after a bounded timeout so one member's stalled upload cannot strand the
-- group. A clip that never lands is a gap the film reports honestly rather than
-- a reason to hold everyone.
--
-- No schema change. This migration exists for its comment and to re-state the
-- function with an accurate one.

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

  -- Not ours to act on, in either direction: an event still filming is not
  -- finished, and one already ready has been marked. Both return unchanged, so
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

comment on function public.compile_film(uuid) is
  'Marks an event watchable: processing -> ready. Produces no video — the film '
  'is played as a sequence of clips in recorded_at order. Idempotent; any member '
  'may call it. Named for a compile step that was never built.';
