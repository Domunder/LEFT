/**
 * A selectable video preview card — the two format choices on 03.
 *
 * The design framed these as strips of film with sprocket-hole bands; that and a
 * later colour-halo treatment were both dropped at the user's request. What is
 * left is the footage in a rounded frame and nothing else, so the two cards read
 * purely as the shapes they are advertising.
 *
 * The clip is 9:16, so the landscape card shows a crop of it rather than the
 * whole frame — `fit="cover"` keeps the footage in proportion either way.
 *
 * Every state difference (border, video opacity, dim, ratio text) animates off
 * the `selected` prop, so picking the other card cross-fades the pair instead of
 * snapping between two static looks.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { BackgroundVideo } from './background-video';
import { FilmStrip, FilmStripState, Motion } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import type { FilmFormat } from '@/lib/events';
import { at } from '@/lib/pair';

/** The design's easing, as a Reanimated timing config. */
const TIMING = {
  duration: Motion.duration,
  easing: Easing.bezier(...Motion.bezier).factory(),
} as const;

/** A touch should settle faster than a state cross-fade, or the card feels soggy. */
const PRESS_SPRING = { damping: 18, stiffness: 260 } as const;
const PRESSED_SCALE = 0.97;

type FilmStripCardProps = {
  ratio: FilmFormat;
  selected: boolean;
  onPress: () => void;
  /** Spoken name of the format — announced instead of the bare "9:16". */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

export function FilmStripCard({
  ratio,
  selected,
  onPress,
  accessibilityLabel,
  style,
}: FilmStripCardProps) {
  const spec = ratio === 'vertical' ? FilmStrip.vertical : FilmStrip.horizontal;

  const [pressed, setPressed] = useState(false);

  // Every animated value is derived from props and animated by returning
  // `withTiming(...)` from the style itself, the same approach AmbientGlow uses.
  // Reanimated cross-fades from whatever was on screen, so the pair of cards
  // still dissolves into each other without a shared value to mutate — which the
  // React Compiler treats as modifying an immutable binding.
  const shell = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed ? PRESSED_SCALE : 1, PRESS_SPRING) }],
  }));

  const frame = useAnimatedStyle(() => ({
    borderColor: withTiming(at(FilmStripState.border, selected), TIMING),
  }));

  const video = useAnimatedStyle(() => ({
    opacity: withTiming(at(FilmStripState.videoOpacity, selected), TIMING),
  }));

  const dim = useAnimatedStyle(() => ({
    backgroundColor: withTiming(at(FilmStripState.dim, selected), TIMING),
  }));

  const ratioText = useAnimatedStyle(() => ({
    color: withTiming(at(FilmStripState.ratioText, selected), TIMING),
  }));

  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.frame, { aspectRatio: spec.aspectRatio }, shell, frame, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, video]}>
        <BackgroundVideo fit="cover" opacity={1} />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, dim]} pointerEvents="none" />

      <Animated.Text style={[styles.ratio, { fontSize: spec.ratioFontSize }, ratioText]}>
        {spec.ratioLabel}
      </Animated.Text>
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The format name under a card. Lives here so its selected/unselected palette
 * stays with the card's, and so the screen can centre it over the same width.
 */
export function FilmStripLabel({ label, selected }: { label: string; selected: boolean }) {
  // Color animates; the 400→500 weight step cannot (RN has no animatable
  // fontFamily) so it swaps discretely, which is imperceptible at 12px.
  const animated = useAnimatedStyle(() => ({
    color: withTiming(at(FilmStripState.label, selected), TIMING),
  }));

  return (
    <Animated.Text
      style={[selected ? Typography.choice : Typography.body, styles.label, animated]}>
      {label}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: FilmStrip.radius,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratio: {
    ...Typography.choice,
    letterSpacing: 13 * 0.06,
  },
  label: {
    fontSize: FilmStrip.labelFontSize,
    textAlign: 'center',
  },
});
