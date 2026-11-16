/**
 * The outbox -> Expo's push service.
 *
 * Woken by Postgres (`dispatch_notifications()` through pg_cron and pg_net)
 * whenever `public.notifications` holds something unsent. The database has
 * already decided what is due and who gets it — `claim_notifications()` hands
 * out rows, `notification_recipients()` applies 20's two switches — so this
 * function only carries messages and reports back.
 *
 * Auth: the caller must present the service-role key. Nothing else may trigger
 * a send; the function takes no input, so the worst a caller could do is send
 * what was due anyway.
 *
 * Delivery is at most once per event and kind. A row is completed as soon as
 * Expo has been asked, even if some messages were refused; only a request that
 * fails outright (network, 5xx) leaves the row claimed, and the database offers
 * it again after five minutes.
 *
 * Not done: Expo's delivery *receipts* (a second call, minutes later, that
 * reports what APNs/FCM said). Tickets already catch dead tokens on the next
 * send; receipts are worth adding if delivery ever needs debugging.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import {
  buildMessages,
  chunk,
  EXPO_BATCH,
  EXPO_PUSH_URL,
  readTickets,
  type NotificationKind,
  type Recipient,
} from '../_shared/expo-push.ts';
import { isServiceCaller } from '../_shared/service-caller.ts';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type Claimed = {
  id: string;
  event_id: string;
  kind: NotificationKind;
  event_name: string;
};

/** Thrown when Expo could not be reached at all — the row is left to be retried. */
class ExpoUnavailable extends Error {}

async function sendBatch(messages: ReturnType<typeof buildMessages>) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // Only needed when "enhanced security" is switched on for the Expo project.
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    // EXPO_PUSH_URL exists so a local test can point at a stand-in.
    response = await fetch(Deno.env.get('EXPO_PUSH_URL') ?? EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    });
  } catch (e) {
    throw new ExpoUnavailable(String(e));
  }

  if (response.status >= 500 || response.status === 429) {
    throw new ExpoUnavailable(`expo answered ${response.status}`);
  }

  if (!response.ok) {
    // A 4xx is about this request, and repeating it will not help.
    console.error('expo refused the batch', response.status, await response.text());
    return { accepted: 0, failed: messages.length, dead: [] as string[] };
  }

  return readTickets(messages, await response.json());
}

async function deliver(admin: SupabaseClient, row: Claimed) {
  const { data, error } = await admin.rpc('notification_recipients', {
    p_notification_id: row.id,
  });
  if (error) throw error;

  const recipients = (data ?? []) as Recipient[];

  if (recipients.length === 0) {
    await admin.rpc('complete_notification', {
      p_notification_id: row.id,
      p_recipients: 0,
      p_skipped: 'no_recipients',
    });
    return { id: row.id, kind: row.kind, accepted: 0, failed: 0 };
  }

  const messages = buildMessages(row.kind, row.event_id, row.event_name, recipients);

  let accepted = 0;
  let failed = 0;
  const dead: string[] = [];
  let reached = false;

  for (const batch of chunk(messages, EXPO_BATCH)) {
    try {
      const result = await sendBatch(batch);
      reached = true;
      accepted += result.accepted;
      failed += result.failed;
      dead.push(...result.dead);
    } catch (e) {
      if (!(e instanceof ExpoUnavailable)) throw e;
      console.error('expo unreachable', e.message);
      // Nothing went out at all: leave the claim to expire and be retried.
      if (!reached) return { id: row.id, kind: row.kind, accepted: 0, failed: 0, retry: true };
      failed += batch.length;
    }
  }

  if (dead.length > 0) {
    const { error: pruneError } = await admin.from('push_tokens').delete().in('token', dead);
    if (pruneError) console.error('could not remove dead tokens', pruneError);
  }

  const { error: completeError } = await admin.rpc('complete_notification', {
    p_notification_id: row.id,
    p_recipients: accepted,
    p_skipped: null,
  });
  if (completeError) throw completeError;

  return { id: row.id, kind: row.kind, accepted, failed, dead: dead.length };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey || !isServiceCaller(req)) {
    return json({ error: 'unauthorized' }, 401);
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  try {
    const { data, error } = await admin.rpc('claim_notifications', { p_limit: 20 });
    if (error) throw error;

    const results = [];
    for (const row of (data ?? []) as Claimed[]) {
      try {
        results.push(await deliver(admin, row));
      } catch (e) {
        // One event's failure must not hold up the others in the batch.
        console.error('notification failed', row.id, e);
        results.push({ id: row.id, kind: row.kind, error: true });
      }
    }

    return json({ processed: results.length, results }, 200);
  } catch (e) {
    console.error('send-notifications failed', e);
    return json({ error: 'send failed' }, 500);
  }
});
