/**
 * 13's zoom control — the glass segment group between flash and flip.
 *
 * Discrete stops *and* pinch, not either/or. Pinch is what a phone camera user
 * reaches for without thinking, and the stops are what someone filming a toast
 * across a room needs to hit without looking at their hand. The artboard draws
 * the stops; the pinch lives on the viewfinder and drives the same value.
 *
 * A stop is always one of the phone's own lenses (`lib/zoom.ts`), which is why
 * the labels arrive as data rather than being drawn from a constant — a device
 * with an ultra-wide shows "0.5×" because it genuinely has one. A phone with a
 * single lens has no stops, and the camera does not render this control at all.
 *
 * Nothing is selected while a pinch is in progress: the value is then between
 * stops, and lighting one up would claim a precision the zoom does not have.
 *
 * Colours come from the two-state tuple idiom (`at()` from lib/pair), and the
 * unselected background is a zero-alpha cream rather than `transparent` for the
 * reason spelled out on `LengthChoiceState`.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Camera, Motion, Radii, ZoomPillState } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { at } from '@/lib/pair';
import type { ZoomStop } from '@/lib/zoom';
import { Glass } from './glass';

const TIMING = {
  duration: Motion.duration,
  easing: Easing.bezier(...Motion.bezier).factory(),
} as const;

type ZoomSelectorProps = {
  /** The stops this device can actually offer — see `stopsForDevice`. */
  stops: ZoomStop[];
  /** The label of the selected stop, or '' while pinching between them. */
  selected: string;
  onSelect: (stop: ZoomStop) => void;
};

export function ZoomSelector({ stops, selected, onSelect }: ZoomSelectorProps) {
  return (
    <View style={styles.root}>
      <Glass radius={Radii.pill} style={styles.group}>
        {stops.map((stop) => (
          <ZoomPill
            key={stop.label}
            stop={stop}
            selected={stop.label === selected}
            onPress={() => onSelect(stop)}
          />
        ))}
      </Glass>
    </View>
  );
}

function ZoomPill({
  stop,
  selected,
  onPress,
}: {
  stop: ZoomStop;
  selected: boolean;
  onPress: () => void;
}) {
  const pill = useAnimatedStyle(
    () => ({ backgroundColor: withTiming(at(ZoomPillState.bg, selected), TIMING) }),
    [selected]
  );

  const label = useAnimatedStyle(
    () => ({ color: withTiming(at(ZoomPillState.text, selected), TIMING) }),
    [selected]
  );

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Zoom ${stop.label}`}
      onPress={onPress}>
      <Animated.View style={[styles.pill, pill]}>
        <Animated.Text style={[styles.label, label]}>{stop.label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: Radii.pill,
  },
  group: {
    flexDirection: 'row',
    gap: Camera.zoom.gap,
    paddingVertical: Camera.zoom.paddingY,
    paddingHorizontal: Camera.zoom.paddingX,
  },
  pill: {
    minWidth: Camera.zoom.pillMinWidth,
    height: Camera.zoom.pillHeight,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Typography.choice,
    fontSize: Camera.zoom.fontSize,
  },
});
