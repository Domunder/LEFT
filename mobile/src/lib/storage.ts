/**
 * The one place that knows where photo files live.
 *
 * Everything that reads or writes a file goes through here, so moving originals
 * to another object store (Cloudflare R2 is the plan once egress matters) is a
 * change to this file and not to the camera or the album.
 *
 * Path convention, which the bucket's policies parse — segment 1 is the event,
 * segment 2 the owner, and the file name must be a photo id this user claimed:
 *
 *     {event_id}/{user_id}/{photo_id}.jpg
 *     {event_id}/{user_id}/{photo_id}_thumb.jpg
 *
 * **Reading is gated by the reveal on the server.** A signed URL for someone
 * else's photo cannot be minted before the event is developed, whatever the app
 * asks for.
 */

import { getSupabase } from './supabase';

export const PHOTO_BUCKET = 'photos';

/** The print-capable original. */
export function photoPath(eventId: string, userId: string, photoId: string): string {
  return `${eventId}/${userId}/${photoId}.jpg`;
}

/** The grid thumbnail. */
export function thumbPath(eventId: string, userId: string, photoId: string): string {
  return `${eventId}/${userId}/${photoId}_thumb.jpg`;
}

/**
 * Upload one JPEG.
 *
 * `upsert` so a retry after a dropped connection replaces a partial object
 * instead of failing on "already exists".
 */
export async function uploadJpeg(path: string, body: ArrayBuffer | Blob): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(PHOTO_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
}

/**
 * Short-lived URLs for a batch of paths, keyed by path.
 *
 * Never cache these at module level: a cache would outlive sign-out and hand the
 * next person on the device a live URL into the previous person's event.
 */
export async function signedUrls(
  paths: readonly string[],
  expiresInSeconds = 3600
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;

  const { data, error } = await getSupabase()
    .storage.from(PHOTO_BUCKET)
    .createSignedUrls([...paths], expiresInSeconds);
  if (error) throw error;

  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}

export async function removeFiles(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await getSupabase().storage.from(PHOTO_BUCKET).remove([...paths]);
  if (error) throw error;
}
