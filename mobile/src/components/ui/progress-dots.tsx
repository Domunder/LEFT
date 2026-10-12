/**
 * The onboarding step indicator: 5 dots, the active one rendered as a 24px-wide
 * pill and the rest as 6px dots.
 *
 * Three states, not two: steps already completed are dimmed off-white, while
 * steps still ahead are the much fainter `surfaceSubtle`.
 *
 * ## Why the pill is a separate layer
 *
 * The indicator has to *travel* between steps rather than snap — the light in
 * one slot goes out as the next comes on, and the eye should follow it across.
 * Animating the dots themselves cannot do that: they are laid out in a row, so
 * widening one and narrowing another reflows everything between them and the
 * pill appears to jump rather than slide.
 *
 * Instead the track underneath is static — every slot is a fixed 24px wide, so
 * nothing ever reflows — and one absolutely-positioned pill slides across it.
 * Its offset is a pure function of `step`, which makes the movement continuous
 * even when a screen change swaps the whole header out.
 *
 * The design note is explicit that this is centered in the header row by absolute
 * positioning, not laid out inline next to the back button — ScreenHeader does that.
 */

import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Colors, Motion, Radii, StepDots } from '@/constants/theme';

export type StepIndicator = {
  /** 1-based index of the current step. */
  step: number;
  total: number;
};

/** Slightly quicker than a full screen transition, so the pill lands first. */
const TIMING = {
  duration: Motion.duration,
  easing: Easing.bezier(...Motion.bezier).factory(),
} as const;

export function ProgressDots({ step, total }: StepIndicator) {
  // Each slot is pill-width so the row never reflows as the pill moves through
  // it; the dot itself is centered inside its slot.
  const slot = StepDots.activeWidth + StepDots.gap;

  const pill = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming((step - 1) * slot, TIMING) }],
  }));

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: step }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.slot, i === total - 1 && styles.lastSlot]}>
          {/*
            The dot under the pill is hidden rather than removed: leaving it in
            would show through as a dark seam while the pill slides over it.
          */}
          <View
            style={[
              styles.dot,
              i < step - 1 ? styles.completed : styles.inactive,
              i === step - 1 && styles.covered,
            ]}
          />
        </View>
      ))}

      <Animated.View style={[styles.pill, pill]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slot: {
    width: StepDots.activeWidth,
    marginRight: StepDots.gap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: StepDots.dotWidth,
    height: StepDots.height,
    borderRadius: Radii.pill,
  },
  completed: {
    backgroundColor: Colors.dotCompleted,
  },
  inactive: {
    backgroundColor: Colors.surfaceSubtle,
  },
  covered: {
    opacity: 0,
  },
  // The trailing gap would otherwise push the whole group off-centre in the header.
  lastSlot: {
    marginRight: 0,
  },
  pill: {
    position: 'absolute',
    left: 0,
    width: StepDots.activeWidth,
    height: StepDots.height,
    borderRadius: Radii.pill,
    backgroundColor: Colors.text,
  },
});
