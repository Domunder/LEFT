/**
 * What an event costs, and what the store calls it.
 *
 * Decided 2026-11-15 (replacing "free up to 100, one SKU"):
 *
 *   up to 50 guests, a finite roll       free
 *   up to 50 guests, the unlimited roll  CHF 10  left_small
 *   up to 100 guests, any roll           CHF 15  left_medium
 *   up to 150 guests, any roll           CHF 20  left_large
 *   up to 200 guests, any roll           CHF 25  left_unlimited
 *
 * A display mirror: `create_event()` decides whether an event needs a purchase
 * (`free_max_members()`, and `roll_size is null`), and
 * `public.unlock_max_members()` is the authority on the product ids and the
 * group each one covers. A modified client that skipped the purchase, or bought
 * a smaller tier than its group needs, is refused by the RPC.
 */

import type { RollSize } from './roll';

/** The largest group that costs nothing. Mirrors `public.free_max_members()`. */
export const FREE_MAX_MEMBERS = 50;

export type EventTier = {
  /** The App Store / Play consumable. Same id in both stores. */
  productId: string;
  /** The largest group it covers. Mirrors `public.unlock_max_members()`. */
  maxMembers: number;
  /** Display price. Never charged from here — the store's own price is. */
  price: string;
};

/**
 * Everything for sale, smallest first. Each is a *consumable*: one purchase
 * pays for one event.
 *
 * Do not rename an id once it has shipped — receipts bought under it would be
 * stranded.
 */
export const TIERS: readonly EventTier[] = [
  { productId: 'left_small', maxMembers: 50, price: 'CHF 10' },
  { productId: 'left_medium', maxMembers: 100, price: 'CHF 15' },
  { productId: 'left_large', maxMembers: 150, price: 'CHF 20' },
  { productId: 'left_unlimited', maxMembers: 200, price: 'CHF 25' },
];

/**
 * The purchase this event needs, or null when it is free.
 *
 * The smallest tier that covers the group — which is why a small group only
 * ever pays for the unlimited roll, and a large one pays the same whatever its
 * roll.
 */
export function tierFor(maxMembers: number, rollSize: RollSize): EventTier | null {
  if (rollSize !== null && maxMembers <= FREE_MAX_MEMBERS) return null;
  return TIERS.find((tier) => tier.maxMembers >= maxMembers) ?? TIERS[TIERS.length - 1];
}

/** The paid CTA. Names the price: a button that opens a store sheet must. */
export function ctaLabel(tier: EventTier): string {
  return `Continue · ${tier.price}`;
}
