-- LEFT — one shared budget, and nothing else.
--
-- Three migrations built a second product on top of this one, and this removes
-- it. `shotstack_films` bought a rendering pipeline, `film_length_from_group`
-- split one number into two to feed it, and `unlock_the_film` moved the money to
-- the moment the render landed. All three assumed a generated film at the end.
--
-- **There is no generated film any more.** An event's clips play back to back,
-- which is what `film_is_a_sequence` said in the first place and what has always
-- actually worked. Everything that existed to produce, price, describe or select
-- for a rendered mp4 comes out here.
--
-- Four things follow, and the third is the one to read twice.
--
-- **The budget is the only number.** `film_seconds` existed because the group
-- filmed 2.5x what the cut would run, so the selector had something to choose
-- between. With no selector the surplus is just footage nobody watches — a group
-- that picks a two-minute film and gets five minutes of playback. So the duration
-- picked on 05.1 *is* the pool: pick two minutes, film two minutes, watch two
-- minutes. `capture_budget_for()` and `film_plan()` go with it.
--
-- **The take cap stays.** `max_take_seconds()` is untouched at 20s. Its argument
-- was never really about cutting — it is what stops one member draining a shared
-- pool, and the pool is still shared.
--
-- **The money moves back to creation.** The paywall sat on 17 because the render
-- was the product and the reveal was its demo. With nothing to re-render, the
-- unlock had nothing left to sell: it bought a clean 4K file instead of a
-- watermarked 720p one, and both of those lived inside the Shotstack client. So
-- `create_event()` claims a purchase again, exactly as it did before
-- `unlock_the_film`, and `unlock_film()` is dropped. Groups of four or fewer stay
-- free — the same free tier the original had.
--
-- **The ledger is untouched and every receipt still spends.** `public.purchases`
-- keeps its shape, its indexes and its rows. A purchase written under the unlock
-- model satisfies `max_members >= p_max_members` here just as it did there, and
-- `unlock_max_members()` still maps the six superseded `left_event_tier_*` ids.
-- Nobody is stranded by this, in either direction.
--
-- Untouched throughout: `reserve_budget`, `commit_reservation`, `resolve_takes`,
-- `release_reservation`, `available_seconds`, `remaining_seconds`,
-- `max_take_seconds`, `finish_event`, `close_expired_events`, `compile_film`,
-- `start_event`, `join_event`, and every RLS policy on clips and members.


-- ---------------------------------------------------------------------------
-- 1. The render axis comes off `public.events`
-- ---------------------------------------------------------------------------
-- Dropped before the functions that read them, so nothing is left referencing a
-- column mid-migration.
--
-- `film_unlocked_at`, `film_unlock_purchase_id` and `film_members_at_unlock` go
-- with the rest: they recorded a payment made *against a film*, and payment is
-- now recorded on `public.purchases.consumed_by_event_id`, which is where it was
-- before and where it still is. No unlock data is lost that the ledger does not
-- already hold.

drop index if exists public.events_film_render_id_idx;

alter table public.events
  drop column if exists film_path,
  drop column if exists film_status,
  drop column if exists film_render_id,
  drop column if exists film_duration_seconds,
  drop column if exists film_error,
  drop column if exists film_requested_at,
  drop column if exists film_ready_at,
  drop column if exists film_poster_path,
  drop column if exists film_quality,
  drop column if exists film_unlocked_at,
  drop column if exists film_unlock_purchase_id,
  drop column if exists film_members_at_unlock;


-- ---------------------------------------------------------------------------
-- 2. The edit, the claim, and the quality question
-- ---------------------------------------------------------------------------
-- `film_shots` recorded which clip the renderer used, from where, for how long,
-- so 17 could read the render's own edit rather than recompute it. With one
-- playback path — the clips, in order, whole — there is nothing to record: the
-- edit and the clip list are the same list.
--
-- `target_film_quality()` is dropped after `claim_film_render()`, which is its
-- only caller.

drop table if exists public.film_shots;
drop function if exists public.record_film_shots(uuid, jsonb);
drop function if exists public.claim_film_render(uuid, interval);
drop function if exists public.target_film_quality(public.events);
drop function if exists public.unlock_film(uuid, text);

drop type if exists public.film_render_status;
drop type if exists public.film_quality;


