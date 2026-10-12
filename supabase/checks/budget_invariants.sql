-- Regression checks for the shared-budget rules.
--
-- Run against a freshly reset local database:
--
--   npm run db:reset
--   docker exec -i supabase_db_LEFT psql -U postgres -d postgres -q \
--     < supabase/checks/budget_invariants.sql
--
-- Expected: every section prints the values named in its heading. Sections 12
-- and 14 are meant to raise errors — "permission denied for table events" and
-- "invalid invite code" are passes, not failures.
--
-- The ones that matter most:
--   5      — a live hold does NOT hide budget from anybody else. This is the
--            whole shared-pool promise, and it was broken until the ordering
--            migration: the first person to press record held everything.
--   8      — a client reporting a longer clip than the budget can cover is
--            charged only what is genuinely left, so the pool cannot be
--            overspent however the client lies.
--   22-24  — the conflict rule. When two takes cannot both fit, whoever
--            **started** first wins; commit order is irrelevant.

\set ON_ERROR_STOP off
\pset pager off

-- Start from a known state. The script creates its own users and event, and
-- re-running it without this left duplicates behind that made every unscoped
-- query ambiguous. Deleting the users cascades to their events, members and
-- clips. seed.sql's own event is left alone — it belongs to a different host.
delete from auth.users where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'host@left.test', '', now(), now(), '{}', '{"name":"Dominik"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'guest@left.test', '', now(), now(), '{}', '{"name":"Sam"}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'outsider@left.test', '', now(), now(), '{}', '{"name":"Nosy"}');

\echo ''
\echo '=== 1. Host creates an event, free, 4 people (expect: budget 60) ==='
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false) \g /dev/null
set role authenticated;

-- Through create_event() rather than a raw INSERT: the purchases migration
-- revoked INSERT on public.events from authenticated, so any client minting its
-- own event is exactly what the schema now prevents.
--
-- No purchase row, because four people IS the free tier. Anything larger claims
-- one — see case 27.
--
-- The sixth argument is p_budget_seconds and it may only *shorten* the pool, so
-- it is left out here to take the group's default. budget_plan() derives it,
-- which is why the tier table needs no copy in any other layer.
select public.create_event(
  'Sam & Alex''s Wedding', 'wedding', 'vertical',
  now() + interval '1 day', 4
) is not null as created \g /dev/null

select name, budget_seconds, used_seconds, length(invite_code) as code_len
  from public.events where host_id = '11111111-1111-1111-1111-111111111111';

\echo ''
\echo '=== 2. Host auto-added as member (trigger) ==='
select display_name, role from public.event_members;

-- Capture the code and event id as postgres: a guest reads the code off the
-- invite screen, not out of the database.
reset role;
select invite_code as code, id as eid
  from public.events
 where host_id = '11111111-1111-1111-1111-111111111111'
 order by created_at desc
 limit 1 \gset

\echo ''
\echo '=== 3. Guest joins with the code ==='
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false) \g /dev/null
set role authenticated;
select public.join_event(:'code', 'Sam') is not null as joined;

reset role;
select display_name, role from public.event_members order by role;

\echo ''
\echo '=== 4. Host asks for 40s (expect: 20 granted -- the take cap -- of 60) ==='
-- `remaining_after` is `available_seconds` — budget minus what is SPENT. A hold
-- spends nothing, so it does not move. That is the point of section 5.
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false) \g /dev/null
set role authenticated;
select granted_seconds, remaining_after from public.reserve_budget(:'eid', 40);

\echo ''
\echo '=== 5. Guest asks WHILE the host holds a take -> also 20, and 60 still shown ==='
-- The shared-pool promise. Both members see the same 60s and both may film
-- against it. This used to return 20 (60 - the host's 40), and asking for the
-- whole remainder — which the camera does — returned 0 and told the guest the
-- group was out of time with the film barely started.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false) \g /dev/null
set role authenticated;
select granted_seconds, remaining_after from public.reserve_budget(:'eid', 30);

