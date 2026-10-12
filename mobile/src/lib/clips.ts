/**
 * Getting a finished take off the phone and into the group's film.
 *
 * The seam between the camera and everything else. Recording produces a file in
 * the app's cache directory and a number of seconds; this turns that into a row
 * in `public.clips` and an object in the private `clips` bucket.
 *
 * Clients cannot insert into `clips` at all — there is no INSERT policy,
 * deliberately: "a clip can never exist without the budget having been charged
 * for it". Rows appear only when the server settles a take.
 *
 * Two things follow from the settlement queue (see ./budget.ts):
 *
 *   1. **A commit may not produce a clip.** `status: 'dropped'` means an earlier
 *      take used the last of the budget. There is nothing to upload.
 *   2. **A commit may not produce a clip *yet*.** `status: 'waiting'` means an
 *      earlier take is still rolling. The upload happens anyway — the path is
 *      keyed by reservation id, not clip id, precisely so it need not wait — and
 *      `markClipUploaded` is called later, by whoever is holding the path when
 *      the verdict arrives over `subscribeToMyTakes`.
 *
 * So a clip is 'pending' between being charged and its file landing, which is
 * the state the schema was designed around: "the file lands later, possibly much
 * later on a bad venue network".
 */

import { File } from 'expo-file-system';

import {
  commitReservation,
  releaseReservation,
  type TakeOutcome,
  type TakeStatus,
} from './budget';
import { clipStoragePath, listClips, markClipUploaded } from './events';
import { subscribeToChanges } from './realtime';
import { getSupabase } from './supabase';

const BUCKET = 'clips';

/**
 * What the bucket accepts.
 *
 * `allowed_mime_types` on the bucket is exactly `['video/mp4','video/quicktime']`,
 * so anything else is rejected at the storage API before RLS is even consulted.
 * iOS records .mov, Android .mp4.
 */
function contentTypeFor(uri: string): string {
  return uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
}

/**
 * Put the recording in the bucket.
 *
 * `expo-file-system`'s `File` implements `Blob`, so the bytes go straight from
 * disk to the upload without a base64 round trip — which for a multi-minute 4K
 * take would mean holding the whole file in memory twice over, at 4/3 size.
 */
export async function uploadClip(localUri: string, storagePath: string): Promise<void> {
  const file = new File(localUri);

  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: contentTypeFor(localUri),
      upsert: true,
    });

  if (error) throw error;
}

/**
 * Mark a clip's upload as failed.
 *
 * `status` and `storage_path` are the only columns granted to clients, so this is
 * the whole of what a client may say about a clip after it exists. Best-effort:
 * the clip row is already correct and charged, and the recording is still on
 * disk, so a failure to record the failure is not worth surfacing.
 */
async function markClipFailed(clipId: string): Promise<void> {
  await getSupabase().from('clips').update({ status: 'failed' }).eq('id', clipId);
}

export type FinishedTake = {
  status: TakeStatus;
  /** Null when the take was dropped, and null *for now* when it is waiting. */
  clipId: string | null;
  /** What the group was actually charged. 0 when dropped or still waiting. */
  chargedSeconds: number;
  /** Authoritative `events.used_seconds`, including this take when charged. */
  usedAfter: number;
  budgetSeconds: number;
  /** False when the file did not land. Always false for a dropped take. */
  uploaded: boolean;
  /**
   * Where the file went, for a take whose clip id is not known yet.
   *
   * Hand this to `attachUpload()` once `subscribeToMyTakes` says the take was
   * charged. Null when there is nothing left to attach.
   */
  storagePath: string | null;
};

/**
 * Settle a finished take: report it, upload the file, attach the two.
 *
 * The upload failing does **not** throw. By that point the take has been
 * reported and the recording is still in the cache — so it is not lost, it is
 * merely not uploaded yet, which is a state the schema has a value for.
 * Throwing here would tell the camera the take failed when the only thing that
 * failed is the part that can be retried later.
 *
 * The commit failing does throw: nothing has happened, and the caller still
 * holds a reservation it needs to know about.
 */
