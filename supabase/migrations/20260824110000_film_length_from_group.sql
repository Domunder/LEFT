-- LEFT — the film's length stops being a question, and creation stops being a sale.
--
-- Two changes that only make sense together.
--
-- **1. The host was being asked something they cannot answer.** Screen 05.1 offered
-- a film length, but within any tier the options cost the same — so the longer one
-- strictly dominated and the control was decoration on an unanswerable question.
-- Nobody knows, before the party, whether their wedding is a four-minute film or a
-- six-minute one. Group size they *do* know. So the group is the only question,
-- and the length derives from it and is shown as a consequence.
--
-- **2. p_budget_seconds was a client's number the server had to police.** That is
-- the whole reason the tier table lived in six places: every layer needed a copy to
-- validate a value it did not compute. `create_event` now derives the budget itself
-- from `film_plan()`, and five of those copies become unnecessary.
-- `mobile/src/lib/pricing.ts` survives as a *display mirror with no authority* — if
-- it drifts, a screen quotes a slightly wrong promise and nothing is oversold.
--
-- **Creation is now free at every group size.** Payment moves to after the film is
-- revealed (see 20260824120000_unlock_the_film.sql), so there is no purchase to
-- claim here and no free-tier branch to guard. `max_members` keeps exactly one job:
-- it is the estimate that sizes the budget, and later the basis the unlock is
-- priced on.

-- ---------------------------------------------------------------------------
-- 1. The capture ratio, in one place
-- ---------------------------------------------------------------------------
-- How much a group may film, given how long their film is meant to be.
--
-- **It ships at 1.0 and that is deliberate.** The design calls for the group to
-- film more than the film is long, so the render has something to choose between
-- rather than concatenating everything. But `finish_event()` refuses while budget
-- remains, and nothing yet closes an event when `ends_at` passes — so running the
-- pool to zero is the *only* route to 'ready'. Multiply the budget before that is
-- fixed and most events would simply never render.
--
-- The sweeper migration lifts this to 2.5. Until then budget == film plus a floor,
-- and behaviour is what it is today. **Change the literal here and nowhere else.**
--
-- The +60 floor is the rule that binds at the small end. A four-person group's 60s
-- film gets no slack at all from a ratio of 1.0, and little enough even at 2.5 — a
-- handful of takes is a handful of takes whatever the ratio says.
create or replace function public.capture_budget_for(p_film_seconds integer)
returns integer
language sql
immutable
as $$
  select greatest(p_film_seconds + 60, round(p_film_seconds * 1.0))::integer;
$$;

revoke all on function public.capture_budget_for(integer) from public, anon;
grant execute on function public.capture_budget_for(integer) to authenticated;

comment on function public.capture_budget_for(integer) is
  'Seconds a group may film, for a film of the given length. The capture ratio '
  'lives here and only here. Held at 1.0 until events close on ends_at.';


-- ---------------------------------------------------------------------------
-- 2. film_plan() — the group is the input, everything else falls out
-- ---------------------------------------------------------------------------
-- The group -> film-length table is unchanged from `tier_max_seconds()`, which this
-- supersedes. It was already tuned and already agreed with the artboard; what
-- changes is that it is a *default* now rather than a ceiling on a choice.
create or replace function public.film_plan(p_max_members integer)
returns table (film_seconds integer, budget_seconds integer)
language sql
immutable
as $$
  with plan as (
    select case
             when p_max_members <= 4   then 60
             when p_max_members <= 10  then 120
             when p_max_members <= 25  then 240
             when p_max_members <= 50  then 360
             when p_max_members <= 100 then 480
             else 600
           end as film
  )
  select plan.film, public.capture_budget_for(plan.film) from plan;
$$;

revoke all on function public.film_plan(integer) from public, anon;
grant execute on function public.film_plan(integer) to authenticated;

comment on function public.film_plan(integer) is
  'Group size -> (film_seconds, budget_seconds). The authority: create_event '
  'derives both from this rather than trusting the client. '
  'mobile/src/lib/pricing.ts mirrors it for display only.';


-- ---------------------------------------------------------------------------
-- 3. An event knows how long its film should be
-- ---------------------------------------------------------------------------
-- `budget_seconds` has always meant both "what the group may film" and "how long
-- the film is", because they were the same number. Selection separates them, and
-- the film's target needs somewhere to live before the renderer can read it.
--
-- Backfilled from `budget_seconds`: today they *are* equal, so every existing row
-- is already correct and no event changes behaviour when this applies.
alter table public.events
  add column film_seconds integer not null default 60 check (film_seconds > 0);

