/**
 * Where a user belongs the moment they are signed in.
 *
 * Auth is the app's entry now: Landing (01) offers Google, Apple or Join, and
 * nothing about the account is known until one of them returns. This is the one
 * answer to what happens next, shared by Landing and by `(auth)/name` — the
 * detour Apple forces when it hands over no name — so the two cannot disagree.
 *
 * A guest joining by invite link never comes through here. They stay anonymous
 * and go straight to 11, as before.
 */

import type { Href } from 'expo-router';

import { getSession, isAnonymous } from './auth';
import { listMyEventSummaries } from './events';

/**
 * Zero memories means there is nothing to show, so go and make one.
 *
 * A user with even one event — finished, live or not yet started — lands in the
 * library instead, which is both the list of their memories and the way to
 * create or join another.
 *
 * **Unless they are anonymous**, in which case they land in the library whatever
 * they have. Hosting needs a full account and `create_event()` enforces that, so
 * routing a guest into onboarding would only walk them four screens to a refusal.
 * The library's plus offers them `(auth)/create` instead, which is the same
 * destination arrived at in the right order. This is the dev skip's path in
 * practice — a real guest reaches 11 without coming through here at all.
 */
export async function destinationAfterSignIn(): Promise<Href> {
  try {
    const session = await getSession();
    if (session?.user && isAnonymous(session.user)) return '/(library)/films';

    const events = await listMyEventSummaries();
    return events.length === 0 ? '/(onboarding)/event' : '/(library)/films';
  } catch {
    /*
      A failed read must not drop somebody into the creation flow. The library
      has an error state, a retry on focus and a way out; onboarding has none of
      those, and would be a strange place to land because the network blipped.
    */
    return '/(library)/films';
  }
}
