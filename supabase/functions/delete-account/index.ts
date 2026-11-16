/**
 * Delete a user's account, everything they host, and their files.
 *
 * Apple's guideline 5.1.1(v): an app that creates accounts must let a user
 * delete one from inside the app. The whole thing needs `service_role` —
 * `auth.admin.deleteUser` is not something a client may hold — so it lives here
 * rather than in `lib/auth.ts`.
 *
 * The order matters and is not a preference:
 *
 *   1. Find the events this user hosts and empty their folders in the `photos`
 *      bucket. **No foreign key reaches into storage**, so nothing else would
 *      delete those files with the account.
 *   2. `prepare_account_deletion()` — clears the purchase -> event links that a
 *      cascade would otherwise leave violating `purchases_consumed_together`.
 *   3. `auth.admin.deleteUser()` — the cascades do the rest.
 *   4. The folders once more, for an upload that landed in between.
 *
 * **The files are read from the bucket's own index** (`event_storage_paths()`),
 * as the retention purge does — never from `photos.storage_path`. Until
 * 2026-11-16 this function removed whatever paths the photo rows named, with
 * the service role, and those columns were writable by the row's owner: a user
 * could point their rows at another event's files and have them deleted by
 * deleting their own account. It also missed files whose row never recorded a
 * path.
 *
 * A file that will not delete does not keep the account alive (see below); the
 * daily purge sweeps files whose event is gone (`orphaned_storage_paths()`).
 *
 * **Photos taken in other people's events are kept, unattributed.** That is
 * `photos.user_id`'s `on delete set null`, and it is deliberate: cascading them
 * would tear holes in albums that belong to other groups. The user's name comes
 * off; the picture stays until that event is deleted or purged. The delete
 * confirmation says this before anyone commits, and so does the privacy policy
 * (where it is marked for legal review).
 *
 * Verified against the local stack on 2026-11-16 (after the rewrite above).
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { isUserId } from '../_shared/tiers.ts';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const BUCKET = 'photos';

/** Storage rejects an oversized batch. */
const REMOVE_BATCH = 100;

/** PostgREST returns at most 1000 rows per call by default. */
const PATHS_PAGE = 1000;

/**
 * Empty one event's folder. Paged by re-reading from the top: each pass deletes
 * what it read. Throws when a pass removes nothing, or it would never end.
 */
async function sweep(admin: SupabaseClient, eventId: string) {
  for (;;) {
    const { data, error } = await admin
      .rpc('event_storage_paths', { p_event_id: eventId })
      .limit(PATHS_PAGE);
    if (error) throw error;

    const paths = ((data ?? []) as { path: string }[]).map((row) => row.path);
    if (paths.length === 0) return;

    for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
      const batch = paths.slice(i, i + REMOVE_BATCH);
      const { data: gone, error: removeError } = await admin.storage.from(BUCKET).remove(batch);
      if (removeError) throw removeError;
      if (!gone || gone.length === 0) throw new Error('storage removed nothing');
    }
  }
}

/**
 * Logged, not fatal. A file that resists deletion must not leave the user with
 * an account they asked to be rid of — the account going is the part they are
 * entitled to, and a stranded object is ours to sweep up (the daily purge does).
 */
async function sweepAll(admin: SupabaseClient, eventIds: string[]) {
  for (const eventId of eventIds) {
    try {
      await sweep(admin, eventId);
    } catch (e) {
      console.error('photo removal failed', eventId, e);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  /*
    The caller's own JWT is the only proof of who is being deleted. No user id is
    accepted from the body — that would be an account-deletion endpoint anyone
    could point at anyone.
  */
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  const asUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: auth } = await asUser.auth.getUser();
  const userId = auth.user?.id;
  if (!isUserId(userId)) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    // 1. The events that go with the account, and their files. Read-only on
    //    the rows; the ids come from the database, never from the caller.
    const { data: hosted, error: hostedError } = await admin
      .from('events')
      .select('id')
      .eq('host_id', userId);
    if (hostedError) throw hostedError;

    const eventIds = (hosted ?? []).map((row) => row.id as string);
    await sweepAll(admin, eventIds);

    // 2. Clear the links that would break the check constraint. Its list of
    //    paths is not used: the sweep reads the bucket itself.
    const { error: prepareError } = await admin.rpc('prepare_account_deletion', {
      p_user_id: userId,
    });
    if (prepareError) throw prepareError;

    // 3. The user. Everything else follows from the cascades.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    // 4. Anything uploaded while the above ran. The photo rows are gone now, so
    //    the bucket refuses further uploads into these folders.
    await sweepAll(admin, eventIds);

    return json({ deleted: true }, 200);
  } catch (e) {
    console.error('account deletion failed', e);
    return json(
      { error: e instanceof Error ? e.message : 'account deletion failed' },
      500
    );
  }
});
