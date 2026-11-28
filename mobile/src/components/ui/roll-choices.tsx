/**
 * 05.1's roll picker — every roll size, face-up: 5 · 10 · 16 · 24 · 36 · ∞.
 *
 * The row is both the control and the readout: the selected card *is* the
 * answer, so nothing repeats it above. Six equal cards, so the numerals are the
 * only thing that differs and the eye reads them as one scale.
 *
 * The unlimited card is the only paid one. It does not carry a price tag — the
 * line under the row and the button say what the current choice costs, in one
 * place, so a card never has to. The numeral stands alone — no "photos" under
 * it (2026-11-19, the user).
 */

import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { LengthChoiceState, Motion, RollChoice, RollSetup } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { at } from '@/lib/pair';
import { ROLL_SIZES, rollNumeral, rollWords, type RollSize } from '@/lib/roll';

const TIMING = {
  duration: Motion.duration,
  easing: Easing.bezier(...Motion.bezier).factory(),
} as const;

type RollChoicesProps = {
  value: RollSize;
  onChange: (roll: RollSize) => void;
  /** Three to a row instead of six in one — beside 05.1's mock camera. */
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function RollChoices({ value, onChange, wrap = false, style }: RollChoicesProps) {
  return (
    <View accessibilityRole="radiogroup" style={[styles.row, wrap && styles.wrap, style]}>
      {ROLL_SIZES.map((roll) => (
        <RollCard
          key={roll ?? 'unlimited'}
          roll={roll}
          selected={roll === value}
          wrap={wrap}
          onPress={() => onChange(roll)}
        />
      ))}
    </View>
  );
}

type RollCardProps = {
  roll: RollSize;
  selected: boolean;
  wrap: boolean;
  onPress: () => void;
};

function RollCard({ roll, selected, wrap, onPress }: RollCardProps) {
  /*
    Animated by returning `withTiming(...)` from the style body. The dependency
    array is required: `selected` is a plain prop read inside a worklet closure.
  */
  const shell = useAnimatedStyle(
    () => ({
      backgroundColor: withTiming(at(LengthChoiceState.bg, selected), TIMING),
      borderColor: withTiming(at(LengthChoiceState.border, selected), TIMING),
    }),
    [selected]
  );

  const numeral = useAnimatedStyle(
    () => ({ color: withTiming(at(LengthChoiceState.duration, selected), TIMING) }),
    [selected]
  );

  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={rollWords(roll)}
      onPress={onPress}
      style={[styles.card, wrap && styles.cardWrapped, shell]}>
      <Animated.Text style={[styles.numeral, numeral]}>{rollNumeral(roll)}</Animated.Text>
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: RollChoice.gap,
  },
  wrap: {
    flexWrap: 'wrap',
  },
  // Under a third, so the gaps fit; `flexGrow` takes up the rest.
  cardWrapped: {
    flexBasis: RollSetup.cardBasis,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: RollChoice.paddingY,
    paddingHorizontal: RollChoice.paddingX,
    borderRadius: RollChoice.radius,
    borderWidth: 1,
  },
  numeral: {
    ...Typography.numeric,
    fontSize: RollChoice.numeralSize,
  },
});
