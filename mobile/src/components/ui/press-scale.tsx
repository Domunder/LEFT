/**
 * PressScale — a `Pressable` that gives under the finger.
 *
 * It answers on touch-down (a spring towards `scale`) and springs back on
 * release; the action still commits on release inside the target, so sliding
 * off cancels. This replaces the "dim while pressed" every button used to do:
 * an opacity change is only visible once the finger lifts off a small control.
 *
 * The scale lives in a shared value, so the response never waits for a render.
 * It stays on under reduced motion — a few percent of scale is feedback, not
 * travel — but then it steps instead of springing (Reanimated's default).
 *
 * `style` is a plain style, not Pressable's function form: the pressed state
 * is the spring's, not React's. Glass controls use `GlassButton` instead.
 */

import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Press, Springs } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressScaleProps = Omit<PressableProps, 'style'> & {
  /** How far it gives. Defaults to the pill's. */
  scale?: number;
  style?: StyleProp<ViewStyle>;
};

export function PressScale({
  scale = Press.pillScale,
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressScaleProps) {
  const pressed = useSharedValue(0);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scale) }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        pressed.value = withSpring(1, Springs.press);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, Springs.press);
        onPressOut?.(e);
      }}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}
