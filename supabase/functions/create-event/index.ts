/**
 * Create an event, reconciling the purchase synchronously.
 *
 * Why it exists: `purchaseStoreProduct()` resolves the moment the store takes the
 * money, but RevenueCat's webhook is a separate async call. The client reaches
 * here within milliseconds, so on a fast network "paid, but the ledger is empty"
 * is the common case rather than an edge case — and a webhook that fails its
 * first delivery is five minutes away from retrying.
 *
 * So rather than waiting, we ask RevenueCat directly. GET /v1/subscribers/{id}
 * returns the same purchase the webhook carries, on demand. If the claimed
 * transaction is there, the ledger row is written here and `create_event()`
 * spends it in the same request. The webhook stays as the durability backstop:
 * its insert later hits the unique index and becomes a no-op.
 *
 * The client's transaction id is only ever a *lookup key*. RevenueCat's own API
 * is what confirms the purchase exists and belongs to this user, so a modified
 * client inventing an id gets nothing — and the row is recorded under the
 * store's id, the same key the webhook uses, never under the client's string.
 *
 * **Free events never reach the paid path.** Up to 50 guests on a finite roll
 * the client sends no transaction id and `create_event()` skips the claim — the
 * free tier is enforced in the database, not here, so a client that lies about
 * its group or roll is refused by the RPC rather than by this function.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { reconcileTransaction } from '../_shared/revenuecat.ts';
import { isUserId } from '../_shared/tiers.ts';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type CreateEventBody = {
  name?: string;
  eventType?: string;
  look?: string;
  endsAt?: string;
  maxMembers?: number;
  /** 5, 10, 16, 24, 36 — or null for the unlimited roll. */
  rollSize?: number | null;
  transactionId?: string | null;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // The caller's own JWT identifies them; create_event() reads auth.uid().
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  let body: CreateEventBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid body' }, 400);
  }

  const { name, eventType, look, endsAt, maxMembers, rollSize, transactionId } = body;

  /*
    Shape checks only. Every *rule* — the ending being in the future, the group
    size band, the roll sizes, the anonymous-host refusal — belongs to
    `create_event()`, which is the one thing a modified client cannot go around.
  */
  if (typeof name !== 'string' || name.trim() === '') return json({ error: 'invalid name' }, 400);
  if (typeof eventType !== 'string') return json({ error: 'invalid event type' }, 400);
  if (typeof look !== 'string') return json({ error: 'invalid look' }, 400);
  if (typeof endsAt !== 'string' || Number.isNaN(Date.parse(endsAt))) {
    return json({ error: 'invalid ending time' }, 400);
  }
  if (!Number.isInteger(maxMembers)) return json({ error: 'invalid group size' }, 400);
  if (rollSize != null && !Number.isInteger(rollSize)) {
    return json({ error: 'invalid roll size' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  // Acts as the user: RLS applies, and create_event() sees the right auth.uid().
  const asUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: auth } = await asUser.auth.getUser();
  const userId = auth.user?.id;
  if (!isUserId(userId)) return json({ error: 'unauthorized' }, 401);

  /*
    Reconcile before creating, but only when the client says it just bought
    something. A free-tier event sends nothing, and a retry where the webhook has
    already landed skips this too — `create_event()` finds the row on its own.
  */
  /*
    What create_event() is told to spend. The client names RevenueCat's id; the
    ledger is keyed by the store's, which only the reconcile can tell us.
  */
  let ledgerId: string | null = null;

  if (typeof transactionId === 'string' && transactionId) {
    try {
      ledgerId = await reconcileTransaction(userId, transactionId, supabaseUrl);
    } catch (e) {
      // Non-fatal: the row may already exist from the webhook, in which case
      // creation succeeds anyway. Only a genuinely missing purchase fails, and it
      // fails below with the 'unsettled' hint the client knows how to handle.
      console.error('reconcile failed', e);
    }
  }

  const { data, error } = await asUser.rpc('create_event', {
    p_name: name,
    p_event_type: eventType,
    p_look: look,
    p_ends_at: endsAt,
    p_max_members: maxMembers,
    p_roll_size: rollSize ?? null,
    /*
      Only an ORDER BY preference among this user's unspent purchases, never
      proof of payment — so when the reconcile failed, the client's id is still
      the better hint than none (on a store where both ids agree it matches).
    */
    p_transaction_id:
      ledgerId ?? (typeof transactionId === 'string' && transactionId ? transactionId : null),
  });

  if (error) {
    // Pass the code and hint through untouched — the client distinguishes
    // "unsettled" from "never paid", and "anonymous" from both, by exactly these.
    return json({ error: error.message, code: error.code, hint: error.hint }, 400);
  }

  // `create_event` returns the events row itself, not a table, so there is
  // nothing to flatten.
  if (!data) return json({ error: 'the event was not created' }, 400);

  return json({ event: data }, 200);
});
