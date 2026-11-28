/**
 * 13's shutter — a cream disc in a ring.
 *
 * It answers on touch-down: the disc gives under the finger and the haptic
 * lands on the same frame, before anything has been decided. The photo is taken
 * on release, so sliding off the button cancels — the disc springs back and no
 * frame is spent. The spring is critically damped; a shutter does not bounce.
 *
 * The scale lives in a shared value rather than in state, so the response does
 * not wait for a React render on the app's busiest screen.
 */

import { haptic } from '@/lib/haptics';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Camera } from '@/constants/theme';

const T = Camera.shutter;

type ShutterButtonProps = {
  /** Fired on release inside the button. */
  onFire: () => void;
  disabled?: boolean;
};

export function ShutterButton({ onFire, disabled = false }: ShutterButtonProps) {
  const scale = useSharedValue(1);

  const disc = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Take photo"
      accessibilityState={{ disabled }}
      disabled={disabled}
      // Generous: a shutter pressed at arm's length is rarely hit dead centre.
      hitSlop={12}
      onPressIn={() => {
        scale.value = withSpring(T.pressedScale, T.pressSpring);
        haptic.press();
      }}
      onPressOut={() => {
        scale.value = withSpring(1, T.pressSpring);
      }}
      onPress={onFire}
      style={[styles.ring, disabled && styles.disabled]}>
      <Animated.View style={[styles.disc, disc]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: T.size,
    height: T.size,
    borderRadius: T.size / 2,
    borderWidth: T.ringWidth,
    borderColor: T.ringColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    width: T.discSize,
    height: T.discSize,
    borderRadius: T.discSize / 2,
    backgroundColor: T.discColor,
  },
  disabled: {
    opacity: T.disabledOpacity,
  },
});
