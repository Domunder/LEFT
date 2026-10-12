/**
 * Noticing that somebody else just filmed.
 *
 * `subscribeToClipCount` in lib/clips.ts answers "how many", which is all 13's
 * badge needs. 18's toast needs to say *who*, *how long*, and *what is left* —
 * so this is a second subscription over the same table, kept separate rather
 * than widening that one, because the badge should not pay for a member lookup
 * and a budget read on every insert.
 *
 * Reads `payload.new` directly instead of refetching, which `replica identity
 * full` on `public.clips` is what makes possible — the same thing
 * `subscribeToBudget` and `subscribeToEventStatus` already rely on.
 *
 * **The self-filter lives here, not in the screen.** A toast announcing your own
 * action is the classic self-notification bug: you already watched the budget
 * bar drop and the clip badge tick up, and being told about it by a banner reads
 * as the app talking to itself. Putting the filter in the subscription means
 * every future consumer inherits it and none of them can forget it.
 */

import { authorOf, authorsFor, UNKNOWN_AUTHOR, type ClipAuthor } from './clip-authors';
import { availableSeconds } from './budget';
import { subscribeToChanges } from './realtime';
import type { Clip } from './events';

export type ClipArrival = {
  clip: Clip;
  author: ClipAuthor;
  /** What the group has left *after* this clip was charged. Null if unreadable. */
  remainingSeconds: number | null;
};

/**
 * Fire whenever someone else's clip lands in this event.
 *
 * The roster is fetched once at subscribe time and re-fetched on a miss — a
 * member who joined after this screen mounted would otherwise be "Someone" for
 * as long as the camera stayed open, which on a long event is the whole event.
 */
export function subscribeToClipArrivals(
  eventId: string,
  selfUserId: string,
  onArrival: (arrival: ClipArrival) => void
): () => void {
  let cancelled = false;
  let authors: Map<string, ClipAuthor> = new Map();

  // Best-effort: a failed roster read degrades names to "Someone", it does not
  // suppress the toast. Knowing a clip arrived matters more than knowing whose.
  void authorsFor(eventId)
    .then((loaded) => {
      if (!cancelled) authors = loaded;
    })
    .catch(() => {});

  async function handle(clip: Clip) {
    /*
      Resolve the author, re-reading the roster once if this user is unknown to
      it. Guarded on user_id being present so a clip with no owner does not
      trigger a pointless refetch on every arrival.
    */
    let author = authorOf(clip, authors);

    if (author === UNKNOWN_AUTHOR && clip.user_id) {
      try {
        authors = await authorsFor(eventId);
        if (cancelled) return;
        author = authorOf(clip, authors);
      } catch {
        // Stay with "Someone".
      }
    }

    /*
      Read the budget rather than deriving it from the payload: `used_seconds`
      lives on `events`, and between this insert and now another member may have
      committed their own take. A number that disagrees with the bar on screen is
      worse than no number, so a failure drops the subtitle and keeps the toast.

      `availableSeconds`, not `remainingSeconds`: the latter subtracts live
      holds, so it would fall the moment somebody merely *started* filming and
      contradict the bar six inches above this banner.
    */
    let remainingSeconds: number | null = null;
    try {
      remainingSeconds = await availableSeconds(eventId);
    } catch {
      // Null rather than a sentinel, so the caller has to decide what to render.
    }

    if (!cancelled) onArrival({ clip, author, remainingSeconds });
  }

  const unsubscribe = subscribeToChanges(
    `event:${eventId}:clip-arrivals`,
    { event: 'INSERT', schema: 'public', table: 'clips', filter: `event_id=eq.${eventId}` },
    (change) => {
      const clip = change.new as unknown as Clip;
      // See the header: your own take is not news to you.
      if (clip.user_id === selfUserId) return;
      void handle(clip);
    }
  );

  return () => {
    cancelled = true;
    unsubscribe();
  };
}
