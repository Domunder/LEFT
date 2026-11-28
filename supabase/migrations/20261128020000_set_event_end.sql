-- The host moves the end of a running event (1.3.0, step 7: event settings).
--
-- ends_at was fixed at creation: clients cannot write it, and a party that
-- runs long, or a trip that ends a day early, had no answer but "Develop now".
-- This is the door. The same limits as create_event(): in the future, and at
-- most max_event_days() ahead. Not once the event is over — a developed film
-- does not go back to shooting.

create function public.set_event_end(p_event_id uuid, p_ends_at timestamptz)
returns public.events
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_event from public.events where id = p_event_id for update;

  if not found or v_event.host_id <> auth.uid() then
    raise exception 'only the host can change this' using errcode = '42501';
  end if;

  if v_event.status = 'developed' or v_event.ends_at <= now() then
    raise exception 'the event is over' using errcode = 'P0001', hint = 'event_closed';
  end if;

  if p_ends_at is null or p_ends_at <= now() then
    raise exception 'that ending time has already passed' using errcode = 'P0001', hint = 'past';
  end if;

  if p_ends_at > now() + make_interval(days => public.max_event_days()) then
    raise exception 'an event can run for at most % days', public.max_event_days()
      using errcode = 'P0001', hint = 'too_far';
  end if;

  update public.events set ends_at = p_ends_at where id = p_event_id
  returning * into v_event;

  -- The "an hour left" reminder belongs to the old end. If the new one is
  -- further away than the reminder's lead, it is due again.
  if p_ends_at > now() + public.reminder_lead() then
    delete from public.notifications
     where event_id = p_event_id and kind = 'ending_soon';
  end if;

  return v_event;
end;
$$;

revoke all on function public.set_event_end(uuid, timestamptz) from public, anon;
grant execute on function public.set_event_end(uuid, timestamptz) to authenticated;
