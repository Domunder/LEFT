/**
 * 05.1's duration picker — every length of filming time the group may choose,
 * face-up.
 *
 * It replaces two things at once: a meter that drew the chosen length as a bar
 * against a fixed ten-minute scale, and an "Adjust" pill that hid the actual
 * options behind a popover. The bar answered a question nobody asked — how does
 * my film compare to the longest one the app can make — and could never fill for
 * a small group, which reads as a shortfall rather than as a short film. The
 * popover meanwhile put the screen's one adjustable thing where it could not be
 * seen, so the length looked fixed until you went looking.
 *
 * Laid out flat, the row is both the control and the readout: the selected card
 * *is* the answer, so nothing has to be repeated above it.
 *
 * **Each card carries the per-person filming time, and that is load-bearing.**
 * The durations alone do not tell a host anything they can decide from — nobody
 * knows, before their wedding, whether theirs is a six-minute film or an
 * eight-minute one. What separates the options is how long each guest gets to
 * film, which is a unit people do have intuition for, and stating it is what
 * turns a longer film from strictly-better into a trade.
 *
 * That per-person number matters more than it used to. It was a share of a pool
 * two and a half times the film's length, so every option looked generous; the
 * pool and the film are one number now, so it is the real thing and it is smaller.
 * The trade it describes is a genuine one.
 *
 * Two or three options, from `adjustOptionsFor()`; the longest is the group's
 * default and also its ceiling, so nothing here can offer a duration
 * `create_event()` would refuse. The cards share the row equally rather than
 * sizing to their text, so a two-up row and a three-up row still read as one
 * control.
 */

import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { LengthChoice, LengthChoiceState, Motion } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { at } from '@/lib/pair';
import { formatDuration, formatDurationWords, perPersonCaptureSeconds } from '@/lib/pricing';

const TIMING = {
  duration: Motion.duration,
  easing: Easing.bezier(...Motion.bezier).factory(),
} as const;

type FilmLengthChoicesProps = {
  /** The durations on offer for the current group, shortest first. */
  options: readonly number[];
  /** The chosen duration. Always one of `options`. */
  value: number;
  /** Group size — the divisor behind each card's per-person line. */
  group: number;
  onChange: (seconds: number) => void;
  style?: StyleProp<ViewStyle>;
};

export function FilmLengthChoices({
  options,
  value,
  group,
  onChange,
  style,
}: FilmLengthChoicesProps) {
  return (
    <View accessibilityRole="radiogroup" style={[styles.row, style]}>
      {options.map((seconds) => (
        <FilmLengthCard
          key={seconds}
          seconds={seconds}
          group={group}
          selected={seconds === value}
          onPress={() => onChange(seconds)}
        />
      ))}
    </View>
  );
}

type FilmLengthCardProps = {
  seconds: number;
  group: number;
  selected: boolean;
  onPress: () => void;
};

function FilmLengthCard({ seconds, group, selected, onPress }: FilmLengthCardProps) {
  /*
    Derived per card rather than passed in: the share is a function of *this*
    card's duration, not of the chosen one, which is the whole point of showing it
    on every card at once.
  */
  const each = perPersonCaptureSeconds(seconds, group);

  /*
    Animated by returning `withTiming(...)` from the style body — the idiom
    group-size-row.tsx uses. The dependency array is not optional: `selected` is a
    plain prop read inside a worklet closure, and Reanimated cannot see through
    `at()` to it, so without the array the card keeps its first look forever.
  */
  const shell = useAnimatedStyle(
    () => ({
      backgroundColor: withTiming(at(LengthChoiceState.bg, selected), TIMING),
      borderColor: withTiming(at(LengthChoiceState.border, selected), TIMING),
    }),
    [selected]
  );

  const duration = useAnimatedStyle(
    () => ({ color: withTiming(at(LengthChoiceState.duration, selected), TIMING) }),
    [selected]
  );

  const perPerson = useAnimatedStyle(
    () => ({ color: withTiming(at(LengthChoiceState.perPerson, selected), TIMING) }),
    [selected]
  );

  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      // The visible text is two fragments; spoken, they need to be a sentence.
      accessibilityLabel={`${formatDurationWords(seconds)} of filming, about ${each} seconds each`}
      onPress={onPress}
      style={[styles.card, shell]}>
      <Animated.Text style={[styles.duration, duration]}>
        {formatDuration(seconds)}
      </Animated.Text>
      <Animated.Text style={[styles.perPerson, perPerson]}>~{each}s each</Animated.Text>
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: LengthChoice.gap,
  },
  card: {
    // Equal shares, so two options and three options both fill the row.
    flex: 1,
    alignItems: 'center',
    gap: LengthChoice.lineGap,
    paddingVertical: LengthChoice.paddingY,
    paddingHorizontal: LengthChoice.paddingX,
    borderRadius: LengthChoice.radius,
    borderWidth: 1,
  },
  duration: {
    ...Typography.numeric,
    fontSize: LengthChoice.durationSize,
  },
  perPerson: {
    ...Typography.caption,
    fontSize: LengthChoice.perPersonSize,
  },
});