reset role;
select id as res_host from public.budget_reservations
 where user_id = '11111111-1111-1111-1111-111111111111' and resolved_at is null \gset
select id as res_guest from public.budget_reservations
 where user_id = '22222222-2222-2222-2222-222222222222' and resolved_at is null \gset

\echo ''
\echo '=== 6. The guest stops FIRST, but started second -> waiting ==='
-- Nobody can price this take yet: what it costs depends on how long the host,
-- who started earlier, turns out to run.
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false) \g /dev/null
set role authenticated;
select status, charged_seconds, used_after from public.commit_reservation(:'res_guest', 25.0);

\echo ''
\echo '=== 7. Host commits its 20s hold -> charged 20, AND the guest settles behind ==='
reset role;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false) \g /dev/null
set role authenticated;
select status, charged_seconds from public.commit_reservation(:'res_host', 40.0);
-- Reported 40 against a 20s hold. resolve_takes charges least(ceil(40), 20, room),
-- so the cap binds and an out-of-date client cannot overspend by over-reporting.

\echo ''
\echo '=== 8. Guest held 20s (capped) and filmed 25s -> charged 20, kept not dropped ==='
-- Truncated, not dropped: the seconds the host did not use are still the guest's
-- to have. Reporting 25 against a 20s remainder cannot overspend the group.
reset role;
select charged_seconds, resolved_at is not null as resolved, clip_id is not null as kept
  from public.budget_reservations where id = :'res_guest';

\echo ''
\echo '=== 9. Nothing exceeded the budget (expect: used 40 of 60) ==='
reset role;
select budget_seconds, used_seconds,
       public.remaining_seconds(id) as remaining,
       public.available_seconds(id) as available
  from public.events where id = :'eid';

\echo ''
\echo '=== 10. RLS: outsider sees nothing ==='
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false) \g /dev/null
set role authenticated;
select (select count(*) from public.events) as events,
       (select count(*) from public.clips)  as clips,
       (select count(*) from public.event_members) as members;

\echo ''
\echo '=== 11. RLS: guest sees the event, both clips, both members ==='
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false) \g /dev/null
set role authenticated;
select (select count(*) from public.events) as events,
       (select count(*) from public.clips)  as clips,
       (select count(*) from public.event_members) as members;

\echo ''
\echo '=== 12. Host CANNOT write used_seconds (expect: permission denied) ==='
reset role;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false) \g /dev/null
set role authenticated;
update public.events set used_seconds = 0;

\echo ''
\echo '=== 13. Host CAN rename the film ==='
update public.events set name = 'Renamed Film';
reset role;
select name, used_seconds from public.events where id = :'eid';

\echo ''
\echo '=== 14. Bad invite code is rejected (expect: invalid invite code) ==='
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false) \g /dev/null
set role authenticated;
select public.join_event('BADCODE', 'Nosy');

\echo ''
\echo '=== 15. Expired holds are reclaimed ==='
reset role;
insert into public.budget_reservations (event_id, user_id, seconds, expires_at)
values (:'eid', '11111111-1111-1111-1111-111111111111', 10, now() - interval '1 minute');
update public.events set used_seconds = 40;
select public.remaining_seconds(:'eid') as remaining_ignoring_expired_hold;

reset role;

\echo ''
\echo '=== 16. finish_event refuses while budget remains ==='
-- Section 9 spent the whole budget, so roll a little back to prove the guard.
-- The event must also be 'live': finish_event checks the status FIRST, so
-- without this the call fails on "this event has not started" and the guard
-- this section exists for is never reached. (It was silently doing exactly
-- that.)
reset role;
update public.events
   set used_seconds = used_seconds - 5, status = 'live'
 where id = :'eid';
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false) \g /dev/null
set role authenticated;
select public.finish_event(:'eid') is not null as should_not_get_here;

