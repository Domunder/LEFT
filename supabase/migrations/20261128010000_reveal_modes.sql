-- Reveal modes (1.3.0, step 5): the host decides WHEN everyone's photos show.
--
--   'end'      at the end of the event — what LEFT always did, and the default
--   'delayed'  some hours after the end ("the morning after")
--   'live'     during the event: members see each other's photos as they land
--
-- Until now one predicate answered two questions. They are separate from here:
--
--   is_event_developed()  the event is OVER — nobody shoots, missions lock.
--                         Unchanged: by status or by the clock.
--   is_event_revealed()   everyone's photos are VISIBLE to members. New, and
--                         what every read policy asks from now on.
--
-- For 'end' the two are the same moment, so existing events behave exactly as
-- before. The reveal is still enforced here, in RLS, never by a client.

alter table public.events
  add column reveal_mode text not null default 'end'
    constraint events_reveal_mode_check check (reveal_mode in ('live', 'end', 'delayed')),
  add column reveal_delay_hours integer
    constraint events_reveal_delay_check check (
      (reveal_mode = 'delayed' and reveal_delay_hours between 0 and 168)
      or (reveal_mode <> 'delayed' and reveal_delay_hours is null)
    );

comment on column public.events.reveal_mode is
  'When members see each other''s photos: live, end (default) or delayed.';
comment on column public.events.reveal_delay_hours is
  'Hours after ends_at, for reveal_mode = delayed. 0 once the host developed by hand.';

-- Not writable by clients: no column grant. set_event_reveal() is the door.

-- THE REVEAL, in one predicate. By the clock, to the second, like the end.
create function public.is_event_revealed(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
     where e.id = p_event_id
       and case e.reveal_mode
             when 'live' then e.status <> 'setup'
             when 'delayed' then
               (e.status = 'developed' or e.ends_at <= now())
               and e.ends_at + make_interval(hours => e.reveal_delay_hours) <= now()
             else e.status = 'developed' or e.ends_at <= now()
           end
  );
$$;

revoke all on function public.is_event_revealed(uuid) from public, anon;
grant execute on function public.is_event_revealed(uuid) to authenticated, service_role;

-- The host's choice. Only before the start: guests shoot knowing who will see
-- what and when, so it cannot change under them.
create function public.set_event_reveal(
  p_event_id    uuid,
  p_mode        text,
  p_delay_hours integer default null
)
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

  if not found or v_event.host_id <> auth.uid() then
    raise exception 'only the host can change this' using errcode = '42501';
  end if;

  if v_event.status <> 'setup' then
    raise exception 'the event has started' using errcode = 'P0001', hint = 'started';
  end if;

  if p_mode not in ('live', 'end', 'delayed') then
    raise exception 'unknown reveal mode' using errcode = '22023', hint = 'mode';
  end if;

  if p_mode = 'delayed' and (p_delay_hours is null or p_delay_hours not between 1 and 168) then
    raise exception 'delay must be 1 to 168 hours' using errcode = '22023', hint = 'delay';
  end if;

  update public.events
     set reveal_mode = p_mode,
         reveal_delay_hours = case when p_mode = 'delayed' then p_delay_hours end
   where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;

revoke all on function public.set_event_reveal(uuid, text, integer) from public, anon;
grant execute on function public.set_event_reveal(uuid, text, integer) to authenticated;

-- "Develop now" means now, in every mode: it ends the event, and a delayed
-- reveal stops waiting. It also works after the end, while a delay still runs.
create or replace function public.end_event(p_event_id uuid)
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
    if v_event.reveal_mode = 'delayed' and v_event.reveal_delay_hours > 0 then
      update public.events
         set reveal_delay_hours = 0,
             ends_at = least(ends_at, now())
       where id = p_event_id
      returning * into v_event;
    end if;
    return v_event;
  end if;

  update public.events
     set status = 'developed',
         developed_at = now(),
         ends_at = least(ends_at, now()),
         reveal_delay_hours = case when reveal_mode = 'delayed' then 0 end
   where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;

-- ---------------------------------------------------------------------------
-- Every read that was "once developed" is "once revealed"
-- ---------------------------------------------------------------------------

drop policy "photos: own always, everyone's once developed" on public.photos;
create policy "photos: own always, everyone's once revealed"
  on public.photos for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      public.is_event_member(event_id, (select auth.uid()))
      and public.is_event_revealed(event_id)
    )
  );

drop policy "photos bucket: own always, everyone's once developed" on storage.objects;
create policy "photos bucket: own always, everyone's once revealed"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and (
      (storage.foldername(objects.name))[2] = (select auth.uid())::text
      or (
        public.is_event_member(
          nullif((storage.foldername(objects.name))[1], '')::uuid, (select auth.uid())
        )
        and public.is_event_revealed(nullif((storage.foldername(objects.name))[1], '')::uuid)
      )
    )
  );

