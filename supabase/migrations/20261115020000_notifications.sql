-- Push notifications (M4).
--
-- Two messages, both about the one thing a guest cannot see for themselves:
--
--   developed    "your photos are developed" — when an event's status flips.
--   ending_soon  a reminder shortly before the end, to guests with frames left.
--
-- The database decides *that* a message is due and *who* gets it; it cannot
-- talk to Expo's push service, so the sending is the `send-notifications` edge
-- function. The handover is an outbox (`public.notifications`): one row per
-- event and kind, written here, claimed and completed by the function.
-- pg_cron wakes the function through pg_net whenever the outbox is not empty.
--
-- Preferences live on the device's token row, so the server can honour 20's two
-- switches without the app being open.

-- ---------------------------------------------------------------------------
-- The numbers
-- ---------------------------------------------------------------------------

-- How long before the end the reminder goes out.
create function public.reminder_lead() returns interval
language sql immutable set search_path = '' as $$ select interval '60 minutes' $$;

-- An event shorter than this gets no reminder: it would arrive right after the
-- invitation and be noise.
create function public.reminder_min_event_length() returns interval
language sql immutable set search_path = '' as $$ select interval '3 hours' $$;

-- ---------------------------------------------------------------------------
-- Device tokens
-- ---------------------------------------------------------------------------

-- One row per installed app. The token is the key, not (user, token): a phone
-- has one token whoever is signed in, and the last person to register owns it,
-- so a signed-out user's notifications never reach the next one.
create table public.push_tokens (
  token            text primary key check (char_length(token) between 10 and 255),
  user_id          uuid not null references auth.users (id) on delete cascade,
  platform         text not null check (platform in ('ios', 'android')),
  -- 20's two switches.
  notify_developed boolean not null default true,
  notify_reminder  boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

-- The only way a token is written. SECURITY DEFINER because taking a token over
-- from the previous user of the phone is an update of somebody else's row.
create function public.register_push_token(
  p_token            text,
  p_platform         text,
  p_notify_developed boolean default true,
  p_notify_reminder  boolean default true
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_token is null or char_length(p_token) not between 10 and 255 then
    raise exception 'invalid push token' using errcode = '22023';
  end if;

  if p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'invalid platform' using errcode = '22023';
  end if;

  insert into public.push_tokens as t
    (token, user_id, platform, notify_developed, notify_reminder)
  values (
    p_token, auth.uid(), p_platform,
    coalesce(p_notify_developed, true), coalesce(p_notify_reminder, true)
  )
  on conflict (token) do update
    set user_id          = excluded.user_id,
        platform         = excluded.platform,
        notify_developed = excluded.notify_developed,
        notify_reminder  = excluded.notify_reminder,
        updated_at       = now();
end;
$$;

-- Signing out. Only your own row: a token is not a secret worth much, but
-- nobody else gets to silence your phone with it.
create function public.unregister_push_token(p_token text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  delete from public.push_tokens
   where token = p_token and user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- The outbox
-- ---------------------------------------------------------------------------

create type public.notification_kind as enum ('developed', 'ending_soon');

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  kind       public.notification_kind not null,
  created_at timestamptz not null default now(),
  -- Set when the sender picks the row up; a claim older than five minutes is a
  -- sender that died, and the row is offered again.
  claimed_at timestamptz,
  -- Set when it is over, sent or not. `recipients` is how many devices it went
  -- to; `skipped` says why it went to none.
  sent_at    timestamptz,
  recipients integer,
  skipped    text,

  -- Once per event and kind, ever. This is what makes every writer idempotent.
  unique (event_id, kind)
);

create index notifications_pending_idx on public.notifications (created_at) where sent_at is null;

-- "Your photos are developed". On the status flip, whoever caused it — the
-- host's end_event() or the clock's develop_expired_events(). An event nobody
-- took a picture in develops silently.
create function public.enqueue_developed_notification()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.photos p where p.event_id = new.id) then
    insert into public.notifications (event_id, kind)
    values (new.id, 'developed')
    on conflict (event_id, kind) do nothing;
  end if;

  return new;
end;
$$;

create trigger events_enqueue_developed_notification
  after update of status on public.events
  for each row
  when (old.status <> 'developed' and new.status = 'developed')
  execute function public.enqueue_developed_notification();

-- The reminder. Scheduled; finds live events inside the lead window.
create function public.enqueue_ending_reminders()
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notifications (event_id, kind)
  select e.id, 'ending_soon'
    from public.events e
   where e.status = 'live'
     and e.ends_at > now()
     and e.ends_at <= now() + public.reminder_lead()
     and e.ends_at - e.created_at >= public.reminder_min_event_length()
  on conflict (event_id, kind) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- The sender takes work. Rows that are no longer worth sending are closed here
-- rather than delivered late: a reminder for an event that has ended, or
-- anything that sat in the outbox for a day.
create function public.claim_notifications(p_limit integer default 20)
returns table (id uuid, event_id uuid, kind public.notification_kind, event_name text)
language plpgsql volatile security definer set search_path = ''
as $$
begin
  update public.notifications n
     set sent_at = now(), recipients = 0, skipped = 'stale'
    from public.events e
   where e.id = n.event_id
     and n.sent_at is null
     and (
       n.created_at < now() - interval '24 hours'
       or (n.kind = 'ending_soon' and (e.ends_at <= now() or e.status <> 'live'))
     );

  return query
  with picked as (
    select n.id
      from public.notifications n
     where n.sent_at is null
       and (n.claimed_at is null or n.claimed_at < now() - interval '5 minutes')
     order by n.created_at
     limit greatest(1, least(coalesce(p_limit, 20), 100))
     for update skip locked
  )
  update public.notifications n
     set claimed_at = now()
    from picked, public.events e
   where n.id = picked.id and e.id = n.event_id
  returning n.id, n.event_id, n.kind, e.name;
end;
$$;

-- Who gets it. The switches are applied here, so a token whose owner turned a
-- kind off is never even handed to the sender. The reminder only goes to
-- guests who can still shoot; shots_left is NULL on an unlimited roll.
create function public.notification_recipients(p_notification_id uuid)
returns table (token text, shots_left integer)
language sql stable security definer set search_path = ''
as $$
  select t.token,
         case when e.roll_size is null then null::integer
              else greatest(0, e.roll_size - m.shots_taken) end
    from public.notifications n
    join public.events e         on e.id = n.event_id
    join public.event_members m  on m.event_id = e.id
    join public.push_tokens t    on t.user_id = m.user_id
   where n.id = p_notification_id
     and (
       (n.kind = 'developed' and t.notify_developed)
       or (
         n.kind = 'ending_soon'
         and t.notify_reminder
         and m.shots_taken < coalesce(e.roll_size, public.unlimited_roll_cap())
       )
     );
$$;

create function public.complete_notification(
  p_notification_id uuid,
  p_recipients      integer,
  p_skipped         text default null
)
returns void
language sql volatile security definer set search_path = ''
as $$
  update public.notifications
     set sent_at = now(), recipients = p_recipients, skipped = p_skipped
   where id = p_notification_id and sent_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Waking an edge function from the database
-- ---------------------------------------------------------------------------

-- Posts to /functions/v1/{name} with the service-role key. Both come from
-- Vault — `project_url` and `service_role_key` — because a migration must not
-- contain either. Returns false, loudly, when they are missing or pg_net is not
-- installed; nothing else breaks, the outbox just waits.
create function public.invoke_edge_function(p_name text)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  select s.decrypted_secret into v_url
    from vault.decrypted_secrets s where s.name = 'project_url';
  select s.decrypted_secret into v_key
    from vault.decrypted_secrets s where s.name = 'service_role_key';

  if v_url is null or v_key is null then
    raise notice 'invoke_edge_function(%): Vault secrets project_url / service_role_key are not set', p_name;
    return false;
  end if;

  perform net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/' || p_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );

  return true;
exception
  when others then
    raise notice 'invoke_edge_function(%) failed: %', p_name, sqlerrm;
    return false;
end;
$$;

-- Scheduled. Does nothing when there is nothing to send.
create function public.dispatch_notifications()
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.notifications n where n.sent_at is null) then
    return false;
  end if;

  return public.invoke_edge_function('send-notifications');
