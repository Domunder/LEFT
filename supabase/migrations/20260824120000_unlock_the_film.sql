-- LEFT — the paywall moves to after the film exists.
--
-- Until now the host paid at event creation: before any footage existed, before
-- anyone had seen a film, for a group size they were guessing at. That is selling
-- a promise. The finished film is the product and the reveal is its demo, so the
-- ask belongs there — "here is your film, unlock the clean copy" converts on
-- something the buyer has already watched.
--
-- Three consequences, and the third is the one worth reading twice.
--
-- **The price is based on who actually turned up.** `unlock_film()` counts
-- `event_members` itself. A client cannot inflate or deflate the basis, and a host
-- who guessed 25 and got 40 is priced on the 40 who are in the film.
--
-- **Any member may unlock, not only the host.** The film lands at
-- `{event_id}/film.mp4` in the `films` bucket, whose only policy is `select` for
-- `is_event_member`. Unlocking changes the file's *quality*, never its audience —
-- exactly the people who could already read the watermarked copy read the clean
-- one. So there is no reason to make the group wait on one person's phone.
--
-- **The re-render is modelled as state, not as a force flag.** A film that has been
-- paid for is entitled to a different file from one that has not, and
-- `claim_film_render` already owns the question "does this event need rendering?".
-- Giving it a `p_force` parameter would hand every member a button that bills the
-- Shotstack account. Instead the event carries the quality of the file that exists
-- and a function says what it *should* be; the claim reopens on its own when those
-- disagree, and closes again when they match. It is idempotent under retries and
-- self-healing when a render fails.

-- ---------------------------------------------------------------------------
-- 1. What a film's file can be
-- ---------------------------------------------------------------------------
create type public.film_quality as enum ('watermarked', 'clean');

comment on type public.film_quality is
  'The quality of the file currently in the films bucket. Not what the event is '
  'entitled to — that is target_film_quality().';

alter table public.events
  add column film_unlocked_at        timestamptz,
  add column film_unlock_purchase_id uuid references public.purchases (id) on delete set null,
  add column film_members_at_unlock  integer,
  add column film_quality            public.film_quality;

comment on column public.events.film_unlocked_at is
  'When someone paid to unlock this film. Null means the render is watermarked '
  'and 720p. Set by unlock_film() only.';

comment on column public.events.film_members_at_unlock is
  'How many members the event had when it was unlocked — the basis the price was '
  'quoted on. Kept for support and for refunds, never read by the render.';

comment on column public.events.film_quality is
  'Quality of the file in the bucket right now. Null until a render lands. '
  'Written by shotstack-callback from the intent captured at submit time — NOT '
  'from film_unlocked_at, or an unlock mid-render would stamp clean over a '
  'watermarked file and the re-render would never happen.';


-- ---------------------------------------------------------------------------
-- 2. The ledger stops assuming payment precedes creation
-- ---------------------------------------------------------------------------
-- `max_members between 5 and 200` encoded the old model twice over: that a
-- purchase always covered a paid *tier* (so never fewer than five people), and
-- that 200 was the largest group anyone could buy.
--
-- Neither holds now. An unlock can cover a four-person dinner, and the top tier is
-- unbounded — 2147483647 rather than a number, because "unlimited" priced as a
-- tier still has to compare against a member count.
--
-- **The old SKUs keep working, and that is on purpose.** An unspent
-- `left_event_tier_50` row still satisfies `max_members >= member_count`, so anyone
-- who paid under the old model can spend it on a film. Nobody is stranded by the
-- change, and the claim in unlock_film() needs no special case to make it true.
alter table public.purchases drop constraint if exists purchases_max_members_check;
alter table public.purchases add constraint purchases_max_members_check
  check (max_members > 0);


-- ---------------------------------------------------------------------------
-- 3. The three SKUs
-- ---------------------------------------------------------------------------
-- Priced on the roster, not on the guess. The six legacy ids are mapped so the
-- webhook can still record a purchase made before this shipped.
create or replace function public.unlock_max_members(p_product_id text)
returns integer
language sql
immutable
as $$
  select case p_product_id
    when 'left_film_unlock_10'        then 10
    when 'left_film_unlock_50'        then 50
    when 'left_film_unlock_unlimited' then 2147483647
    -- Superseded, still honoured. See the ledger note above.
    when 'left_event_tier_10'         then 10
    when 'left_event_tier_25'         then 25
    when 'left_event_tier_50'         then 50
    when 'left_event_tier_100'        then 100
    when 'left_event_tier_150'        then 150
    when 'left_event_tier_200'        then 200
    else null
  end;
$$;

-- Service role only: the webhook and the reconcile path reach it, no client does.
--
-- The grant is not a formality. `service_role` is `bypassrls`, which gets it past
-- table policies — it is **not** a superuser, so function EXECUTE is still checked
-- and revoking from `public` would otherwise lock the webhook out of its own
-- lookup.
revoke all on function public.unlock_max_members(text) from public, anon, authenticated;
grant execute on function public.unlock_max_members(text) to service_role;

comment on function public.unlock_max_members(text) is
  'Store product id -> the largest group it covers. The SKU table, in the one '
  'place both the webhook and unlock_film() can read it.';


-- ---------------------------------------------------------------------------
-- 4. What quality this event is entitled to
-- ---------------------------------------------------------------------------
create or replace function public.target_film_quality(e public.events)
returns public.film_quality
language sql
immutable
as $$
  select case when e.film_unlocked_at is not null then 'clean' else 'watermarked' end::public.film_quality;
$$;

comment on function public.target_film_quality(public.events) is
  'What this event''s film file SHOULD be. Compared against events.film_quality '
  '(what it is) to decide whether a render is owed.';


