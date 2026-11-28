/**
 * 05.1's group picker (1.3.0) — one bar with a segment per group size and a
 * light thumb that slides to the choice.
 *
 * Replaces the seven growing circles (`group-size-row.tsx`, deleted): the bar
 * is one control with one moving part, so a change reads as a movement, not
 * as two things recolouring. The thumb travels on `Springs.settle`; under
 * reduced motion Reanimated places it without the travel.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Colors, GroupSegments as T, Motion, Radii, Springs } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { t } from '@/i18n';
import { at } from '@/lib/pair';
import { GROUP_PRESETS } from '@/lib/roll';

const TIMING = {
  duration: Motion.duration,
  easing: Easing.bezier(...Motion.bezier).factory(),
} as const;

type GroupSegmentsProps = {
  /** The selected preset. Always one of GROUP_PRESETS. */
  value: number;
  onChange: (size: number) => void;
  style?: StyleProp<ViewStyle>;
};

export function GroupSegments({ value, onChange, style }: GroupSegmentsProps) {
  const [width, setWidth] = useState(0);
  const segment = width > 0 ? (width - 2 * T.padding) / GROUP_PRESETS.length : 0;
  const index = Math.max(0, GROUP_PRESETS.indexOf(value as (typeof GROUP_PRESETS)[number]));

  const thumb = useAnimatedStyle(
    () => ({ transform: [{ translateX: withSpring(index * segment, Springs.settle) }] }),
    [index, segment]
  );

  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.bar, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {segment > 0 ? (
        <Animated.View pointerEvents="none" style={[styles.thumb, { width: segment }, thumb]} />
      ) : null}

      {GROUP_PRESETS.map((preset) => (
        <Segment
          key={preset}
          preset={preset}
          selected={preset === value}
          onPress={() => onChange(preset)}
        />
      ))}
    </View>
  );
}

function Segment({
  preset,
  selected,
  onPress,
}: {
  preset: number;
  selected: boolean;
  onPress: () => void;
}) {
  // The dependency array is required: `selected` is a plain prop read in a worklet.
  const label = useAnimatedStyle(
    () => ({ color: withTiming(at(T.label, selected), TIMING) }),
    [selected]
  );

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={t('onboarding.groupUpTo', { count: preset })}
      onPress={onPress}
      style={styles.segment}>
      <Animated.Text style={[styles.label, label]}>{preset}</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: T.height,
    padding: T.padding,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.bg,
  },
  thumb: {
    position: 'absolute',
    top: T.padding,
    bottom: T.padding,
    left: T.padding,
    borderRadius: Radii.pill,
    backgroundColor: Colors.text,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Typography.choice,
    fontSize: T.fontSize,
    fontVariant: ['tabular-nums'],
  },
});
