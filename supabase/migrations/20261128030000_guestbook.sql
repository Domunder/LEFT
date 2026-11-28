-- The guest book (1.3.0, step 9): polaroids and short notes that a moment's
-- members leave for each other.
--
-- Decided with the user (2026-11-28):
--   * an entry is a photo (taken with the selfie camera or picked from the
--     phone), a note of up to 150 characters, or both
--   * entries are visible to every member right away — the guest book is not
--     part of the reveal; only the roll's photos are
--   * three entries per guest (`guestbook_limit()`), and they never touch the roll
--   * the host can switch the guest book off; it is on by default
--
-- An entry's picture lives in the `photos` bucket at
-- `{event_id}/guestbook/{entry_id}.jpg`: under the event's folder, so the
-- retention purge, account deletion and the orphan sweep take it with the
-- photos (`event_storage_paths()` lists by that prefix).
--
-- The doors are the same shape as the roll's: `add_guestbook_entry()` writes
-- the row (pending while its picture is owed), the bucket accepts exactly that
-- row's file, `mark_guestbook_uploaded()` attaches it. Clients never write the
-- table.

alter table public.events
  add column guestbook boolean not null default true;

create function public.guestbook_limit()
returns integer language sql immutable set search_path = ''
as $$ select 3 $$;

create function public.guestbook_note_max()
returns integer language sql immutable set search_path = ''
as $$ select 150 $$;

create table public.guestbook_entries (
  -- Minted on the device, so a retry of the same entry is the same entry.
  id         uuid primary key,
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  note       text check (note is null or char_length(note) between 1 and 150),
  has_photo  boolean not null default false,
  -- 'pending' while a photo entry's file is still owed.
  status     text not null default 'ready' check (status in ('pending', 'ready')),
  width      integer,
  height     integer,
  created_at timestamptz not null default now(),
  check (has_photo or note is not null)
);

create index guestbook_entries_event_idx on public.guestbook_entries (event_id, created_at desc);
create index guestbook_entries_user_idx on public.guestbook_entries (user_id);

alter table public.guestbook_entries enable row level security;

-- Members read what is finished, and their own while it is on its way.
create policy "members read the guest book"
  on public.guestbook_entries for select to authenticated
  using (
    public.is_event_member(event_id, (select auth.uid()))
    and (status = 'ready' or user_id = (select auth.uid()))
  );

revoke all on public.guestbook_entries from anon, authenticated;
grant select on public.guestbook_entries to authenticated;
grant all on public.guestbook_entries to service_role;

-- Where an entry's picture lives. The one place the path is built.
create function public.guestbook_path(p_event_id uuid, p_entry_id uuid)
returns text language sql immutable set search_path = ''
as $$ select p_event_id::text || '/guestbook/' || p_entry_id::text || '.jpg' $$;

-- ---------------------------------------------------------------------------
-- Writing
-- ---------------------------------------------------------------------------

create function public.add_guestbook_entry(
  p_event_id  uuid,
  p_entry_id  uuid,
  p_note      text default null,
  p_has_photo boolean default false
)
returns public.guestbook_entries
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_note  text := nullif(btrim(coalesce(p_note, '')), '');
  v_entry public.guestbook_entries%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_entry_id is null then
    raise exception 'an entry needs an id' using errcode = '22023';
  end if;

  -- The member row is the lock: two entries sent at once are counted in turn.
  perform 1 from public.event_members m
    where m.event_id = p_event_id and m.user_id = v_user
    for update;
  if not found then
    raise exception 'not a member of this event' using errcode = '42501';
  end if;

  -- A retry of an entry that already exists is that entry.
  select * into v_entry from public.guestbook_entries g where g.id = p_entry_id;
  if found then
    if v_entry.user_id <> v_user or v_entry.event_id <> p_event_id then
      raise exception 'an entry needs an id' using errcode = '22023';
    end if;
    return v_entry;
  end if;

  if not (select e.guestbook from public.events e where e.id = p_event_id) then
    raise exception 'the guest book is off' using errcode = 'P0001', hint = 'guestbook_off';
  end if;

  if v_note is null and not coalesce(p_has_photo, false) then
    raise exception 'an entry needs a photo or a note' using errcode = '22023', hint = 'empty';
  end if;

  if char_length(v_note) > public.guestbook_note_max() then
    raise exception 'the note is too long' using errcode = '22023', hint = 'note_too_long';
  end if;

  if (select count(*) from public.guestbook_entries g
       where g.event_id = p_event_id and g.user_id = v_user) >= public.guestbook_limit() then
    raise exception 'the guest book is full for you' using errcode = 'P0001', hint = 'guestbook_full';
  end if;

  insert into public.guestbook_entries (id, event_id, user_id, note, has_photo, status)
  values (p_entry_id, p_event_id, v_user, v_note, coalesce(p_has_photo, false),
          case when coalesce(p_has_photo, false) then 'pending' else 'ready' end)
  returning * into v_entry;

  return v_entry;
end;
$$;

-- The picture is in the bucket: the entry becomes visible. A no-op on an entry
-- that is already there, so a retry is safe.
create function public.mark_guestbook_uploaded(p_entry_id uuid, p_width integer, p_height integer)
returns public.guestbook_entries
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_entry public.guestbook_entries%rowtype;
begin
  select * into v_entry from public.guestbook_entries g
   where g.id = p_entry_id and g.user_id = auth.uid()
   for update;
  if not found then
    raise exception 'entry not found' using errcode = 'P0002', hint = 'not_found';
  end if;

  if v_entry.status = 'ready' then
    return v_entry;
  end if;

  if not exists (
    select 1 from storage.objects o
     where o.bucket_id = 'photos'
       and o.name = public.guestbook_path(v_entry.event_id, v_entry.id)
  ) then
    raise exception 'the picture is not uploaded yet' using errcode = 'P0001', hint = 'not_uploaded';
  end if;

  update public.guestbook_entries g
     set status = 'ready',
         width  = greatest(1, least(coalesce(p_width, 1), 10000)),
         height = greatest(1, least(coalesce(p_height, 1), 10000))
   where g.id = v_entry.id
  returning * into v_entry;

  return v_entry;
