/**
 * What an event costs, and what the store calls it.
 *
 * Deliberately **not** in `./pricing.ts`. That module answers "how much filming
 * time does this group get"; this one answers "what does that cost". They were
 * one table once, and keeping them apart is what let the duration options stop
 * being a pricing decision — within a tier every duration costs the same, so
 * picking a shorter one is a trade about the film, never about money.
 *
 * **The price is quoted on the group the host picks, before the party.** That is
 * a guess, and it is the buyer's own guess — which is the honest version of this
 * question, because the alternative is billing them afterwards for who turned up.
 * `create_event()` compares the receipt against `max_members` server-side; a
 * client that lied about the group size would buy the wrong SKU and be refused by
 * the claim.
 *
 * Mirrors `public.unlock_max_members()`, which also still honours the six
 * superseded `left_event_tier_*` ids so nobody who paid under an older model is
 * stranded with an unspendable receipt.
 */

/**
 * The largest group that costs nothing.
 *
 * Enforced in `create_event()`, not here — this copy only decides whether 05.1
 * opens a store sheet. A modified client that skipped the purchase would be
 * refused by the RPC.
 */
export const FREE_MAX_MEMBERS = 4;

export type EventTier = {
  /**
   * Inclusive upper bound on the group this tier covers.
   *
   * `Infinity` on the last one, which is the only reason `tierFor` can be a
   * plain `.find()`. The SQL uses 2147483647 for the same tier — a bound has to
   * be comparable there, and Postgres has no Infinity for integers.
   */
  max: number;
  /** Display price. Never charged from here — the store's own price is. */
  price: string;
  /** The App Store / Play consumable. Same id in both stores. */
  productId: string;
  /** How the tier names its own range, for the price line on 05.1. */
  label: string;
};

/**
 * The three SKUs, smallest first.
 *
 * Three rather than the old six: every tier is a decision forced on the buyer and
 * a row to maintain in the two stores, and the revenue difference between three
 * bands and six is not worth either.
 *
 * The ids still read `left_film_unlock_*` because they are the ids the store rows
 * will be created with, and renaming a SKU that has ever shipped strands the
 * receipts bought under it. They are opaque strings; nothing reads meaning out of
 * them but `public.unlock_max_members()`, which maps both these and the older
 * `left_event_tier_*` set.
 *
 * These are **consumables attached to no entitlement**. A non-consumable would be
 * bought once ever and every later event would be free; a consumable inside a
 * RevenueCat entitlement makes RevenueCat report that entitlement unlocked
 * forever after the first purchase — the same bug wearing a hat.
 * `public.purchases` is the record of what has been spent.
 */
export const EVENT_TIERS: readonly EventTier[] = [
  { max: 10, price: '$4.99', productId: 'left_film_unlock_10', label: 'up to 10 people' },
  { max: 50, price: '$14.99', productId: 'left_film_unlock_50', label: 'up to 50 people' },
  { max: Infinity, price: '$29.99', productId: 'left_film_unlock_unlimited', label: 'any group' },
] as const;

/** Whether a group of this size has to pay at all. */
export function isFreeGroup(groupSize: number): boolean {
  return groupSize <= FREE_MAX_MEMBERS;
}

/**
 * The tier that covers this group.
 *
 * Falls back to the largest rather than throwing: the last tier is unbounded, so
 * the only way to miss is an empty table, and quoting the top price beats a screen
 * that cannot render.
 */
export function tierFor(groupSize: number): EventTier {
  return EVENT_TIERS.find((tier) => groupSize <= tier.max) ?? EVENT_TIERS[EVENT_TIERS.length - 1];
}

/** "$14.99" — what the price line on 05.1 leads with. */
export function priceLabel(tier: EventTier): string {
  return tier.price;
}

/**
 * What the Continue button says.
 *
 * Names the price, because a button that opens a store sheet without naming one
 * is the thing every app store guideline is about. The free case never reaches
 * here — 05.1 keeps its own label for that.
 */
export function ctaLabel(tier: EventTier): string {
  return `Continue · ${tier.price}`;
}

/**
 * Check the tier table is usable, in development.
 *
 * The same standing-invariant trick `pricing.ts` uses, and for the same reason:
 * no test runner, and the failure this catches — two tiers sharing a SKU, so one
 * of them silently charges the other's price — is invisible until money moves.
 */
function assertTierInvariant(): void {
  if (EVENT_TIERS.length === 0) {
    console.error('tiers.ts: EVENT_TIERS is empty — nothing can be bought.');
    return;
  }

  for (let i = 1; i < EVENT_TIERS.length; i++) {
    if (EVENT_TIERS[i].max <= EVENT_TIERS[i - 1].max) {
      console.error('tiers.ts: tiers are not in ascending order of group size.');
      break;
    }
  }

  // Without an unbounded last tier a big enough group has nothing to buy.
  if (EVENT_TIERS[EVENT_TIERS.length - 1].max !== Infinity) {
    console.error('tiers.ts: the largest tier must be unbounded.');
  }

  // The free tier has to sit below the first paid band, or a group is both.
  if (FREE_MAX_MEMBERS >= EVENT_TIERS[0].max) {
    console.error('tiers.ts: the free tier overlaps the first paid tier.');
  }

  const ids = EVENT_TIERS.map((t) => t.productId);
  if (new Set(ids).size !== ids.length) {
    console.error('tiers.ts: two tiers share a productId — one would sell at the wrong price.');
  }
}

if (__DEV__) assertTierInvariant();
