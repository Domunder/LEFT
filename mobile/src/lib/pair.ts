/**
 * Picker for the state pairs in constants/theme.ts.
 *
 * Several components animate between two looks — selected or not — and the theme
 * stores those as tuples ordered [unselected, selected] (`FilmStripState`,
 * `GroupCircleState`, `LengthChoiceState`). This turns the flag into the right
 * end of one.
 *
 * A three-state variant lived here while 05.1's length picker drew out-of-tier
 * lengths dimmed; that row now offers only legal lengths, and the variant went
 * with it.
 */

/**
 * Pick the selected or unselected end of a two-state pair.
 *
 * Marked as a worklet: every caller uses it *inside* `useAnimatedStyle`, which
 * runs on the UI thread. A plain JS function called from there throws an
 * uncatchable error that aborts the process rather than showing a red box.
 */
export function at<T>(pair: readonly [T, T], selected: boolean): T {
  'worklet';
  return pair[selected ? 1 : 0];
}
