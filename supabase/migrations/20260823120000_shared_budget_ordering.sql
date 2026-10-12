-- LEFT — one pool, shared honestly: soft holds settled in start order.
--
-- The initial schema made a hold *exclusive*: `reserve_budget` subtracted every
-- other member's open reservation, and the client asked for the whole remainder.
-- So the first person to press record held the entire pool and everyone else was
-- told "the group is out of filming time" with nine minutes left. Two phones
-- filming at once — the thing this whole app is for — was impossible.
--
-- The rule this migration implements instead:
--
--   * Every member sees the same number: `budget_seconds - used_seconds`. A hold
--     hides nothing from anybody.
--   * Anyone may start filming while that number is above zero.
--   * When the pool cannot cover everyone, **whoever started first wins**, and
--     the ones behind them are truncated to what is left, or dropped.
--
-- With a 50s budget and A starting before B:
--
--   A 10s, B 10s  ->  both kept, 20s used
--   A 50s, B 50s  ->  A kept, B dropped entirely
--   A 40s, B 20s  ->  A kept at 40s, B kept at its first 10s
--
-- **The price, and it is not an implementation detail.** In the third case B
-- stops filming at second 21 while A is still rolling until second 40. Until A
-- stops, nobody can know whether B is owed 20s, 10s or nothing. So B's take
-- *waits*: `commit_reservation` returns 'waiting', and B's clip row appears when
-- A settles. Resolving B any earlier would mean guessing, and the only honest
-- guess is A's full hold — which is exactly the starvation this migration exists
-- to remove.
--
-- A hold is therefore no longer a claim on seconds. It is a claim on a **place in
-- the queue**, and `budget_reservations.created_at` — stamped before the camera
-- rolls — is what "started first" means.

-- ---------------------------------------------------------------------------
-- 1. A reservation records its own outcome
-- ---------------------------------------------------------------------------
-- Three states, in order:
--
--   open       committed_at is null, expires_at > now()   camera rolling
--   committed  committed_at set, resolved_at is null      filmed, waiting its turn
--   resolved   resolved_at set                            charged (possibly 0)
--
-- `settled_at` keeps its old meaning of "no longer a live hold" and is set
-- alongside `resolved_at`, so `remaining_seconds()` — which still subtracts open
-- holds and is still what guards a premature ending — needs no change.

alter table public.budget_reservations
  add column actual_seconds  numeric(6, 2),
  add column committed_at    timestamptz,
  add column charged_seconds integer,
  add column resolved_at     timestamptz,
  add column clip_id         uuid references public.clips (id) on delete set null;

comment on column public.budget_reservations.actual_seconds is
  'What was actually filmed, reported at commit. Null while the camera is rolling.';
comment on column public.budget_reservations.charged_seconds is
  'What the group was finally charged. 0 means the take was dropped — an earlier '
  'take used the last of the budget — and no clip row exists for it.';
comment on column public.budget_reservations.clip_id is
  'The clip this take became. Null while waiting, and null forever if dropped.';

-- The queue walker reads exactly this: unresolved rows for one event, in start
-- order. Partial, because a finished event's reservations are all resolved.
create index budget_reservations_queue_idx
  on public.budget_reservations (event_id, created_at)
  where resolved_at is null;

-- Everything already in the table predates the queue and has been settled one
-- way or the other. Marking it resolved keeps it out of the walker's way.
update public.budget_reservations
   set resolved_at = coalesce(settled_at, created_at)
 where resolved_at is null
   and settled_at is not null;


-- ---------------------------------------------------------------------------
-- 2. available_seconds() — the number every member sees
-- ---------------------------------------------------------------------------
-- Deliberately blind to holds. That blindness is the feature: it is what lets A
-- and B both read "50s left" and both start filming. Overspending is prevented
-- at settlement instead, where the real lengths are finally known.
--
-- `remaining_seconds()` is untouched and still subtracts holds. The two now
-- answer different questions and both are needed:
--
--   available_seconds  "how much may I claim?"        -> reserve, the bar, the toast
--   remaining_seconds  "how much is unaccounted for?" -> finish_event()'s guard

