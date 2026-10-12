-- LEFT — a take is capped at 20 seconds, whatever the pool holds.
--
-- `reserve_budget` has always granted `least(p_seconds, v_available)`, and
-- camera.tsx has always asked for the whole remainder. The comment there argues
-- the case well: "the grant is a cap on this take, not a promise of seconds…
-- asking for less would cut the take short for no reason."
--
-- That reasoning is right about *budget* and wrong about *film*. One member with
-- a 10-minute pool could spend all of it in a single take, and three things
-- follow from that, none of them good:
--
--   * **One person can drain the group.** The shared pool is the whole premise;
--     a single uncapped take makes it first-come-first-served.
--   * **Long takes cut badly.** A film assembled from four 90-second holds is
--     four long holds. A cut film wants many short shots — it is why Vine and
--     early Instagram video worked, and it is what makes the finished film feel
--     like the group rather than like one person's video.
--   * **Fewer people appear.** Budget spent is budget nobody else can film with.
--
-- So the cap is a product rule, not a UI convenience, and it belongs here rather
-- than only in the client. One term does the whole job:
--
--     v_grant := least(p_seconds, v_available, max_take_seconds());
--
-- It flows downhill on its own. `granted_seconds` is handed to
-- `recordAsync({ maxDuration })`, so the camera stops itself; and `resolve_takes`
-- already charges `least(ceil(actual_seconds), r.seconds, v_room)`, so a client
-- that reports 60 seconds against a 20-second hold is charged 20 and the clip row
-- records 20. An old client cannot overspend and cannot lie its way past this.
--
-- The client half (camera.tsx asking for `min(20, shared)`, the REC pill counting
-- down, the record button's ring) ships alongside, but the two halves are
-- independent: a capped client against an uncapped server gets 20 because it
-- asked for 20, and an uncapped client against this migration gets 20 because it
-- is all it is given.

-- ---------------------------------------------------------------------------
-- 1. The cap itself
-- ---------------------------------------------------------------------------
-- A function rather than a literal in `reserve_budget` so the number has one
-- home and a name, and so the client can read it rather than keep a second copy
-- that can drift. `constants/theme.ts` holds the fast path (`Camera.maxTakeSeconds`)
-- because a camera screen cannot wait on a round trip to draw a countdown ring —
-- but this is the one that decides what a take actually gets.

create or replace function public.max_take_seconds()
returns integer
language sql
immutable
as $$
  select 20;
$$;

revoke all on function public.max_take_seconds() from public, anon;
grant execute on function public.max_take_seconds() to authenticated;

comment on function public.max_take_seconds() is
  'The longest single take, in seconds, regardless of how much budget remains. '
  'A product rule: it keeps one member from draining the shared pool and keeps '
  'the finished film made of short shots.';


-- ---------------------------------------------------------------------------
-- 2. reserve_budget honours it
-- ---------------------------------------------------------------------------
-- Reproduced whole from 20260823120000_shared_budget_ordering.sql. The only
-- change is the third term of the `least()`, and the comment above it.

create or replace function public.reserve_budget(p_event_id uuid, p_seconds integer)
returns table (reservation_id uuid, granted_seconds integer, remaining_after integer)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_available integer;
  v_grant     integer;
  v_id        uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not public.is_event_member(p_event_id, auth.uid()) then
    raise exception 'not a member of this event' using errcode = '42501';
  end if;

  if p_seconds <= 0 then
    raise exception 'p_seconds must be positive' using errcode = '22023';
  end if;

  -- Serialize against every other reservation and settlement for this event.
  perform 1 from public.events where id = p_event_id for update;

  -- Settle anything the queue can settle first, so this take is measured against
  -- an up-to-date `used_seconds` and does not queue behind an abandoned hold.
  perform public.resolve_takes(p_event_id);

  v_available := public.available_seconds(p_event_id);

  /*
    Three ceilings, and they mean different things. `p_seconds` is what the
    client asked for; `v_available` is what the group can still afford; and
    `max_take_seconds()` is what any one take is allowed to be no matter how rich
    the group is. The last is the only one that does not vary, which is why a
    member with nine minutes left still gets twenty seconds.
  */
  v_grant := least(p_seconds, v_available, public.max_take_seconds());

  if v_grant <= 0 then
    return query select null::uuid, 0, v_available;
    return;
  end if;

  insert into public.budget_reservations (event_id, user_id, seconds, expires_at)
  values (p_event_id, auth.uid(), v_grant, now() + interval '15 minutes')
  returning id into v_id;

  return query select v_id, v_grant, public.available_seconds(p_event_id);
end;
$$;

comment on function public.reserve_budget(uuid, integer) is
  'Takes a place in the settlement queue and returns the hard cap for one '
  'recording: least(asked, what the group can afford, max_take_seconds()).';
