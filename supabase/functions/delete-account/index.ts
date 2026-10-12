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
 *   1. `prepare_account_deletion()` — clears the purchase -> event links that a
 *      cascade would otherwise leave violating `purchases_consumed_together`,
 *      and reports which storage objects are about to be orphaned. See the
 *      migration; the constraint hazard is spelled out there.
 *   2. Remove those objects from the `clips` bucket. **No foreign key reaches
 *      into storage**, so nothing else would ever delete them and the footage
 *      would outlive the account that owned it.
 *   3. `auth.admin.deleteUser()` — the cascades do the rest.
 *
 * **Clips filmed in other people's events are kept, unattributed.** That is
 * `clips.user_id`'s `on delete set null`, and it is deliberate: cascading them
 * would destroy footage inside films other people paid for and have already
 * watched. The user's name comes off; the clip stays. The delete confirmation
 * says this before anyone commits, and so does the privacy notice.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { isUserId } from '../_shared/tiers.ts';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const BUCKET = 'clips';

/** Storage rejects an oversized batch; clips are large but rows are cheap. */
const REMOVE_BATCH = 100;

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
    // 1. Clear the links that would break the check constraint, and find the files.
    const { data: prepared, error: prepareError } = await admin.rpc(
      'prepare_account_deletion',
      { p_user_id: userId }
    );
    if (prepareError) throw prepareError;

    const paths: string[] = prepared?.[0]?.clip_paths ?? [];

    // 2. The bucket. Nothing else will ever remove these.
    for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
      const batch = paths.slice(i, i + REMOVE_BATCH);
      const { error } = await admin.storage.from(BUCKET).remove(batch);
      /*
        Logged, not fatal. A file that resists deletion must not leave the user
        with an account they asked to be rid of — the account going is the part
        they are entitled to, and a stranded object is ours to sweep up.
      */
      if (error) console.error('clip removal failed', error);
    }

    // 3. The user. Everything else follows from the cascades.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return json({ deleted: true }, 200);
  } catch (e) {
    console.error('account deletion failed', e);
    return json(
      { error: e instanceof Error ? e.message : 'account deletion failed' },
      500
    );
  }
});
