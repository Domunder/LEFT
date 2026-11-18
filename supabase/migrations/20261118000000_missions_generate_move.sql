-- Missions: generating more, and moving one between people (2026-11-18).
--
-- Two host tools for the planning screen, both setup-only like every other
-- write to the list:
--
--   generate_missions(event)  tops the list up until it covers the whole group
--                             (max_members x missions_per_guest, personal ones
--                             included), from the same libraries
--                             seed_missions() draws from. Missions
--                             not on the list yet come first; once the libraries
--                             run out, a mission can appear twice — two guests
--                             then share it, which is better than none.
--   event_missions.person_id  now writable by the host, so a mission can be
--                             dragged onto a name (personal) and back (shared).
--                             The composite foreign key keeps it inside its own
--                             event; the update policy keeps it to the host in
--                             setup.
--
-- Changing missions_per_guest still never adds or removes missions on its own:
-- the host sees how far the list reaches and decides.

create function public.generate_missions(p_event_id uuid)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_total integer;
  v_need  integer;
  v_added integer;
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

  select count(*) into v_total
    from public.event_missions m
   where m.event_id = p_event_id;

  -- Personal missions count too: the whole list against the whole group,
  -- within the ceiling. The planning screen shows the same arithmetic.
  v_need := least(
    v_event.max_members * v_event.missions_per_guest,
    public.max_event_missions()
  ) - v_total;

  if v_need <= 0 then
    return 0;
  end if;

  -- Each library mission is offered in rounds; a mission already on the list
  -- starts a round later per copy, so unused ones always go first. The event's
  -- own kind before the general ones, shuffled within a round.
  insert into public.event_missions (event_id, body)
  select p_event_id, t.body
    from (
      select lib.body, lib.tier, r.n + (
               select count(*) from public.event_missions m
                where m.event_id = p_event_id
                  and lower(btrim(m.body)) = lower(btrim(lib.body))
             ) as round
        from (
          select own.body, 0 as tier
            from unnest(public.event_type_missions(v_event.event_type)) as own(body)
          union all
          select gen.body, 1 as tier
            from unnest(public.general_missions()) as gen(body)
        ) lib
        cross join generate_series(0, 9) as r(n)
    ) t
   order by t.round, t.tier, random()
   limit v_need;

  get diagnostics v_added = row_count;
  return v_added;
end;
$$;

revoke all on function public.generate_missions(uuid) from public, anon, authenticated;
grant execute on function public.generate_missions(uuid) to authenticated;

-- Moving a mission onto a name and back. Row and event stay; only the owner.
grant update (person_id) on public.event_missions to authenticated;
