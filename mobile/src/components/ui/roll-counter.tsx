/**
 * 13's roll counter — "17 left".
 *
 * The number is whatever `useCameraSession` hands it: the server's count minus
 * frames still waiting to be counted. Nothing is computed here.
 *
 * The last few frames warm in colour, the way the numbers on a film counter
 * turn red near the end. The unlimited roll shows the sign alone — there is
 * nothing left to count.
 *
 * A changed digit rolls, as the App Clip's counter does (`.numericText()`):
 * the old one rises out and fades, the new one rises in from below, and only
 * the digits that changed move. SwiftUI also blurs them in flight; RN cannot
 * blur a glyph cheaply, so this one only slides and fades. Reduced motion:
 * a cross-fade.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Camera, Colors } from '@/constants/theme';
import { Typography } from '@/constants/typography';

const T = Camera.counter;

/** Large text sizes must not push the counter into the close button. */
const MAX_SCALE = 1.3;

const TRAVEL = Typography.shotCount.lineHeight! * T.roll.travel;

export function RollCounter({ shotsLeft }: { shotsLeft: number | null }) {
  const unlimited = shotsLeft === null;
  const low = !unlimited && shotsLeft <= T.lowAt;
  const color = low ? T.lowColor : Colors.text;

  const [shown, setShown] = useState({ now: label(shotsLeft), before: label(shotsLeft) });
  const now = label(shotsLeft);
  if (shown.now !== now) setShown({ now, before: shown.now });

  // Digits line up from the right, so 15 → 14 moves only the last one, and
  // 10 → 9 lets the "1" leave on its own.
  const slots = Math.max(shown.now.length, shown.before.length);
  const digits = Array.from({ length: slots }, (_, i) => {
    const fromRight = slots - 1 - i;
    return {
      key: fromRight,
      char: shown.now[shown.now.length - 1 - fromRight] ?? '',
      before: shown.before[shown.before.length - 1 - fromRight] ?? '',
    };
  });

  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="text"
      accessibilityLabel={
        unlimited ? 'Unlimited photos' : `${shotsLeft} ${shotsLeft === 1 ? 'photo' : 'photos'} left`
      }>
      <View style={styles.number}>
        {digits.map((d) => (
          <Digit key={d.key} char={d.char} before={d.before} style={[styles.numeral, { color }]} />
        ))}
      </View>
      {unlimited ? null : (
        <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.suffix}>
          left
        </Text>
      )}
    </View>
  );
}

function label(shotsLeft: number | null): string {
  return shotsLeft === null ? '∞' : String(shotsLeft);
}

/** One digit's place: the new digit in the flow, the old one leaving over it. */
function Digit({
  char,
  before,
  style,
}: {
  char: string;
  before: string;
  style: (TextStyle | false)[];
}) {
  const reduceMotion = useReducedMotion();
  // 1 = settled. Starts settled, so the first render does not roll in.
  const progress = useSharedValue(1);
  const travel = reduceMotion ? 0 : TRAVEL;

  useEffect(() => {
    if (char === before) return;
    progress.value = 0;
    progress.value = withSpring(1, { ...T.roll.spring, reduceMotion: ReduceMotion.Never });
  }, [char, before, progress]);

  const incoming = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * travel }],
  }));
  const outgoing = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: -progress.value * travel }],
  }));

  return (
    <View>
      <Animated.Text maxFontSizeMultiplier={MAX_SCALE} style={[style, incoming]}>
        {char}
      </Animated.Text>
      {char === before ? null : (
        <Animated.Text
          maxFontSizeMultiplier={MAX_SCALE}
          style={[style, styles.leaving, outgoing]}
          importantForAccessibility="no"
          accessibilityElementsHidden>
          {before}
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: T.gap,
  },
  number: {
    flexDirection: 'row',
  },
  numeral: {
    ...Typography.shotCount,
  },
  // Pinned to its place's right edge: a leading digit that leaves (10 → 9)
  // has a place of no width and rises out where it stood.
  leaving: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  suffix: {
    ...Typography.shotSuffix,
    color: T.suffixColor,
  },
});
