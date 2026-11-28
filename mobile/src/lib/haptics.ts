/**
 * The app's haptic vocabulary — the only file that imports `expo-haptics`.
 *
 * Five words, so the same kind of moment feels the same everywhere:
 *
 *   select   a choice changed: a pill, a card, a switch, a wheel row, a lens
 *   tap      a primary button committed
 *   press    something physical gave way: the shutter, a long press
 *   success  a moment worth marking: the last shot, the reveal
 *   error    a refusal the user has to notice
 *
 * Every call is fire-and-forget and may never throw: a phone without a Taptic
 * Engine, Low Power Mode and the simulator all reject, and feedback is never
 * worth an unhandled rejection. Call these from the JS thread only (from a
 * worklet, go through `runOnJS`).
 */

import * as Haptics from 'expo-haptics';

function fire(run: () => Promise<void>) {
  run().catch(() => {});
}

export const haptic = {
  select: () => fire(() => Haptics.selectionAsync()),
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  press: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
} as const;
