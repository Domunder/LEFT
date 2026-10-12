/**
 * The ring spinner on 14 · Creating Your Film.
 *
 * A circle with a dim border whose *top* edge is bright, rotated continuously:
 * the bright arc is what the eye tracks, so one border colour override does the
 * work an animated arc would otherwise need. That is the artboard's own
 * construction (`border: 2px solid rgba(255,255,255,0.1); border-top-color:
 * #f0ede8; animation: spin 1s linear infinite`), and it is the reason this needs
 * no SVG.
 *
 * Linear, not eased. A spinner that accelerates and decelerates reads as
 * something struggling rather than something working steadily, and this one may
 * be on screen for a while.
 *
 * The second use of `withRepeat` in the app, after `rec-pill.tsx`.
 */

import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Processing } from '@/constants/theme';

type SpinnerProps = {
  style?: StyleProp<ViewStyle>;
};

export function Spinner({ style }: SpinnerProps) {
  const angle = useSharedValue(0);

  useEffect(() => {
    angle.value = withRepeat(
      withTiming(360, { duration: Processing.spinner.duration, easing: Easing.linear }),
      -1,
      /* Not reversing: a spinner that unwound every other cycle would read as
         indecision. Each repeat restarts from 0, which is seamless at 360. */
      false
    );
    return () => {
      angle.value = 0;
    };
  }, [angle]);

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  return (
    <Animated.View
      style={[styles.ring, spin, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    width: Processing.spinner.size,
    height: Processing.spinner.size,
    borderRadius: Processing.spinner.size / 2,
    borderWidth: Processing.spinner.borderWidth,
    borderColor: Processing.spinner.track,
    borderTopColor: Processing.spinner.head,
  },
});