end;
$$;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.push_tokens   enable row level security;
alter table public.notifications enable row level security;

-- A user may see their own devices; writing goes through the two functions.
create policy "push tokens: owner can read"
  on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));

-- No policy on notifications: the outbox is the server's alone.

revoke all on public.push_tokens, public.notifications from anon, authenticated;
grant select on public.push_tokens to authenticated;

revoke all on function
  public.reminder_lead(),
  public.reminder_min_event_length(),
  public.register_push_token(text, text, boolean, boolean),
  public.unregister_push_token(text),
  public.enqueue_developed_notification(),
  public.enqueue_ending_reminders(),
  public.claim_notifications(integer),
  public.notification_recipients(uuid),
  public.complete_notification(uuid, integer, text),
  public.invoke_edge_function(text),
  public.dispatch_notifications()
from public, anon, authenticated;

grant execute on function public.register_push_token(text, text, boolean, boolean) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

grant execute on function public.enqueue_ending_reminders() to service_role;
grant execute on function public.claim_notifications(integer) to service_role;
grant execute on function public.notification_recipients(uuid) to service_role;
grant execute on function public.complete_notification(uuid, integer, text) to service_role;
grant execute on function public.dispatch_notifications() to service_role;

-- ---------------------------------------------------------------------------
-- The clock
-- ---------------------------------------------------------------------------

do $$
begin
  create extension if not exists pg_net;
exception
  when others then
    raise notice 'pg_net unavailable (%): notifications queue up but are never sent.', sqlerrm;
end;
$$;

-- Every minute, after develop-expired-events has had its turn: queue reminders
-- that have come due, then wake the sender if anything is waiting.
do $$
begin
  create extension if not exists pg_cron;

  if exists (select 1 from cron.job where jobname = 'notifications-tick') then
    perform cron.unschedule('notifications-tick');
  end if;

  perform cron.schedule(
    'notifications-tick',
    '* * * * *',
    $cron$select public.enqueue_ending_reminders(); select public.dispatch_notifications();$cron$
  );
exception
  when others then
    raise notice 'pg_cron unavailable (%): no reminders, and nothing wakes the sender.', sqlerrm;
end;
$$;
