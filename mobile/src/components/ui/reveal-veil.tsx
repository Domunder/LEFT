/**
 * One print coming up in the developer bath — the reveal, per tile.
 *
 * A warm near-black veil over the thumbnail that clears slowly. The album starts every veil from one
 * shared clock (`play`), each delayed by its place in the sheet, so the prints
 * come up one after another.
 *
 * Under reduced motion there is no stagger: the whole sheet cross-fades once.
 */

import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Album } from '@/constants/theme';

const T = Album.reveal;

/** When the last staggered print has finished coming up. */
export function revealDurationMs(count: number, reducedMotion: boolean): number {
  if (reducedMotion) return T.reducedMs;
  return Math.min(Math.max(0, count - 1), T.maxStaggered) * T.staggerMs + T.developMs;
}

type RevealVeilProps = {
  index: number;
  /** False while the sheet waits in the dark, true once it develops. */
  play: boolean;
  reducedMotion: boolean;
};

export function RevealVeil({ index, play, reducedMotion }: RevealVeilProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!play) return;
    progress.value = reducedMotion
      ? withTiming(1, { duration: T.reducedMs })
      : withDelay(
          Math.min(index, T.maxStaggered) * T.staggerMs,
          // Slow to start, like an image surfacing — not a UI ease-out.
          withTiming(1, { duration: T.developMs, easing: Easing.inOut(Easing.cubic) })
        );
  }, [play, index, reducedMotion, progress]);

  const style = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));

  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, style]} />;
}

const styles = StyleSheet.create({
  veil: {
    backgroundColor: T.veil,
  },
});
