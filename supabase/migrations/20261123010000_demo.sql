-- The demo (2026-11-23, the user): "try LEFT" from the website.
--
-- leftmoment.com/j/TRYLEFT is not an invite. A client that meets that code
-- signs in anonymously and calls start_demo(), which hands the caller a moment
-- of their own: live, a roll of five, and already holding the photos of a few
-- sample guests — blurred until the caller develops it, exactly as a real
-- moment would be. The caller is the host, so the existing end_event() is
-- their "Develop now" and every existing policy already fits.
--
-- The sample guests and their pictures live in ONE template event. Its guests
-- are real (anonymous) users that joined and uploaded through the normal
-- doors (web/scripts/seed-demo.mjs). A visitor's demo copies the roster and
-- the photo ROWS; the files are not copied — the rows point at the template's
-- files, and one storage policy lets any signed-in user read that folder
-- (licensed stock pictures, nothing private).
--
--   events.demo            null (a real moment) | 'template' | 'visitor'
--   demo_template_id()     the one template
--   start_demo()           the door
--
-- A visitor's demo is deleted a week after it was developed (it develops by
-- the clock after 24 hours at the latest); the template never is. Demos send
-- no notifications.

alter table public.events
  add column demo text check (demo in ('template', 'visitor'));

create unique index events_one_demo_template_idx
  on public.events (demo) where demo = 'template';

create index events_demo_host_idx
  on public.events (host_id, created_at desc) where demo = 'visitor';

-- How long a developed demo is kept, how long a demo runs, how many a user may
-- start in a day.
create function public.demo_retention() returns interval
language sql immutable set search_path = '' as $$ select interval '7 days' $$;

create function public.demo_length() returns interval
language sql immutable set search_path = '' as $$ select interval '24 hours' $$;

create function public.demo_daily_limit() returns integer
language sql immutable set search_path = '' as $$ select 5 $$;

create function public.demo_template_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select e.id from public.events e where e.demo = 'template' limit 1;
$$;

-- ---------------------------------------------------------------------------
-- The template: a host nobody can sign in as, and an empty event that the
-- seed script fills. max_members is the host plus the script's four guests,
-- so once they are in, join_event() refuses everyone else ('full').
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_anonymous,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  'de300000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', null,
  null, null,
  '{"provider":"demo","providers":[]}',
  '{"name":"LEFT"}',
  now(), now(), false,
  '', '', '', ''
)
on conflict (id) do nothing;

