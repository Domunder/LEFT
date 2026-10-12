-- LEFT — the purchase ledger, and server-enforced event creation.
--
-- Every paid tier is a consumable bought once per event. RevenueCat validates the
-- receipt, but it cannot tell us whether a given purchase has already been spent:
-- consumable redemption is explicitly the app's problem. This table is that
-- record — one row per store transaction, consumed at most once, by exactly one
-- event.
--
-- The client is never asked whether it paid. It cannot be: a modified build would
-- say yes. Rows here are written only by the RevenueCat webhook and the
-- reconciliation function (both service_role), and spent only inside
-- create_event(), which is why INSERT on events is revoked at the bottom of this
-- file. Same reasoning as the budget being server-authoritative.

-- ---------------------------------------------------------------------------
-- The tier table, mirrored server-side
-- ---------------------------------------------------------------------------

-- mobile/src/lib/pricing.ts is the client's copy; these two are the authority.
-- A client claiming its tier_10 purchase pays for a 200-person event is rejected
-- here. EDIT THESE AND pricing.ts TOGETHER — they encode the same product table.

create or replace function public.tier_max_members(p_product_id text)
returns integer
language sql
immutable
as $$
  select case p_product_id
    when 'left_event_tier_10'  then 10
    when 'left_event_tier_25'  then 25
    when 'left_event_tier_50'  then 50
    when 'left_event_tier_100' then 100
    when 'left_event_tier_150' then 150
    when 'left_event_tier_200' then 200
    else null
  end;
$$;

-- The longest film each tier covers — mirrors durationsForGroup() in pricing.ts.
create or replace function public.tier_max_seconds(p_max_members integer)
returns integer
language sql
immutable
as $$
  select case
    when p_max_members <= 4   then 60
    when p_max_members <= 10  then 120
    when p_max_members <= 25  then 240
    when p_max_members <= 50  then 360
    when p_max_members <= 100 then 480
    else 600
  end;
$$;

-- ---------------------------------------------------------------------------
-- The ledger
-- ---------------------------------------------------------------------------

create table public.purchases (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  -- The tier SKU, e.g. 'left_event_tier_25'. Text rather than an enum so adding
  -- a tier does not need a migration; tier_max_members() validates it.
  product_id           text not null,
  -- The store's transaction id, and the idempotency key: RevenueCat retries a
  -- webhook up to five times and every retry carries this same value.
  store_transaction_id text not null unique,
  -- The largest group this purchase pays for, compared against events.max_members.
  max_members          integer not null check (max_members between 5 and 200),
  -- Sandbox purchases are real rows so TestFlight works end to end, but they are
  -- marked so they can be swept before launch without touching real ones.
  environment          text not null check (environment in ('PRODUCTION', 'SANDBOX')),
  store                text,
  price_cents          integer,
  currency             text,
  purchased_at         timestamptz not null,
  created_at           timestamptz not null default now(),
  -- Null until spent. Set atomically with the event insert, never by a client.
  consumed_at          timestamptz,
  consumed_by_event_id uuid references public.events (id) on delete set null,

  constraint purchases_consumed_together check (
    (consumed_at is null) = (consumed_by_event_id is null)
  )
);

-- The hot path: "does this user have an unspent purchase big enough?"
create index purchases_unconsumed_idx
  on public.purchases (user_id, max_members)
  where consumed_at is null;

-- An event is paid for at most once.
create unique index purchases_one_per_event_idx
  on public.purchases (consumed_by_event_id)
  where consumed_by_event_id is not null;

alter table public.purchases enable row level security;

-- Readable so a host can be shown a purchase they paid for but never redeemed —
-- a crash between paying and creating. Never writable from a client.
create policy "purchases: owner can read"
  on public.purchases for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.purchases to authenticated;
-- Deliberately no insert/update/delete grant: the webhook and the reconciliation
-- function use service_role, which bypasses RLS, and create_event() is
-- SECURITY DEFINER.

-- ---------------------------------------------------------------------------
-- Event creation
-- ---------------------------------------------------------------------------

-- The only way an events row comes into existence.
--
-- Free tier: capped at 4 members and 60 seconds *here*, not on the client, so a
-- modified build cannot ask for a 200-person 10-minute film for nothing.
--
-- Paid tiers: an unconsumed purchase covering this group size is claimed
-- FOR UPDATE SKIP LOCKED and marked consumed in the same transaction as the
-- insert. Two concurrent calls cannot spend one purchase twice, and if the insert
-- fails the purchase stays unspent.
create or replace function public.create_event(
  p_name           text,
  p_event_type     public.event_type,
  p_format         public.film_format,
  p_ends_at        timestamptz,
  p_max_members    integer,
  p_budget_seconds integer,
  -- The transaction the client believes it just made. Used to prefer the right
  -- row and to report "not settled yet" precisely. Never trusted on its own: a
  -- row must already exist, and only service_role writes rows.
  p_transaction_id text default null
)
returns public.events
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_purchase public.purchases%rowtype;
  v_event    public.events%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_ends_at <= now() then
    raise exception 'that ending time has already passed' using errcode = 'P0001';
  end if;

  if p_budget_seconds <= 0 then
    raise exception 'budget must be positive' using errcode = '22023';
  end if;

  if p_max_members <= 4 then
    -- Free tier. These caps are the product's, not the client's.
    if p_max_members < 1 then
      raise exception 'invalid group size' using errcode = '22023';
    end if;
    if p_budget_seconds > public.tier_max_seconds(p_max_members) then
      raise exception 'the free tier is limited to 60 seconds' using errcode = 'P0001';
    end if;
  else
    -- Paid. Claim the smallest unspent purchase that still covers this group, so
    -- a host holding both a tier_25 and a tier_200 spends the cheaper one. The
    -- p_transaction_id match sorts first, so the purchase just made wins a tie.
    select * into v_purchase
      from public.purchases
     where user_id = v_user
       and consumed_at is null
       and max_members >= p_max_members
     order by (store_transaction_id is distinct from p_transaction_id), max_members, purchased_at
     for update skip locked
     limit 1;

    if not found then
      -- 'unsettled' lets the client tell "you have not paid" from "we have not
      -- seen your payment yet", which it renders very differently.
      raise exception 'no unconsumed purchase for this group size'
        using errcode = 'P0002', hint = 'unsettled';
    end if;

    if p_budget_seconds > public.tier_max_seconds(v_purchase.max_members) then
      raise exception 'that film length is longer than this tier allows'
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.events (
    host_id, name, event_type, format, ends_at, max_members, budget_seconds
  ) values (
    v_user, p_name, p_event_type, p_format, p_ends_at, p_max_members, p_budget_seconds
  )
  returning * into v_event;

  if v_purchase.id is not null then
    update public.purchases
       set consumed_at = now(), consumed_by_event_id = v_event.id
     where id = v_purchase.id;
  end if;

  return v_event;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

-- The load-bearing revoke. With INSERT granted, a client could write an events
-- row directly and skip create_event() entirely — the old policy checked only
-- host_id = auth.uid(), which a client paying nothing satisfies trivially.
-- Without this line the rest of this file is decorative.
revoke insert on public.events from authenticated;
drop policy if exists "events: host can create" on public.events;

revoke all on function public.create_event(
  text, public.event_type, public.film_format, timestamptz, integer, integer, text
) from public, anon;
grant execute on function public.create_event(
  text, public.event_type, public.film_format, timestamptz, integer, integer, text
) to authenticated;

revoke all on function public.tier_max_members(text) from public, anon;
revoke all on function public.tier_max_seconds(integer) from public, anon;
