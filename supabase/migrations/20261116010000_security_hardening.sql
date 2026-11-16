-- Security review, 2026-11-16. Five holes closed, each one found by reading the
-- schema as an anonymous guest with the public key would:
--
--   1. A guest could delete their own roster row and join again with a fresh
--      roll — unlimited frames on a free event.
--   2. `photos.storage_path` was whatever its owner wrote, and account deletion
--      (service role) and host moderation deleted the files those rows named —
--      so one member could have other people's pictures deleted.
--   3. The bucket's upload rule checked the folder and the file name but not the
--      whole path, and a storage "move" was not checked at all.
--   4. Files of an event that no longer exists were never swept.
--   5. Invite codes were six characters — the only secret in front of an album.
--   6. The bucket's delete policy compared the *event's name* with the path
--      (an unqualified `name` inside a subquery over events): a host who renamed
--      their event could delete every file they could see, and real moderation
--      deleted nothing.

-- ---------------------------------------------------------------------------
-- 1. The roster row holds the roll. Clients never delete it.
-- ---------------------------------------------------------------------------

-- `shots_taken` lives on the member row, and `join_event()` inserts a new row at
-- zero. Nothing in the app leaves an event or removes a guest; the policy was
-- unused surface. If either is ever built, it must be an RPC that keeps the
-- count (a `removed` flag, not a delete). Cascades from auth.users and events
-- need neither the grant nor the policy.
drop policy "members: guests leave, hosts remove guests" on public.event_members;
revoke delete on public.event_members from authenticated;

-- ---------------------------------------------------------------------------
-- 2. Photo paths are written by the server
-- ---------------------------------------------------------------------------

-- The one door for "my upload has landed". The paths are derived from the row,
-- never taken from the caller, and both files must actually be in the bucket.
-- Idempotent, and deliberately without an event-status check: an upload may
-- finish after the event has ended. Once a row is 'uploaded' the bucket refuses
-- to replace its files (section 3), so a picture cannot be swapped after the
-- reveal — or after it was reported.
create function public.mark_photo_uploaded(
  p_photo_id uuid,
  p_width    integer,
  p_height   integer
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_photo public.photos%rowtype;
  v_orig  text;
  v_thumb text;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_photo
    from public.photos p
   where p.id = p_photo_id and p.user_id = v_user
     for update;
  if not found then
    raise exception 'no such photo' using errcode = 'P0002';
  end if;

  -- Attached once. A second call (a retry whose first answer was lost) is a
  -- success and changes nothing — the print is frozen from here on.
  if v_photo.status = 'uploaded' then
    return;
  end if;

  if p_width is null or p_height is null
     or p_width not between 1 and 20000 or p_height not between 1 and 20000 then
    raise exception 'invalid size' using errcode = '22023';
  end if;

  v_orig  := v_photo.event_id::text || '/' || v_user::text || '/' || v_photo.id::text || '.jpg';
  v_thumb := v_photo.event_id::text || '/' || v_user::text || '/' || v_photo.id::text || '_thumb.jpg';

  if (select count(*) from storage.objects o
       where o.bucket_id = 'photos' and o.name in (v_orig, v_thumb)) <> 2 then
    raise exception 'upload not found' using errcode = 'P0002', hint = 'not_uploaded';
  end if;

  update public.photos
     set storage_path = v_orig,
         thumb_path   = v_thumb,
         width        = p_width,
         height       = p_height,
         status       = 'uploaded'
   where id = p_photo_id;
end;
$$;

revoke all on function public.mark_photo_uploaded(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.mark_photo_uploaded(uuid, integer, integer) to authenticated;

-- No client writes a photo row any more: claim_shot() inserts, the function
-- above attaches the upload, and delete stays with the owner and the host.
drop policy "photos: owner attaches the upload" on public.photos;
revoke update on public.photos from authenticated;
revoke update (storage_path, thumb_path, width, height, status) on public.photos from authenticated;

-- Rows written while the columns were open: back to the canonical path. A row
-- whose author is gone (user_id null) keeps its path only if it is under its
-- own event and named after its own id.
update public.photos p
   set storage_path = p.event_id::text || '/' || p.user_id::text || '/' || p.id::text || '.jpg'
 where p.user_id is not null
   and p.storage_path is not null
   and p.storage_path <> p.event_id::text || '/' || p.user_id::text || '/' || p.id::text || '.jpg';

update public.photos p
   set thumb_path = p.event_id::text || '/' || p.user_id::text || '/' || p.id::text || '_thumb.jpg'
 where p.user_id is not null
   and p.thumb_path is not null
   and p.thumb_path <> p.event_id::text || '/' || p.user_id::text || '/' || p.id::text || '_thumb.jpg';

update public.photos p
   set storage_path = null, thumb_path = null, status = 'failed'
 where p.user_id is null
   and (
     (p.storage_path is not null
      and p.storage_path !~ ('^' || p.event_id::text || '/[0-9a-f-]{36}/' || p.id::text || '\.jpg$'))
     or
     (p.thumb_path is not null
      and p.thumb_path !~ ('^' || p.event_id::text || '/[0-9a-f-]{36}/' || p.id::text || '_thumb\.jpg$'))
   );

-- Account deletion reads the bucket's own index, as the retention purge does —
-- never the rows. Same signature and shape, so the edge function deployed
-- before this migration is safe with it too.
create or replace function public.prepare_account_deletion(p_user_id uuid)
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

  select coalesce(array_agg(o.name), '{}') into v_paths
    from unnest(v_events) ev(id)
    join storage.objects o
      on o.bucket_id = 'photos' and o.name like ev.id::text || '/%';

  update public.purchases
     set consumed_at = null, consumed_by_event_id = null
   where consumed_by_event_id = any(v_events);

  return query select v_events, v_paths;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The bucket: the whole path, on upload and on move
-- ---------------------------------------------------------------------------

-- Before: folder 1, folder 2 and the file name were checked, so any depth in
-- between passed ({event}/{me}/x/y/{photo}.jpg). And the update policy had no
-- WITH CHECK, which is all the storage API consults for a move — an owner could
-- rename their object to nearly any path, out of reach of the purge.
--
-- Only while the row is 'pending': after mark_photo_uploaded() the files are
-- final. The upload queue's retries all happen before that; a retry after it
-- is refused here and the queue then finds the row already attached.
drop policy "photos bucket: upload a claimed frame into your own folder" on storage.objects;
drop policy "photos bucket: owner can replace their upload" on storage.objects;

create policy "photos bucket: upload a claimed frame into your own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and exists (
      select 1 from public.photos p
       where p.user_id = (select auth.uid())
         and p.status = 'pending'
         and objects.name in (
           p.event_id::text || '/' || p.user_id::text || '/' || p.id::text || '.jpg',
           p.event_id::text || '/' || p.user_id::text || '/' || p.id::text || '_thumb.jpg'
         )
    )
  );

