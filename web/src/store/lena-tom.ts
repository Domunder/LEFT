/**
 * "Lena & Tom", the demo wedding on the hosted project (invite K7WQ2HXD): the
 * same 22 photos in the order the album shows them (taken_at), with who took
 * each, already graded with the event's golden look by
 * `node scripts/store-photos.mjs`. The store screenshots and the site's album
 * and Moments mocks show this album, so a reviewer who opens the demo sees
 * the same pictures.
 */
import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/photos/lena-tom/*.jpg', { eager: true });

/** In album order: `NN-name.jpg`. */
export const LENA_TOM = Object.keys(files)
  .sort()
  .map((file) => {
    const name = /\d+-([a-z]+)\.jpg$/.exec(file)?.[1] ?? '';
    return { src: files[file].default, by: name.charAt(0).toUpperCase() + name.slice(1) };
  });

/** One print, by its place in the album (1-based). */
export const lenaTom = (n: number) => LENA_TOM[n - 1].src;

/**
 * The header pictures. In the app one event image heads the album, Moments
 * and the invite alike; the mocks use a different photo of the couple on each
 * (the user, 2026-11-21) so the set does not repeat one picture. The hosted
 * event's own image is LENA_TOM_COVER (uploaded 2026-11-21, ungraded at
 * 1080 px as the app stores it; the app draws it through the golden look).
 */
export const LENA_TOM_COVER = lenaTom(5); // the album: the kiss on the hill
export const LENA_TOM_SPOTLIGHT = lenaTom(13); // Moments: running across the field
export const LENA_TOM_INVITE = lenaTom(12); // the invite: hand in hand

const graded = new Set(LENA_TOM.map((print) => print.src.src));
/** Already graded: no CSS stand-in for the look on top. */
export const isGraded = (image: ImageMetadata) => graded.has(image.src);