-- ---------------------------------------------------------------------------
-- 5. unlock_film() — the money, and only the money
-- ---------------------------------------------------------------------------
-- Deliberately does not touch `film_status`. Unlocking records that the film was
-- paid for; the render is a separate, retryable step that the client kicks off and
-- that `claim_film_render` guards. Coupling them would mean a failed render left
-- the purchase looking unspent.
create or replace function public.unlock_film(
  p_event_id       uuid,
  p_transaction_id text default null
)
returns table (event public.events, outcome text)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_event    public.events%rowtype;
  v_members  integer;
  v_purchase public.purchases%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_event from public.events where id = p_event_id for update;

  if not found then
    raise exception 'no such event' using errcode = 'P0002';
  end if;

  if not public.is_event_member(p_event_id, v_user) then
    raise exception 'you are not a member of this event' using errcode = '42501';
  end if;

  /*
    Already unlocked, by anyone.

    Returns without consuming a purchase, which is the point: if two members both
    reach the store sheet, the second one's receipt stays unspent in the ledger and
    can be used on their next film. Refusing here and keeping their money would be
    the only worse option.
  */
  if v_event.film_unlocked_at is not null then
    return query select v_event, 'already'::text;
    return;
  end if;

  select count(*) into v_members
    from public.event_members
   where event_id = p_event_id;

  /*
    Claim the cheapest purchase that covers the roster.

    The 15-minute leniency is not slack, it is a specific bug fix. Without it:
    someone opens 17 with nine members, is quoted the <=10 price, taps buy, and a
    straggler joins while the store sheet is open. The roster is now ten-plus, the
    receipt no longer covers it, and the unlock is refused *after* the money was
    taken. The window is far too short to game at scale — you would have to buy the
    cheapest unlock and add forty-one people inside fifteen minutes — and it turns
    an unrecoverable dead end into a non-event.

    The p_transaction_id match sorts first so the receipt just bought wins a tie
    over an older unspent one; then the smallest cap, so a member holding both a
    tier_10 and a tier_50 spends the cheaper.
  */
  select * into v_purchase
    from public.purchases
   where user_id = v_user
     and consumed_at is null
     and (max_members >= v_members or purchased_at > now() - interval '15 minutes')
   order by (store_transaction_id is distinct from p_transaction_id), max_members, purchased_at
   for update skip locked
   limit 1;

  if not found then
    raise exception 'no unconsumed purchase for this film'
      using errcode = 'P0002', hint = 'unsettled';
  end if;

  update public.purchases
     set consumed_at = now(), consumed_by_event_id = p_event_id
   where id = v_purchase.id;

  update public.events
     set film_unlocked_at        = now(),
         film_unlock_purchase_id = v_purchase.id,
         film_members_at_unlock  = v_members
   where id = p_event_id
   returning * into v_event;

  return query select v_event, 'unlocked'::text;
end;
$$;

revoke all on function public.unlock_film(uuid, text) from public, anon;
grant execute on function public.unlock_film(uuid, text) to authenticated;

comment on function public.unlock_film(uuid, text) is
  'Spends one purchase against this event and marks its film unlocked. Any '
  'member may call it. Returns outcome ''already'' without consuming anything if '
  'someone got there first. Does not render — claim_film_render() reopens on its '
  'own once the target quality changes.';


-- ---------------------------------------------------------------------------
-- 6. claim_film_render() reopens when the film owes a better file
-- ---------------------------------------------------------------------------
-- Reproduced whole from 20260823140000_shotstack_films.sql; the only change is the
-- already-rendered guard, which now asks whether the file that exists is the file
-- the event is entitled to.
--
-- `purchases_one_per_event_idx` (unique on consumed_by_event_id) was written for
-- creation and is exactly right here: an event can be paid for at most once, so
-- the target can flip from watermarked to clean and never back.
create or replace function public.claim_film_render(
  p_event_id    uuid,
  p_stale_after interval default interval '30 minutes'
)
returns boolean
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

  if not public.is_event_member(p_event_id, auth.uid()) then
    raise exception 'you are not a member of this event' using errcode = '42501';
  end if;

  -- Nothing to render until every clip that is coming has arrived. That is
  -- precisely what 'ready' has meant since the film_is_a_sequence migration.
  if v_event.status <> 'ready' then
    return false;
  end if;

  /*
    Already rendered, at the quality this event is owed. Asking again would
    replace a good file with an identical one and bill for the privilege.

    The second half of that condition is what makes the paywall work. An unlock
    flips target_film_quality() to 'clean' while film_quality is still
    'watermarked', the two disagree, and this gate opens without anyone passing a
    flag. When the clean render lands they match again and it closes.

    It is also why a failed 4K render is safe: film_quality stays 'watermarked',
    so the next attempt is legal. Nothing has to remember that a retry is owed.
  */
  if v_event.film_status = 'ready'
     and v_event.film_quality is not distinct from public.target_film_quality(v_event) then
    return false;
  end if;

  -- Someone else holds a live claim. Only a stale one may be taken over.
  if v_event.film_status in ('queued', 'rendering')
     and v_event.film_requested_at is not null
     and v_event.film_requested_at > now() - p_stale_after then
    return false;
  end if;

  update public.events
     set film_status       = 'queued',
         film_requested_at = now(),
         -- The abandoned attempt's identifiers are not this one's. Cleared so a
         -- late callback from it cannot land on the render replacing it.
         film_render_id    = null,
         film_error        = null
   where id = p_event_id;

  return true;
end;
$$;

comment on function public.claim_film_render(uuid, interval) is
  'Atomically claims the right to render this event''s film. True for exactly '
  'one caller; false for everyone racing it. Claims again when the file in the '
  'bucket is not the quality the event is entitled to — which is how paying for '
  'a film triggers its clean re-render.';
