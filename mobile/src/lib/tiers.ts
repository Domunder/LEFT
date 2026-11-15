/**
 * What an event costs, and what the store calls it.
 *
 * **Free up to 100 guests on any finite roll. One product, "LEFT Unlimited",
 * covers everything else** — the unlimited roll, and groups up to 200.
 *
 * A display mirror: `create_event()` decides whether an event needs a purchase
 * (`free_max_members()`, and `roll_size is null`), and
 * `public.unlock_max_members()` is the authority on the product id. A modified
 * client that skipped the purchase is refused by the RPC.
 */

import type { RollSize } from './roll';

/** The largest group that costs nothing. Mirrors `public.free_max_members()`. */
export const FREE_MAX_MEMBERS = 100;

export type EventTier = {
  /** The App Store / Play consumable. Same id in both stores. */
  productId: string;
  /** Display price. Never charged from here — the store's own price is. */
  price: string;
};

/**
 * The one thing for sale. A *consumable*: one purchase pays for one event.
 *
 * Do not rename the id once it has shipped — receipts bought under it would be
 * stranded.
 */
export const UNLIMITED: EventTier = {
  productId: 'left_unlimited',
  price: 'CHF 5',
};

/** Whether this event needs the purchase. */
export function needsUnlimited(maxMembers: number, rollSize: RollSize): boolean {
  return rollSize === null || maxMembers > FREE_MAX_MEMBERS;
}

/** Why it is paid, in the words 05.1 puts under the choices. */
export function unlimitedReason(maxMembers: number, rollSize: RollSize): string {
  const bigGroup = maxMembers > FREE_MAX_MEMBERS;
  if (rollSize === null && bigGroup) return 'Unlimited shots and a group over 100';
  if (rollSize === null) return 'Unlimited shots';
  return 'A group over 100';
}

/** The paid CTA. Names the price: a button that opens a store sheet must. */
export function ctaLabel(tier: EventTier): string {
  return `Continue · ${tier.price}`;
}
