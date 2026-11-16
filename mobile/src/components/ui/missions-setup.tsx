/**
 * 05.1's Missions section — a switch, one line about what it does, and, when it
 * is on, how many missions each guest is dealt: 1 · 2 · 3.
 *
 * Not in the prototype (missions arrived after it). Composed from what 05.1
 * and 20 already draw, so nothing here is a new kind of control:
 *  - the switch is 20's `ToggleSwitch`, beside a plain row title;
 *  - "Missions per guest" is the same eyebrow as "Shots per person";
 *  - the count cards are the roll cards' colours and metrics, three across.
 *
 * Off by default. The count is remembered while the switch is off, so turning
 * it off and on again brings back the last choice instead of resetting to 1.
 * The parent hears one value: `null` (off) or the count.
 *
 * Missions are free, so nothing here touches the price.
 *
 * Motion: the count row fades in and out along the same path (opacity only —
 * no travel, so it is also the reduced-motion version). The parent moves the
 * rest of the page with a layout spring so nothing jumps.
 */

import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { PressScale } from '@/components/ui/press-scale';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Body, Label } from '@/components/ui/typography';
import {
  Colors,
  LengthChoice,
  LengthChoiceState,
  MissionsSetup as Tokens,
  Motion,
  Press,
} from '@/constants/theme';
import { Typography } from '@/constants/typography';
import {
  MISSIONS_PER_GUEST_DEFAULT,
  MISSIONS_PER_GUEST_MAX,
  MISSIONS_PER_GUEST_MIN,
} from '@/lib/missions';
import { at } from '@/lib/pair';

const TIMING = {
  duration: Motion.duration,
  easing: Easing.bezier(...Motion.bezier).factory(),
} as const;

/** The choices, from the server's own bounds (1 · 2 · 3). */
const COUNTS = Array.from(
  { length: MISSIONS_PER_GUEST_MAX - MISSIONS_PER_GUEST_MIN + 1 },
  (_, i) => MISSIONS_PER_GUEST_MIN + i
);

const FADE_IN = FadeIn.duration(Tokens.fadeMs).reduceMotion(ReduceMotion.Never);
const FADE_OUT = FadeOut.duration(Tokens.fadeMs).reduceMotion(ReduceMotion.Never);

type MissionsSetupProps = {
  /** Missions per guest, or null when missions are off. */
  value: number | null;
  onChange: (next: number | null) => void;
  style?: StyleProp<ViewStyle>;
};

export function MissionsSetup({ value, onChange, style }: MissionsSetupProps) {
  const on = value !== null;

  // The last count picked, so off -> on restores it.
  const [lastCount, setLastCount] = useState(value ?? MISSIONS_PER_GUEST_DEFAULT);

  function toggle(next: boolean) {
    onChange(next ? lastCount : null);
  }

  function pick(count: number) {
    setLastCount(count);
    onChange(count);
  }

  return (
    <View style={style}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Missions</Text>
        <ToggleSwitch value={on} onValueChange={toggle} accessibilityLabel="Missions" />
      </View>

      <Body small color={Colors.textFaint} style={styles.explainer}>
        Small challenges for the night, like a photo with someone you&apos;ve never met. Each
        guest gets their own — you can edit them before the start.
      </Body>

      {on ? (
        <Animated.View entering={FADE_IN} exiting={FADE_OUT} style={styles.count}>
          <Label small style={styles.countLabel}>
            Missions per guest
          </Label>

          <View accessibilityRole="radiogroup" style={styles.cards}>
            {COUNTS.map((count) => (
              <CountCard
                key={count}
                count={count}
                selected={count === value}
                onPress={() => pick(count)}
              />
            ))}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

type CountCardProps = {
  count: number;
  selected: boolean;
  onPress: () => void;
};

/** One roll card, recoloured on the same timing, with press-in feedback. */
function CountCard({ count, selected, onPress }: CountCardProps) {
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

  const unit = useAnimatedStyle(
    () => ({ color: withTiming(at(LengthChoiceState.perPerson, selected), TIMING) }),
    [selected]
  );

  const words = count === 1 ? 'mission' : 'missions';

  return (
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${count} ${words} per guest`}
      onPress={onPress}
      scale={Press.cardScale}
      style={styles.cardSlot}>
      <Animated.View style={[styles.card, shell]}>
        <Animated.Text style={[styles.numeral, numeral]}>{count}</Animated.Text>
        <Animated.Text style={[styles.unit, unit]}>{words}</Animated.Text>
      </Animated.View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Tokens.rowGap,
  },
  title: {
    ...Typography.choice,
    color: Colors.text,
    // Takes the row and wraps under large text; the switch keeps its size.
    flex: 1,
  },
  explainer: {
    marginTop: Tokens.explainerGap,
  },
  count: {
    marginTop: Tokens.countGap,
  },
  countLabel: {
    marginBottom: LengthChoice.labelGap,
  },
  cards: {
    flexDirection: 'row',
    gap: Tokens.card.gap,
  },
  cardSlot: {
    flex: 1,
  },
  card: {
    alignItems: 'center',
    gap: Tokens.card.lineGap,
    paddingVertical: Tokens.card.paddingY,
    paddingHorizontal: Tokens.card.paddingX,
    borderRadius: Tokens.card.radius,
    borderWidth: 1,
  },
  numeral: {
    ...Typography.numeric,
    fontSize: Tokens.card.numeralSize,
  },
  unit: {
    ...Typography.caption,
    fontSize: Tokens.card.unitSize,
  },
});
