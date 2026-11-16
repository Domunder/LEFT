/**
 * Reading purchases back out of RevenueCat, and writing them to the ledger.
 *
 * Shared by `create-event` (which reconciles the one transaction a user just
 * made) and `restore-purchases` (which sweeps up everything they have ever
 * bought). Both do the same two things — ask RevenueCat what exists, insert what
 * is missing — and having two copies of that would let the two drift on exactly
 * the details that decide whether someone's money turns into a film.
 *
 * **RevenueCat is the receipt validator, not the ledger.** It knows a purchase
 * happened; it explicitly does not track whether a *consumable* has been spent,
 * which is the app's problem and lives in `public.purchases`. So everything here
 * only ever inserts, and `consumed_at` is nobody's business but `create_event()`'s.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * The SKU table lives in Postgres now — `public.unlock_max_members()`.
 *
 * It used to be a local `TIER_MAX_MEMBERS` map, which meant a webhook could meet
 * a product id it did not recognise and drop a purchase somebody had already
 * paid for. Asking the database costs a round trip and removes that class of bug
 * entirely: there is one table and the store, the ledger and the unlock all read
 * the same one.
 *
 * Memoised per invocation. A restore sweeps every product a user has ever bought
 * and would otherwise ask about the same handful of ids repeatedly; an edge
 * function's lifetime is short enough that staleness is not a concern.
 */
const maxMembersCache = new Map<string, number | null>();

export async function maxMembersFor(supabaseUrl: string, productId: string): Promise<number | null> {
  const cached = maxMembersCache.get(productId);
  if (cached !== undefined) return cached;

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await admin.rpc('unlock_max_members', { p_product_id: productId });

  /*
    A lookup failure is not "unknown product". Caching it would turn one blip
    into a whole restore's worth of silently skipped purchases, so it is left out
    of the map and rethrown — the webhook's 500 gets it retried.
  */
  if (error) throw error;

  const resolved = typeof data === 'number' ? data : null;
  maxMembersCache.set(productId, resolved);
  return resolved;
}

/** One purchase as /v1/subscribers reports it, under `non_subscriptions[productId]`. */
export type RcPurchase = {
  id?: string;
  store_transaction_id?: string;
  purchase_date?: string;
  store?: string;
  is_sandbox?: boolean;
};

/**
 * Every id one entry answers to — for *finding* a purchase, never for keying it.
 *
 * RevenueCat gives a consumable two ids: `id` is its own, and is what the SDK
 * hands the app as `transactionIdentifier`; `store_transaction_id` is the
 * store's, and is what the webhook carries. A client names the first, so both
 * have to match here — a missed match would charge a user and then refuse to
 * create their event.
 */
export function transactionIdsOf(p: RcPurchase): string[] {
  return [p.store_transaction_id, p.id].filter((v): v is string => typeof v === 'string' && !!v);
}

/**
 * The one id a purchase is recorded under: the store's.
 *
 * **Every writer must use this, or one purchase becomes two rows.** The ledger's
 * only guard against recording a purchase twice is the unique index on
 * `store_transaction_id`. Until 2026-11-16 `reconcileTransaction` stored whatever
 * id the client had sent (RevenueCat's) while the webhook stored the store's, so
 * every purchase ended up in the ledger twice — and the second row paid for a
 * second event.
 *
 * RevenueCat's own id is the fallback only for an entry that carries no store id
 * at all; that is logged, because the webhook could then disagree.
 */
export function ledgerIdOf(p: RcPurchase): string | null {
  if (typeof p.store_transaction_id === 'string' && p.store_transaction_id) {
    return p.store_transaction_id;
  }
  if (typeof p.id === 'string' && p.id) {
    console.warn('purchase without store_transaction_id, keyed by RevenueCat id');
    return p.id;
  }
  return null;
}