create or replace function public.available_seconds(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, e.budget_seconds - e.used_seconds)::integer
    from public.events e
   where e.id = p_event_id;
$$;

comment on function public.available_seconds(uuid) is
  'Budget minus what is spent, ignoring live holds. The shared number every '
  'member sees and reserves against.';


-- ---------------------------------------------------------------------------
-- 3. resolve_takes() — the queue walker
-- ---------------------------------------------------------------------------
-- The heart of the change, and the only place `used_seconds` moves.
--
-- Walks one event's unresolved reservations in **start order** and charges each
-- against what is left at the moment it is reached. Commit order is irrelevant:
-- a 5s take that started second is settled after the 40s take that started
-- first, however much earlier it stopped.
--
-- It stops dead at the first take that is still rolling. Everything behind that
-- take waits, because its own charge depends on a length nobody knows yet.
--
-- Not granted to anyone. It is called from commit/release/reserve, always inside
-- a transaction that already holds the event's row lock.

create or replace function public.resolve_takes(p_event_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r        public.budget_reservations%rowtype;
  v_event  public.events%rowtype;
  v_room   integer;
  v_charge integer;
  v_clip   uuid;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    return;
  end if;

  for r in
    select *
      from public.budget_reservations
     where event_id = p_event_id
       and resolved_at is null
     order by created_at, id
       for update
  loop
    if r.committed_at is null then
      /*
        Still rolling, or abandoned.

        An expired hold is resolved at nothing and skipped: a member who force-
        quit mid-take must not block everyone queued behind them forever. A live
        one stops the walk — that is the whole ordering rule in one statement.
      */
      if r.expires_at <= now() then
        update public.budget_reservations
           set charged_seconds = 0,
               resolved_at     = now(),
               settled_at      = coalesce(settled_at, now())
         where id = r.id;
        continue;
      end if;

      exit;
    end if;

    v_room   := greatest(0, v_event.budget_seconds - v_event.used_seconds);
    /*
      Three caps, and the group is safe if any one of them holds: the length
      actually filmed, the size of the hold taken before filming, and the budget
      genuinely left. The third is what truncates a later take to the seconds an
      earlier one did not use.
    */
    v_charge := least(ceil(r.actual_seconds)::integer, r.seconds, v_room);
    v_clip   := null;

    /*
      The order of the three writes below is deliberate, and it is about what
      subscribers see rather than about correctness in the database.

      Logical decoding emits row changes in statement order, so a client watching
      both `events` and its own `budget_reservations` receives them in the order
      written here. Bumping `used_seconds` first would tell a phone "the budget
      moved" before telling it "and that was your take, you can stop counting it
      yourself" — which renders for a frame as the take charged twice. The
      verdict therefore goes out ahead of the total.
    */
    if v_charge > 0 then
      /*
        `r.user_id`, never `auth.uid()`. This runs inside whichever member's
        transaction happened to drain the queue, which is routinely *not* the
        member whose take is being charged — A's commit is what finally settles
        B's. Attributing the clip to the caller would put B's footage under A's
        name in the film.

        `recorded_at` is the reservation's own created_at: when the camera
        started rolling, which is the order screen 17 plays clips in.

        `duration_seconds` is the charge, not the filmed length. A take truncated
        to its first 10 seconds is a 10-second clip as far as the film is
        concerned, and the player caps playback there.
      */
      insert into public.clips (
        event_id, user_id, duration_seconds, status, recorded_at
      )
      values (p_event_id, r.user_id, v_charge, 'pending', r.created_at)
      returning id into v_clip;
    end if;

    update public.budget_reservations
       set charged_seconds = v_charge,
           clip_id         = v_clip,
           resolved_at     = now(),
           settled_at      = coalesce(settled_at, now())
     where id = r.id;

    /* Last, so the verdict above reaches subscribers first. `v_event` is carried
       forward for the next iteration's `v_room`. */
    if v_charge > 0 then
      update public.events
         set used_seconds = used_seconds + v_charge
       where id = p_event_id
      returning * into v_event;
    end if;
  end loop;
end;
$$;

revoke all on function public.resolve_takes(uuid) from public, anon, authenticated;

comment on function public.resolve_takes(uuid) is
  'Charges an event''s finished takes in the order they STARTED, stopping at the '
  'first take still rolling. Internal — called by reserve/commit/release.';


-- ---------------------------------------------------------------------------
-- 4. reserve_budget() — a place in the queue, not a lock on seconds
-- ---------------------------------------------------------------------------
-- Two changes. It grants against `available_seconds` rather than
-- `remaining_seconds`, so another member's live take no longer hides budget from
-- this one; and it drains the queue on the way in, so a new take never lines up
-- behind a hold that expired an hour ago.
--
-- `granted_seconds` still means "the hard cap for this recording" and is still
-- handed to `recordAsync({ maxDuration })`. What changed is that it is now a cap
-- on ambition rather than a promise — the seconds are only yours if you started
-- before whoever else is filming.

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
  v_grant     := least(p_seconds, v_available);

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


-- ---------------------------------------------------------------------------
-- 5. commit_reservation() — record the length, then let the queue decide
-- ---------------------------------------------------------------------------
-- No longer charges anything itself. It records what was filmed and asks the
-- walker to settle as far as it can, which may or may not reach this take.
--
-- The return type changes, so the old signature has to go rather than be
-- replaced. `p_storage_path` goes with it: the bucket path has always contained
-- the clip id, which does not exist until after the commit, so the parameter was
-- never passable and is now impossible by construction. Uploads are keyed by
-- reservation id instead — see lib/clips.ts.
--
--   status 'charged'  this take is settled; used_after includes it
--          'dropped'  an earlier take took the last of the budget; no clip exists
--          'waiting'  an earlier take is still rolling; ask again when it resolves
--
-- `used_after` is what makes the client's progress bar race-free: it is the
-- authoritative `used_seconds` *including* this take, so the phone can drop its
-- provisional local count in the same breath as it adopts the server's number,
-- instead of trying to work out from realtime deltas whether its own take has
-- landed yet. That guesswork is what made a 10s take read as 22.

drop function if exists public.commit_reservation(uuid, numeric, text);

create function public.commit_reservation(
  p_reservation_id uuid,
  p_actual_seconds numeric
)
returns table (
  status          text,
  clip_id         uuid,
  charged_seconds integer,
  used_after      integer,
  budget_seconds  integer
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r          public.budget_reservations%rowtype;
  v_event    public.events%rowtype;
  v_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_actual_seconds <= 0 then
    raise exception 'p_actual_seconds must be positive' using errcode = '22023';
  end if;

  /*
    The event is locked before the reservation, and that order matters. The
    walker locks the event and then every unresolved reservation on it; a commit
    that grabbed its own reservation first would hold one lock while waiting for
    the other, and two members stopping at the same instant would deadlock.
  */
  select event_id into v_event_id
    from public.budget_reservations
   where id = p_reservation_id
     and user_id = auth.uid();

  if v_event_id is null then
    raise exception 'reservation not found, already settled, or not yours'
      using errcode = 'P0002';
  end if;

  perform 1 from public.events where id = v_event_id for update;

  select * into r
    from public.budget_reservations
   where id = p_reservation_id
     and user_id = auth.uid()
     and committed_at is null
     and resolved_at is null
     for update;

  if not found then
    raise exception 'reservation not found, already settled, or not yours'
      using errcode = 'P0002';
  end if;

  /*
    Push the expiry out. A take that has stopped filming is no longer abandonable
    — it is queued — and letting the original 15-minute window catch it would
    throw away footage for the crime of waiting behind a long take.
  */
  update public.budget_reservations
     set committed_at   = now(),
         actual_seconds = p_actual_seconds,
         expires_at     = greatest(expires_at, now() + interval '15 minutes')
   where id = r.id;

  perform public.resolve_takes(r.event_id);

  select * into r from public.budget_reservations res where res.id = p_reservation_id;
  select * into v_event from public.events e where e.id = r.event_id;

  return query
    select
      (case
         when r.resolved_at is null                then 'waiting'
         when coalesce(r.charged_seconds, 0) > 0   then 'charged'
         else                                           'dropped'
       end)::text,
      r.clip_id,
      coalesce(r.charged_seconds, 0)::integer,
      v_event.used_seconds,
      v_event.budget_seconds;
end;
$$;

comment on function public.commit_reservation(uuid, numeric) is
  'Records a finished take''s real length and settles the event''s queue as far '
  'as it can. Returns charged / dropped / waiting — waiting means an earlier '
  'take is still rolling and this one''s charge is not yet knowable.';


-- ---------------------------------------------------------------------------
-- 6. release_reservation() — and drain whatever that unblocks
-- ---------------------------------------------------------------------------
-- Handing back a hold is one of the two events that can unblock the queue (the
-- other is a commit). Without the walk here, discarding a take would leave
-- everyone who started after it waiting until their expiry.

create or replace function public.release_reservation(p_reservation_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id
    from public.budget_reservations
   where id = p_reservation_id
     and user_id = auth.uid()
     and resolved_at is null;

  if v_event_id is null then
    raise exception 'reservation not found, already settled, or not yours'
      using errcode = 'P0002';
  end if;

  -- Event first, then the row. See commit_reservation for why.
  perform 1 from public.events where id = v_event_id for update;

  update public.budget_reservations
     set charged_seconds = 0,
         resolved_at     = now(),
         settled_at      = coalesce(settled_at, now())
   where id = p_reservation_id
     and resolved_at is null;

  perform public.resolve_takes(v_event_id);

  return public.available_seconds(v_event_id);
end;
$$;


-- ---------------------------------------------------------------------------
-- 7. finish_event() must not end an event mid-queue
-- ---------------------------------------------------------------------------
-- Two guards where there was one, and the first one changes.
--
-- The old test was `remaining_seconds() > 0`, which subtracts live holds — so a
-- member who had merely *started* filming made the budget look spent, and any
-- phone could have ended the event out from under them. That was survivable
-- while a hold was exclusive. It is not now that everyone holds at once.
--
-- So: the budget must genuinely be spent (`available_seconds`), and nothing may
-- still be in flight. The second guard is what stops the event ending while B's
-- take waits behind A's — B's footage would be dropped without ever being
-- considered.

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
  -- budget is the expected case, not an error.
  if v_event.status in ('processing', 'ready') then
    return v_event;
  end if;

  if v_event.status <> 'live' then
    raise exception 'this event has not started' using errcode = 'P0002';
  end if;

  -- Settle anything settleable first, so a queue that is merely *finishable*
  -- does not read as a queue that is still busy.
  perform public.resolve_takes(p_event_id);

  select * into v_event from public.events where id = p_event_id for update;

  if public.available_seconds(p_event_id) > 0 then
    raise exception 'this event still has filming time left' using errcode = 'P0001';
  end if;

  if exists (
    select 1
      from public.budget_reservations r
     where r.event_id = p_event_id
       and r.resolved_at is null
       and (r.committed_at is not null or r.expires_at > now())
  ) then
    raise exception 'a take is still settling' using errcode = 'P0001';
  end if;

  update public.events
     set status = 'processing'
   where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;


-- ---------------------------------------------------------------------------
-- 8. Privileges, RLS and realtime
-- ---------------------------------------------------------------------------

revoke all on function public.available_seconds(uuid) from public, anon;
grant execute on function public.available_seconds(uuid) to authenticated;

revoke all on function public.commit_reservation(uuid, numeric) from public, anon;
grant execute on function public.commit_reservation(uuid, numeric) to authenticated;

-- A phone whose take came back 'waiting' has to find out how it ended, and a
-- dropped take produces no clip row to notice — so the reservation itself is the
-- only signal.
--
-- No new SELECT policy: "reservations: members can read" from the RLS migration
-- already covers this, and covers *every* member's holds rather than only your
-- own — it was written so a client could show "somebody else is filming right
-- now". Realtime honours it, so the channel carries the whole event and the
-- caller filters to itself. Narrowing it here would be a second, redundant
-- policy that could never take effect: policies are OR'd, and the broad one
-- would still win.

-- Whole row on UPDATE, so a resolution arrives with its charge and clip id
-- attached rather than triggering a refetch. Same call events already makes.
alter table public.budget_reservations replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'budget_reservations'
    ) then
      alter publication supabase_realtime add table public.budget_reservations;
    end if;
  end if;
end
$$;
