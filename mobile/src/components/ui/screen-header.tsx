/**
 * The standard header row: back button on the left, optional step dots centered,
 * optional action on the right.
 *
 * The dots are absolutely positioned and centered across the full row width so
 * they stay centered regardless of what sits on either side — matching the design
 * note in design/README.md.
 */

import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CircleBackButton } from './circle-back-button';
import { ProgressDots, type StepIndicator } from './progress-dots';

type ScreenHeaderProps = {
  /** Show the circular back button. Default true. */
  back?: boolean;
  /** Use the blurred glass back button, for screens over video. */
  glass?: boolean;
  /** Where back goes on a screen with no history behind it — see CircleBackButton. */
  backFallback?: Href;
  /**
   * Centered step indicator, e.g. {step: 1, total: 5}.
   *
   * The (onboarding) screens do *not* use this — their dots are rendered once by
   * (onboarding)/_layout.tsx so the active pill can slide between steps instead
   * of being unmounted with the screen. This is for an indicator on a screen
   * outside that group. Nothing uses it today: 06 did, as the flow's last step
   * from inside (auth), and the flow now ends at 05.1.
   */
  dots?: StepIndicator;
  /** Right-hand slot — info button, settings gear, etc. */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ScreenHeader({
  back = true,
  glass = false,
  backFallback,
  dots,
  right,
  style,
}: ScreenHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      {back ? (
        <CircleBackButton glass={glass} fallback={backFallback} />
      ) : (
        <View style={styles.spacer} />
      )}

      {dots ? (
        <View style={styles.dotsLayer} pointerEvents="none">
          <ProgressDots {...dots} />
        </View>
      ) : null}

      {right ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spacer: {
    width: 38,
    height: 38,
  },
  dotsLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
