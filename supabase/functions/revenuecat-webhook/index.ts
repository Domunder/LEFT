/**
 * RevenueCat webhook -> the purchase ledger.
 *
 * One of two writers of public.purchases (the other is create-event, which
 * reconciles synchronously). Runs as service_role, so it bypasses RLS — which is
 * exactly why the Authorization check below is not optional.
 *
 * Idempotent by construction: store_transaction_id is unique, and a conflict is
 * success rather than an error. RevenueCat retries up to five times with backoff
 * and sends the same transaction each time, so a retry must neither create a
 * second row nor return a non-200 — a non-200 keeps it retrying.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { maxMembersFor } from '../_shared/revenuecat.ts';
import { isUserId } from '../_shared/tiers.ts';

/** 200 with no work done. Used for anything we deliberately ignore. */
const ok = () => new Response('ok', { status: 200 });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  /*
    RevenueCat signs nothing — it sends whatever string is configured on the
    webhook destination. This shared secret is the entire auth story between the
    open internet and a service_role writer, so it is compared in full.
  */
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!expected || req.headers.get('Authorization') !== expected) {
    return new Response('unauthorized', { status: 401 });
  }

  let body: { event?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return ok(); // Malformed JSON will not become valid on a retry.
  }

  const event = body?.event;
  if (!event) return ok();

  // Fired by the dashboard's "Send test event" button.
  if (event.type === 'TEST') return ok();

  /*
    Only consumables matter. Ignoring everything else keeps the ledger clean, and
    means adding a subscription product later cannot silently grant a free event.
  */
  if (event.type !== 'NON_RENEWING_PURCHASE') return ok();

  const productId = String(event.product_id ?? '');

  /*
    Resolved by Postgres, not by a map in this file. `unlock_max_members()` is the
    only SKU table now — a local copy here was one webhook deploy away from
    dropping a purchase somebody had paid for.

    A throw from the lookup is a database problem, not an unknown product: it
    escapes to the outer handler and returns non-200 so RevenueCat retries. Only a
    genuine null lands in the branch below.
  */
  const maxMembers = await maxMembersFor(Deno.env.get('SUPABASE_URL')!, productId);
  if (!maxMembers) {
    // A config error, not a transient one — 200 so it is not retried five times.
    console.error('unknown product_id, dropping', productId);
    return ok();
  }

  /*
    app_user_id is the Supabase uid, set by Purchases.logIn() after sign-in. An
    anonymous id means the purchase happened before identify() ran, which should
    be impossible — writing that row would create a purchase nobody can spend.
  */
  const userId = event.app_user_id;
  if (!isUserId(userId)) {
    console.error('non-uuid app_user_id, dropping', userId);
    return ok();
  }

  const transactionId = event.transaction_id;
  if (typeof transactionId !== 'string' || !transactionId) {
    console.error('missing transaction_id, dropping');
    return ok();
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { error } = await supabase.from('purchases').insert({
    user_id: userId,
    product_id: productId,
    store_transaction_id: transactionId,
    max_members: maxMembers,
    environment: event.environment === 'SANDBOX' ? 'SANDBOX' : 'PRODUCTION',
    store: typeof event.store === 'string' ? event.store : null,
    price_cents: typeof event.price === 'number' ? Math.round(event.price * 100) : null,
    currency: typeof event.currency === 'string' ? event.currency : null,
    purchased_at: new Date(
      typeof event.purchased_at_ms === 'number' ? event.purchased_at_ms : Date.now()
    ).toISOString(),
  });

  // 23505 is a unique violation on store_transaction_id: a retry of a purchase
  // already recorded, or create-event having reconciled it first. Both are fine.
  if (error && error.code !== '23505') {
    console.error('ledger insert failed', error);
    return new Response('error', { status: 500 }); // Let RevenueCat retry.
  }

  return ok();
});