-- ---------------------------------------------------------------------------
-- 3. The films bucket
-- ---------------------------------------------------------------------------
-- Objects first: `storage.buckets` will not drop a row that still owns files,
-- and a hosted project may have real renders in here. The policy is dropped by
-- name — `storage.objects` survives, so dropping the bucket does not take its
-- policies with it.
--
-- **`storage.allow_delete_query` is the guard's own escape hatch**, not a trick.
-- `storage.protect_delete()` fires on any statement-level DELETE against
-- storage.objects or storage.buckets and refuses unless this is set, because the
-- ordinary way to lose files is a stray DELETE that leaves the API's records and
-- the actual bytes disagreeing. Retiring a whole bucket in a migration is the
-- case it is meant to allow.
--
-- A plain `set`, not `set local`: the CLI applies a migration file outside a
-- transaction block, where `set local` raises a warning and then does nothing —
-- which would leave the guard armed and the delete below refused on any project
-- that actually has renders in the bucket. It is reset immediately after.
--
-- The `clips` bucket is emphatically **not** touched. That is the group's actual
-- footage and the only video this app has left — hence the `bucket_id` filter
-- rather than a bare delete.

set storage.allow_delete_query = 'true';

delete from storage.objects where bucket_id = 'films';
drop policy if exists "films bucket: members can read" on storage.objects;
delete from storage.buckets where id = 'films';

reset storage.allow_delete_query;


-- ---------------------------------------------------------------------------
-- 4. One number: budget_plan()
-- ---------------------------------------------------------------------------
-- The same CASE table `film_plan()` carried, and `tier_max_seconds()` before it.
-- It has been tuned against the artboard twice and is not being retuned here —
-- what changes is what the number *means*. It was "how long the finished cut
-- runs, from which a 2.5x pool is derived"; it is now the pool itself.
--
-- **The default and the ceiling at once.** `create_event()` accepts a shorter
-- budget and refuses a longer one, which is the whole reason 05.1 can offer the
-- choice: a client cannot talk its way into a bigger pool, and a smaller one
-- costs the group nothing but their own decision.
--
-- Bigger groups get more because the pool is shared. 60s across a hundred people
-- is not a film, it is half a second each.
--
-- `mobile/src/lib/pricing.ts` mirrors this for display and has no authority. If
-- the two drift a screen quotes a slightly wrong promise and nothing is oversold.
create or replace function public.budget_plan(p_max_members integer)
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

revoke all on function public.budget_plan(integer) from public, anon;
grant execute on function public.budget_plan(integer) to authenticated;

comment on function public.budget_plan(integer) is
  'Group size -> how many seconds that group may film, shared between all of '
  'them. The default and the ceiling at once: create_event() derives the budget '
  'from this and accepts only a shorter one. mobile/src/lib/pricing.ts mirrors '
  'it for display.';


-- ---------------------------------------------------------------------------
-- 5. film_seconds folds back into budget_seconds
-- ---------------------------------------------------------------------------
-- The constraint goes first — it references the column being dropped.
--
-- Nothing is migrated into `budget_seconds`. Existing rows keep the budget they
-- were created with, which is correct for the same reason `capture_ratio` gave:
-- a group part-way through their evening does not have the rules changed under
-- them. Their pool is simply now also the length of what they will watch.

alter table public.events
  drop constraint if exists events_film_within_budget;

alter table public.events
  drop column if exists film_seconds;

drop function if exists public.film_plan(integer);
drop function if exists public.capture_budget_for(integer);

comment on column public.events.budget_seconds is
  'How many seconds the group may film in total, shared between every member — '
  'and, since there is no render, exactly how long the finished playback runs. '
  'Derived from max_members by budget_plan(); never accepted from a client.';


-- ---------------------------------------------------------------------------
-- 6. create_event() pays again
-- ---------------------------------------------------------------------------
-- This is `unlock_film()`'s purchase claim moved back into creation, which is
-- where it lived before `unlock_the_film` — and it is deliberately the *same*
-- claim rather than a fresh one, down to the ordering and the leniency window.
--
-- The signature changes (p_film_seconds out, p_budget_seconds and
-- p_transaction_id in), so this is a drop and create and the grants have to be
-- restated.
--
-- Kept verbatim in intent from the version this replaces: the anonymous-host
-- rule, and the reason it reads `auth.users.is_anonymous` rather than the JWT
-- claim. `linkIdentity()` upgrades the row in place and the claim stays stale
-- until the token refreshes, so gating on the claim would reject the guest who
-- just did the thing we asked them to do.
drop function if exists public.create_event(
  text, public.event_type, public.film_format, timestamptz, integer, integer
);

