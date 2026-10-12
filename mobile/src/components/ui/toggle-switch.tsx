/**
 * The switch on 20's Notifications rows.
 *
 * Not React Native's `Switch`. That draws platform chrome — iOS green at its own
 * fixed size, Android's Material thumb — and exposes no way to become the
 * artboard's 42x25 track with an off-white fill and a *dark* knob. The colours
 * here are inverted from every system switch on both platforms, which is the
 * point: on a near-black screen, "on" is the light state.
 *
 * **The off state is invented.** The artboard draws both switches on and shows
 * no off state anywhere in the prototype, so it is the on state inverted — a
 * faint track with a light knob, which is the only reading that keeps the knob
 * visible against `Colors.bg`. Flagged in `Settings.toggle` too.
 *
 * Animated in the style of duration-pill.tsx, but faster than `Motion.duration`:
 * a switch is a direct manipulation and has to land under the finger, where 550ms
 * would feel like the app was deciding whether to agree.
 */

import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

import { Motion, Settings } from '@/constants/theme';

const TIMING = {
  duration: Settings.toggle.duration,
  easing: Easing.bezier(...Motion.bezier).factory(),
};

/** How far the knob travels: track width less the knob and both insets. */
const TRAVEL =
  Settings.toggle.trackWidth - Settings.toggle.knobSize - Settings.toggle.inset * 2;

type ToggleSwitchProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  /** Required: the row's label is a sibling, so the control is unlabelled alone. */
  accessibilityLabel: string;
};

export function ToggleSwitch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: ToggleSwitchProps) {
  const progress = useDerivedValue(() => withTiming(value ? 1 : 0, TIMING), [value]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [Settings.toggle.offTrack, Settings.toggle.onTrack]
    ),
  }));

  const knob = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [Settings.toggle.offKnob, Settings.toggle.onKnob]
    ),
    transform: [{ translateX: progress.value * TRAVEL }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      // 25pt tall against a 44pt target; the row's own padding is not tappable.
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
      style={disabled ? styles.disabled : undefined}>
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: Settings.toggle.trackWidth,
    height: Settings.toggle.trackHeight,
    borderRadius: Settings.toggle.trackHeight / 2,
    padding: Settings.toggle.inset,
    // The knob is positioned by translateX from the inset, not by justifyContent.
    justifyContent: 'center',
  },
  knob: {
    width: Settings.toggle.knobSize,
    height: Settings.toggle.knobSize,
    borderRadius: Settings.toggle.knobSize / 2,
  },
  disabled: {
    opacity: 0.4,
  },
});
