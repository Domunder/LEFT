-- The event image (2026-11-21, the user): picked by the host while creating a
-- moment — one of LEFT's stock pictures or their own photo — and shown behind
-- the guests' waiting screen, on the Moments card before there are photos,
-- and behind the host's QR (09). Drawn through the event's look by the app.
--
-- `events.cover`:
--   null          no choice; the app falls back to a stock picture
--   'sample-N'    one of the app's stock pictures (constants/samples.ts)
--   'upload'      the host's own photo, at photos/{event_id}/cover.jpg
--
-- **The file lives in the `photos` bucket under the event's folder** on
-- purpose: `event_storage_paths()` lists by that prefix, so the retention
-- purge, account deletion and the orphan sweep remove it with the photos
-- without a change to any edge function.

alter table public.events
  add column cover text
  check (cover is null or cover = 'upload' or cover ~ '^sample-[0-9]{1,2}$');

-- The host writes it through the existing "host can rename" update policy;
-- the column grant is what widens. Status, roll, size and the clock stay
-- unwritable.
grant update (name, cover) on public.events to authenticated;

-- Every member may read the cover at any time — it is not a photo of the
-- group, so the reveal rule does not apply to it. Exactly one path per event.
create policy "photos bucket: members read the event image"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.events e
       where objects.name = e.id::text || '/cover.jpg'
         and public.is_event_member(e.id, (select auth.uid()))
    )
  );

-- Only the host uploads or replaces it, and only at that exact path.
create policy "photos bucket: host uploads the event image"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and exists (
      select 1 from public.events e
       where objects.name = e.id::text || '/cover.jpg'
         and e.host_id = (select auth.uid())
    )
  );

create policy "photos bucket: host replaces the event image"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.events e
       where objects.name = e.id::text || '/cover.jpg'
         and e.host_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'photos'
    and exists (
      select 1 from public.events e
       where objects.name = e.id::text || '/cover.jpg'
         and e.host_id = (select auth.uid())
    )
  );
