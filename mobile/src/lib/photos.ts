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

/**
 * Where the caller's roll stands, without spending anything — what the camera
 * shows before its first claim of a session.
 *
 * Reads the same `shots_taken` that `claim_shot()` writes, so it is the server's
 * number. The unlimited roll reports null, as the claim does.
 */
export async function getRollState(
  eventId: string,
  userId: string,
  rollSize: number | null
): Promise<RollState> {
  const { data, error } = await getSupabase()
    .from('event_members')
    .select('shots_taken')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .single();
  if (error) throw error;

  return {
    shotsTaken: data.shots_taken,
    shotsLeft: rollSize === null ? null : Math.max(0, rollSize - data.shots_taken),
  };
}

/**
 * Attach a finished upload to its row.
 *
 * `mark_photo_uploaded()` is the only door: clients cannot write a photo row.
 * The server derives both paths from the row and checks that the two files are
 * in the bucket — a path a client could choose was a path account deletion and
 * moderation would later delete on its word.
 */
export async function markPhotoUploaded(
  photoId: string,
  size: { width: number; height: number }
): Promise<void> {
  const { error } = await getSupabase().rpc('mark_photo_uploaded', {
    p_photo_id: photoId,
    p_width: size.width,
    p_height: size.height,
  });
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
 * The caller's own uploaded frames, newest first — readable before the event
 * is developed, because RLS always lets a member see their own.
 */
export async function listMyPhotos(eventId: string, userId: string): Promise<Photo[]> {
  const { data, error } = await getSupabase()
    .from('photos')
    .select()
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('status', 'uploaded')
    .order('taken_at', { ascending: false });
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

/**
 * Flag someone else's picture for the operator to look at.
 *
 * `report_photo()` is the only door: it checks that the caller can see the
 * photo, and a second report of the same picture by the same person is a
 * no-op, so a double tap or a retry is safe. Nothing can be read back — a
 * report is never visible to a client.
 */
export async function reportPhoto(photoId: string): Promise<void> {
  const { error } = await getSupabase().rpc('report_photo', { p_photo_id: photoId });
  if (error) throw error;
}
