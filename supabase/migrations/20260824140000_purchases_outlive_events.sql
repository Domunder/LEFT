-- LEFT — a spent purchase survives the event it paid for.
--
-- `purchases_consumed_together` asserted that `consumed_at` and
-- `consumed_by_event_id` are always null together:
--
--     check ((consumed_at is null) = (consumed_by_event_id is null))
--
-- which is right about one direction and wrong about the other, and the wrong
-- half fires on a path the app actually has.
--
-- `consumed_by_event_id` is `on delete set null`. So deleting an event nulls the
-- column while `consumed_at` stays set, the check fails, and **the delete is
-- refused**. The event cannot be removed, and neither can the account that owns
-- it — `prepare_account_deletion()` cascades through events, so a user who ever
-- unlocked a film could not delete their account. CLAUDE.md has carried this as a
-- suspected risk under "Account deletion"; it is real, and section 28 of
-- `supabase/checks/budget_invariants.sql` reproduces it.
--
-- It was latent before because a purchase was only ever consumed by
-- `create_event()` in the same transaction as the insert, and nothing in testing
-- then deleted such an event. `unlock_film()` writes the same pair far more often
-- and on a much more ordinary path.
--
-- **The invariant that actually matters is one-directional**: a purchase pointing
-- at an event must be marked spent. The reverse does not hold — a spent purchase
-- whose event has been deleted is a true and unremarkable state. The money was
-- taken, the receipt is used, the thing it bought is gone. What must never happen
-- is the ledger forgetting a purchase was spent, and nulling `consumed_at` is the
-- only thing that could do that.
--
-- Keeping the row also keeps the record: `product_id`, `price_cents` and
-- `purchased_at` are what a refund or a support question is answered from, and
-- `on delete cascade` would throw all of it away to satisfy a constraint.

alter table public.purchases drop constraint if exists purchases_consumed_together;

alter table public.purchases add constraint purchases_consumed_together
  check (consumed_by_event_id is null or consumed_at is not null);

comment on constraint purchases_consumed_together on public.purchases is
  'A purchase pointing at an event must be marked spent. The reverse is allowed: '
  'deleting an event nulls consumed_by_event_id (on delete set null) and leaves a '
  'spent purchase with no event, which is exactly what happened and is correct.';

/*
  Any row already stranded by the old rule.

  There should be none — the constraint refused the delete rather than letting a
  bad row through, so this is belt-and-braces for a database where it was ever
  dropped and recreated. A row with an event but no `consumed_at` is the direction
  that is still illegal, so it is stamped rather than cleared: the event reference
  is the evidence that it was spent.
*/
update public.purchases
   set consumed_at = coalesce(consumed_at, created_at)
 where consumed_by_event_id is not null
   and consumed_at is null;
