/**
 * Gesture physics shared by anything that is dragged — the photo viewer, the
 * films carousel.
 *
 * All three are worklets: they run inside gesture callbacks on the UI thread.
 */

/**
 * Where a flick would come to rest, as a distance from where it was released.
 *
 * Scroll-style exponential decay (the form UIScrollView uses), not `v²/2a`.
 * `velocity` is in points per second.
 */
export function project(velocity: number, deceleration: number): number {
  'worklet';
  return ((velocity / 1000) * deceleration) / (1 - deceleration);
}

/**
 * Progressive resistance past a boundary: the further the overshoot, the less
 * the content follows. `dimension` is the size of the thing being dragged.
 */
export function rubberband(overshoot: number, dimension: number, constant: number): number {
  'worklet';
  const sign = overshoot < 0 ? -1 : 1;
  const distance = Math.abs(overshoot);
  return (sign * (distance * dimension * constant)) / (dimension + constant * distance);
}

/** `value` held inside `[min, max]`, rubber-banding outside it. */
export function clampWithRubber(
  value: number,
  min: number,
  max: number,
  dimension: number,
  constant: number
): number {
  'worklet';
  if (value < min) return min + rubberband(value - min, dimension, constant);
  if (value > max) return max + rubberband(value - max, dimension, constant);
  return value;
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}
