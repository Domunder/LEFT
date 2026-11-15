/**
 * The film stocks a host can load — 03's four cards, and what each one does to
 * a picture.
 *
 * Ids mirror the `film_look` enum; adding one means a migration and a recipe in
 * `LOOK_RECIPES`. Order is the order on screen.
 *
 * A recipe is the *only* description of a look. `lib/look-shader.ts` feeds it to
 * one shader, and that shader draws 03's preview cards, the live viewfinder and
 * the JPEG the camera bakes — so none of them can promise what another does
 * not deliver.
 */

import type { FilmLook } from '@/lib/events';

export type LookOption = {
  id: FilmLook;
  name: string;
  /** One line a host can choose from. No jargon. */
  blurb: string;
};

/*
  Four colour schemes, not effects. Each one is how a kind of film rendered
  colour — warm, cool, washed out, black and white — kept muted and clean: the
  picture stays sharp and natural, only its palette changes. No brand names in
  the UI — the ids are the enum's, the names are ours.
*/
export const LOOKS: readonly LookOption[] = [
  { id: 'golden', name: 'Golden', blurb: 'Warm and nostalgic. Soft, sunny colour.' },
  { id: 'chrome', name: 'Chrome', blurb: 'Cool and calm. Muted greens and blues.' },
  { id: 'faded', name: 'Faded', blurb: 'Washed out and gentle, like an old print.' },
  { id: 'mono', name: 'Mono', blurb: 'Clean black and white. Timeless.' },
] as const;

export const DEFAULT_LOOK: FilmLook = 'golden';

export function lookName(id: FilmLook): string {
  return LOOKS.find((look) => look.id === id)?.name ?? id;
}

type Rgb = readonly [number, number, number];

/**
 * What the shader is told. All colour values are linear multipliers or offsets
 * on 0–1 channels, applied in the order they are listed.
 */
export type LookRecipe = {
  /** 0 is black and white, 1 leaves colour alone. */
  saturation: number;
  /** Per-channel multiplier — the white balance of the stock. */
  gain: Rgb;
  /** Around mid-grey: above 1 is punchier, below 1 flatter. */
  contrast: number;
  /** Added to the shadows, fading out towards the highlights. */
  shadowTint: Rgb;
  /** Added to the highlights, fading out towards the shadows. */
  highlightTint: Rgb;
  /** How far black is lifted towards grey — the washed-out print. */
  fade: number;
  /** Grain strength. Luminance noise, strongest in the shadows. */
  grain: number;
  /** How much the corners darken. */
  vignette: number;
};

/**
 * Tuned by eye towards a muted, nostalgic palette (decided 2026-11-15: colour
 * scheme only — no heavy grain, vignette or contrast). Adjust against real
 * party photos. Grain here is the print's; the viewfinder draws none.
 */
export const LOOK_RECIPES: Record<FilmLook, LookRecipe> = {
  // Warm: colours pulled back a little, yellow-warm highlights, soft blacks.
  golden: {
    saturation: 0.9,
    gain: [1.05, 1.0, 0.9],
    contrast: 0.98,
    shadowTint: [0.012, 0.012, 0.0],
    highlightTint: [0.03, 0.018, -0.02],
    fade: 0.045,
    grain: 0.025,
    vignette: 0.1,
  },
  // Cool: the same restraint, leaning green-blue in the shadows.
  chrome: {
    saturation: 0.86,
    gain: [0.97, 1.01, 1.0],
    contrast: 1.0,
    shadowTint: [-0.012, 0.018, 0.014],
    highlightTint: [0.008, 0.004, 0.0],
    fade: 0.04,
    grain: 0.025,
    vignette: 0.1,
  },
  // A print that aged: thinner colour, lifted blacks, a rosy-warm drift.
  faded: {
    saturation: 0.68,
    gain: [1.03, 0.99, 0.94],
    contrast: 0.9,
    shadowTint: [0.03, 0.015, 0.012],
    highlightTint: [0.012, 0.008, -0.01],
    fade: 0.1,
    grain: 0.025,
    vignette: 0.08,
  },
  // Neutral black and white: a touch more contrast, nothing else.
  mono: {
    saturation: 0.0,
    gain: [1.0, 1.0, 1.0],
    contrast: 1.1,
    shadowTint: [0.0, 0.0, 0.0],
    highlightTint: [0.0, 0.0, 0.0],
    fade: 0.02,
    grain: 0.03,
    vignette: 0.1,
  },
} as const;

/**
 * What the lens did to every picture, whatever film was in it: a trace of
 * colour fringing towards the corners. Barely there — the picture stays clear.
 */
export const LENS = {
  /** Red/blue separation at the corners, as a fraction of the picture's size. */
  fringe: 0.0008,
} as const;

/**
 * How fine the grain is: noise cells along the picture's long edge.
 *
 * Relative to the picture rather than to pixels, so a 170pt card and a 3000px
 * original carry the same grain when seen at the same size.
 */
export const GRAIN_CELLS = 720;

/** What the camera writes. */
export const PhotoOutput = {
  /** Long edge of the original, in pixels — enough for a print (Phase 2). */
  longEdge: 3000,
  quality: 88,
  /** Long edge of the album grid's thumbnail. */
  thumbLongEdge: 640,
  thumbQuality: 72,
} as const;
