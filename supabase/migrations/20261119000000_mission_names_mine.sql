-- 11's names, with the caller's own (2026-11-19, the user).
--
-- A guest who already joined can come back to 11 from the waiting screen and
-- switch between a name the host listed and their own. To show which name
-- they hold now, the list includes it, marked `mine`. Everyone else's claimed
-- names stay out: a name somebody holds disappears for the others, and
-- claim_mission_person() refuses it with hint 'taken' if two race for it.
--
-- The return type changes, so the function is dropped and created again.

drop function public.mission_people_for_invite(text);

create function public.mission_people_for_invite(p_invite_code text)
returns table (person_id uuid, name text, mine boolean)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name, p.claimed_by is not null
    from public.mission_people p
    join public.events e on e.id = p.event_id
   where auth.uid() is not null
     and e.invite_code = upper(trim(p_invite_code))
     and e.missions_per_guest is not null
     and e.status <> 'developed'
     and (p.claimed_by is null or p.claimed_by = auth.uid())
   order by lower(p.name);
$$;

revoke all on function public.mission_people_for_invite(text) from public, anon, authenticated;
grant execute on function public.mission_people_for_invite(text) to authenticated;
