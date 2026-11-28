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
 * **A digit wheel (1.3.0, step 8).** Each place is a strip of digits behind a
 * window one line high; a changed place turns one step and seats with a slight
 * overshoot, the way a film counter clicks on. Only the places that change
 * turn; 0 → 9 turns one step too (the strip carries a spare 9 and 0 at its
 * ends). A leading place that empties (10 → 9) simply goes.
 *
 * Reduced motion keeps the earlier counter: the old digit fades out as the new
 * one fades in (`Digit`).
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
import { t } from '@/i18n';
import { Typography } from '@/constants/typography';

const T = Camera.counter;

/** Large text sizes must not push the counter into the close button. */
const MAX_SCALE = 1.3;

const TRAVEL = Typography.shotCount.lineHeight! * T.roll.travel;

export function RollCounter({ shotsLeft }: { shotsLeft: number | null }) {
  const unlimited = shotsLeft === null;
  const low = !unlimited && shotsLeft <= T.lowAt;
  const color = low ? T.lowColor : Colors.text;

  const reduceMotion = useReducedMotion();
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
        unlimited ? t('camera.rollUnlimitedA11y') : t('camera.rollLeftA11y', { count: shotsLeft })
      }>
      <View style={[styles.number, !reduceMotion && !unlimited && styles.window]}>
        {digits.map((d) =>
          d.char === '' ? null : !reduceMotion && isDigit(d.char) ? (
            <Wheel key={d.key} char={d.char} before={d.before} style={[styles.numeral, { color }]} />
          ) : (
            <Digit key={d.key} char={d.char} before={d.before} style={[styles.numeral, { color }]} />
          )
        )}
      </View>
      {unlimited ? null : (
        <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.suffix}>
          {t('camera.rollLeft', { count: shotsLeft })}
        </Text>
      )}
    </View>
  );
}

function label(shotsLeft: number | null): string {
  return shotsLeft === null ? '∞' : String(shotsLeft);
}

const isDigit = (char: string) => char.length === 1 && char >= '0' && char <= '9';

/** A spare 9 above the 0 and a spare 0 under the 9, so the wheel turns one step either way. */
const STRIP = ['9', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;
const LINE = Typography.shotCount.lineHeight!;

/**
 * One place as a wheel. The digit itself is in the flow, unseen, and gives the
 * place its width and baseline; the strip turns over it.
 */
function Wheel({ char, before, style }: { char: string; before: string; style: TextStyle[] }) {
  // The strip's index of a digit is the digit plus one.
  const index = useSharedValue(Number(char) + 1);

  useEffect(() => {
    const to = Number(char);
    if (char === before || !isDigit(before)) {
      index.value = to + 1;
      return;
    }
    const from = Number(before);
    // Start from the digit's own cell: after a wrap the wheel rests on a spare.
    index.value = from + 1;
    const target = from === 0 && to === 9 ? 0 : from === 9 && to === 0 ? 11 : to + 1;
    index.value = withSpring(target, { ...T.wheel.spring, reduceMotion: ReduceMotion.Never });
  }, [char, before, index]);

  const turn = useAnimatedStyle(() => ({
    transform: [{ translateY: -index.value * LINE }],
  }));

  return (
    <View>
      <Text maxFontSizeMultiplier={1} style={[style, styles.unseen]}>
        {char}
      </Text>
      <Animated.View
        style={[styles.strip, turn]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden>
        {STRIP.map((digit, i) => (
          <Text key={i} maxFontSizeMultiplier={1} style={[style, styles.cell]}>
            {digit}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

/** One digit's place: the new digit in the flow, the old one leaving over it. */
function Digit({
  char,
  before,
  style,
}: {
  char: string;
  before: string;
  style: TextStyle[];
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
  // The wheels' window: one line high. Only around wheels — the sign and the
  // reduced-motion digits grow with large text and must not be cut.
  window: {
    height: LINE,
    overflow: 'hidden',
  },
  unseen: {
    opacity: 0,
  },
  strip: {
    position: 'absolute',
    top: 0,
    left: -T.wheel.bleed,
    right: -T.wheel.bleed,
  },
  cell: {
    height: LINE,
    textAlign: 'center',
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
