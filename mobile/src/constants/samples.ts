/**
 * Stock photos that stand in for a moment's pictures before there are any to
 * show: an event that is not developed yet, and the "start a moment" card.
 *
 * They are never passed off as the group's own — wherever they appear they are
 * dimmed and tagged "Sample" (see `PhotoStack`).
 *
 * Six 600x800 JPEGs from Unsplash (Unsplash License), fetched through Lorem
 * Picsum on 2026-11-15. Credits are in assets/images/samples/CREDITS.md.
 */

import type { ImageSource } from 'expo-image';

export const SAMPLE_PHOTOS: readonly ImageSource[] = [
  require('../../assets/images/samples/sample-1.jpg'),
  require('../../assets/images/samples/sample-2.jpg'),
  require('../../assets/images/samples/sample-3.jpg'),
  require('../../assets/images/samples/sample-4.jpg'),
  require('../../assets/images/samples/sample-5.jpg'),
  require('../../assets/images/samples/sample-6.jpg'),
];

/**
 * `count` samples for one stack, starting at a place seeded by `seed` — so two
 * moments side by side do not show the same three pictures, and a moment shows
 * the same ones every time it is drawn.
 */
export function samplesFor(seed: string, count = 3): ImageSource[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;

  const picked: ImageSource[] = [];
  for (let i = 0; i < count; i += 1) {
    picked.push(SAMPLE_PHOTOS[(hash + i) % SAMPLE_PHOTOS.length]);
  }
  return picked;
}

/**
 * The stock pictures a host can pick as the event image (2026-11-21), by the
 * key stored in `events.cover` ("sample-1" … "sample-6"). **No people in
 * them** (the user): places and settings, so they suit any group. Credits in
 * assets/images/covers/CREDITS.md. The web camera and the App Clip carry the
 * same six as `sample-N.jpg`; change all three together, and never reorder —
 * a key names a position.
 */
export const COVER_SAMPLES: readonly { key: string; source: number }[] = [
  require('../../assets/images/covers/cover-1.jpg'),
  require('../../assets/images/covers/cover-2.jpg'),
  require('../../assets/images/covers/cover-3.jpg'),
  require('../../assets/images/covers/cover-4.jpg'),
  require('../../assets/images/covers/cover-5.jpg'),
  require('../../assets/images/covers/cover-6.jpg'),
].map((source: number, i) => ({ key: `sample-${i + 1}`, source }));

/** The event image of a moment without a choice: one of the six, seeded by its id. */
export function coverFor(seed: string): { key: string; source: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return COVER_SAMPLES[hash % COVER_SAMPLES.length];
}