/** Every non-subscription purchase RevenueCat holds for this user, by product id. */
export async function fetchPurchases(userId: string): Promise<Record<string, RcPurchase[]>> {
  const secret = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!secret) throw new Error('REVENUECAT_SECRET_API_KEY is not set');

  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error(`RevenueCat returned ${res.status}`);

  const payload = await res.json();
  return payload?.subscriber?.non_subscriptions ?? {};
}

/**
 * Insert one purchase into the ledger.
 *
 * Returns whether a row was actually created: a 23505 on `store_transaction_id`
 * means the webhook — or a previous restore — got here first, which is success
 * and not something to report as new.
 */
export async function recordPurchase(
  supabaseUrl: string,
  userId: string,
  productId: string,
  transactionId: string,
  maxMembers: number,
  purchase: RcPurchase
): Promise<boolean> {
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { error } = await admin.from('purchases').insert({
    user_id: userId,
    product_id: productId,
    store_transaction_id: transactionId,
    max_members: maxMembers,
    environment: purchase.is_sandbox ? 'SANDBOX' : 'PRODUCTION',
    store: purchase.store ?? null,
    purchased_at: purchase.purchase_date ?? new Date().toISOString(),
  });

  if (!error) return true;
  // 23505: already in the ledger. Nothing to do, and not an error.
  if (error.code === '23505') return false;
  throw error;
}

/**
 * Find one transaction in RevenueCat's records and write it to the ledger.
 *
 * `create-event`'s path: the client has just paid and named the transaction, and
 * the webhook has almost certainly not landed yet. Throws when RevenueCat has no
 * such transaction for this user — which is what stops a modified client from
 * inventing an id.
 *
 * The client's id only finds the purchase. Returns the id it is recorded under
 * (`ledgerIdOf`), which is what `create_event()` must be told to spend.
 */
export async function reconcileTransaction(
  userId: string,
  transactionId: string,
  supabaseUrl: string
): Promise<string> {
  const byProduct = await fetchPurchases(userId);

  for (const [productId, purchases] of Object.entries(byProduct)) {
    if (!Array.isArray(purchases)) continue;

    /*
      The transaction is matched before the product id is resolved. Most of a
      user's products are not the one being reconciled, and asking the database
      about each of them first would be a round trip per miss.
    */
    const match = purchases.find((p) => transactionIdsOf(p).includes(transactionId));
    if (!match) continue;

    const maxMembers = await maxMembersFor(supabaseUrl, productId);
    if (!maxMembers) continue;

    const ledgerId = ledgerIdOf(match);
    if (!ledgerId) continue;

    await recordPurchase(supabaseUrl, userId, productId, ledgerId, maxMembers, match);
    return ledgerId;
  }

  throw new Error('RevenueCat has no such transaction for this user');
}

/**
 * Write every purchase RevenueCat holds for this user into the ledger.
 *
 * `restore-purchases`' path, and the reason a reinstall is recoverable: the
 * receipts live with the store and RevenueCat, so after `restorePurchases()` has
 * re-synced them this can rebuild the rows a wiped device lost.
 *
 * Returns how many rows were genuinely new. Unknown product ids are skipped
 * rather than guessed at — a purchase whose tier we cannot name is one
 * `create_event()` could not honour anyway.
 */
export async function restoreAllPurchases(
  userId: string,
  supabaseUrl: string
): Promise<number> {
  const byProduct = await fetchPurchases(userId);
  let restored = 0;

  for (const [productId, purchases] of Object.entries(byProduct)) {
    if (!Array.isArray(purchases)) continue;

    const maxMembers = await maxMembersFor(supabaseUrl, productId);
    if (!maxMembers) continue;

    for (const purchase of purchases) {
      const transactionId = ledgerIdOf(purchase);
      if (!transactionId) continue;

      if (await recordPurchase(supabaseUrl, userId, productId, transactionId, maxMembers, purchase)) {
        restored++;
      }
    }
  }

  return restored;
}
