/**
 * Odds and ends the edge functions share.
 *
 * **The SKU table used to live here and no longer does.** It was one of six
 * copies of the same pricing facts, and this one had the worst failure mode: a
 * webhook that did not recognise a product id silently dropped a purchase that
 * the user had already paid for. `public.unlock_max_members()` is the single
 * source now, and `revenuecat.ts` asks Postgres rather than a local map — one
 * extra round trip on a webhook, in exchange for the table existing once.
 */

/** A Supabase user id, as opposed to a `$RCAnonymousID:...`. */
export function isUserId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}