\echo ''
\echo '=== 17. Budget spent -> finish_event moves live to processing ==='
reset role;
update public.events set status = 'live', used_seconds = budget_seconds where id = :'eid';
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false) \g /dev/null
set role authenticated;
select (public.finish_event(:'eid')).status as after_finish;

\echo ''
\echo '=== 18. finish_event is idempotent (expect: processing again) ==='
select (public.finish_event(:'eid')).status as second_call;

\echo ''
\echo '=== 19. A GUEST who never filmed can compile -> ready ==='
-- The point of the whole ending: it belongs to every member, not just the host.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false) \g /dev/null
set role authenticated;
select (public.compile_film(:'eid')).status as after_compile;

\echo ''
\echo '=== 20. An outsider cannot end anyone else''s event ==='
reset role;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false) \g /dev/null
set role authenticated;
select public.finish_event(:'eid') is not null as should_not_get_here;

\echo ''
\echo '=== 21. Clips are ordered by when recording STARTED ==='
-- recorded_at now comes from the reservation's created_at (when the camera
-- started rolling), not from now() at commit time (when it stopped). Both clips
-- above were held before either was committed, so held-order must equal
-- play-order.
reset role;
select duration_seconds,
       rank() over (order by recorded_at) as play_order
  from public.clips where event_id = :'eid' order by recorded_at;

-- ---------------------------------------------------------------------------
-- The conflict rule, end to end.
-- ---------------------------------------------------------------------------
-- Two members, A always starting before B. These three cases are the whole
-- specification, and none of them can be checked by reading the functions in
-- isolation — they are about ordering across two transactions.
--
--   22.  30s pool, A 10s, B 10s  ->  both kept, 20s used
--   23.  20s pool, A 20s, B 20s  ->  A kept, B dropped entirely
--   24.  25s pool, A 20s, B 12s  ->  A kept at 20s, B kept at its first 5s
--
-- Case 24 is the one that forces the design: B stops filming long before A does,
-- and is still settled after A, because it started second.
--
-- **The pools shrank when max_take_seconds() arrived.** These cases are about
-- ordering, not magnitude, and they need takes that can exhaust the pool — which
-- a 20s cap makes impossible against the 50s pool they used to use. Case 23 with
-- a 50s pool now simply keeps both takes at 20s and proves nothing. Scale the
-- pools with the cap if it ever changes; do not scale the takes past it, or the
-- server will silently truncate them and the case will pass for the wrong reason.

reset role;

create or replace function pg_temp.two_up(p_budget integer) returns uuid
language plpgsql as $$
declare v uuid;
begin
  delete from public.events
   where host_id = '11111111-1111-1111-1111-111111111111'
     and name = 'Ordering';

  /*
    These rows do not go through create_event(): they need a 'live' status and an
    exact budget, neither of which it will accept. The pools here are
    deliberately smaller than any real group's — the whole point is to make a
    single take exhaust one.
  */
  insert into public.events (host_id, name, ends_at, max_members,
                             budget_seconds, status)
  values ('11111111-1111-1111-1111-111111111111', 'Ordering',
          now() + interval '1 day', 4, p_budget, 'live')
  returning id into v;

  insert into public.event_members (event_id, user_id, display_name, role)
  values (v, '22222222-2222-2222-2222-222222222222', 'Sam', 'guest')
  on conflict do nothing;

  return v;
end $$;

