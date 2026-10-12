/**
 * The ambient glow that travels across the onboarding flow.
 *
 * The design draws this as a blurred radial gradient (`radial-gradient(ellipse, ...)`
 * + `filter: blur(44px)`), mostly offscreen. React Native has neither radial gradients
 * nor a blur filter on a View, so the falloff is built from concentric circles: a
 * small bright core inside progressively larger, fainter rings. Each ring is a plain
 * View with a huge border radius, and because their opacities sum rather than clip,
 * the result reads as a soft radial falloff with no visible banding at these very low
 * opacities.
 *
 * Position and opacity animate whenever the preset changes, so the light appears to
 * be a single source moving across the flow rather than one glow per screen. The
 * component is rendered once by (onboarding)/_layout.tsx, behind the Stack.
 */

import { StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { Glow, GlowPreset, Motion, type GlowPresetName } from '@/constants/theme';

/**
 * Concentric rings approximating the design's falloff.
 *
 * The CSS stops are: peak at the centre, ~1/3 peak at 42%, transparent at 74%. These
 * 16 ring alphas were solved so that their composite (each ring compositing over the
 * ones outside it: `acc + a*(1-acc)`) tracks that curve to within 0.07 of peak. Since
 * peak is at most 0.18, the worst-case absolute error is ~0.013 — far below what is
 * visible, and every outer ring is under 5% alpha so there is no banding.
 *
 * `scale` is the ring's diameter as a fraction of the container; `alpha` is its own
 * opacity. The container is sized to the design's 74% transparent edge.
 */
const RINGS = [
  { scale: 1, alpha: 0.0008 },
  { scale: 0.9375, alpha: 0.0482 },
  { scale: 0.875, alpha: 0.0506 },
  { scale: 0.8125, alpha: 0.0533 },
  { scale: 0.75, alpha: 0.0563 },
  { scale: 0.6875, alpha: 0.0597 },
  { scale: 0.625, alpha: 0.0634 },
  { scale: 0.5625, alpha: 0.0709 },
  { scale: 0.5, alpha: 0.1111 },
  { scale: 0.4375, alpha: 0.125 },
  { scale: 0.375, alpha: 0.1429 },
  { scale: 0.3125, alpha: 0.1667 },
  { scale: 0.25, alpha: 0.2 },
  { scale: 0.1875, alpha: 0.25 },
  { scale: 0.125, alpha: 0.3333 },
  { scale: 0.0625, alpha: 0.5 },
] as const;

const timing = {
  duration: Motion.duration,
  easing: Easing.bezier(...Motion.bezier),
};

/**
 * The rings composite to 0.927 at the centre, not 1.0, so the container opacity is
 * scaled up to land on the preset's true peak.
 */
const PEAK_COMPOSITE = 0.9267;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
});

/**
 * One style per ring, built once at module load rather than per render.
 * A 50% border radius makes each ring a circle whatever the container's size is.
 */
const ringStyles: Record<number, ViewStyle> = Object.fromEntries(
  RINGS.map((ring) => [
    ring.scale,
    {
      position: 'absolute',
      width: `${ring.scale * 100}%`,
      height: `${ring.scale * 100}%`,
      left: `${((1 - ring.scale) / 2) * 100}%`,
      top: `${((1 - ring.scale) / 2) * 100}%`,
      borderRadius: '50%',
      backgroundColor: `${Glow.core}${ring.alpha})`,
    } satisfies ViewStyle,
  ])
);

export function AmbientGlow({ preset }: { preset: GlowPresetName }) {
  const { width, height } = useWindowDimensions();
  const { size, opacity, left, top } = GlowPreset[preset];

  // left/top are screen fractions pointing at the glow's centre, so the container is
  // offset by half its size to centre it on that point.
  const animatedStyle = useAnimatedStyle(() => ({
    width: withTiming(size, timing),
    height: withTiming(size, timing),
    left: withTiming(width * left - size / 2, timing),
    top: withTiming(height * top - size / 2, timing),
    opacity: withTiming(Math.min(opacity / PEAK_COMPOSITE, 1), timing),
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="none">
      {RINGS.map((ring) => (
        <View key={ring.scale} style={ringStyles[ring.scale]} />
      ))}
    </Animated.View>
  );
}
