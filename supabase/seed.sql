-- Local development seed.
--
-- Run by `npm run db:reset` (config.toml [db.seed] already points here). Never
-- runs against a hosted project — `db reset` is local-only.
--
-- What it exists for: the host path needs Google or Apple, and neither works in
-- Expo Go. Sign-up's "Skip sign-in (dev)" button covers creating an event, but a
-- group of one is a poor test of a screen about a *group* — 10's roster, the
-- shared budget, and the camera's realtime bar all only show their real
-- behaviour with more than one member in the event.
--
-- So this seeds an event that already has people in it. Its members are real
-- auth.users rows rather than bare uuids, because every RLS policy keys off
-- auth.uid() and a membership pointing at a nonexistent user would read as
-- corrupt data the moment anything joined against it.
--
-- The event is free-tier (4 people, 60s) so nothing here depends on a purchase.

-- ---------------------------------------------------------------------------
-- Identities
-- ---------------------------------------------------------------------------
-- Fixed uuids so a reset is reproducible and these rows can be referenced below.
-- `devhost@left.local` is a plain email user: it is the one identity you may
-- want to sign in as deliberately, and an anonymous row cannot be signed into.
-- The guests are anonymous, which is what a real guest is.

insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_anonymous
)
values
  (
    '2252058e-dc4d-4f3f-ae4d-59c16cafe35c',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'devhost@left.local',
    crypt('devpassword', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Marcus"}',
    now(), now(), false
  ),
  (
    'cccccccc-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', null,
    null, null,
    '{"provider":"anonymous","providers":["anonymous"]}',
    '{"name":"Yuki"}',
    now(), now(), true
  ),
  (
    'cccccccc-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', null,
    null, null,
    '{"provider":"anonymous","providers":["anonymous"]}',
    '{"name":"Priya"}',
    now(), now(), true
  )
on conflict (id) do nothing;

-- The email identity, so devhost@left.local can actually be signed in as.
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, created_at, updated_at
)
values (
  '2252058e-dc4d-4f3f-ae4d-59c16cafe35c',
  '2252058e-dc4d-4f3f-ae4d-59c16cafe35c',
  '2252058e-dc4d-4f3f-ae4d-59c16cafe35c',
  'email',
  '{"sub":"2252058e-dc4d-4f3f-ae4d-59c16cafe35c","email":"devhost@left.local","email_verified":true}',
  now(), now()
)
on conflict (provider, provider_id) do nothing;

-- ---------------------------------------------------------------------------
-- The event
-- ---------------------------------------------------------------------------
-- Inserted directly rather than through create_event(), which needs an
-- auth.uid() there is no session for here. (Four people is the free tier, so a
-- purchase is not what stands in the way.) A fixed
-- invite_code means the join link is stable across resets:
--
--     https://leftmoment.com/j/DEV123   ->  screen 11
--
-- `ends_at` is relative to now() so a reset never produces an already-expired
-- event, which start_event() would refuse outright.

insert into public.events (
  id, host_id, name, event_type, format,
  invite_code, max_members, budget_seconds, used_seconds,
  status, ends_at
)
values (
  'bbbbbbbb-0000-4000-8000-000000000001',
  '2252058e-dc4d-4f3f-ae4d-59c16cafe35c',
  'Summer Trip', 'trip', 'vertical',
  -- 4 people -> budget_plan() gives 60 seconds, shared between all of them.
  -- Stated rather than left to the column default, which only matches by
  -- coincidence.
  'DEV123', 4, 60, 0,
  'setup', now() + interval '3 days'
)
on conflict (id) do update set
  status       = 'setup',
  used_seconds = 0,
  ends_at      = now() + interval '3 days';

-- The roster. Three members, against an estimate of four — 10 shows a group that
-- is filling up. The estimate is no longer a limit: join_event admits anyone with
-- the code, and max_members only sizes the budget and prices the event.
insert into public.event_members (event_id, user_id, display_name, role)
values
  ('bbbbbbbb-0000-4000-8000-000000000001', '2252058e-dc4d-4f3f-ae4d-59c16cafe35c', 'Marcus', 'host'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000002', 'Yuki',   'guest'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000003', 'Priya',  'guest')
on conflict (event_id, user_id) do nothing;
