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
