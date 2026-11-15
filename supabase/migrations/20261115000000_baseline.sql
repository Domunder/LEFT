-- LEFT — baseline schema.
--
-- A disposable camera for events. Three invariants hold the product together,
-- and all three live here rather than in the app:
--
--   1. THE ROLL. Every guest gets the same number of shots. A shot is claimed
--      through claim_shot(), which counts under a row lock. A client never
--      decrements anything.
--   2. THE REVEAL. Until an event is developed, a member can read only their own
--      photos — rows and files. This is RLS, not a hidden screen.
--   3. THE PRICE. Free up to 100 guests and a 36 roll; one purchase unlocks the
--      unlimited roll and groups up to 200. create_event() decides, not a client.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.event_type as enum (
  'wedding', 'birthday', 'trip', 'party', 'graduation', 'company', 'other'
);

-- The film stock the host loads. One per event, baked into each JPEG on the
-- device at capture — the server never processes pixels.
create type public.film_look as enum ('golden', 'chrome', 'faded', 'mono');

-- setup: guests gather. live: cameras open. developed: everyone sees everything.
create type public.event_status as enum ('setup', 'live', 'developed');

create type public.member_role as enum ('host', 'guest');

create type public.photo_status as enum ('pending', 'uploaded', 'failed');

-- ---------------------------------------------------------------------------
-- The numbers the product is made of. One place each.
-- ---------------------------------------------------------------------------

-- The largest group that costs nothing.
create function public.free_max_members() returns integer
language sql immutable set search_path = '' as $$ select 100 $$;

-- The largest group at all.
create function public.max_event_members() returns integer
language sql immutable set search_path = '' as $$ select 200 $$;

-- What "unlimited" means per guest. A fair-use ceiling, so one phone cannot use
-- an event as free storage; far above anything a party produces.
create function public.unlimited_roll_cap() returns integer
language sql immutable set search_path = '' as $$ select 150 $$;

