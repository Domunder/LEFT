-- Missions: auto-assign before the start (2026-11-18).
--
-- The deal at "Start the Event" stays as it was. This lets the host see it
-- early: every guest who has joined is given missions now, up to the per-guest
-- count, as personal missions the planning screen shows with a name — so the
-- host can still change any of them. Whoever joins later is dealt from what is
-- left when the event starts.
--
-- A joined guest's missions hang on a mission_people row, as when the host
-- gives one by hand: the row they hold, else a free row with their name (now
-- linked to them), else a new one — "Anna 2" when another guest already holds
-- "Anna", since names are unique per event.

create function public.auto_assign_missions(p_event_id uuid)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_event    public.events%rowtype;
  v_member   public.event_members%rowtype;
  v_person   uuid;
  v_name     text;
  v_suffix   integer;
  v_have     integer;
  v_mission  uuid;
  v_assigned integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_event from public.events e where e.id = p_event_id for update;

  if not found then
    raise exception 'no such event' using errcode = 'P0002';
  end if;

  if v_event.host_id <> auth.uid() then
    raise exception 'only the host can change the missions' using errcode = '42501';
  end if;

  if v_event.status <> 'setup' or v_event.ends_at <= now() then
    raise exception 'the missions are fixed once the event has started'
      using errcode = 'P0001', hint = 'started';
  end if;

  if v_event.missions_per_guest is null then
    raise exception 'missions are off' using errcode = 'P0001', hint = 'off';
  end if;

  for v_member in
    select * from public.event_members m
     where m.event_id = p_event_id
     order by random()
  loop
    -- Their name row: held, free and matching, or new.
    select p.id into v_person
      from public.mission_people p
     where p.event_id = p_event_id and p.claimed_by = v_member.user_id;

    if v_person is null then
      select p.id into v_person
        from public.mission_people p
       where p.event_id = p_event_id
         and p.claimed_by is null
         and lower(btrim(p.name)) = lower(btrim(v_member.display_name))
       limit 1;

      if v_person is not null then
        update public.mission_people
           set claimed_by = v_member.user_id, claimed_at = now()
         where id = v_person;
      end if;
    end if;

    if v_person is null then
      v_name := btrim(v_member.display_name);
      v_suffix := 1;
      while exists (
        select 1 from public.mission_people p
         where p.event_id = p_event_id and lower(btrim(p.name)) = lower(v_name)
      ) loop
        v_suffix := v_suffix + 1;
        v_name := left(btrim(v_member.display_name), 56) || ' ' || v_suffix;
      end loop;

      insert into public.mission_people (event_id, name, claimed_by, claimed_at)
      values (p_event_id, v_name, v_member.user_id, now())
      returning id into v_person;
    end if;

    select count(*) into v_have
      from public.event_missions em
     where em.event_id = p_event_id and em.person_id = v_person;

    while v_have < v_event.missions_per_guest loop
      select em.id into v_mission
        from public.event_missions em
       where em.event_id = p_event_id and em.person_id is null
       order by random()
       limit 1;

      exit when v_mission is null;

      update public.event_missions set person_id = v_person where id = v_mission;
      v_have := v_have + 1;
      v_assigned := v_assigned + 1;
    end loop;

    v_person := null;
  end loop;

  return v_assigned;
end;
$$;

revoke all on function public.auto_assign_missions(uuid) from public, anon, authenticated;
grant execute on function public.auto_assign_missions(uuid) to authenticated;
