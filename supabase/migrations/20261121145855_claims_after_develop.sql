-- Photos may be added after the film is developed (2026-11-21, the user).
--
-- A guest can add pictures from their phone's library, during the event and
-- after it, but never more than their roll: the roll is the only limit, and
-- `max_members` (join_event) still caps who can be in the group at all. So
-- `claim_shot()` now refuses only an event that has not started (`setup`);
-- a `live` or `developed` event counts frames against the same roll as
-- before. A photo claimed after the reveal is visible to every member as soon
-- as it is uploaded — the reveal rule (RLS) is unchanged.
--
-- Side effect, accepted: frames still queued in a camera when the event ends
-- are now counted and uploaded instead of refused and dropped.
--
-- Same signature, same body except for the refusal.

create or replace function public.claim_shot(
  p_event_id uuid,
  p_photo_id uuid,
  p_taken_at timestamptz default now()
)
returns table (photo_id uuid, shots_taken integer, shots_left integer)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_event    public.events%rowtype;
  v_member   public.event_members%rowtype;
  v_existing public.photos%rowtype;
  v_limit    integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_photo_id is null then
    raise exception 'a photo id is required' using errcode = '22023';
  end if;

  -- The member row is the lock: it serialises one guest's shots without making
  -- two hundred phones queue behind a single event row.
  select * into v_member
    from public.event_members m
   where m.event_id = p_event_id and m.user_id = v_user
   for update;

  if not found then
    raise exception 'not a member of this event' using errcode = '42501';
  end if;

  select * into v_event from public.events e where e.id = p_event_id;

  v_limit := coalesce(v_event.roll_size, public.unlimited_roll_cap());

  select * into v_existing from public.photos p where p.id = p_photo_id;

  if found then
    if v_existing.user_id is distinct from v_user or v_existing.event_id <> p_event_id then
      raise exception 'that photo id is already in use' using errcode = '23505';
    end if;

    return query select
      p_photo_id,
      v_member.shots_taken,
      case when v_event.roll_size is null then null::integer
           else greatest(0, v_limit - v_member.shots_taken) end;
    return;
  end if;

  -- Only before the start. Live and developed events take frames up to the roll.
  if v_event.status = 'setup' then
    raise exception 'the cameras are not open' using errcode = 'P0001', hint = 'event_closed';
  end if;

  if v_member.shots_taken >= v_limit then
    raise exception 'the roll is empty' using errcode = 'P0001', hint = 'roll_empty';
  end if;

  insert into public.photos (id, event_id, user_id, taken_at)
  values (
    p_photo_id, p_event_id, v_user,
    -- A device clock is a hint, not a fact: keep it inside the event.
    least(greatest(coalesce(p_taken_at, now()), v_event.created_at), now())
  );

  update public.event_members m
     set shots_taken = m.shots_taken + 1
   where m.event_id = p_event_id and m.user_id = v_user
  returning * into v_member;

  return query select
    p_photo_id,
    v_member.shots_taken,
    case when v_event.roll_size is null then null::integer
         else greatest(0, v_limit - v_member.shots_taken) end;
end;
$$;
