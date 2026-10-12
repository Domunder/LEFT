-- LEFT — starting an event.
--
-- `events.status` has existed since the initial schema with nothing to move it
-- off 'setup'. Screen 10's "Start the Event" is what moves it, and screen 12
-- (guest waiting) is what listens for the change — a guest's phone leaves the
-- holding screen because this column flipped, not because anyone told it to.
--
-- A function rather than the host's existing UPDATE policy on public.events,
-- for the same reason joining is a function: the policy checks only
-- `host_id = auth.uid()`, so it would happily accept 'ready' -> 'setup', or a
-- second start on an event already live. The legal transition is one arrow and
-- it is enforced here.

create or replace function public.start_event(p_event_id uuid)
returns public.events
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_event
    from public.events
   where id = p_event_id
   for update;

  if not found then
    raise exception 'no such event' using errcode = 'P0002';
  end if;

  -- Only the host starts the event. A guest reaching this is a bug on the
  -- client, not a race, so it is an error rather than a silent no-op.
  if v_event.host_id <> auth.uid() then
    raise exception 'only the host can start this event' using errcode = '42501';
  end if;

  -- Already live is not a failure: the host double-tapped, or the screen was
  -- restored while the event was running. Hand back the row unchanged.
  if v_event.status = 'live' then
    return v_event;
  end if;

  if v_event.status <> 'setup' then
    raise exception 'this event has already finished filming' using errcode = 'P0002';
  end if;

  if v_event.ends_at <= now() then
    raise exception 'this event has already ended' using errcode = 'P0002';
  end if;

  update public.events
     set status = 'live'
   where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;

revoke all on function public.start_event(uuid) from public, anon;
grant execute on function public.start_event(uuid) to authenticated;