create or replace function pg_temp.act_as(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role', 'authenticated')::text, false);
  select null::void;
$$;

\echo ''
\echo '=== 22. A 10s + B 10s of 30s -> both kept, 20 used ==='
select pg_temp.two_up(30) as oid \gset
select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select reservation_id as ra from public.reserve_budget(:'oid', 50) \gset
reset role;
-- A distinct created_at is what "started first" means. Real phones are never
-- this close; the sleep makes the ordering deterministic in a script.
select pg_sleep(0.01) \g /dev/null
select pg_temp.act_as('22222222-2222-2222-2222-222222222222') \g /dev/null
set role authenticated;
select reservation_id as rb from public.reserve_budget(:'oid', 50) \gset
reset role;

\echo 'both were granted the 20s cap, not 20 and then 10 -- a hold hides nothing:'
select (select seconds from public.budget_reservations where id = :'ra') as a_granted,
       (select seconds from public.budget_reservations where id = :'rb') as b_granted;

select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select status, charged_seconds, used_after from public.commit_reservation(:'ra', 10.0);
reset role;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222') \g /dev/null
set role authenticated;
select status, charged_seconds, used_after from public.commit_reservation(:'rb', 10.0);
reset role;
select used_seconds from public.events where id = :'oid';

\echo ''
\echo '=== 23. A 20s + B 20s of 20s -> A kept, B DROPPED (one clip, 20s) ==='
select pg_temp.two_up(20) as oid \gset
select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select reservation_id as ra from public.reserve_budget(:'oid', 50) \gset
reset role;
select pg_sleep(0.01) \g /dev/null
select pg_temp.act_as('22222222-2222-2222-2222-222222222222') \g /dev/null
set role authenticated;
select reservation_id as rb from public.reserve_budget(:'oid', 50) \gset
reset role;

select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select status, charged_seconds from public.commit_reservation(:'ra', 20.0);
reset role;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222') \g /dev/null
set role authenticated;
select status, charged_seconds from public.commit_reservation(:'rb', 20.0);
reset role;
select count(*) as clips, coalesce(sum(duration_seconds), 0) as total, max(used_seconds) as used
  from public.clips c
  join public.events e on e.id = c.event_id
 where c.event_id = :'oid';

\echo ''
\echo '=== 24. A 20s + B 12s of 25s, B STOPS FIRST -> A 20, B truncated to 5 ==='
select pg_temp.two_up(25) as oid \gset
select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select reservation_id as ra from public.reserve_budget(:'oid', 50) \gset
reset role;
select pg_sleep(0.01) \g /dev/null
select pg_temp.act_as('22222222-2222-2222-2222-222222222222') \g /dev/null
set role authenticated;
select reservation_id as rb from public.reserve_budget(:'oid', 50) \gset

\echo 'B stops while A is still rolling (expect: waiting, 0, 0):'
select status, charged_seconds, used_after from public.commit_reservation(:'rb', 12.0);
reset role;

\echo 'A stops (expect: charged 20 -- and this call settles B too):'
select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select status, charged_seconds, used_after from public.commit_reservation(:'ra', 20.0);
reset role;

\echo 'the film: 20s then 5s, in the order they STARTED, 25 used:'
select used_seconds from public.events where id = :'oid';
select duration_seconds,
       (select display_name from public.event_members m
         where m.event_id = c.event_id and m.user_id = c.user_id) as who
  from public.clips c where c.event_id = :'oid' order by recorded_at;

\echo ''
\echo '=== 25. finish_event refuses while somebody is still filming ==='
-- The case: A spends the whole budget while B is mid-take. Every other phone
-- now reads "0 seconds left" and races to end the event — and B, who started
-- before the budget ran out, has a recording that has not been priced yet.
-- Ending here would discard it. `available_seconds` alone cannot see that;
-- the unresolved-reservation guard is what holds the door.
select pg_temp.two_up(20) as oid \gset
select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select reservation_id as ra from public.reserve_budget(:'oid', 20) \gset
reset role;
select pg_sleep(0.01) \g /dev/null
select pg_temp.act_as('22222222-2222-2222-2222-222222222222') \g /dev/null
set role authenticated;
select reservation_id as rb from public.reserve_budget(:'oid', 20) \gset
reset role;

-- A films the lot and stops. B is still rolling.
select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select status, charged_seconds from public.commit_reservation(:'ra', 20.0);

\echo 'nothing left, but B is still filming (expect: 0 available):'
reset role;
select public.available_seconds(:'oid') as available;

\echo 'so the event may not end yet (expect: a take is still settling):'
select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select public.finish_event(:'oid') is not null as should_not_get_here;

\echo 'B stops -> dropped, and now the event can end (expect: processing):'
reset role;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222') \g /dev/null
set role authenticated;
select status, charged_seconds from public.commit_reservation(:'rb', 20.0);
select (public.finish_event(:'oid')).status as after_finish;
reset role;

\echo ''
\echo '=== 26. max_take_seconds() caps a take however rich the group is ==='
-- The cap is a product rule, not a UI convenience: one member must not be able
-- to spend a ten-minute pool on a single hold. Two halves are worth checking
-- separately, because only the first is visible to the client.
--
--   the grant  -- reserve_budget refuses to hand out more than the cap
--   the charge -- resolve_takes truncates a client that reports more than it held
--
-- The second is what makes an out-of-date client harmless. It cannot overspend
-- the group and it cannot write a clip longer than the cap, whatever it claims.
--
-- **One reservation, used for both halves.** Taking a second hold to commit would
-- leave the first one open ahead of it in the queue, and resolve_takes stops at
-- the first take still rolling — so the commit would answer 'waiting' and the
-- section would prove the queue works rather than that the cap does.
select pg_temp.two_up(600) as oid \gset
select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;

select reservation_id as rc, granted_seconds as granted, remaining_after as rem
  from public.reserve_budget(:'oid', 600) \gset

\echo 'asked for the whole 600s pool (expect: granted 20, 600 still available):'
select :'granted' as granted_seconds, :'rem' as remaining_after;

\echo 'an over-reporting client is truncated, not trusted (expect: charged 20):'
select status, charged_seconds from public.commit_reservation(:'rc', 45.0);
reset role;

\echo 'the cap agrees with what the client is told to use (theme.ts must match):'
select public.max_take_seconds() as max_take;

\echo 'and the clip row records the charge, not the claim (expect: 20):'
select duration_seconds from public.clips
 where event_id = :'oid' order by recorded_at desc limit 1;

\echo ''
\echo '=== 27. create_event: the paywall, before the event exists ==='
-- The money is spent at creation, and three things about it are worth holding
-- still:
--
--   * four people or fewer need no purchase at all (case 1 already proved it)
--   * above that, a receipt is required and the CHEAPEST covering one is spent
--   * a spent receipt cannot be spent twice, so the second event is refused
--
-- The claim is `for update skip locked` inside the same transaction as the
-- insert, so a failed insert leaves the purchase unspent rather than burnt.
reset role;

delete from public.purchases
 where user_id = '11111111-1111-1111-1111-111111111111';
delete from public.events
 where host_id = '11111111-1111-1111-1111-111111111111'
   and name in ('Paid Party', 'Second Party');

\echo 'no receipt, 25 people -- creation is REFUSED (expect: P0002 / unsettled):'
select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select public.create_event(
  'Paid Party', 'party', 'vertical', now() + interval '1 day', 25
) is not null as should_not_get_here;
reset role;

-- Two receipts, so the claim has to choose. Only service_role writes these.
insert into public.purchases (
  user_id, product_id, store_transaction_id, max_members, environment, purchased_at
) values
  ('11111111-1111-1111-1111-111111111111', 'left_film_unlock_50',
   'txn-create-b', 50, 'SANDBOX', now() - interval '1 hour'),
  ('11111111-1111-1111-1111-111111111111', 'left_film_unlock_10',
   'txn-create-a', 10, 'SANDBOX', now() - interval '2 hours');

\echo 'with a receipt, 25 people creates fine (expect: t, budget 240):'
select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select public.create_event(
  'Paid Party', 'party', 'vertical', now() + interval '1 day', 25
) is not null as created \g /dev/null
reset role;
select name, max_members, budget_seconds from public.events
 where host_id = '11111111-1111-1111-1111-111111111111' and name = 'Paid Party';

\echo 'and the tier_50 receipt is spent -- the tier_10 does NOT cover 25:'
select store_transaction_id, max_members, consumed_at is not null as spent
  from public.purchases where user_id = '11111111-1111-1111-1111-111111111111'
 order by store_transaction_id;

\echo 'the leftover tier_10 cannot pay for a second 25-person event (expect: P0002):'
select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select public.create_event(
  'Second Party', 'party', 'vertical', now() + interval '1 day', 25
) is not null as should_not_get_here;
reset role;

\echo 'but it does pay for a 10-person one (expect: t, budget 120):'
select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select public.create_event(
  'Second Party', 'party', 'vertical', now() + interval '1 day', 10
) is not null as created \g /dev/null
reset role;
select name, max_members, budget_seconds from public.events
 where host_id = '11111111-1111-1111-1111-111111111111' and name = 'Second Party';

\echo ''
\echo '=== 27b. budget_plan is the ceiling, and only shorter is accepted ==='
-- The whole reason 05.1 can offer a length choice: the plan is the
-- recommendation and the ceiling at once, so a client cannot talk its way into a
-- bigger pool.
reset role;
delete from public.events
 where host_id = '11111111-1111-1111-1111-111111111111'
   and name in ('Shorter', 'Longer');

\echo 'the plan for each group preset (expect: 60, 120, 240, 360, 480, 600):'
select public.budget_plan(4)   as g4,
       public.budget_plan(10)  as g10,
       public.budget_plan(25)  as g25,
       public.budget_plan(50)  as g50,
       public.budget_plan(100) as g100,
       public.budget_plan(200) as g200;

\echo 'a SHORTER pool is accepted (expect: t, budget 30):'
select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select public.create_event(
  'Shorter', 'trip', 'vertical', now() + interval '1 day', 4, 30
) is not null as created \g /dev/null
reset role;
select name, budget_seconds from public.events
 where host_id = '11111111-1111-1111-1111-111111111111' and name = 'Shorter';

\echo 'a LONGER one is refused (expect: P0001):'
select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select public.create_event(
  'Longer', 'trip', 'vertical', now() + interval '1 day', 4, 600
) is not null as should_not_get_here;
reset role;

\echo '=== 28. close_expired_events: a clock may end an event, a client may not ==='
-- The guard `finish_event()` keeps is about distrusting *clients*: a member
-- asking to end is not evidence the group is done. A clock is not a client, so
-- the sweeper is allowed past it — and it must be, or an event whose budget was
-- never exhausted stays 'live' forever and never produces a film.
--
-- The pool is now exactly as long as the playback, so filming the lot is roughly
-- what a party does and exhausting the budget is the ordinary ending. The clock
-- is the backstop for the party that does not.
reset role;
select pg_temp.two_up(60) as oid \gset

\echo 'budget left and the clock has not run out -- a member may NOT end it:'
select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select public.finish_event(:'oid') is not null as should_not_get_here;
reset role;

\echo 'the sweeper leaves it alone too, while ends_at is in the future (expect: 0):'
select public.close_expired_events() as closed;

\echo 'now the ending time passes (expect: 1 closed, status processing):'
update public.events set ends_at = now() - interval '1 minute' where id = :'oid';
select public.close_expired_events() as closed;
select status, budget_seconds, used_seconds from public.events where id = :'oid';

\echo 'and it is idempotent -- nothing is left to close (expect: 0):'
select public.close_expired_events() as closed;

\echo 'an unresolved take is settled BEFORE the status moves, never abandoned:'
select pg_temp.two_up(60) as oid2 \gset
select pg_temp.act_as('11111111-1111-1111-1111-111111111111') \g /dev/null
set role authenticated;
select reservation_id as rd from public.reserve_budget(:'oid2', 20) \gset
select status, charged_seconds from public.commit_reservation(:'rd', 12.0);
reset role;
update public.events set ends_at = now() - interval '1 minute' where id = :'oid2';
select public.close_expired_events() as closed;

\echo 'the take kept its charge through the sweep (expect: processing, used 12):'
select status, used_seconds from public.events where id = :'oid2';
