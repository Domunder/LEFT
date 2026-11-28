-- The invitation card (1.3.0, 2026-11-28).
--
-- 11 is where a guest lands from the link, before they are a member — and RLS
-- hides an event from everyone who is not. Until now that screen could only
-- ask for a name. It now shows the invitation the host designed: the event
-- image, who invites, the name, when it ends and the roll.
--
-- `invite_preview(code)` is the door: the same shape as
-- `mission_people_for_invite()` — signed in (anonymously counts), and only for
-- someone who holds the code. It hands out what the invitation says and
-- nothing else: no roster, no counts, no photos. The reveal is untouched.
--
-- Deliberate: whoever holds an invite link can read the event's name, the
-- host's display name and the event image before joining. That is what an
-- invitation is.

create function public.invite_preview(p_invite_code text)
returns table (
  event_id  uuid,
  name      text,
  host_name text,
  look      text,
  cover     text,
  ends_at   timestamptz,
  roll_size integer,
  status    text
)
language sql stable security definer set search_path = ''
as $$
  select e.id,
         e.name,
         (select m.display_name
            from public.event_members m
           where m.event_id = e.id and m.user_id = e.host_id),
         e.look::text,
         e.cover,
         e.ends_at,
         e.roll_size,
         e.status::text
    from public.events e
   where auth.uid() is not null
     and e.invite_code = upper(trim(p_invite_code));
$$;

revoke all on function public.invite_preview(text) from public, anon, authenticated;
grant execute on function public.invite_preview(text) to authenticated;

-- The event image belongs to the invitation, so a signed-in user may read it
-- without being a member. Exactly one path per event, and the event's id is
-- only learnt through the function above (or by being a member). Photos stay
-- behind their own policies: this matches `cover.jpg` and nothing else.
create policy "photos bucket: the invited read the event image"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and objects.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/cover\.jpg$'
  );