drop policy "event missions: host, the dealt, and everyone once developed" on public.event_missions;
create policy "event missions: host, the dealt, and everyone once revealed"
  on public.event_missions for select to authenticated
  using (
    public.is_event_host(event_id, (select auth.uid()))
    or exists (
      select 1 from public.member_missions mm
       where mm.mission_id = event_missions.id and mm.user_id = (select auth.uid())
    )
    or (
      public.is_event_member(event_id, (select auth.uid()))
      and public.is_event_revealed(event_id)
    )
  );

drop policy "member missions: own always, everyone's once developed" on public.member_missions;
create policy "member missions: own always, everyone's once revealed"
  on public.member_missions for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      public.is_event_member(event_id, (select auth.uid()))
      and public.is_event_revealed(event_id)
    )
  );

-- A photo can be reported as soon as others can see it.
create or replace function public.report_photo(p_photo_id uuid, p_reason text default 'unspecified')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_photo public.photos%rowtype;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into v_photo from public.photos p where p.id = p_photo_id;

  -- The same answer for "does not exist" and "not yours to see": a caller must
  -- not learn from this function which photo ids exist.
  if not found
     or not public.is_event_member(v_photo.event_id, v_user)
     or not public.is_event_revealed(v_photo.event_id)
  then
    raise exception 'Photo not found' using errcode = 'P0002', hint = 'not_found';
  end if;

  if v_photo.user_id = v_user then
    raise exception 'You cannot report your own photo' using errcode = 'P0001', hint = 'own_photo';
  end if;

  insert into public.photo_reports
    (photo_id, event_id, reporter_id, photo_owner_id, storage_path, reason)
  values
    (v_photo.id, v_photo.event_id, v_user, v_photo.user_id, v_photo.storage_path,
     coalesce(p_reason, 'unspecified'))
  on conflict (photo_id, reporter_id)
    where photo_id is not null and reporter_id is not null
    do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- "Your photos are developed." is sent when they can be seen
-- ---------------------------------------------------------------------------

-- At the end, unless the reveal is still to come.
create or replace function public.enqueue_developed_notification()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.demo is null
     and not (
       new.reveal_mode = 'delayed'
       and new.ends_at + make_interval(hours => new.reveal_delay_hours) > now()
     )
     and exists (select 1 from public.photos p where p.event_id = new.id) then
    insert into public.notifications (event_id, kind)
    values (new.id, 'developed')
    on conflict (event_id, kind) do nothing;
  end if;

  return new;
end;
$$;

-- A delayed reveal has no status change to hang a trigger on: the clock asks.
-- Only events whose reveal came within the last day, so nothing old is woken.
create function public.enqueue_reveal_notifications()
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notifications (event_id, kind)
  select e.id, 'developed'
    from public.events e
   where e.reveal_mode = 'delayed'
     and e.demo is null
     and e.status = 'developed'
     and e.ends_at + make_interval(hours => e.reveal_delay_hours) <= now()
     and e.ends_at + make_interval(hours => e.reveal_delay_hours) > now() - interval '1 day'
     and exists (select 1 from public.photos p where p.event_id = e.id)
  on conflict (event_id, kind) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.enqueue_reveal_notifications() from public, anon, authenticated;
grant execute on function public.enqueue_reveal_notifications() to service_role;

do $$
begin
  create extension if not exists pg_cron;

  if exists (select 1 from cron.job where jobname = 'notifications-tick') then
    perform cron.unschedule('notifications-tick');
  end if;

  perform cron.schedule(
    'notifications-tick',
    '* * * * *',
    $cron$select public.enqueue_ending_reminders(); select public.enqueue_reveal_notifications(); select public.dispatch_notifications();$cron$
  );
exception
  when others then
    raise notice 'pg_cron unavailable (%): no reminders, and nothing wakes the sender.', sqlerrm;
end;
$$;

-- The invitation says when the photos show.
drop function public.invite_preview(text);
create function public.invite_preview(p_invite_code text)
returns table (
  event_id           uuid,
  name               text,
  host_name          text,
  look               text,
  cover              text,
  ends_at            timestamptz,
  roll_size          integer,
  status             text,
  reveal_mode        text,
  reveal_delay_hours integer
)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.name,
         (select m.display_name from public.event_members m
           where m.event_id = e.id and m.user_id = e.host_id),
         e.look::text, e.cover, e.ends_at, e.roll_size, e.status::text,
         e.reveal_mode, e.reveal_delay_hours
    from public.events e
   where auth.uid() is not null
     and e.invite_code = upper(trim(p_invite_code))
   limit 1;
$$;

revoke all on function public.invite_preview(text) from public, anon;
grant execute on function public.invite_preview(text) to authenticated;
