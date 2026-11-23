-- The gallery before the reveal (2026-11-23, the user).
--
-- A moment that is not developed yet opens as its gallery: the viewer's own
-- photos sharp, everyone else's as a colour smudge with the photographer's name
-- and the countdown. The smudge is a blurhash (~30 characters of colour, no
-- recognisable picture) that the device computes from its thumbnail and hands
-- over with the upload. The files themselves stay behind RLS until the
-- developing, exactly as before — this adds no read on storage.

alter table public.photos
  add column blurhash text
    check (blurhash is null
           or (char_length(blurhash) between 6 and 120
               and blurhash ~ '^[0-9A-Za-z#$%*+,.:;=?@\[\]^_{|}~-]+$'));

-- mark_photo_uploaded() takes the blurhash as an optional fourth argument.
-- Callers that send three (App Store 1.0, older clips) keep working: PostgREST
-- matches a function whose missing arguments have defaults.
drop function public.mark_photo_uploaded(uuid, integer, integer);

create function public.mark_photo_uploaded(
  p_photo_id uuid,
  p_width    integer,
  p_height   integer,
  p_blurhash text default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_photo public.photos%rowtype;
  v_orig  text;
  v_thumb text;
  v_hash  text := nullif(btrim(p_blurhash), '');
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

  -- Attached once; the print is frozen from here on. A retry may still bring
  -- the smudge an earlier call did not have — it is only a preview.
  if v_photo.status = 'uploaded' then
    if v_photo.blurhash is null and v_hash is not null then
      update public.photos set blurhash = v_hash where id = p_photo_id;
    end if;
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
         blurhash     = v_hash,
         status       = 'uploaded'
   where id = p_photo_id;
end;
$$;

revoke all on function public.mark_photo_uploaded(uuid, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.mark_photo_uploaded(uuid, integer, integer, text) to authenticated;

-- Every photo of an event, for its members, at any time — without paths.
-- Before the reveal this is all a member learns about someone else's photo:
-- that it exists, who took it, its shape and its smudge. Failed claims are
-- left out; a pending one (claimed, upload on its way) is a frame without a
-- smudge yet.
create function public.event_gallery(p_event_id uuid)
returns table (
  id        uuid,
  user_id   uuid,
  width     integer,
  height    integer,
  blurhash  text,
  status    public.photo_status,
  taken_at  timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public.is_event_member(p_event_id, auth.uid()) then
    raise exception 'not a member' using errcode = '42501';
  end if;

  return query
    select p.id, p.user_id, p.width, p.height, p.blurhash, p.status, p.taken_at
      from public.photos p
     where p.event_id = p_event_id
       and p.status <> 'failed'
     order by p.taken_at desc, p.id;
end;
$$;

revoke all on function public.event_gallery(uuid) from public, anon, authenticated;
grant execute on function public.event_gallery(uuid) to authenticated;