insert into public.events (
  id, host_id, name, event_type, look, status, invite_code,
  ends_at, max_members, roll_size, demo
)
values (
  'de300000-0000-4000-8000-0000000000e0',
  'de300000-0000-4000-8000-000000000001',
  'Lea’s birthday', 'birthday', 'golden', 'live', 'LEFTDEMPLATE',
  timestamptz '2099-01-01 00:00:00+00', 5, null, 'template'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The door
-- ---------------------------------------------------------------------------

-- Returns the caller's demo: the one still running, or the one they developed
-- within the last hour (so reopening the link shows its album), else a new
-- one. Refuses with hint 'demo_limit' past demo_daily_limit() a day and
-- 'demo_unavailable' while the template has no photos.
create function public.start_demo(p_display_name text default null)
returns public.events
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_template public.events%rowtype;
  v_name     text := left(nullif(btrim(coalesce(p_display_name, '')), ''), 60);
  v_event    public.events%rowtype;
  v_guests   integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- One at a time per user: two taps must not make two demos.
  perform pg_advisory_xact_lock(hashtextextended('start_demo:' || v_user::text, 0));

  select * into v_event
    from public.events e
   where e.host_id = v_user
     and e.demo = 'visitor'
     and (
       (e.status <> 'developed' and e.ends_at > now())
       or coalesce(e.developed_at, e.ends_at) > now() - interval '1 hour'
     )
   order by e.created_at desc
   limit 1;
  if found then
    return v_event;
  end if;

  select * into v_template from public.events e where e.demo = 'template' limit 1;
  if not found or not exists (
       select 1 from public.photos p
        where p.event_id = v_template.id and p.status = 'uploaded'
     ) then
    raise exception 'the demo is not set up' using errcode = 'P0002', hint = 'demo_unavailable';
  end if;

  if (select count(*) from public.events e
       where e.host_id = v_user
         and e.demo = 'visitor'
         and e.created_at > now() - interval '24 hours') >= public.demo_daily_limit() then
    raise exception 'too many demos today' using errcode = 'P0001', hint = 'demo_limit';
  end if;

  select count(*) into v_guests
    from public.event_members m
   where m.event_id = v_template.id and m.role = 'guest';

  insert into public.events (
    host_id, name, event_type, look, status, ends_at, max_members, roll_size, cover, demo
  )
  values (
    v_user, v_template.name, v_template.event_type, v_template.look, 'live',
    now() + public.demo_length(), greatest(2, v_guests + 1), 5,
    case when v_template.cover ~ '^sample-' then v_template.cover end, 'visitor'
  )
  returning * into v_event;

  -- events_add_host_as_member has put the caller on the roster as 'Host'.
  update public.event_members m
     set display_name = coalesce(v_name, 'You')
   where m.event_id = v_event.id and m.user_id = v_user;

  insert into public.event_members (event_id, user_id, display_name, role, shots_taken)
  select v_event.id, m.user_id, m.display_name, 'guest',
         (select count(*) from public.photos p
           where p.event_id = v_template.id and p.user_id = m.user_id and p.status = 'uploaded')
    from public.event_members m
   where m.event_id = v_template.id and m.role = 'guest'
  on conflict (event_id, user_id) do nothing;

  -- The rows, not the files: the paths stay the template's. Spread over the
  -- last hour, in the template's order, so the gallery reads as a party that
  -- is already going.
  insert into public.photos (
    id, event_id, user_id, storage_path, thumb_path, width, height, blurhash, status, taken_at
  )
  select gen_random_uuid(), v_event.id, s.user_id, s.storage_path, s.thumb_path,
         s.width, s.height, s.blurhash, 'uploaded',
         now() - make_interval(mins => (5 * (s.total - s.rn + 1))::integer)
    from (
      select p.*,
             row_number() over (order by p.taken_at, p.id) as rn,
             count(*) over () as total
        from public.photos p
       where p.event_id = v_template.id
         and p.status = 'uploaded'
         and p.user_id is not null
    ) s;

  return v_event;
end;
$$;

revoke all on function
  public.demo_retention(),
  public.demo_length(),
  public.demo_daily_limit(),
  public.demo_template_id(),
  public.start_demo(text)
from public, anon, authenticated;

grant execute on function public.demo_template_id() to authenticated, service_role;
grant execute on function public.start_demo(text) to authenticated;

-- ---------------------------------------------------------------------------
-- The template's files are readable by anyone signed in. (The policy that
-- guards real photos never matches them for a visitor: a visitor is not a
-- member of the template.)
-- ---------------------------------------------------------------------------

create policy "photos bucket: the demo's sample photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(objects.name))[1] = (select public.demo_template_id())::text
  );

-- ---------------------------------------------------------------------------
-- Retention: a visitor's demo goes after a week, the template never.
-- purge_event() and dispatch_purge() call these two and need no change.
-- ---------------------------------------------------------------------------

create or replace function public.is_event_due_for_purge(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
     where e.id = p_event_id
       and e.status = 'developed'
       and e.developed_at is not null
       and e.demo is distinct from 'template'
       and e.developed_at <= now() - case when e.demo = 'visitor'
                                          then public.demo_retention()
                                          else public.retention_period() end
  );
$$;

create or replace function public.events_due_for_purge(p_limit integer default 20)
returns table (event_id uuid)
language sql stable security definer set search_path = ''
as $$
  select e.id
    from public.events e
   where e.status = 'developed'
     and e.developed_at is not null
     and e.demo is distinct from 'template'
     and e.developed_at <= now() - case when e.demo = 'visitor'
                                        then public.demo_retention()
                                        else public.retention_period() end
   order by e.developed_at
   limit greatest(1, least(coalesce(p_limit, 20), 200));
$$;

-- ---------------------------------------------------------------------------
-- Demos send nothing.
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_developed_notification()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.demo is null
     and exists (select 1 from public.photos p where p.event_id = new.id) then
    insert into public.notifications (event_id, kind)
    values (new.id, 'developed')
    on conflict (event_id, kind) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.enqueue_ending_reminders()
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notifications (event_id, kind)
  select e.id, 'ending_soon'
    from public.events e
   where e.status = 'live'
     and e.demo is null
     and e.ends_at > now()
     and e.ends_at <= now() + public.reminder_lead()
     and e.ends_at - e.created_at >= public.reminder_min_event_length()
  on conflict (event_id, kind) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