-- How far ahead an event may end. Long enough for a trip.
create function public.max_event_days() returns integer
language sql immutable set search_path = '' as $$ select 31 $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.events (
  id           uuid primary key default gen_random_uuid(),
  host_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  event_type   public.event_type not null default 'other',
  look         public.film_look not null default 'golden',
  status       public.event_status not null default 'setup',
  invite_code  text not null unique,
  ends_at      timestamptz not null,
  -- A hard cap: join_event() refuses past it. It is also the price boundary.
  max_members  integer not null check (max_members between 2 and 200),
  -- Shots per guest. NULL is the unlimited roll.
  roll_size    integer check (roll_size in (5, 10, 16, 24, 36)),
  developed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index events_host_id_idx on public.events (host_id);
create index events_open_ends_at_idx on public.events (ends_at) where status <> 'developed';

create table public.event_members (
  event_id     uuid not null references public.events (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  role         public.member_role not null default 'guest',
  -- Frames exposed. Written only by claim_shot(); never refunded — a disposable
  -- camera does not give a frame back.
  shots_taken  integer not null default 0 check (shots_taken >= 0),
  joined_at    timestamptz not null default now(),

  primary key (event_id, user_id)
);

create index event_members_user_id_idx on public.event_members (user_id);

-- One exposed frame. The id is minted by the client *before* the claim, which
-- makes the claim idempotent and the storage path knowable up front:
--   photos/{event_id}/{user_id}/{id}.jpg  and  …/{id}_thumb.jpg
create table public.photos (
  id           uuid primary key,
  event_id     uuid not null references public.events (id) on delete cascade,
  -- Kept when a contributor deletes their account: the picture is part of the
  -- group's film. (Revisit with the legal review — see docs/MILESTONES.md, M6.)
  user_id      uuid references auth.users (id) on delete set null,
  -- A print-capable original and a grid thumbnail. Null until the upload lands.
  storage_path text,
  thumb_path   text,
  width        integer check (width > 0),
  height       integer check (height > 0),
  status       public.photo_status not null default 'pending',
  -- When the shutter fired on the device, not when the row was written.
  taken_at     timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index photos_event_taken_idx on public.photos (event_id, taken_at);
create index photos_user_idx on public.photos (user_id);

-- The ledger of store purchases. RevenueCat validates a receipt but does not
-- track whether a consumable was *spent*; this table does.
create table public.purchases (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  product_id           text not null,
  store_transaction_id text not null unique,
  -- What the purchase covers. One SKU today, so always max_event_members().
  max_members          integer not null check (max_members between 2 and 200),
  environment          text not null check (environment in ('PRODUCTION', 'SANDBOX')),
  store                text,
  price_cents          integer,
  currency             text,
  purchased_at         timestamptz not null,
  created_at           timestamptz not null default now(),
  consumed_at          timestamptz,
  consumed_by_event_id uuid references public.events (id) on delete set null,

  -- Pointing at an event means spent. The reverse is allowed: deleting an event
  -- nulls the reference and leaves a spent purchase, which is what happened.
  constraint purchases_consumed_together
    check (consumed_by_event_id is null or consumed_at is not null)
);

create index purchases_unconsumed_idx on public.purchases (user_id) where consumed_at is null;

create unique index purchases_one_per_event_idx
  on public.purchases (consumed_by_event_id)
  where consumed_by_event_id is not null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- 6 characters, no I/O/0/1. SECURITY DEFINER because it runs as a column
-- default: under RLS the collision check would only see the caller's own events.
create function public.generate_invite_code()
returns text
language plpgsql volatile security definer set search_path = ''
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

-- SECURITY DEFINER on purpose: a policy on event_members cannot query
-- event_members without recursing.
create function public.is_event_member(p_event_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.event_members m
     where m.event_id = p_event_id and m.user_id = p_user_id
  );
$$;

-- THE REVEAL, in one predicate. True by status *or by the clock*, so the film
-- develops at ends_at to the second whether or not the scheduled job has run
-- yet; the job only exists to flip the status so realtime can tell the phones.
create function public.is_event_developed(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
     where e.id = p_event_id
       and (e.status = 'developed' or e.ends_at <= now())
  );
$$;

-- The product id the stores sell, and what it covers. NULL for anything else,
-- which is how the webhook knows to ignore a product that is not ours.
create function public.unlock_max_members(p_product_id text)
returns integer
language sql immutable set search_path = ''
as $$
  select case p_product_id when 'left_unlimited' then 200 else null end;
$$;

-- The host is a member of their own event.
create function public.add_host_as_member()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  select coalesce(
           nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
           nullif(split_part(u.email, '@', 1), ''),
           'Host'
         )
    into v_name
    from auth.users u
   where u.id = new.host_id;

  insert into public.event_members (event_id, user_id, display_name, role)
  values (new.id, new.host_id, coalesce(v_name, 'Host'), 'host')
  on conflict (event_id, user_id) do nothing;

  return new;
end;
$$;

create trigger events_add_host_as_member
  after insert on public.events
  for each row execute function public.add_host_as_member();

-- ---------------------------------------------------------------------------
-- Creating
-- ---------------------------------------------------------------------------

-- The only way an event comes to exist: INSERT on events is not granted.
--
-- p_roll_size is one of 5, 10, 16, 24, 36, or NULL for the unlimited roll.
-- An event needs a purchase when the roll is unlimited or the group is larger
-- than free_max_members(). The purchase is claimed `for update skip locked` in
-- the same transaction as the insert, so it cannot be spent twice and a failed
-- insert burns nothing. p_transaction_id only breaks ties toward the receipt
-- just bought; it is never proof of payment.
create function public.create_event(
  p_name           text,
  p_event_type     public.event_type,
  p_look           public.film_look,
  p_ends_at        timestamptz,
  p_max_members    integer,
  p_roll_size      integer,
  p_transaction_id text default null
)
returns public.events
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_anonymous boolean;
  v_purchase  public.purchases%rowtype;
  v_event     public.events%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- The column, not auth.jwt(): the token is stale until the session refreshes.
  select u.is_anonymous into v_anonymous from auth.users u where u.id = v_user;

  if coalesce(v_anonymous, false) then
    raise exception 'hosting an event requires a full account'
      using errcode = '42501', hint = 'anonymous';
  end if;

  if p_ends_at <= now() then
    raise exception 'that ending time has already passed' using errcode = 'P0001';
  end if;

  if p_ends_at > now() + make_interval(days => public.max_event_days()) then
    raise exception 'an event can run for at most % days', public.max_event_days()
      using errcode = 'P0001';
  end if;

  if p_max_members is null or p_max_members < 2 or p_max_members > public.max_event_members() then
    raise exception 'invalid group size' using errcode = '22023';
  end if;

  if p_roll_size is not null and p_roll_size not in (5, 10, 16, 24, 36) then
    raise exception 'invalid roll size' using errcode = '22023';
  end if;

  if p_roll_size is null or p_max_members > public.free_max_members() then
    select * into v_purchase
      from public.purchases
     where user_id = v_user
       and consumed_at is null
       and max_members >= p_max_members
     order by (store_transaction_id is distinct from p_transaction_id), purchased_at
     for update skip locked
     limit 1;

    if not found then
      raise exception 'no unspent purchase covers this event'
        using errcode = 'P0002', hint = 'unsettled';
    end if;
  end if;

  insert into public.events (host_id, name, event_type, look, ends_at, max_members, roll_size)
  values (v_user, trim(p_name), p_event_type, p_look, p_ends_at, p_max_members, p_roll_size)
  returning * into v_event;

  if v_purchase.id is not null then
    update public.purchases
       set consumed_at = now(), consumed_by_event_id = v_event.id
     where id = v_purchase.id;
  end if;

  return v_event;
end;
$$;

-- ---------------------------------------------------------------------------
-- Joining
-- ---------------------------------------------------------------------------

-- Guests join by code. A function rather than a policy on invite_code, so a
-- code resolves exactly one event and nobody can enumerate the rest.
--
-- Joining stays open after the event is developed: the same link that let
-- someone shoot lets a latecomer see the album. The cap applies either way.
create function public.join_event(p_invite_code text, p_display_name text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_name  text := trim(coalesce(p_display_name, ''));
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if char_length(v_name) not between 1 and 60 then
    raise exception 'a name is required' using errcode = '22023';
  end if;

  -- The lock serialises joins, which is what makes the cap a cap.
  select * into v_event
    from public.events
   where invite_code = upper(trim(p_invite_code))
   for update;

  if not found then
    raise exception 'invalid invite code' using errcode = 'P0002';
  end if;

  if not public.is_event_member(v_event.id, auth.uid()) then
    select count(*) into v_count from public.event_members where event_id = v_event.id;

    if v_count >= v_event.max_members then
      raise exception 'this group is full' using errcode = 'P0002', hint = 'full';
    end if;
  end if;

  insert into public.event_members (event_id, user_id, display_name, role)
  values (v_event.id, auth.uid(), v_name, 'guest')
  on conflict (event_id, user_id) do update set display_name = excluded.display_name;

  return v_event.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Starting and ending
-- ---------------------------------------------------------------------------

-- setup -> live. Host only; a second call is a no-op.
create function public.start_event(p_event_id uuid)
returns public.events
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_event from public.events where id = p_event_id for update;

  if not found then
    raise exception 'no such event' using errcode = 'P0002';
  end if;

  if v_event.host_id <> auth.uid() then
    raise exception 'only the host can start this event' using errcode = '42501';
  end if;

  if v_event.status = 'live' and v_event.ends_at > now() then
    return v_event;
  end if;

  if v_event.status <> 'setup' or v_event.ends_at <= now() then
    raise exception 'this event has already ended' using errcode = 'P0002';
  end if;

  update public.events set status = 'live' where id = p_event_id returning * into v_event;
  return v_event;
end;
$$;

-- The host develops the film early. Irreversible, and it ends the event for
-- everyone: ends_at is pulled in so the clock and the status agree.
create function public.end_event(p_event_id uuid)
returns public.events
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_event from public.events where id = p_event_id for update;

  if not found then
    raise exception 'no such event' using errcode = 'P0002';
  end if;

  if v_event.host_id <> auth.uid() then
    raise exception 'only the host can end this event' using errcode = '42501';
  end if;

  if v_event.status = 'developed' then
    return v_event;
  end if;

  update public.events
     set status = 'developed',
         developed_at = now(),
         ends_at = least(ends_at, now())
   where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;

-- The clock develops everything else. Scheduled, never called by a client.
create function public.develop_expired_events()
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.events
     set status = 'developed', developed_at = now()
   where status <> 'developed'
     and ends_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- The roll
-- ---------------------------------------------------------------------------

-- Expose one frame. Call when the shutter fires, before uploading anything.
--
-- p_photo_id is minted on the device. Calling again with the same id returns
-- the same answer and spends nothing, so a retry on bad venue Wi-Fi cannot burn
-- two frames. shots_left is NULL on an unlimited roll.
--
-- Fails with hint 'roll_empty' when the roll is used up and 'event_closed' when
-- the cameras are not open.
create function public.claim_shot(
  p_event_id uuid,
  p_photo_id uuid,
  p_taken_at timestamptz default now()
)
returns table (photo_id uuid, shots_taken integer, shots_left integer)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_event    public.events%rowtype;
  v_member   public.event_members%rowtype;
  v_existing public.photos%rowtype;
  v_limit    integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_photo_id is null then
    raise exception 'a photo id is required' using errcode = '22023';
  end if;

  -- The member row is the lock: it serialises one guest's shots without making
  -- two hundred phones queue behind a single event row.
  select * into v_member
    from public.event_members m
   where m.event_id = p_event_id and m.user_id = v_user
   for update;

  if not found then
    raise exception 'not a member of this event' using errcode = '42501';
  end if;

  select * into v_event from public.events e where e.id = p_event_id;

  v_limit := coalesce(v_event.roll_size, public.unlimited_roll_cap());

  select * into v_existing from public.photos p where p.id = p_photo_id;

  if found then
    if v_existing.user_id is distinct from v_user or v_existing.event_id <> p_event_id then
      raise exception 'that photo id is already in use' using errcode = '23505';
    end if;

    return query select
      p_photo_id,
      v_member.shots_taken,
      case when v_event.roll_size is null then null::integer
           else greatest(0, v_limit - v_member.shots_taken) end;
    return;
  end if;

  if v_event.status <> 'live' or v_event.ends_at <= now() then
    raise exception 'the cameras are not open' using errcode = 'P0001', hint = 'event_closed';
  end if;

  if v_member.shots_taken >= v_limit then
    raise exception 'the roll is empty' using errcode = 'P0001', hint = 'roll_empty';
  end if;

  insert into public.photos (id, event_id, user_id, taken_at)
  values (
    p_photo_id, p_event_id, v_user,
    -- A device clock is a hint, not a fact: keep it inside the event.
    least(greatest(coalesce(p_taken_at, now()), v_event.created_at), now())
  );

  update public.event_members m
     set shots_taken = m.shots_taken + 1
   where m.event_id = p_event_id and m.user_id = v_user
  returning * into v_member;

  return query select
    p_photo_id,
    v_member.shots_taken,
    case when v_event.roll_size is null then null::integer
         else greatest(0, v_limit - v_member.shots_taken) end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Account deletion
-- ---------------------------------------------------------------------------

-- Called by the delete-account edge function (service_role) right before the
-- auth.users row goes. Reports every storage object under the events this user
-- hosts — those events cascade away and no foreign key reaches into the bucket —
-- and hands back any purchase that paid for one of them.
create function public.prepare_account_deletion(p_user_id uuid)
returns table (hosted_event_ids uuid[], photo_paths text[])
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_events uuid[];
  v_paths  text[];
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'you may only delete your own account' using errcode = '42501';
  end if;

  select coalesce(array_agg(e.id), '{}') into v_events
    from public.events e where e.host_id = p_user_id;

  select coalesce(array_agg(paths.path), '{}') into v_paths
    from (
      select p.storage_path as path from public.photos p
       where p.event_id = any(v_events) and p.storage_path is not null
      union all
      select p.thumb_path from public.photos p
       where p.event_id = any(v_events) and p.thumb_path is not null
    ) paths;

  update public.purchases
     set consumed_at = null, consumed_by_event_id = null
   where consumed_by_event_id = any(v_events);

  return query select v_events, v_paths;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.events        enable row level security;
alter table public.event_members enable row level security;
alter table public.photos        enable row level security;
alter table public.purchases     enable row level security;

-- Anonymous guests carry the `authenticated` role, so every policy below
-- applies to them as written.

create policy "events: members can read"
  on public.events for select to authenticated
  using (public.is_event_member(id, (select auth.uid())));

create policy "events: host can rename"
  on public.events for update to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

create policy "events: host can delete"
  on public.events for delete to authenticated
  using (host_id = (select auth.uid()));

create policy "members: members can read the roster"
  on public.event_members for select to authenticated
  using (public.is_event_member(event_id, (select auth.uid())));

create policy "members: rename yourself"
  on public.event_members for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "members: guests leave, hosts remove guests"
  on public.event_members for delete to authenticated
  using (
    role = 'guest'
    and (
      user_id = (select auth.uid())
      or exists (
        select 1 from public.events e
         where e.id = event_members.event_id and e.host_id = (select auth.uid())
      )
    )
  );

-- THE REVEAL. Your own frames always; everyone's once the film is developed.
create policy "photos: own always, everyone's once developed"
  on public.photos for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      public.is_event_member(event_id, (select auth.uid()))
      and public.is_event_developed(event_id)
    )
  );

create policy "photos: owner attaches the upload"
  on public.photos for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Moderation: the host may remove any picture from their event.
create policy "photos: owner or host can delete"
  on public.photos for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.events e
       where e.id = photos.event_id and e.host_id = (select auth.uid())
    )
  );