update public.events set film_seconds = budget_seconds;

alter table public.events
  add constraint events_film_within_budget check (film_seconds <= budget_seconds);

comment on column public.events.film_seconds is
  'How long the finished film should be. <= budget_seconds, and equal to it until '
  'the capture ratio rises above 1.0 — after which the render selects rather than '
  'concatenating.';

comment on column public.events.budget_seconds is
  'How many seconds the group may film in total. Derived from max_members by '
  'film_plan() — never accepted from a client.';


-- ---------------------------------------------------------------------------
-- 4. create_event() — no purchase, no tier, no client-supplied budget
-- ---------------------------------------------------------------------------
-- The signature changes (p_budget_seconds and p_transaction_id out, p_film_seconds
-- in), so this is a drop and create rather than a replace, and the grants have to
-- be restated.
--
-- Gone: the `p_max_members <= 4` free-tier branch, the purchase claim with its
-- `for update skip locked`, the `tier_max_seconds` validation, and the 'unsettled'
-- raise. All of it moves to `unlock_film()`, where the money now is.
--
-- Kept, verbatim in intent: the anonymous-host rule and the reason for it. Read
-- `auth.users.is_anonymous`, never the JWT claim — `linkIdentity()` upgrades the
-- row in place and the claim stays stale until the token refreshes, so gating on
-- the claim would reject the guest who just did the thing we asked them to do.
drop function if exists public.create_event(
  text, public.event_type, public.film_format, timestamptz, integer, integer, text
);

create function public.create_event(
  p_name         text,
  p_event_type   public.event_type,
  p_format       public.film_format,
  p_ends_at      timestamptz,
  p_max_members  integer,
  p_film_seconds integer default null
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
  v_plan      record;
  v_film      integer;
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

  select * into v_plan from public.film_plan(p_max_members);

  /*
    A film may be adjusted **shorter**, never longer.

    That asymmetry is what makes the Adjust control on 05.1 safe to offer: the plan
    is the recommendation and the ceiling at once, so a client cannot talk its way
    into a longer film, and a shorter one costs the group nothing but their choice.
  */
  v_film := coalesce(p_film_seconds, v_plan.film_seconds);

  if v_film <= 0 then
    raise exception 'film length must be positive' using errcode = '22023';
  end if;

  if v_film > v_plan.film_seconds then
    raise exception 'that film length is longer than this group allows'
      using errcode = 'P0001';
  end if;

  insert into public.events (
    host_id, name, event_type, format, ends_at, max_members, budget_seconds, film_seconds
  ) values (
    v_user, p_name, p_event_type, p_format, p_ends_at, p_max_members,
    /*
      The budget follows the *effective* film length, not the group's default. A
      host who shortens the film should not still have to fill a pool sized for the
      film they did not pick.
    */
    public.capture_budget_for(v_film), v_film
  )
  returning * into v_event;

  return v_event;
end;
$$;

revoke all on function public.create_event(
  text, public.event_type, public.film_format, timestamptz, integer, integer
) from public, anon;
grant execute on function public.create_event(
  text, public.event_type, public.film_format, timestamptz, integer, integer
) to authenticated;

comment on function public.create_event(
  text, public.event_type, public.film_format, timestamptz, integer, integer
) is
  'Creates an event, free at any group size. Derives budget_seconds and '
  'film_seconds from film_plan(max_members); p_film_seconds may only shorten the '
  'film. Payment happens later, in unlock_film().';


-- ---------------------------------------------------------------------------
-- 5. The superseded tier functions
-- ---------------------------------------------------------------------------
-- `tier_max_seconds()` was the server's copy of the duration table and is now
-- `film_plan()`'s job. `tier_max_members()` was dead on arrival — defined, revoked
-- from everything, granted to nobody, and never called by any function or edge
-- function; the TypeScript TIER_MAX_MEMBERS map did that work instead.
--
-- Both go now rather than being left to rot: a stale copy of a pricing table is
-- exactly the thing someone reads by mistake a year later.
drop function if exists public.tier_max_seconds(integer);
drop function if exists public.tier_max_members(text);
