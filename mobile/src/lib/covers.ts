/**
 * The cover photo on each film in the library, and how many photos it holds.
 *
 * What a cover may show follows the reveal, and RLS enforces it rather than
 * this file: before an event is developed the query can only return the
 * caller's own frames, so a live film is covered by *your* latest shot; once
 * developed it is the album's first photo.
 *
 * One small query per event (newest or oldest row, plus an exact count) and
 * one signing request for all of them. A library is a handful of events.
 */

import { isDeveloped, type Event } from './events';
import { signedUrls } from './storage';
import { getSupabase } from './supabase';
import { localShots } from './upload-queue';

export type FilmCover = {
  /** Undefined when there is no photo to show yet — the card falls back to its tint. */
  uri?: string;
  /** Photos the caller can see: their own before the reveal, everyone's after. */
  photoCount: number;
};

async function coverRow(event: Event): Promise<{ thumbPath?: string; count: number }> {
  const developed = isDeveloped(event);
  const { data, count, error } = await getSupabase()
    .from('photos')
    .select('thumb_path', { count: 'exact' })
    .eq('event_id', event.id)
    .eq('status', 'uploaded')
    // The album opens on its first photo; a live film shows your latest.
    .order('taken_at', { ascending: developed })
    .limit(1);
  if (error) throw error;
  return { thumbPath: data?.[0]?.thumb_path ?? undefined, count: count ?? 0 };
}

/** A cover per event id. Never throws: a film without a cover still has a card. */
export async function loadCovers(events: Event[]): Promise<Map<string, FilmCover>> {
  const covers = new Map<string, FilmCover>();

  const rows = await Promise.all(
    events.map((event) => coverRow(event).catch(() => ({ thumbPath: undefined, count: 0 })))
  );

  let urls = new Map<string, string>();
  try {
    urls = await signedUrls(rows.flatMap((row) => (row.thumbPath ? [row.thumbPath] : [])));
  } catch {
    // Offline: frames still on the phone can cover their film.
  }

  events.forEach((event, i) => {
    const { thumbPath, count } = rows[i];

    // A frame still in the upload queue is newer than anything on the server.
    const queued = isDeveloped(event)
      ? []
      : localShots(event.id).sort((a, b) => b.takenAt.localeCompare(a.takenAt));

    covers.set(event.id, {
      uri: queued[0]?.thumbUri ?? (thumbPath ? urls.get(thumbPath) : undefined),
      photoCount: count + queued.length,
    });
  });

  return covers;
}
