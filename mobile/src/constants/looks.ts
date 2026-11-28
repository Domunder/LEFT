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
  /**
   * One line a host can choose from. No jargon. A translation key, read with
   * `t()` where it is drawn — never text built at import time. Spelt out
   * rather than typed as `TKey`: this file is copied to the website and
   * transpiled for the App Clip, so it must not import `@/i18n`.
   */
  blurbKey: `onboarding.look${'Golden' | 'Original' | 'Chrome' | 'Faded' | 'Mono'}Blurb`;
};

/*
  Four colour schemes, not effects. Each one is how a kind of film rendered
  colour — warm, cool, washed out, black and white — kept muted and clean: the
  picture stays sharp and natural, only its palette changes. No brand names in
  the UI — the ids are the enum's, the names are ours.
*/
export const LOOKS: readonly LookOption[] = [
  { id: 'golden', name: 'Golden', blurbKey: 'onboarding.lookGoldenBlurb' },
  { id: 'original', name: 'Original', blurbKey: 'onboarding.lookOriginalBlurb' },
  { id: 'faded', name: 'Faded', blurbKey: 'onboarding.lookFadedBlurb' },
  { id: 'mono', name: 'Mono', blurbKey: 'onboarding.lookMonoBlurb' },
  { id: 'chrome', name: 'Chrome', blurbKey: 'onboarding.lookChromeBlurb' },
] as const;

/**
 * Retired from the picker (1.3.0, the user, 2026-11-28: "drop chrome and add
 * original"). Events created with one keep it, so its recipe and name stay.
 */
const RETIRED: readonly FilmLook[] = ['chrome'];

/** What 03 offers a host. `LOOKS` is every look an event can have. */
export const OFFERED_LOOKS: readonly LookOption[] = LOOKS.filter(
  (look) => !RETIRED.includes(look.id)
);

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
  /*
    Original: the photo as the phone took it. The recipe is neutral, and that
    is all the viewfinder needs; the print skips the shader altogether
    (`developPhoto`), so it gets no grain, vignette or lens fringing either.
    The web camera and the App Clip run this neutral recipe through their
    shaders, which still add the lens's trace of fringing.
  */
  original: {
    saturation: 1.0,
    gain: [1.0, 1.0, 1.0],
    contrast: 1.0,
    shadowTint: [0.0, 0.0, 0.0],
    highlightTint: [0.0, 0.0, 0.0],
    fade: 0.0,
    grain: 0.0,
    vignette: 0.0,
  },
  // Cool: the same restraint, leaning green-blue in the shadows. Retired from
  // the picker in 1.3.0; kept for the events that have it.
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
  /**
   * Long edge of the original, in pixels — enough for a print (Phase 2).
   * 3600 since 2026-11-19 (was 3000; the user, "the photos look soft"): a
   * full-screen viewfinder crops the 4032 px capture, and 3000 then threw
   * away detail the crop had kept.
   */
  longEdge: 3600,
  quality: 90,
  /**
   * Long edge of the thumbnail: the grids, the album's hero and the viewer's
   * first paint. 1080 since 2026-11-19 (was 640, which the full-width hero
   * blew up almost twofold until the original arrived).
   */
  thumbLongEdge: 1080,
  thumbQuality: 78,
} as const;

/**
 * Mitchell–Netravali bicubic (B = C = 1/3) for every resize of a photo.
 * Linear filtering with mipmaps blended in the half-size level on a 0.75×
 * shrink and softened the whole print (2026-11-19).
 */
export const RESAMPLE = { B: 1 / 3, C: 1 / 3 } as const;