create policy "purchases: owner can read"
  on public.purchases for select to authenticated
  using (user_id = (select auth.uid()));

-- Column-level grants are the second lock. No INSERT on events (create_event is
-- the door), no INSERT on photos (claim_shot is), and nobody writes status,
-- ends_at, roll_size, max_members or shots_taken from a client.
revoke all on public.events, public.event_members, public.photos, public.purchases
  from anon, authenticated;

grant select, delete on public.events to authenticated;
grant update (name) on public.events to authenticated;

grant select, delete on public.event_members to authenticated;
grant update (display_name) on public.event_members to authenticated;

grant select, delete on public.photos to authenticated;
grant update (storage_path, thumb_path, width, height, status) on public.photos to authenticated;

grant select on public.purchases to authenticated;

-- Functions: nothing for anon, and the service-only ones for nobody else.
revoke all on all functions in schema public from public, anon, authenticated;

grant execute on function public.generate_invite_code() to authenticated;
grant execute on function public.is_event_member(uuid, uuid) to authenticated;
grant execute on function public.is_event_developed(uuid) to authenticated;
grant execute on function public.free_max_members() to authenticated;
grant execute on function public.max_event_members() to authenticated;
grant execute on function public.unlimited_roll_cap() to authenticated;
grant execute on function public.max_event_days() to authenticated;
grant execute on function public.create_event(
  text, public.event_type, public.film_look, timestamptz, integer, integer, text
) to authenticated;
grant execute on function public.join_event(text, text) to authenticated;
grant execute on function public.start_event(uuid) to authenticated;
grant execute on function public.end_event(uuid) to authenticated;
grant execute on function public.claim_shot(uuid, uuid, timestamptz) to authenticated;

