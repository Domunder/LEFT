-- ---------------------------------------------------------------------------
-- Hosting requires a full account
-- ---------------------------------------------------------------------------
--
-- Anonymous users can join, film and watch. They cannot create.
--
-- `create_event()` only ever asked whether `auth.uid()` was null, and an
-- anonymous JWT answers that with a real uuid — so a guest, or anyone who called
-- `signInAnonymously()` and then the RPC, could mint events. The free tier is the
-- hole that matters: at four members and sixty seconds it consumes no purchase,
-- so nothing else in the function stood in the way. Paid tiers were already
-- bounded by the ledger, but they went through the same door.
--
-- This is the enforcement. The client gate in `(library)/films` sends a guest to
-- `(auth)/create` instead of into onboarding, but that is UX: a modified build or
-- a direct PostgREST call skips it entirely, and the edge function calls this
-- same RPC with the caller's own JWT, so putting the rule here covers both paths.
--
-- **Read `auth.users`, not the JWT claim.** `auth.jwt() ->> 'is_anonymous'` is
-- stale for exactly the user this is about: `linkIdentity()` upgrades the row in
-- place, and until that session's token is refreshed its claim still says
-- anonymous. Gating on the claim would reject the guest who just did the thing we
-- asked them to do. The column is the truth, and it flips the moment they link.
--
-- Nothing else in the function changes — it is reproduced whole because
-- `create or replace` has no other form. See
-- 20260819202201_purchases_and_create_event.sql for the purchase-claiming half.
create or replace function public.create_event(
  p_name           text,
  p_event_type     public.event_type,
  p_format         public.film_format,
  p_ends_at        timestamptz,
  p_max_members    integer,
  p_budget_seconds integer,
  p_transaction_id text default null
)
returns public.events
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_anonymous boolean;
  v_purchase  public.purchases%rowtype;
  v_event     public.events%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select u.is_anonymous into v_anonymous
    from auth.users u
   where u.id = v_user;

  if coalesce(v_anonymous, false) then
    -- The hint is what lets the client say "sign in to start your own memory"
    -- rather than showing this sentence, which is written for a log.
    raise exception 'hosting a memory requires a full account'
      using errcode = '42501', hint = 'anonymous';
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

-- `create or replace` keeps the existing grants, but restating them costs
-- nothing and makes this file readable on its own.
revoke all on function public.create_event(
  text, public.event_type, public.film_format, timestamptz, integer, integer, text
) from public, anon;
grant execute on function public.create_event(
  text, public.event_type, public.film_format, timestamptz, integer, integer, text
) to authenticated;