end;
$$;

-- Its author takes an entry back; the host removes any. The file is removed by
-- the caller through the storage API first (the bucket's "owner or host can
-- delete" policy); one left behind goes with the event.
create function public.delete_guestbook_entry(p_entry_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  delete from public.guestbook_entries g
   where g.id = p_entry_id
     and (
       g.user_id = v_user
       or exists (select 1 from public.events e where e.id = g.event_id and e.host_id = v_user)
     );
  if not found then
    raise exception 'entry not found' using errcode = 'P0002', hint = 'not_found';
  end if;
end;
$$;

-- On or off, by the host, at any time. Off hides the tab and refuses new
-- entries; what was written stays in the table.
create function public.set_event_guestbook(p_event_id uuid, p_on boolean)
returns public.events
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  update public.events e
     set guestbook = coalesce(p_on, true)
   where e.id = p_event_id and e.host_id = auth.uid()
  returning * into v_event;
  if not found then
    raise exception 'only the host can change this' using errcode = '42501';
  end if;
  return v_event;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports (both stores require a way to flag user content)
-- ---------------------------------------------------------------------------

create table public.guestbook_reports (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid references public.guestbook_entries (id) on delete set null,
  event_id    uuid references public.events (id) on delete set null,
  reporter_id uuid references auth.users (id) on delete set null,
  -- Snapshots, so the report still says what it was about after a deletion.
  author_id   uuid,
  note        text,
  storage_path text,
  reason      text not null default 'unspecified',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolution  text
);

create unique index guestbook_reports_once_idx
  on public.guestbook_reports (entry_id, reporter_id)
  where entry_id is not null and reporter_id is not null;

-- No policy: no client reads or writes it.
alter table public.guestbook_reports enable row level security;
revoke all on public.guestbook_reports from anon, authenticated;
grant all on public.guestbook_reports to service_role;

create function public.report_guestbook_entry(p_entry_id uuid, p_reason text default 'unspecified')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_entry public.guestbook_entries%rowtype;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into v_entry from public.guestbook_entries g where g.id = p_entry_id;

  -- One answer for "does not exist" and "not yours to see".
  if not found
     or v_entry.status <> 'ready'
     or not public.is_event_member(v_entry.event_id, v_user)
  then
    raise exception 'Entry not found' using errcode = 'P0002', hint = 'not_found';
  end if;

  if v_entry.user_id = v_user then
    raise exception 'You cannot report your own entry' using errcode = 'P0001', hint = 'own_entry';
  end if;

  insert into public.guestbook_reports
    (entry_id, event_id, reporter_id, author_id, note, storage_path, reason)
  values
    (v_entry.id, v_entry.event_id, v_user, v_entry.user_id, v_entry.note,
     case when v_entry.has_photo then public.guestbook_path(v_entry.event_id, v_entry.id) end,
     left(coalesce(p_reason, 'unspecified'), 40))
  on conflict (entry_id, reporter_id)
    where entry_id is not null and reporter_id is not null
    do nothing;
end;
$$;

revoke all on function public.add_guestbook_entry(uuid, uuid, text, boolean) from public, anon;
revoke all on function public.mark_guestbook_uploaded(uuid, integer, integer) from public, anon;
revoke all on function public.delete_guestbook_entry(uuid) from public, anon;
revoke all on function public.set_event_guestbook(uuid, boolean) from public, anon;
revoke all on function public.report_guestbook_entry(uuid, text) from public, anon;
grant execute on function public.add_guestbook_entry(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.mark_guestbook_uploaded(uuid, integer, integer) to authenticated;
grant execute on function public.delete_guestbook_entry(uuid) to authenticated;
grant execute on function public.set_event_guestbook(uuid, boolean) to authenticated;
grant execute on function public.report_guestbook_entry(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The bucket
-- ---------------------------------------------------------------------------

-- Members see the guest book's pictures at any time. `objects.name`, never a
-- bare `name`: inside the subquery that would be the event's.
create policy "photos bucket: members read the guest book"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and split_part(objects.name, '/', 2) = 'guestbook'
    and exists (
      select 1 from public.events e
       where e.id::text = split_part(objects.name, '/', 1)
         and public.is_event_member(e.id, (select auth.uid()))
    )
  );

-- An upload must be the picture of the caller's own pending entry, at exactly
-- its path. Once the entry is ready the picture cannot be replaced.
create policy "photos bucket: author uploads a guest book picture"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and exists (
      select 1 from public.guestbook_entries g
       where objects.name = public.guestbook_path(g.event_id, g.id)
         and g.user_id = (select auth.uid())
         and g.status = 'pending'
    )
  );

create policy "photos bucket: author retries a guest book picture"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.guestbook_entries g
       where objects.name = public.guestbook_path(g.event_id, g.id)
         and g.user_id = (select auth.uid())
         and g.status = 'pending'
    )
  )
  with check (
    bucket_id = 'photos'
    and exists (
      select 1 from public.guestbook_entries g
       where objects.name = public.guestbook_path(g.event_id, g.id)
         and g.user_id = (select auth.uid())
         and g.status = 'pending'
    )
  );
