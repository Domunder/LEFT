/**
 * The progress bar on 14 · Creating Your Film.
 *
 * **Two modes, and which one runs is a question of whether there is anything
 * honest to say.** Given a `progress`, it fills like every other bar in the app,
 * because it is reporting a real quantity: the share of the group's clips that
 * have finished uploading. Given nothing, it falls back to a segment sweeping
 * across the track, which claims only "still going".
 *
 * The artboard draws a fixed 64% fill. That was a lie for as long as this screen
 * waited on `compile_film()` — a stub that returned immediately and had no
 * percentage to give — which is why the sweep was built. The screen now waits
 * for the uploads instead, and those can be counted, so the fill is back and is
 * finally true. The sweep survives for the moment before the count arrives.
 *
 * Like `live-budget-bar.tsx` and `budget-bar.tsx` the determinate mode animates
 * a *width*; the fallback animates a *position*, which is what distinguishes a
 * bar that knows something from one that does not.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Processing, Radii } from '@/constants/theme';

type IndeterminateBarProps = {
  /**
   * 0–1. Omit while the total is still unknown and the bar sweeps instead.
   */
  progress?: number;
  /** Announced to a screen reader in place of the generic label. */
  accessibilityLabel?: string;
};

export function IndeterminateBar({ progress, accessibilityLabel }: IndeterminateBarProps = {}) {
  const determinate = progress !== undefined;
  const travel = useSharedValue(0);
  const fill = useSharedValue(0);

  useEffect(() => {
    if (!determinate) return;
    fill.value = withTiming(Math.min(1, Math.max(0, progress)), {
      duration: Processing.bar.fillDuration,
      easing: Easing.out(Easing.ease),
    });
  }, [determinate, progress, fill]);

  useEffect(() => {
    if (determinate) return;
    travel.value = withRepeat(
      withTiming(1, { duration: Processing.bar.duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      /* Reversing, unlike the spinner: a segment that jumped back to the left
         edge each cycle would read as a stutter, where sweeping back and forth
         reads as continuous activity. */
      true
    );
    return () => {
      travel.value = 0;
    };
  }, [determinate, travel]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  const segment = useAnimatedStyle(() => ({
    /*
      Positioned as a percentage of the track rather than a measured offset — the
      same call every other bar in the app makes, and for the same reason: it
      avoids an onLayout pass and the frame of wrong geometry that comes with it.
    */
    left: `${travel.value * (1 - Processing.bar.segment) * 100}%`,
  }));

  return (
    <View
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? 'Creating your film'}
      /* A `now` only when there is one. Claiming a position the bar does not
         know would mislead a screen reader as much as the eye. */
      accessibilityValue={
        determinate
          ? { min: 0, max: 100, now: Math.round(Math.min(1, Math.max(0, progress)) * 100) }
          : { min: 0, max: 100 }
      }>
      {determinate ? (
        <Animated.View style={[styles.fill, fillStyle]} />
      ) : (
        <Animated.View style={[styles.segment, segment]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: Processing.bar.width,
    height: Processing.bar.height,
    borderRadius: Radii.pill,
    backgroundColor: Processing.bar.track,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: Radii.pill,
    backgroundColor: Processing.bar.fill,
  },
  segment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: `${Processing.bar.segment * 100}%`,
    borderRadius: Radii.pill,
    backgroundColor: Processing.bar.fill,
  },
});
