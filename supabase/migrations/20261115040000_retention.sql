-- Retention: an event and its photos are deleted 6 months after it was developed.
--
-- The privacy notice promises it (mobile/src/constants/legal.ts), so it is
-- enforced here rather than remembered by someone.
--
-- What goes: the storage objects, the photo rows, and the event itself with its
-- roster — a name on a guest list is personal data too, and an album with no
-- pictures is not worth keeping. A purchase that paid for the event stays in
-- the ledger, spent (its reference to the event is nulled by the foreign key).
--
-- Files cannot be deleted from SQL (the storage API owns the bucket), so the
-- work is split like the notifications are:
--
--   dispatch_purge()        scheduled daily; wakes the edge function if
--                           anything is due.
--   purge-expired-events    the edge function: asks events_due_for_purge(),
--                           removes each event's files through the storage API,
--                           then calls purge_event().
--   purge_event()           deletes the rows — and checks the date itself.
--
-- "Never earlier" is therefore a property of the database, not of the caller:
-- purge_event() refuses any event that is not developed or not old enough, and
-- refuses while files are still in the bucket.

-- How long a developed event is kept.
create function public.retention_period() returns interval
language sql immutable set search_path = '' as $$ select interval '6 months' $$;

-- The one definition of "due". developed_at is when the status flipped; an
-- event is never due on ends_at alone, so one the clock has not yet flipped —
-- or one whose developed_at is somehow missing — is left alone.
create function public.is_event_due_for_purge(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
     where e.id = p_event_id
       and e.status = 'developed'
       and e.developed_at is not null
       and e.developed_at <= now() - public.retention_period()
  );
$$;

create function public.events_due_for_purge(p_limit integer default 20)
returns table (event_id uuid)
language sql stable security definer set search_path = ''
as $$
  select e.id
    from public.events e
   where e.status = 'developed'
     and e.developed_at is not null
     and e.developed_at <= now() - public.retention_period()
   order by e.developed_at
   limit greatest(1, least(coalesce(p_limit, 20), 200));
$$;

-- Every object under the event's folder — read from the bucket's own index, not
-- from photos.storage_path, so a file whose row never recorded it is found too.
create function public.event_storage_paths(p_event_id uuid)
returns table (path text)
language sql stable security definer set search_path = ''
as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'photos'
     and o.name like p_event_id::text || '/%';
$$;

-- Delete the event. Returns false, and deletes nothing, unless the event is due
-- and its folder in the bucket is already empty.
create function public.purge_event(p_event_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_event_due_for_purge(p_event_id) then
    return false;
  end if;

  if exists (select 1 from public.event_storage_paths(p_event_id)) then
    return false;
  end if;

  -- Cascades: event_members, photos, notifications.
  delete from public.events e where e.id = p_event_id;
  return true;
end;
$$;

-- Scheduled. Quiet when nothing is due.
create function public.dispatch_purge()
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.events_due_for_purge(1)) then
    return false;
  end if;

  return public.invoke_edge_function('purge-expired-events');
end;
$$;

revoke all on function
  public.retention_period(),
  public.is_event_due_for_purge(uuid),
  public.events_due_for_purge(integer),
  public.event_storage_paths(uuid),
  public.purge_event(uuid),
  public.dispatch_purge()
from public, anon, authenticated;

-- The app may say how long things are kept; everything else is the server's.
grant execute on function public.retention_period() to authenticated;

grant execute on function public.events_due_for_purge(integer) to service_role;
grant execute on function public.event_storage_paths(uuid) to service_role;
grant execute on function public.purge_event(uuid) to service_role;
grant execute on function public.dispatch_purge() to service_role;

-- Once a day, at an hour when nobody is at a party in Europe. An event that
-- could not be finished (a file that would not delete) is simply due again
-- tomorrow.
do $$
begin
  create extension if not exists pg_cron;

  if exists (select 1 from cron.job where jobname = 'purge-expired-events') then
    perform cron.unschedule('purge-expired-events');
  end if;

  perform cron.schedule(
    'purge-expired-events',
    '17 3 * * *',
    $cron$select public.dispatch_purge()$cron$
  );
exception
  when others then
    raise notice 'pg_cron unavailable (%): nothing is ever purged.', sqlerrm;
end;
$$;
