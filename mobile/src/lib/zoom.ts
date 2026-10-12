/**
 * Zoom stops for 13's segmented control.
 *
 * Two things are true about `CameraView` and they pull in opposite directions:
 *
 *  - **`zoom` is a 0–1 fraction of whatever the device's maximum happens to be**,
 *    not a lens factor. There is no API that says what 2× is in that range, and
 *    the maximum differs wildly — a phone with a 10× telephoto and one with none
 *    both map their whole range onto the same 0–1.
 *  - **`selectedLens` is iOS-only** and takes opaque AVFoundation identifiers
 *    (`builtInUltraWideCamera`, `builtInTelephotoCamera`) that carry no zoom
 *    factor either.
 *
 * So a stop is one of two different things. On an iPhone with more than one rear
 * lens it can be a *real* optical switch, which is the only way to get a true
 * 0.5× and the only way to get a wide shot that is not simply cropped. Everywhere
 * else — every Android, and iPhones with a single rear camera — it is a point on
 * the digital range, and the label is honest about being approximate.
 *
 * The factors here are Apple's own published ones for the lens types, which is
 * why they are safe to print on a button; anything derived from the digital range
 * is not, and is labelled from the range itself rather than invented.
 */

import type { CameraType } from 'expo-camera';

/** An AVFoundation lens name, as `getAvailableLensesAsync()` returns it. */
type LensName = string;

export type ZoomStop = {
  /** What the pill says. */
  label: string;
  /** `CameraView`'s 0–1 zoom fraction for this stop. */
  zoom: number;
  /**
   * The lens to switch to, when this stop is a real optical one.
   *
   * iOS only, and absent on every digital stop — passing `selectedLens` on a
   * device that does not have the lens is what makes a preview go black.
   */
  lens?: LensName;
};

/**
 * The optical stops worth offering, and what Apple says each one's field of view
 * is relative to the wide-angle camera.
 *
 * Ultra-wide is 0.5× on every iPhone that has one. Telephoto is *not* fixed —
 * it has been 2×, 2.5×, 3× and 5× across generations — so it is labelled from a
 * conservative floor rather than claimed precisely. Getting that wrong on a
 * button is worse than being vague on one.
 */
const OPTICAL: { lens: LensName; label: string }[] = [
  { lens: 'builtInUltraWideCamera', label: '0.5×' },
  { lens: 'builtInWideAngleCamera', label: '1×' },
  { lens: 'builtInTelephotoCamera', label: '2×' },
];

/** The wide-angle camera — the default, and the one every phone has. */
const WIDE: LensName = 'builtInWideAngleCamera';

/**
 * The fallback ladder: three points on the digital range.
 *
 * Deliberately shallow. Digital zoom is a crop, so the top of the range is
 * unusable on any phone — offering 10× would be offering mush. These stop at a
 * third of the way up, which is roughly where a modern sensor still has real
 * detail to give.
 */
const DIGITAL: ZoomStop[] = [
  { label: '1×', zoom: 0 },
  { label: '2×', zoom: 0.05 },
  { label: '3×', zoom: 0.12 },
];

/**
 * Turn the lenses a device reports into the stops to draw.
 *
 * Falls back to the digital ladder whenever there is nothing to switch between:
 * a single-lens iPhone, the front camera, and all of Android. A one-button
 * segmented control is not a control, so a device with only the wide-angle lens
 * gets the digital stops rather than a lone "1×".
 */
export function stopsForLenses(lenses: LensName[]): ZoomStop[] {
  const available = OPTICAL.filter((o) => lenses.includes(o.lens));

  if (available.length < 2) return DIGITAL;

  return available.map((o) => ({
    label: o.label,
    /*
      Each optical stop is the *bottom* of its own lens's range. The switch does
      the magnification, so leaving zoom at 0 is what makes it optical rather
      than an optical switch with a crop stacked on top of it.
    */
    zoom: 0,
    lens: o.lens,
  }));
}

/** The stop to start on — 1× where there is one, else the first. */
export function defaultStop(stops: ZoomStop[]): ZoomStop {
  return stops.find((s) => s.label === '1×') ?? stops[0];
}

/**
 * Where a pinch lands, as a stop-shaped value.
 *
 * A pinch moves the digital range continuously, so it has no lens and no label
 * of its own. It keeps whatever lens is selected — pinching on an iPhone's
 * telephoto should zoom *that* lens further, not silently drop back to wide.
 */
export function pinchStop(zoom: number, lens?: LensName): ZoomStop {
  return { label: '', zoom: Math.min(1, Math.max(0, zoom)), lens };
}

/** Lenses are only meaningful for the rear camera on iOS. */
export function supportsLensSwitching(facing: CameraType): boolean {
  return facing === 'back';
}

export { WIDE as WIDE_ANGLE_LENS };
