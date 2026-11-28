/**
 * Rise — a block that arrives with its screen: a short lift and a fade.
 *
 * Onboarding screens cross-fade (see `Transitions` in the theme), so the
 * movement that says "next" has to come from the content. Give blocks an
 * ascending `index` and they arrive one after another, headline first, the
 * way a page is read.
 *
 * It only runs on mount, on a critically damped spring, and never again — a
 * block that re-lifted on every state change would be noise. Under reduced
 * motion Reanimated skips layout animations, so the block is simply there.
 */

import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Springs, Transitions } from '@/constants/theme';

type RiseProps = PropsWithChildren<{
  /** Place in the screen's reading order; each step waits one stagger longer. */
  index?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function Rise({ index = 0, style, children }: RiseProps) {
  const entering = FadeInDown.delay(index * Transitions.rise.stagger)
    .springify(Springs.settle.duration)
    .dampingRatio(Springs.settle.dampingRatio)
    .withInitialValues({ opacity: 0, transform: [{ translateY: Transitions.rise.travel }] });

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
