/**
 * A deterministic colour for an event, standing in for cover imagery.
 *
 * **Why this exists.** The artboard's cards each carry a photograph, and 16's
 * backdrop is that photograph blurred. Nothing in the app can produce one: no
 * frame is ever extracted from a clip — the same gap that made screen 13's
 * bottom-right tile a clip count instead of a thumbnail — and there is no
 * compiled film to take a cover from either, since 17 plays the clips in
 * sequence rather than stitching them into a file.
 *
 * So a card's cover is a gradient derived from the event's own id. Deterministic
 * on purpose: a library whose colours reshuffled between launches would read as
 * broken, and the host comes to recognise their event by its colour. The same
 * pair feeds 16's backdrop, so the wash behind the list genuinely derives from
 * the first card rather than being an unrelated decoration.
 *
 * When real covers arrive this is the seam — the card takes its cover as a prop.
 */

/** Hues chosen to sit inside the palette rather than fight it — no primaries. */
const HUES = [18, 42, 168, 198, 214, 258, 286, 336];

/** Both stops stay dark enough for `Colors.text` to hold contrast over them. */
const TOP = { saturation: 32, lightness: 34 };
const BOTTOM = { saturation: 38, lightness: 16 };

/**
 * FNV-1a. Any stable hash would do; this one is short, has no dependencies and
 * spreads uuids across the bucket count evenly enough for the purpose.
 */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The two gradient stops for an event, top to bottom.
 *
 * Shaped for `expo-linear-gradient`'s `colors`, which needs at least two.
 */
export function tintFor(eventId: string): readonly [string, string] {
  const hue = HUES[hash(eventId) % HUES.length];
  return [
    `hsl(${hue}, ${TOP.saturation}%, ${TOP.lightness}%)`,
    `hsl(${hue}, ${BOTTOM.saturation}%, ${BOTTOM.lightness}%)`,
  ] as const;
}
