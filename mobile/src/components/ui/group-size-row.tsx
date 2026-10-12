/**
 * The group-size picker on 05.1 — seven circles that grow with the number.
 *
 * The control is the sizing: 4 people is a dot and 200 is a disc, so the row
 * reads as a scale before any of the numerals do. Picking one sets both the
 * price tier and which film lengths are on offer (see lib/pricing.ts).
 *
 * The circles bottom-align on a common line, which is why each sits in a
 * fixed-height box — letting them centre would make the numerals underneath
 * ride up and down and the row look ragged.
 */

import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { GroupCircleState, GroupRow, Motion } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { at } from '@/lib/pair';
import { GROUP_PRESETS } from '@/lib/pricing';

const TIMING = {
  duration: Motion.duration,
  easing: Easing.bezier(...Motion.bezier).factory(),
} as const;

/** The largest circle plus its halo — the height every slot reserves. */
const BOX = GroupRow.sizes[GroupRow.sizes.length - 1] + GroupRow.ringWidth * 2;

type GroupSizeRowProps = {
  /** The selected preset. Always one of GROUP_PRESETS. */
  value: number;
  onChange: (size: number) => void;
  style?: StyleProp<ViewStyle>;
};

export function GroupSizeRow({ value, onChange, style }: GroupSizeRowProps) {
  return (
    <View accessibilityRole="radiogroup" style={[styles.row, style]}>
      {GROUP_PRESETS.map((preset, index) => (
        <GroupCircle
          key={preset}
          preset={preset}
          diameter={GroupRow.sizes[index]}
          selected={preset === value}
          onPress={() => onChange(preset)}
        />
      ))}
    </View>
  );
}

type GroupCircleProps = {
  preset: number;
  diameter: number;
  selected: boolean;
  onPress: () => void;
};

function GroupCircle({ preset, diameter, selected, onPress }: GroupCircleProps) {
  // Derived from props and animated by returning `withTiming(...)` from the style
  // itself — the film-strip-card.tsx idiom. Nothing mutates a shared value, which
  // the React Compiler treats as writing to an immutable binding.
  // The dependency array is not optional here. `selected` is a plain prop read
  // inside a worklet closure, and Reanimated's automatic detection does not see
  // through the `at()` call to it — without the array the style body never
  // re-runs and the circle stays on its first look forever.
  const circle = useAnimatedStyle(
    () => ({
      backgroundColor: withTiming(at(GroupCircleState.fill, selected), TIMING),
      borderColor: withTiming(at(GroupCircleState.border, selected), TIMING),
    }),
    [selected]
  );

  const ring = useAnimatedStyle(
    () => ({
      opacity: withTiming(at(GroupCircleState.ring, selected), TIMING),
    }),
    [selected]
  );

  const label = useAnimatedStyle(
    () => ({
      color: withTiming(at(GroupCircleState.label, selected), TIMING),
    }),
    [selected]
  );

  const ringSize = diameter + GroupRow.ringWidth * 2;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Up to ${preset} people`}
      onPress={onPress}
      // The smallest circle is 14pt across; the slot is ~46pt wide on a 390pt
      // screen, so only the vertical axis needs help reaching a 44pt target.
      hitSlop={{ top: 12, bottom: 12 }}
      style={styles.slot}>
      <View style={styles.box}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
            ring,
          ]}
        />
        <Animated.View
          style={[
            styles.circle,
            { width: diameter, height: diameter, borderRadius: diameter / 2 },
            circle,
          ]}
        />
      </View>
      <Animated.Text style={[styles.label, label]}>{preset}</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: GroupRow.rowPaddingTop,
    paddingHorizontal: GroupRow.rowPaddingX,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: GroupRow.labelGap,
  },
  /** Fixed height so every circle bottom-aligns and the numerals share a baseline. */
  box: {
    height: BOX,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    backgroundColor: GroupRow.ringColor,
    // Centred on the circle, which sits at the bottom of the box.
    bottom: -GroupRow.ringWidth,
  },
  circle: {
    borderWidth: GroupRow.borderWidth,
  },
  label: {
    ...Typography.durationPill,
    fontSize: GroupRow.labelSize,
    letterSpacing: GroupRow.labelLetterSpacing,
  },
});