create function public.create_event(
  p_name           text,
  p_event_type     public.event_type,
  p_format         public.film_format,
  p_ends_at        timestamptz,
  p_max_members    integer,
  p_budget_seconds integer default null,
  -- The transaction the client believes it just made. A *lookup hint*: it prefers
  -- the right row and lets the client tell "not paid" from "not settled yet". A
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
  v_user      uuid := auth.uid();
  v_anonymous boolean;
  v_budget    integer;
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
    raise exception 'hosting a memory requires a full account'
      using errcode = '42501', hint = 'anonymous';
  end if;

  if p_ends_at <= now() then
    raise exception 'that ending time has already passed' using errcode = 'P0001';
  end if;

  /*
    The table's own check is `between 4 and 200`. Restated so a bad group size
    fails in the product's language rather than as a constraint violation.
  */
  if p_max_members < 4 or p_max_members > 200 then
    raise exception 'invalid group size' using errcode = '22023';
  end if;

  /*
    Shorter is allowed, longer is not. See budget_plan(): the plan is the
    recommendation and the ceiling at once, which is what makes the length
    choice on 05.1 safe to offer at all.
  */
  v_budget := coalesce(p_budget_seconds, public.budget_plan(p_max_members));

  if v_budget <= 0 then
    raise exception 'filming time must be positive' using errcode = '22023';
  end if;

  if v_budget > public.budget_plan(p_max_members) then
    raise exception 'that is more filming time than this group allows'
      using errcode = 'P0001';
  end if;

  /*
    The free tier, capped *here* rather than on the client so a modified build
    cannot ask for a two-hundred-person event for nothing. Four people or fewer
    is the whole of it, and budget_plan() already holds them to 60 seconds.
  */
  if p_max_members > 4 then
    /*
      Claim the cheapest unspent purchase that still covers this group, so a host
      holding both a tier_10 and a tier_50 spends the cheaper one. The
      p_transaction_id match sorts first, so the receipt just bought wins a tie
      over an older unspent one.

      The 15-minute leniency is inherited from unlock_film() and is not slack. A
      host is quoted a price for the group size on screen, taps buy, and then
      changes the group size while the store sheet is open; without this the
      purchase no longer covers the event and creation is refused *after* the
      money was taken. Far too short a window to game — you would have to buy the
      cheapest tier and add a hundred and ninety people inside fifteen minutes —
      and it turns an unrecoverable dead end into a non-event.

      `skip locked` so two concurrent calls cannot spend one purchase twice; if
      the insert below fails the whole transaction rolls back and the purchase
      stays unspent.
    */
    select * into v_purchase
      from public.purchases
     where user_id = v_user
       and consumed_at is null
       and (max_members >= p_max_members or purchased_at > now() - interval '15 minutes')
     order by (store_transaction_id is distinct from p_transaction_id), max_members, purchased_at
     for update skip locked
     limit 1;

    if not found then
      -- 'unsettled' lets the client tell "you have not paid" from "we have not
      -- seen your payment yet", which it renders very differently.
      raise exception 'no unconsumed purchase for this group size'
        using errcode = 'P0002', hint = 'unsettled';
    end if;
  end if;

  insert into public.events (
    host_id, name, event_type, format, ends_at, max_members, budget_seconds
  ) values (
    v_user, p_name, p_event_type, p_format, p_ends_at, p_max_members, v_budget
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

revoke all on function public.create_event(
  text, public.event_type, public.film_format, timestamptz, integer, integer, text
) from public, anon;
grant execute on function public.create_event(
  text, public.event_type, public.film_format, timestamptz, integer, integer, text
) to authenticated;

comment on function public.create_event(
  text, public.event_type, public.film_format, timestamptz, integer, integer, text
) is
  'Creates an event, free for groups of four or fewer and paid above that. '
  'Derives budget_seconds from budget_plan(max_members); p_budget_seconds may '
  'only shorten it. Spends one purchase from public.purchases in the same '
  'transaction as the insert.';
