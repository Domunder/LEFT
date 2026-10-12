/**
 * Rebuild a user's purchase ledger from RevenueCat.
 *
 * Settings' "Restore Purchases". The App Store requires the button for any app
 * selling in-app purchases, but the requirement is not the reason it exists —
 * `public.purchases` lives in our database and a user who reinstalls, switches
 * device or deletes and recreates an account has receipts with the store that
 * our ledger knows nothing about. Without this they would be asked to pay again
 * for an event they already bought.
 *
 * **Only unspent purchases matter, and this cannot know which those are.** It
 * inserts every transaction RevenueCat holds; the unique index on
 * `store_transaction_id` makes that idempotent, so a purchase already recorded —
 * and possibly already consumed — is a no-op rather than a duplicate. A row's
 * `consumed_at` is set by `create_event()` and is never touched here.
 *
 * The client calls this *after* `Purchases.restorePurchases()`, which is what
 * re-syncs the store's receipts up to RevenueCat in the first place. This only
 * reads what RevenueCat then holds.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { restoreAllPurchases } from '../_shared/revenuecat.ts';
import { isUserId } from '../_shared/tiers.ts';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // The caller's own JWT is the only thing that says whose purchases these are.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  const asUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: auth } = await asUser.auth.getUser();
  const userId = auth.user?.id;
  if (!isUserId(userId)) return json({ error: 'unauthorized' }, 401);

  try {
    const restored = await restoreAllPurchases(userId, supabaseUrl);
    return json({ restored }, 200);
  } catch (e) {
    console.error('restore failed', e);
    /*
      404 from RevenueCat is the ordinary "this user has never bought anything"
      case — a brand-new account tapping Restore — and is not a failure. Anything
      else is, and the client says so rather than claiming a silent success.
    */
    const message = e instanceof Error ? e.message : 'restore failed';
    if (message.includes('404')) return json({ restored: 0 }, 200);
    return json({ error: message }, 500);
  }
});
