-- Reporting a photo.
--
-- Both stores require a way to flag objectionable user content (App Store
-- guideline 1.2). The host can already delete any picture in their event and
-- everyone their own; this is the door for everybody else: a member who can
-- see a photo tells the operator about it.
--
--   report_photo()   the only way in. The caller must be able to see the photo
--                    the way RLS would let them: a member of its event, and
--                    the event developed. Reporting your own photo is refused
--                    (delete it instead). One report per person and photo —
--                    a second tap is a no-op, not an error.
--   photo_reports    readable by nobody but the service role. A report must
--                    never be visible to the person it is about.
--
-- A report outlives what it points at: when the photo, the event or the
-- reporter is deleted the reference is nulled and the row stays, with the
-- file path and the photographer as they were when it was made.

create table public.photo_reports (
  id            uuid primary key default gen_random_uuid(),
  photo_id      uuid references public.photos (id) on delete set null,
  event_id      uuid references public.events (id) on delete set null,
  reporter_id   uuid references auth.users (id) on delete set null,
  -- Snapshots, so the report still says what it was about after a deletion.
  photo_owner_id uuid,
  storage_path   text,
  reason        text not null default 'unspecified'
    check (reason in ('unspecified', 'nudity', 'harassment', 'violence', 'privacy', 'other')),
  created_at    timestamptz not null default now(),
  -- Set by the operator once the report was looked at.
  resolved_at   timestamptz,
  resolution    text
);

create unique index photo_reports_once_idx
  on public.photo_reports (photo_id, reporter_id)
  where photo_id is not null and reporter_id is not null;

create index photo_reports_open_idx
  on public.photo_reports (created_at)
  where resolved_at is null;

alter table public.photo_reports enable row level security;

-- No policies: no client reads or writes this table. report_photo() is the door.
revoke all on public.photo_reports from anon, authenticated;
grant all on public.photo_reports to service_role;

create function public.report_photo(p_photo_id uuid, p_reason text default 'unspecified')
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
     or not public.is_event_developed(v_photo.event_id)
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

revoke all on function public.report_photo(uuid, text) from public, anon;
grant execute on function public.report_photo(uuid, text) to authenticated;
