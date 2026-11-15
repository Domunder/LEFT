/**
 * The photos on each moment's stack in the library, and how many it holds.
 *
 * A developed moment shows the album's first few photos. One that is not
 * developed shows none of its own — the library draws dimmed sample pictures
 * there instead (decided 2026-11-15; `constants/samples.ts`) — so only its
 * count is read. RLS decides what the count covers: the caller's own frames
 * before the reveal, everyone's after.
 *
 * One small query per event and one signing request for all of them. A library
 * is a handful of events.
 */

import { isDeveloped, type Event } from './events';
import { signedUrls } from './storage';
import { getSupabase } from './supabase';
import { localShots } from './upload-queue';

export type FilmCover = {
  /** The album's first photos, front first. Empty until the moment is developed. */
  uris: string[];
  /** Photos the caller can see: their own before the reveal, everyone's after. */
  photoCount: number;
};

/** How many photos a stack shows: the one in front and two behind it. */
const STACK_SIZE = 3;

async function coverRow(event: Event): Promise<{ thumbPaths: string[]; count: number }> {
  const developed = isDeveloped(event);
  const { data, count, error } = await getSupabase()
    .from('photos')
    .select('thumb_path', { count: 'exact' })
    .eq('event_id', event.id)
    .eq('status', 'uploaded')
    // The stack opens the way the album does: on its first photos.
    .order('taken_at', { ascending: true })
    .limit(developed ? STACK_SIZE : 1);
  if (error) throw error;

  const thumbPaths = developed
    ? (data ?? []).flatMap((row) => (row.thumb_path ? [row.thumb_path] : []))
    : [];
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
    // Offline: the stacks fall back to their tint.
  }

  events.forEach((event, i) => {
    const { thumbPaths, count } = rows[i];

    // Frames still in the upload queue are not on the server yet, but they count.
    const queued = isDeveloped(event) ? 0 : localShots(event.id).length;

    covers.set(event.id, {
      uris: thumbPaths.flatMap((path) => {
        const url = urls.get(path);
        return url ? [url] : [];
      }),
      photoCount: count + queued,
    });
  });

  return covers;
}