create policy "photos bucket: owner can replace their upload"
  on storage.objects for update to authenticated
  using (bucket_id = 'photos' and owner_id = (select auth.uid())::text)
  with check (
    bucket_id = 'photos'
    and owner_id = (select auth.uid())::text
    and exists (
      select 1 from public.photos p
       where p.user_id = (select auth.uid())
         and p.status = 'pending'
         and objects.name in (
           p.event_id::text || '/' || p.user_id::text || '/' || p.id::text || '.jpg',
           p.event_id::text || '/' || p.user_id::text || '/' || p.id::text || '_thumb.jpg'
         )
    )
  );

-- The delete policy. In the baseline its subquery over events said
-- `storage.foldername(name)` — and inside that subquery `name` is events.name,
-- not the object's. So the "host" branch asked whether some event the caller
-- hosts was *named* like its own id: never true for an honest host (moderation
-- removed no file, silently), and true for every object in the bucket once a
-- host renamed their event to "{its id}/x". Qualified now, and compared as text
-- so no path can make the cast throw.
drop policy "photos bucket: owner or host can delete" on storage.objects;

create policy "photos bucket: owner or host can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and (
      owner_id = (select auth.uid())::text
      or exists (
        select 1 from public.events e
         where e.id::text = split_part(objects.name, '/', 1)
           and e.host_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Files without an event
-- ---------------------------------------------------------------------------

-- An upload can only land under an event that exists (the insert policy needs a
-- photos row, which needs the event), so an object whose first folder is not an
-- event is left over: from an account deletion that could not remove a file, an
-- event row deleted by its host, or anything moved before the policy above.
-- The daily purge sweeps them.
create function public.orphaned_storage_paths(p_limit integer default 1000)
returns table (path text)
language sql stable security definer set search_path = ''
as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'photos'
     -- NOT IN on purpose (events.id is never null): it plans as a hashed
     -- subplan whatever the limit. `not exists` with limit 1 became a nested
     -- loop over objects x events, minutes on a full bucket with no orphans.
     and split_part(o.name, '/', 1) not in (select e.id::text from public.events e)
   limit greatest(1, least(coalesce(p_limit, 1000), 1000));
$$;

create or replace function public.dispatch_purge()
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.events_due_for_purge(1))
     and not exists (select 1 from public.orphaned_storage_paths(1)) then
    return false;
  end if;

  return public.invoke_edge_function('purge-expired-events');
end;
$$;

revoke all on function public.orphaned_storage_paths(integer) from public, anon, authenticated;
grant execute on function public.orphaned_storage_paths(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Longer invite codes
-- ---------------------------------------------------------------------------

-- The code is the only secret in front of an album, joining stays open after
-- the reveal, and join_event() says whether a guess was right. Six characters
-- of 32 is about 1e9; eight is about 1e12. Nobody types a code — it travels as
-- a link or a QR — so the length costs nothing. Existing codes keep working.
--
-- And no longer from random(): that is a per-connection PRNG, not meant for
-- secrets, and this function is callable by clients. The bytes now come from
-- gen_random_uuid() (the system's CSPRNG) through sha256; 256 is a multiple of
-- 32, so taking five bits of a byte is unbiased.
create or replace function public.generate_invite_code()
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  noise bytea;
begin
  loop
    code := '';
    noise := sha256(convert_to(gen_random_uuid()::text, 'UTF8'));
    for i in 1 .. 8 loop
      code := code || substr(alphabet, 1 + (get_byte(noise, i - 1) & 31), 1);
    end loop;
    exit when not exists (select 1 from public.events e where e.invite_code = code);
  end loop;
  return code;
end;
$$;
