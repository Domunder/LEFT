/**
 * Photos and the roll.
 *
 * Thin wrappers over the database — no state is held here.
 *
 * **The roll is server-authoritative.** `claimShot()` is the only thing that
 * spends a frame, and what it returns is the only number the camera may show.
 * The order for one picture is:
 *
 *     mint an id -> claimShot() -> upload original + thumb -> markPhotoUploaded()
 *
 * The id is minted on the device *first*, which makes the claim idempotent: a
 * retry on bad venue Wi-Fi returns the same answer and never burns a second
 * frame. It also makes the storage paths knowable before any network call.
 *
 * **The reveal is server-side too.** `listPhotos()` returns only the caller's own
 * frames until the event is developed; that is RLS, not a filter here.
 */

import { removeFiles } from './storage';
import { getSupabase } from './supabase';
import type { Database } from '@/types/database';

export type Photo = Database['public']['Tables']['photos']['Row'];

export type RollState = {
  shotsTaken: number;
  /** Null on an unlimited roll. */
  shotsLeft: number | null;
};

/** The roll is used up. Not an error to retry — the camera shows its empty state. */
export class RollEmptyError extends Error {
  constructor() {
    super('Your roll is empty');
    this.name = 'RollEmptyError';
  }
}

/** The event has not started, or has ended. */
export class EventClosedError extends Error {
  constructor() {
    super('The cameras are not open');
    this.name = 'EventClosedError';
  }
}

/**
 * Spend one frame.
 *
 * Throws `RollEmptyError` / `EventClosedError` for the two refusals the camera
 * has screens for; anything else (offline, a dropped request) is retryable with
 * the **same** `photoId`.
 */
export async function claimShot(
  eventId: string,
  photoId: string,
  takenAt: Date = new Date()
): Promise<RollState> {
  const { data, error } = await getSupabase().rpc('claim_shot', {
    p_event_id: eventId,
    p_photo_id: photoId,
    p_taken_at: takenAt.toISOString(),
  });

  if (error) {
    if (error.hint === 'roll_empty') throw new RollEmptyError();
    if (error.hint === 'event_closed') throw new EventClosedError();
    throw error;
  }

  const row = data?.[0];
  if (!row) throw new Error('The shot was not recorded');
  return { shotsTaken: row.shots_taken, shotsLeft: row.shots_left ?? null };
}

/** Attach a finished upload to its row. */
export async function markPhotoUploaded(
  photoId: string,
  upload: { storagePath: string; thumbPath: string; width: number; height: number }
): Promise<void> {
  const { error } = await getSupabase()
    .from('photos')
    .update({
      storage_path: upload.storagePath,
      thumb_path: upload.thumbPath,
      width: upload.width,
      height: upload.height,
      status: 'uploaded',
    })
    .eq('id', photoId);
  if (error) throw error;
}

/**
 * The album, oldest first. Before the event is developed this is only the
 * caller's own frames.
 */
export async function listPhotos(eventId: string): Promise<Photo[]> {
  const { data, error } = await getSupabase()
    .from('photos')
    .select()
    .eq('event_id', eventId)
    .eq('status', 'uploaded')
    .order('taken_at');
  if (error) throw error;
  return data ?? [];
}

/**
 * Remove a picture — its owner, or the host moderating their event.
 *
 * Files first: a row without files is an invisible gap, files without a row are
 * bytes nobody can find again.
 */
export async function deletePhoto(photo: Photo): Promise<void> {
  const paths = [photo.storage_path, photo.thumb_path].filter((p): p is string => !!p);
  await removeFiles(paths);

  const { error } = await getSupabase().from('photos').delete().eq('id', photo.id);
  if (error) throw error;
}
