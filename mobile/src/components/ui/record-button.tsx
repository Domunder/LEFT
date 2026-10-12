/**
 * 13's record button.
 *
 * A circle that becomes a rounded square while recording — the shutter idiom
 * every phone camera uses, and the only control on the screen a guest at a party
 * will find without looking.
 *
 * The morph runs on the artboard's own `cubic-bezier(0.34,1.56,0.64,1)`, which is
 * deliberately not `Motion.bezier`. Its third control point sits above 1, so the
 * shape overshoots its target and settles back: the button snaps rather than
 * eases. Everything else in the app eases; a shutter should not.
 *
 * The 76pt tap target stays the same size in both states — only the dot inside it
 * changes — so a thumb resting on the button to stop a take cannot miss because
 * the target shrank underneath it.
 *
 * While recording it also draws a **countdown ring** for the take's own cap (see
 * `progress`). The ring is inset *within* the 76pt target rather than drawn
 * around it, for the same reason the target does not resize: the control's
 * footprint has to be constant or the row it sits in reflows mid-take.
 */

import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Camera } from '@/constants/theme';

const TIMING = {
  duration: Camera.record.duration,
  easing: Easing.bezier(...Camera.record.bezier).factory(),
} as const;

/*
  The ring's own timing, and it is not the shutter's.

  `progress` arrives from a 250ms interval, so the raw value steps rather than
  sweeps. A matching 250ms **linear** tween turns the steps back into a constant
  sweep — the one place in this file that must not use the artboard's overshooting
  bezier, which would make the ring visibly stutter backwards at every tick.
*/
const RING_TIMING = { duration: 250, easing: Easing.linear } as const;

/* Inset so the stroke sits fully inside the tap target rather than straddling it. */
const RING_RADIUS = (Camera.record.size - Camera.record.ringWidth) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type RecordButtonProps = {
  recording: boolean;
  /** Out of budget, or the camera is not ready. Drawn dimmed and inert. */
  disabled?: boolean;
  /**
   * How much of this take's cap is spent, 0–1. Undefined means no cap is known,
   * and no ring is drawn.
   *
   * Only rendered while `recording` — a full or empty ring on an idle button
   * would read as a state the button does not have.
   */
  progress?: number;
  onPress: () => void;
};

export function RecordButton({
  recording,
  disabled = false,
  progress,
  onPress,
}: RecordButtonProps) {
  const handlePress = useCallback(() => {
    /*
      Haptics on both edges of a take. Starting and stopping a recording are the
      two moments where the screen's own feedback (a pill appearing, a shape
      changing) is easy to miss while pointing the phone at something else.

      Web has no haptics and the call is a no-op there, but it is still skipped
      rather than fired-and-ignored so the platform difference is visible here.
    */
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  }, [onPress]);

  /*
    Clamped, not trusted. `progress` is elapsed-over-cap computed from a wall
    clock, so it can overshoot 1 by a tick before the camera's own stop lands,
    and an offset below zero draws the ring inside out.
  */
  const ring = useAnimatedProps(() => {
    const spent = Math.min(1, Math.max(0, progress ?? 0));
    return {
      strokeDashoffset: withTiming(RING_CIRCUMFERENCE * (1 - spent), RING_TIMING),
    };
  }, [progress]);

  const dot = useAnimatedStyle(
    () => ({
      width: withTiming(recording ? Camera.record.recordingSize : Camera.record.idleSize, TIMING),
      height: withTiming(recording ? Camera.record.recordingSize : Camera.record.idleSize, TIMING),
      borderRadius: withTiming(
        recording ? Camera.record.recordingRadius : Camera.record.idleRadius,
        TIMING
      ),
    }),
    [recording]
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
      accessibilityState={{ disabled, busy: recording }}
      disabled={disabled}
      onPress={handlePress}
      style={styles.root}>
      <View style={[styles.ring, disabled && styles.disabled]}>
        {recording && progress !== undefined ? (
          <Svg
            width={Camera.record.size}
            height={Camera.record.size}
            style={StyleSheet.absoluteFill}
            /* Start at twelve o'clock. SVG arcs begin at three. */
            transform={[{ rotate: '-90deg' }]}
            pointerEvents="none">
            <Circle
              cx={Camera.record.size / 2}
              cy={Camera.record.size / 2}
              r={RING_RADIUS}
              stroke={Camera.record.ringTrack}
              strokeWidth={Camera.record.ringWidth}
              fill="none"
            />
            <AnimatedCircle
              cx={Camera.record.size / 2}
              cy={Camera.record.size / 2}
              r={RING_RADIUS}
              stroke={Camera.record.ringColor}
              strokeWidth={Camera.record.ringWidth}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={RING_CIRCUMFERENCE}
              animatedProps={ring}
            />
          </Svg>
        ) : null}
        <Animated.View style={[styles.dot, dot]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    width: Camera.record.size,
    height: Camera.record.size,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: Camera.record.size,
    height: Camera.record.size,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: Camera.record.disabledOpacity,
  },
  dot: {
    backgroundColor: Camera.record.color,
  },
});
