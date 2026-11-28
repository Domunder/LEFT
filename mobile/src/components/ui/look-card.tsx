/**
 * One film stock on 03 — a sample photo developed with the look, its name inside.
 *
 * The artwork is `LookPreview`: the camera's own shader over a bundled frame, so
 * the card shows what the look does rather than a palette standing in for it. A
 * gradient under the text keeps the name legible over any picture.
 *
 * Feedback lands on press-in, as a spring: the card gives under the finger
 * before the selection commits on release, and a spring can be interrupted
 * mid-way if the finger lifts early. The selected/unselected change is a timed
 * cross-fade, because nothing is being dragged.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';

import type { LookOption } from '@/constants/looks';
import { LookPreview } from '@/components/ui/look-preview';
import { LookCard as Tokens, LookCardState, Motion } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { t } from '@/i18n';
import { at } from '@/lib/pair';

const TIMING = {
  duration: Motion.duration,
  easing: Easing.bezier(...Motion.bezier).factory(),
} as const;

type LookCardProps = {
  look: LookOption;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function LookCard({ look, selected, onPress, style }: LookCardProps) {
  const [pressed, setPressed] = useState(false);

  /*
    The dependency arrays are not optional: `pressed` and `selected` are plain
    values read inside a worklet closure, and without the array the card keeps
    its first look forever.
  */
  const shell = useAnimatedStyle(
    () => ({
      transform: [{ scale: withSpring(pressed ? Tokens.pressedScale : 1, Tokens.pressSpring) }],
      borderColor: withTiming(at(LookCardState.border, selected), TIMING),
    }),
    [pressed, selected]
  );

  const dim = useAnimatedStyle(
    () => ({ backgroundColor: withTiming(at(LookCardState.dim, selected), TIMING) }),
    [selected]
  );

  const name = useAnimatedStyle(
    () => ({ color: withTiming(at(LookCardState.name, selected), TIMING) }),
    [selected]
  );

  const blurb = useAnimatedStyle(
    () => ({ color: withTiming(at(LookCardState.blurb, selected), TIMING) }),
    [selected]
  );

  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${look.name}. ${t(look.blurbKey)}`}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.card, shell, style]}>
      <LookPreview look={look.id} />
      <LinearGradient
        colors={[...Tokens.textScrim]}
        locations={[...Tokens.textScrimLocations]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Animated.View style={[StyleSheet.absoluteFill, dim]} pointerEvents="none" />

      <View style={styles.text}>
        <Animated.Text style={[styles.name, name]}>{look.name}</Animated.Text>
        <Animated.Text style={[styles.blurb, blurb]}>{t(look.blurbKey)}</Animated.Text>
      </View>
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  card: {
    aspectRatio: Tokens.aspectRatio,
    borderRadius: Tokens.radius,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: Tokens.bg,
  },
  text: {
    padding: Tokens.padding,
    gap: Tokens.textGap,
  },
  name: {
    ...Typography.groupHeading,
    fontSize: Tokens.nameSize,
  },
  blurb: {
    ...Typography.caption,
    fontSize: Tokens.blurbSize,
    lineHeight: Tokens.blurbLineHeight,
  },
});
