/**
 * 13's roll counter — "17 left".
 *
 * The number is whatever `useCameraSession` hands it: the server's count minus
 * frames still waiting to be counted. Nothing is computed here.
 *
 * The last few frames warm in colour, the way the numbers on a film counter
 * turn red near the end. The unlimited roll shows the sign alone — there is
 * nothing left to count.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Camera, Colors } from '@/constants/theme';
import { Typography } from '@/constants/typography';

const T = Camera.counter;

/** Large text sizes must not push the counter into the close button. */
const MAX_SCALE = 1.3;

export function RollCounter({ shotsLeft }: { shotsLeft: number | null }) {
  const unlimited = shotsLeft === null;
  const low = !unlimited && shotsLeft <= T.lowAt;

  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="text"
      accessibilityLabel={
        unlimited ? 'Unlimited photos' : `${shotsLeft} ${shotsLeft === 1 ? 'photo' : 'photos'} left`
      }>
      <Text
        maxFontSizeMultiplier={MAX_SCALE}
        style={[styles.numeral, { color: low ? T.lowColor : Colors.text }]}>
        {unlimited ? '∞' : shotsLeft}
      </Text>
      {unlimited ? null : (
        <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.suffix}>
          left
        </Text>
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
  numeral: {
    ...Typography.shotCount,
  },
  suffix: {
    ...Typography.shotSuffix,
    color: T.suffixColor,
  },
});
