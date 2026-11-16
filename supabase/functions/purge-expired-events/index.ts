/**
 * Retention: delete events developed more than six months ago, files first.
 *
 * Woken once a day by Postgres (`dispatch_purge()` through pg_cron and pg_net).
 * The database decides which events are due (`events_due_for_purge()`), and
 * decides again when asked to delete (`purge_event()` re-checks the date and
 * refuses while the event's folder still holds files) — so this function cannot
 * delete anything early, whatever it is sent or however it fails.
 *
 * Per event:
 *   1. read every object under `{event_id}/` from the bucket's index,
 *   2. remove them through the storage API (SQL cannot delete files),
 *   3. `purge_event()` — the event, its roster and its photo rows.
 *
 * An event whose files could not all be removed is left as it is and is due
 * again tomorrow. Nothing is ever half-deleted on the row side: rows only go
 * once the bucket is empty.
 *
 * Auth: the service-role key, as for send-notifications.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { isServiceCaller } from '../_shared/service-caller.ts';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const BUCKET = 'photos';

/** Storage rejects an oversized batch. */
const REMOVE_BATCH = 100;

/** Events per run. The job is daily; a backlog drains over a few nights. */
const EVENTS_PER_RUN = 50;

/** PostgREST returns at most 1000 rows per call by default. */
const PATHS_PAGE = 1000;

async function purge(admin: SupabaseClient, eventId: string) {
  let removed = 0;

  // Paged by re-reading from the top: each pass deletes what it read.
  for (;;) {
    const { data, error } = await admin
      .rpc('event_storage_paths', { p_event_id: eventId })
      .limit(PATHS_PAGE);
    if (error) throw error;

    const paths = ((data ?? []) as { path: string }[]).map((row) => row.path);
    if (paths.length === 0) break;

    for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
      const batch = paths.slice(i, i + REMOVE_BATCH);
      const { data: gone, error: removeError } = await admin.storage.from(BUCKET).remove(batch);
      if (removeError) throw removeError;
      // Nothing removed means the next pass would read the same paths forever.
      if (!gone || gone.length === 0) throw new Error('storage removed nothing');
      removed += gone.length;
    }
  }

  const { data: purged, error: purgeError } = await admin.rpc('purge_event', {
    p_event_id: eventId,
  });
  if (purgeError) throw purgeError;

  return { eventId, files: removed, purged: purged === true };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey || !isServiceCaller(req)) {
    return json({ error: 'unauthorized' }, 401);
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  try {
    const { data, error } = await admin.rpc('events_due_for_purge', {
      p_limit: EVENTS_PER_RUN,
    });
    if (error) throw error;

    const results = [];
    for (const row of (data ?? []) as { event_id: string }[]) {
      try {
        results.push(await purge(admin, row.event_id));
      } catch (e) {
        // Left for tomorrow; one stubborn event must not block the rest.
        console.error('purge failed', row.event_id, e);
        results.push({ eventId: row.event_id, purged: false, error: true });
      }
    }

    return json({ processed: results.length, results }, 200);
  } catch (e) {
    console.error('purge-expired-events failed', e);
    return json({ error: 'purge failed' }, 500);
  }
});