-- service_role is bypassrls but still needs EXECUTE.
grant execute on function public.unlock_max_members(text) to service_role;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
grant execute on function public.develop_expired_events() to service_role;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

-- Private. Paths are photos/{event_id}/{user_id}/{photo_id}.jpg (+ _thumb.jpg).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 15728640, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- THE REVEAL again, for the files: the same rule as the rows.
create policy "photos bucket: own always, everyone's once developed"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or (
        public.is_event_member(
          nullif((storage.foldername(name))[1], '')::uuid, (select auth.uid())
        )
        and public.is_event_developed(nullif((storage.foldername(name))[1], '')::uuid)
      )
    )
  );

-- An upload must belong to a frame this user actually claimed. Without the
-- photos lookup the roll would limit rows while the bucket took anything.
create policy "photos bucket: upload a claimed frame into your own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1 from public.photos p
       where p.user_id = (select auth.uid())
         and p.event_id = nullif((storage.foldername(name))[1], '')::uuid
         and storage.filename(name) in (p.id::text || '.jpg', p.id::text || '_thumb.jpg')
    )
  );

create policy "photos bucket: owner can replace their upload"
  on storage.objects for update to authenticated
  using (bucket_id = 'photos' and owner_id = (select auth.uid())::text);

create policy "photos bucket: owner or host can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and (
      owner_id = (select auth.uid())::text
      or exists (
        select 1 from public.events e
         where e.id = nullif((storage.foldername(name))[1], '')::uuid
           and e.host_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- events: status changes (start, develop). event_members: the roster and each
-- guest's shots_taken. photos is deliberately absent — nothing may announce a
-- picture before the reveal, and after it the album simply reads.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.events;
    alter publication supabase_realtime add table public.event_members;
  end if;
end
$$;

alter table public.events        replica identity full;
alter table public.event_members replica identity full;

-- ---------------------------------------------------------------------------
-- The clock
-- ---------------------------------------------------------------------------

-- Every minute. Visibility does not wait for this (see is_event_developed);
-- it exists so `status` flips and realtime carries the reveal to open apps.
do $$
begin
  create extension if not exists pg_cron;

  if exists (select 1 from cron.job where jobname = 'develop-expired-events') then
    perform cron.unschedule('develop-expired-events');
  end if;

  perform cron.schedule(
    'develop-expired-events',
    '* * * * *',
    $cron$select public.develop_expired_events()$cron$
  );
exception
  when others then
    raise notice
      'pg_cron unavailable (%): develop_expired_events() exists but nothing calls it. '
      'Photos still become visible at ends_at; open apps will not be told.', sqlerrm;
end;
$$;
