-- LEFT — core schema.
--
-- The whole app hangs off one invariant: an event has a fixed time budget that
-- every member spends from. Two people filming at once must not both be told
-- there is time left. So the budget is never decremented by a client — it moves
-- only through the reserve/commit functions at the bottom of this file, which
-- take a row lock on the event.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.event_type as enum (
  'wedding', 'birthday', 'trip', 'party', 'graduation', 'company', 'other'
);

-- Recording aspect ratio, not device orientation.
create type public.film_format as enum ('vertical', 'horizontal');

create type public.event_status as enum ('setup', 'live', 'processing', 'ready');

create type public.member_role as enum ('host', 'guest');

create type public.clip_status as enum ('pending', 'uploaded', 'failed');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.events (
  id             uuid primary key default gen_random_uuid(),
  host_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 120),
  event_type     public.event_type not null default 'other',
  format         public.film_format not null default 'vertical',
  status         public.event_status not null default 'setup',
  invite_code    text not null unique,
  ends_at        timestamptz not null,
  -- Group-size tier from the pricing table: 4, 10, 25, 50, 100, 150 or 200.
  max_members    integer not null check (max_members between 4 and 200),
  budget_seconds integer not null check (budget_seconds > 0),
  used_seconds   integer not null default 0 check (used_seconds >= 0),
  created_at     timestamptz not null default now(),

  constraint events_used_within_budget check (used_seconds <= budget_seconds)
);

create index events_host_id_idx on public.events (host_id);

create table public.event_members (
  event_id     uuid not null references public.events (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  role         public.member_role not null default 'guest',
  joined_at    timestamptz not null default now(),

  primary key (event_id, user_id)
);

create index event_members_user_id_idx on public.event_members (user_id);

create table public.clips (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events (id) on delete cascade,
  -- Kept when a contributor deletes their account: the clip is part of the film.
  user_id          uuid references auth.users (id) on delete set null,
  storage_path     text,
  duration_seconds numeric(6, 2) not null check (duration_seconds > 0),
  status           public.clip_status not null default 'pending',
  recorded_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index clips_event_recorded_idx on public.clips (event_id, recorded_at);

-- A hold on the shared budget for the duration of one recording.
--
-- Taken when recording starts and settled when it stops. Without this, a client
-- could only report time after the fact — and two phones starting a 30s clip
-- against a 40s remainder would both succeed.
create table public.budget_reservations (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  seconds    integer not null check (seconds > 0),
  created_at timestamptz not null default now(),
  -- A crashed or backgrounded client must not hold budget forever.
  expires_at timestamptz not null,
  settled_at timestamptz
);

create index budget_reservations_active_idx
  on public.budget_reservations (event_id)
  where settled_at is null;

-- ---------------------------------------------------------------------------
-- Invite codes
-- ---------------------------------------------------------------------------

-- 6 characters, no I/O/0/1 — these get read aloud and typed by hand at a party.
--
-- SECURITY DEFINER matters here: this runs as a column default, so it executes
-- as whoever is inserting. Under RLS the collision check would otherwise only
-- see that user's own events and could hand out a code already in use.
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1 .. 6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.events e where e.invite_code = code);
  end loop;
  return code;
end;
$$;

alter table public.events
  alter column invite_code set default public.generate_invite_code();

-- ---------------------------------------------------------------------------
-- Membership helper
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER on purpose: RLS policies on event_members cannot query
-- event_members without recursing. This function reads it with RLS bypassed.
create or replace function public.is_event_member(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.event_members m
     where m.event_id = p_event_id
       and m.user_id = p_user_id
  );
$$;

-- The host is a member of their own event.
create or replace function public.add_host_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select coalesce(u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1), 'Host')
    into v_name
    from auth.users u
   where u.id = new.host_id;

  insert into public.event_members (event_id, user_id, display_name, role)
  values (new.id, new.host_id, v_name, 'host')
  on conflict (event_id, user_id) do nothing;

  return new;
end;
$$;

create trigger events_add_host_as_member
  after insert on public.events
  for each row
  execute function public.add_host_as_member();

-- ---------------------------------------------------------------------------
-- Budget
-- ---------------------------------------------------------------------------

-- Budget minus what is spent minus what is currently held.
create or replace function public.remaining_seconds(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    e.budget_seconds
      - e.used_seconds
      - coalesce((
          select sum(r.seconds)
            from public.budget_reservations r
           where r.event_id = e.id
             and r.settled_at is null
             and r.expires_at > now()
        ), 0)
  )::integer
    from public.events e
   where e.id = p_event_id;
$$;

-- Call on record-start. Grants up to p_seconds, or whatever is actually left —
-- so the caller learns its real cap and can stop the camera at that point.
-- granted_seconds = 0 means the group is out of budget.
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

  -- Serialize concurrent reservations for this event.
  perform 1 from public.events where id = p_event_id for update;

  -- Reclaim budget held by clients that went away.
  update public.budget_reservations
     set settled_at = now()
   where event_id = p_event_id
     and settled_at is null
     and expires_at <= now();

  v_available := public.remaining_seconds(p_event_id);
  v_grant := least(p_seconds, v_available);

  if v_grant <= 0 then
    return query select null::uuid, 0, v_available;
    return;
  end if;

  insert into public.budget_reservations (event_id, user_id, seconds, expires_at)
  values (p_event_id, auth.uid(), v_grant, now() + interval '15 minutes')
  returning id into v_id;

  return query select v_id, v_grant, public.remaining_seconds(p_event_id);
end;
$$;

-- Call on record-stop. Charges the real clip length, creates the clip row, and
-- releases the hold — all in one transaction.
--
-- The charge is capped at what was reserved, so a client reporting a longer
-- duration than it held cannot overspend the group's budget.
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

  insert into public.clips (event_id, user_id, storage_path, duration_seconds, status)
  values (
    r.event_id,
    auth.uid(),
    p_storage_path,
    least(p_actual_seconds, r.seconds),
    (case when p_storage_path is null then 'pending' else 'uploaded' end)::public.clip_status
  )
  returning id into v_clip;

  return query select v_clip, v_charge, public.remaining_seconds(r.event_id);
end;
$$;

-- Call when a recording is discarded — returns the hold without charging.
create or replace function public.release_reservation(p_reservation_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r public.budget_reservations%rowtype;
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

  update public.budget_reservations set settled_at = now() where id = r.id;

  return public.remaining_seconds(r.event_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Joining
-- ---------------------------------------------------------------------------

-- Guests join by code. This is a function rather than a SELECT policy on
-- invite_code so that a guest can resolve exactly one code without being able
-- to enumerate events.
create or replace function public.join_event(p_invite_code text, p_display_name text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_event  public.events%rowtype;
  v_count  integer;
  v_member boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_event
    from public.events
   where invite_code = upper(trim(p_invite_code))
   for update;

  if not found then
    raise exception 'invalid invite code' using errcode = 'P0002';
  end if;

  if v_event.ends_at <= now() then
    raise exception 'this event has already ended' using errcode = 'P0002';
  end if;

  v_member := public.is_event_member(v_event.id, auth.uid());

  if not v_member then
    select count(*) into v_count
      from public.event_members
     where event_id = v_event.id;

    if v_count >= v_event.max_members then
      raise exception 'this group is full' using errcode = 'P0002';
    end if;
  end if;

  insert into public.event_members (event_id, user_id, display_name, role)
  values (v_event.id, auth.uid(), p_display_name, 'guest')
  on conflict (event_id, user_id)
    do update set display_name = excluded.display_name;

  return v_event.id;
end;
$$;
