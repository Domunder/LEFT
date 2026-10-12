-- LEFT — row-level security, privileges, storage and realtime.
--
-- Shape of the rules: you can see an event only if you are a member of it, and
-- the budget columns are not writable by anyone. All budget movement goes
-- through the SECURITY DEFINER functions in the previous migration.

alter table public.events              enable row level security;
alter table public.event_members       enable row level security;
alter table public.clips               enable row level security;
alter table public.budget_reservations enable row level security;

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------

create policy "events: members can read"
  on public.events for select to authenticated
  using (public.is_event_member(id, (select auth.uid())));

create policy "events: host can create"
  on public.events for insert to authenticated
  with check (host_id = (select auth.uid()));

create policy "events: host can update"
  on public.events for update to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

create policy "events: host can delete"
  on public.events for delete to authenticated
  using (host_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- event_members
-- ---------------------------------------------------------------------------

create policy "members: members can read the roster"
  on public.event_members for select to authenticated
  using (public.is_event_member(event_id, (select auth.uid())));

-- No INSERT policy: joining goes through public.join_event(), which enforces
-- the invite code, the end time and the group-size cap.

create policy "members: rename yourself"
  on public.event_members for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "members: leave, or be removed by the host"
  on public.event_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
        from public.events e
       where e.id = event_members.event_id
         and e.host_id = (select auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- clips
-- ---------------------------------------------------------------------------

create policy "clips: members can read"
  on public.clips for select to authenticated
  using (public.is_event_member(event_id, (select auth.uid())));

-- No INSERT policy: clips are created by public.commit_reservation() so that a
-- clip can never exist without the budget having been charged for it.

-- The upload finishes after the clip row exists, so the owner needs to be able
-- to fill in where the file landed.
create policy "clips: owner can attach the upload"
  on public.clips for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "clips: owner or host can delete"
  on public.clips for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
        from public.events e
       where e.id = clips.event_id
         and e.host_id = (select auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- budget_reservations
-- ---------------------------------------------------------------------------

-- Readable so a client can show "someone else is filming right now", but never
-- writable: reserve_budget / commit_reservation / release_reservation own it.
create policy "reservations: members can read"
  on public.budget_reservations for select to authenticated
  using (public.is_event_member(event_id, (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
--
-- Granted explicitly rather than relying on schema default privileges, which do
-- not cover these tables. RLS narrows what a grant can reach; it never widens
-- it, so a missing grant here means the policy above can never match.
--
-- The column lists are the second half of the budget protection: RLS cannot
-- restrict individual columns, so UPDATE is granted per column. The host can
-- rename the film or move the end time, but budget_seconds, used_seconds and
-- invite_code are unreachable from a client at any privilege level.
--
-- No INSERT on event_members, clips or budget_reservations: those rows are
-- created only by join_event() and commit_reservation(), so a clip cannot exist
-- without the budget having been charged for it.

grant select, insert, delete on public.events to authenticated;
grant update (name, event_type, format, status, ends_at) on public.events to authenticated;

grant select, delete on public.event_members to authenticated;
grant update (display_name) on public.event_members to authenticated;

grant select, delete on public.clips to authenticated;
grant update (storage_path, status) on public.clips to authenticated;

-- Readable so a client can show "someone else is filming right now".
grant select on public.budget_reservations to authenticated;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

-- generate_invite_code backs a column default, so the inserting role must be
-- able to execute it — but anon has no business calling it.
revoke all on function public.generate_invite_code() from public, anon;
grant execute on function public.generate_invite_code() to authenticated;

revoke all on function public.reserve_budget(uuid, integer) from public, anon;
revoke all on function public.commit_reservation(uuid, numeric, text) from public, anon;
revoke all on function public.release_reservation(uuid) from public, anon;
revoke all on function public.join_event(text, text) from public, anon;
revoke all on function public.remaining_seconds(uuid) from public, anon;
revoke all on function public.is_event_member(uuid, uuid) from public, anon;

grant execute on function public.reserve_budget(uuid, integer) to authenticated;
grant execute on function public.commit_reservation(uuid, numeric, text) to authenticated;
grant execute on function public.release_reservation(uuid) to authenticated;
grant execute on function public.join_event(text, text) to authenticated;
grant execute on function public.remaining_seconds(uuid) to authenticated;
grant execute on function public.is_event_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

-- Private bucket. Path convention: {event_id}/{user_id}/{clip_id}.mp4 — the
-- policies below read the first path segment as the event id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clips',
  'clips',
  false,
  524288000, -- 500 MB
  array['video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

create policy "clips bucket: members can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'clips'
    and public.is_event_member(
      nullif((storage.foldername(name))[1], '')::uuid,
      (select auth.uid())
    )
  );

create policy "clips bucket: members can upload into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'clips'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.is_event_member(
      nullif((storage.foldername(name))[1], '')::uuid,
      (select auth.uid())
    )
  );

create policy "clips bucket: owner can replace or remove their upload"
  on storage.objects for update to authenticated
  using (bucket_id = 'clips' and owner_id = (select auth.uid())::text);

create policy "clips bucket: owner can delete their upload"
  on storage.objects for delete to authenticated
  using (bucket_id = 'clips' and owner_id = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- The budget bar on every member's camera screen is driven by UPDATEs to
-- events.used_seconds arriving over realtime.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.events;
    alter publication supabase_realtime add table public.event_members;
    alter publication supabase_realtime add table public.clips;
  end if;
end
$$;

-- Send the whole row on UPDATE so subscribers get used_seconds without a refetch.
alter table public.events replica identity full;
