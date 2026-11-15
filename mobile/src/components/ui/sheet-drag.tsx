/**
 * SheetDrag — makes a bottom sheet something the hand can move.
 *
 * Wraps the sheet's surface. It rises on a spring when it mounts, follows the
 * finger 1:1 downwards, resists being pulled up past its rest (rubber band),
 * and on release lands where the flick was going: past `dismissDistance` it
 * leaves with the finger's velocity and calls `onDismiss`, otherwise it
 * settles back. A new touch takes it over mid-flight — the drag starts from
 * wherever the sheet is, not from where the last animation was headed.
 *
 * The surface must be drawn `SheetMotion.overdraw` past the bottom of the
 * screen by its owner (negative bottom margin, the same again as padding), so
 * pulling the sheet up never shows a gap under it.
 *
 * Reduced motion: no rise and no slide out — the route's own fade carries
 * both. The drag itself stays, it is direct manipulation.
 *
 * Uses Gesture Handler's builder API like the viewer and the camera; migrate
 * the three together.
 */

import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SheetMotion as T, Springs } from '@/constants/theme';
import { project, rubberband } from '@/lib/motion';

type SheetDragProps = PropsWithChildren<{
  /** Called once the sheet has left the screen. */
  onDismiss: () => void;
  /** Holds the sheet in place — while a request it started is still running. */
  locked?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function SheetDrag({ children, onDismiss, locked = false, style }: SheetDragProps) {
  const window = useWindowDimensions();

  /** Distance below rest. Starts off screen; negative while pulled up. */
  const offset = useSharedValue(window.height);
  const dragFrom = useSharedValue(0);
  const height = useSharedValue(window.height);

  useEffect(() => {
    offset.value = withSpring(0, Springs.settle);
  }, [offset]);

  const pan = Gesture.Pan()
    .enabled(!locked)
    .activeOffsetY([-T.slop, T.slop])
    .onStart(() => {
      dragFrom.value = offset.value;
    })
    .onUpdate((e) => {
      const next = dragFrom.value + e.translationY;
      offset.value =
        next < 0 ? Math.max(-T.overdraw, rubberband(next, height.value, T.rubber)) : next;
    })
    .onEnd((e) => {
      const landing = offset.value + project(e.velocityY, T.deceleration);
      if (landing > T.dismissDistance) {
        offset.value = withSpring(
          height.value,
          { ...Springs.settle, velocity: e.velocityY, overshootClamping: true },
          (finished) => {
            if (finished) scheduleOnRN(onDismiss);
          }
        );
      } else {
        // Momentum only when the hand gave it some; a slow let-go just settles.
        offset.value = withSpring(0, { ...Springs.settle, velocity: e.velocityY });
      }
    });

  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[style, animated]}
        onLayout={(e) => {
          height.value = e.nativeEvent.layout.height;
        }}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
