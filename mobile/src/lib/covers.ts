/**
 * The photos on each moment's card in the library, and how many there are.
 *
 * A developed moment shows the album's first few photos. One that is not
 * developed shows the caller's own latest frames (decided 2026-11-16,
 * replacing the sample pictures) — a guest may see their own before the
 * reveal, and nobody else's. No filter is needed for that: RLS returns only
 * the caller's own rows until the event is developed, and it decides what the
 * count covers too — own frames before the reveal, everyone's after.
 *
 * One small query per event and one signing request for all of them. A library
 * is a handful of events.
 */

import { isDeveloped, type Event } from './events';
import { signedUrls } from './storage';
import { getSupabase } from './supabase';
import { localShots } from './upload-queue';

export type FilmCover = {
  /** Up to `STACK_SIZE`: the album's first photos, or the caller's own latest before the reveal. */
  uris: string[];
  /** Photos the caller can see: their own before the reveal, everyone's after. */
  photoCount: number;
};

/** How many prints a moment's stack shows (16). */
export const STACK_SIZE = 3;

async function coverRow(event: Event): Promise<{ thumbPaths: string[]; count: number }> {
  const developed = isDeveloped(event);
  const { data, count, error } = await getSupabase()
    .from('photos')
    .select('thumb_path', { count: 'exact' })
    .eq('event_id', event.id)
    .eq('status', 'uploaded')
    // A developed strip opens the way the album does, on its first photos; a
    // running one shows what the caller shot last.
    .order('taken_at', { ascending: developed })
    .limit(STACK_SIZE);
  if (error) throw error;

  const thumbPaths = (data ?? []).flatMap((row) => (row.thumb_path ? [row.thumb_path] : []));
  return { thumbPaths, count: count ?? 0 };
}

/** A cover per event id. Never throws: a moment without photos still has a stack. */
export async function loadCovers(events: Event[]): Promise<Map<string, FilmCover>> {
  const covers = new Map<string, FilmCover>();

  const rows = await Promise.all(
    events.map((event) => coverRow(event).catch(() => ({ thumbPaths: [] as string[], count: 0 })))
  );

  let urls = new Map<string, string>();
  try {
    urls = await signedUrls(rows.flatMap((row) => row.thumbPaths));
  } catch {
    // Offline: the strips stay empty frames.
  }

  events.forEach((event, i) => {
    const { thumbPaths, count } = rows[i];

    // Frames still in the upload queue are not on the server yet, but they
    // count, and they are the newest — so they lead the strip.
    const queued = isDeveloped(event)
      ? []
      : localShots(event.id).sort((a, b) => b.takenAt.localeCompare(a.takenAt));

    const uploaded = thumbPaths.flatMap((path) => {
      const url = urls.get(path);
      return url ? [url] : [];
    });

    covers.set(event.id, {
      uris: [...queued.map((shot) => shot.thumbUri), ...uploaded].slice(0, STACK_SIZE),
      photoCount: count + queued.length,
    });
  });

  return covers;
}
