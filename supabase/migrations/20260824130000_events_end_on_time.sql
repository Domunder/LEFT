-- LEFT — an event ends when it says it will.
--
-- **This is the migration that unblocks the capture ratio**, and the reason is
-- worth stating before the code.
--
-- Running out of budget has been the only ending that exists. `finish_event()`
-- refuses while `remaining_seconds()` is above zero, deliberately — a client
-- asking to end is not evidence that the group is done, and without that guard
-- any member could cut everyone else short. But nothing has ever ended an event
-- whose `ends_at` simply passed, so a group that filmed 8 of their 10 minutes and
-- went home left an event stuck at 'live' forever: no 'processing', no 'ready',
-- no render, no film.
--
-- That was survivable while `budget_seconds` equalled the film's length, because
-- a group filming its whole film is roughly what a party does. It stops being
-- survivable the moment the budget is a *multiple* of the film — which is the
-- whole point of separating them, so that the render has more footage than it
-- needs and can choose. At a ratio of 2.5 almost nobody exhausts the pool, and
-- almost nobody would ever get a film.
--
-- So: a clock ends the event. **A clock is not a client**, which is exactly why
-- it may bypass the guard that exists to distrust clients.
--
-- What this deliberately does NOT do:
--
--   * It does not touch the unresolved-take guard's *purpose*. It calls
--     `resolve_takes()` first, so a take that finished is charged and a take
--     still rolling is settled or dropped before the status moves. The event
--     ending is not allowed to lose footage somebody filmed.
--   * It does not render. 14 asks for the render, and every member's phone
--     follows the status over realtime as it always has. An event swept while
--     every phone is closed simply renders whenever someone next opens it, which
--     is the same behaviour an event has always had when nobody was looking.
--   * It does not touch 'setup'. An event nobody ever started has no clips and
--     no film to make; it just expires quietly and `join_event` already refuses
--     it.

-- ---------------------------------------------------------------------------
-- 1. close_expired_events()
-- ---------------------------------------------------------------------------
create or replace function public.close_expired_events()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_closed integer := 0;
begin
  /*
    One event at a time, each locked on its own.

    Not a single set-based UPDATE: `resolve_takes()` has to run per event, and it
    takes the same row lock that `reserve_budget` and `commit_reservation` do. A
    bulk update would either skip that settlement or hold locks across every
    expired event at once, and a phone mid-take would block on a housekeeping job.

    `skip locked` means an event currently being written by a member's phone is
    left for the next run five minutes later, rather than fighting it.
  */
  for v_event in
    select * from public.events
     where status = 'live'
       and ends_at <= now()
     order by ends_at
     for update skip locked
  loop
    /*
      Settle first, always. Takes that finished before the clock ran out are owed
      their charge, and a take still rolling has to be resolved before the event
      can move — the same rule finish_event's unresolved-take guard enforces, just
      applied rather than asserted.
    */
    perform public.resolve_takes(v_event.id);

    update public.events
       set status = 'processing'
     where id = v_event.id;

    v_closed := v_closed + 1;
  end loop;

  return v_closed;
end;
$$;

-- Nobody calls this but the scheduler. It is not a client-facing operation, and
-- a client that could reach it could end any event on the platform.
revoke all on function public.close_expired_events() from public, anon, authenticated;

comment on function public.close_expired_events() is
  'Moves every live event past its ends_at to processing, settling its takes '
  'first. Scheduled, never called by a client: a clock may end an event, a '
  'client may not. Returns how many were closed.';


-- ---------------------------------------------------------------------------
-- 2. The schedule
-- ---------------------------------------------------------------------------
-- Five minutes is chosen against what the delay costs, not against precision.
-- The visible effect of a late sweep is that 14 appears a few minutes after the
-- ending time the host picked — and every member's phone is following realtime,
-- so they all see it together whenever it lands. Nothing is lost by waiting and
-- nothing races.
--
-- **Scheduling is best-effort, and a failure here is not fatal.** pg_cron needs
-- `shared_preload_libraries`, which the local CLI image does not always carry, and
-- its objects always live in the `cron` schema regardless of what CREATE EXTENSION
-- is told. Letting that abort the migration would mean the function above never
-- lands either — and the function is the part that matters, since it can always be
-- scheduled by hand or called from anything.
--
-- **If the notice below appears on the hosted stack, events will not end on their
-- own.** Enable pg_cron in the dashboard and re-run just this block.
do $$
begin
  create extension if not exists pg_cron;

  if exists (select 1 from cron.job where jobname = 'close-expired-events') then
    perform cron.unschedule('close-expired-events');
  end if;

  perform cron.schedule(
    'close-expired-events',
    '*/5 * * * *',
    $cron$select public.close_expired_events()$cron$
  );

  raise notice 'close_expired_events() scheduled every 5 minutes.';
exception
  when others then
    raise notice
      'pg_cron unavailable (%): close_expired_events() exists but nothing calls it. '
      'Events will not end on ends_at until it is scheduled.', sqlerrm;
end;
$$;
