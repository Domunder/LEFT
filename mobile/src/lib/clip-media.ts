/**
 * Getting a clip back *out* of storage.
 *
 * lib/clips.ts is the write half of this seam — it puts a recording in the
 * private `clips` bucket. Nothing until now has ever read one back, because
 * until 17 no screen played a clip. This is the read half.
 *
 * The bucket is private, so a path is not a URL. Every playable clip needs a
 * signature, and three facts shape how that is done:
 *
 * **A clip row is not a video.** `status` is 'pending' until the upload lands,
 * and 'failed' if it never did; `storage_path` is null for both. So "this clip
 * has no file" is an ordinary state, not an error — it is the state the schema
 * was designed around ("the file lands later, possibly much later on a bad venue
 * network"). Those clips are filtered out before storage is ever asked.
 *
 * **Signing is batched.** `createSignedUrls` takes an array and returns a result
 * per path, each with its own `error`, so one bad path cannot fail the rest. 17
 * signs every clip in the event at once; doing that one round trip at a time on
 * the network these clips were filmed over is the difference between a screen
 * that loads and one that appears broken.
 *
 * **Nothing is cached.** A module-level cache keyed by storage path would
 * outlive sign-out and hand the next person on the device a live URL into the
 * previous person's event. Signatures are minted per load and thrown away. The
 * cost is one request when a screen regains focus; the alternative is a leak.
 */

import { getSupabase } from './supabase';
import type { Clip, Event } from './events';

const BUCKET = 'clips';

/**
 * How long a signature lives.
 *
 * An hour, not the week the API would happily grant. Two reasons, and the second
 * is the one that matters: a URL that outlives the app's memory of it cannot be
 * revoked, and `shareClip` puts one of these in a text message where it becomes
 * a capability anyone holding it can use. An hour covers a session of watching
 * and a message that gets opened right away; it does not cover a screenshot of a
 * link resurfacing next month.
 */
export const CLIP_URL_TTL_SECONDS = 3600;

/** A clip that has a file behind it, resolved to something a player can open. */
export type PlayableClip = {
  clipId: string;
  url: string;
  /** Wall-clock ms when the signature dies. A player must not outlive it. */
  expiresAt: number;
  durationSeconds: number;
};

/** True when the row has a file behind it — everything else has nothing to sign. */
function isSignable(clip: Clip): clip is Clip & { storage_path: string } {
  return clip.status === 'uploaded' && clip.storage_path !== null;
}

/**
 * Sign every clip that has a file, in one request.
 *
 * Keyed by clip id rather than storage path, because that is what the screen
 * holds. A clip missing from the returned map is not an error the caller has to
 * handle specially — it renders as a tile with no video, exactly like a clip
 * still uploading, which from the viewer's side is the same fact.
 */
export async function signedClipUrls(clips: Clip[]): Promise<Map<string, PlayableClip>> {
  const signable = clips.filter(isSignable);
  if (signable.length === 0) return new Map();

  const { data, error } = await getSupabase()
    .storage.from(BUCKET)
    .createSignedUrls(
      signable.map((clip) => clip.storage_path),
      CLIP_URL_TTL_SECONDS
    );

  if (error || !data) throw error ?? new Error('Could not sign clips');

  const expiresAt = Date.now() + CLIP_URL_TTL_SECONDS * 1000;

  /*
    Results come back keyed by path, so the clip id has to be recovered by
    matching on it. Built as a map first because the API does not promise the
    results arrive in the order the paths went out.
  */
  const byPath = new Map(
    data.filter((row) => row.path && row.signedUrl).map((row) => [row.path as string, row.signedUrl as string])
  );

  const playable = new Map<string, PlayableClip>();

  for (const clip of signable) {
    const url = byPath.get(clip.storage_path);
    // A per-path error leaves this clip unsigned. The tile shows as unavailable.
    if (!url) continue;

    playable.set(clip.id, {
      clipId: clip.id,
      url,
      expiresAt,
      durationSeconds: clip.duration_seconds,
    });
  }

  return playable;
}

/**
 * Sign a single clip.
 *
 * Null rather than throwing when there is no file: the caller's question is
 * "can this be played", and 'not yet' is an answer, not a failure.
 */
export async function signedClipUrl(clip: Clip): Promise<PlayableClip | null> {
  if (!isSignable(clip)) return null;
  return (await signedClipUrls([clip])).get(clip.id) ?? null;
}

/**
 * The shape of an event's playback frame, as width over height.
 *
 * `events.format` is chosen on screen 03 and this is the only thing that reads
 * it. It used to live beside the renderer, in a module that honoured the
 * format server-side while playback ignored it — a horizontal event was drawn in
 * a hard-coded near-square box. This is the half that fixes that, and it outlived
 * the renderer because it never depended on one.
 *
 * Note it describes the **event**, not the clip. A clip is whatever the device
 * recorded, which is portrait regardless — and it is drawn in this box anyway,
 * letterboxed where the two disagree. That is deliberate: this is the shape of
 * every playback surface on 17, whatever happens to be loaded into it, so the
 * frame never changes shape while someone is watching.
 *
 * `use-clip-playlist` used to measure the loaded track and override this. It must
 * not again: iOS records portrait as a 1920x1080 track plus a rotation flag, so
 * an upright clip measures as landscape and the box flips to 16:9 around a
 * portrait picture.
 */
export function filmAspect(event: Pick<Event, 'format'>): number {
  return event.format === 'horizontal' ? 16 / 9 : 9 / 16;
}