export async function finishTake(args: {
  reservationId: string;
  eventId: string;
  userId: string;
  localUri: string;
  seconds: number;
  /**
   * Fired the instant the commit returns, **before** the upload starts.
   *
   * The verdict and the upload are minutes apart on a bad network, and a caller
   * that has been holding a provisional number for this take needs the first
   * without waiting for the second. Everything here is also on the resolved
   * value; this only says it sooner.
   */
  onCommitted?: (outcome: TakeOutcome) => void;
}): Promise<FinishedTake> {
  const { reservationId, eventId, userId, localUri, seconds, onCommitted } = args;

  const outcome = await commitReservation(reservationId, seconds);
  onCommitted?.(outcome);

  const base = {
    status: outcome.status,
    clipId: outcome.clipId,
    chargedSeconds: outcome.chargedSeconds,
    usedAfter: outcome.usedAfter,
    budgetSeconds: outcome.budgetSeconds,
  };

  /*
    Nobody was charged for this and no row exists, so there is nothing for a file
    to belong to. Uploading it would leave an orphan in the bucket that no clip
    ever points at and no cleanup ever removes.
  */
  if (outcome.status === 'dropped') {
    return { ...base, uploaded: false, storagePath: null };
  }

  /*
    Keyed by reservation, so this does not wait on a clip id that may still be
    several seconds away. See clipStoragePath().
  */
  const path = clipStoragePath(eventId, userId, reservationId);

  try {
    await uploadClip(localUri, path);
  } catch {
    if (outcome.clipId) {
      await markClipFailed(outcome.clipId).catch(() => {
        // Already reported, already queued. Nothing further to salvage here.
      });
    }
    return { ...base, uploaded: false, storagePath: null };
  }

  /*
    Waiting: the file is in the bucket but the row it belongs to does not exist
    yet. The path travels back to the caller, which attaches it when the verdict
    arrives.
  */
  if (!outcome.clipId) {
    return { ...base, uploaded: true, storagePath: path };
  }

  try {
    await markClipUploaded(outcome.clipId, path);
    return { ...base, uploaded: true, storagePath: null };
  } catch {
    return { ...base, uploaded: false, storagePath: path };
  }
}

/**
 * Attach an already-uploaded file to a clip that only just came into existence.
 *
 * The second half of a 'waiting' take: the bytes were in the bucket before the
 * queue reached it, and this is what points the row at them. Reports whether it
 * worked rather than throwing — by here the take is charged and part of the
 * film, and an unattached file is a clip that plays as a gap, not a failure the
 * user can act on.
 */
export async function attachUpload(clipId: string, storagePath: string): Promise<boolean> {
  try {
    await markClipUploaded(clipId, storagePath);
    return true;
  } catch {
    await markClipFailed(clipId).catch(() => {});
    return false;
  }
}

/**
 * Hand a place in the queue back without charging for it.
 *
 * For a take that produced nothing worth keeping — a stray tap, or a camera that
 * errored before it wrote a file. Swallows its own failure: the hold expires on
 * its own after 15 minutes, so the worst case is the group being briefly short
 * those seconds, and there is nothing a user could do with the error.
 */
export async function discardTake(reservationId: string): Promise<void> {
  await releaseReservation(reservationId).catch(() => {});
}

/**
 * How many clips the group has filmed — the badge on 13.
 *
 * Counts every member's clips, not just yours: the badge sits on a screen about a
 * shared film, and "3" meaning "the group has three" is the same reading as the
 * budget bar above it.
 *
 * Modelled on `subscribeToBudget` and `subscribeToMembers`, down to the channel
 * naming. Like the latter it re-reads rather than patching the payload in —
 * a count is one cheap indexed query, and reconstructing it from INSERT/DELETE
 * deltas would drift the moment one event was missed.
 */
export function subscribeToClipCount(
  eventId: string,
  onChange: (count: number) => void
): () => void {
  const refresh = () => {
    void listClips(eventId)
      .then((clips) => onChange(clips.length))
      .catch(() => {
        // Leave the last good count on screen; the next change corrects it.
      });
  };

  return subscribeToChanges(
    `event:${eventId}:clips`,
    { event: '*', schema: 'public', table: 'clips', filter: `event_id=eq.${eventId}` },
    refresh
  );
}
