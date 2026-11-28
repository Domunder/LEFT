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
 * After a pinch the stops step aside for the zoom itself (the user, 2026-11-18,
 * as the system camera does): one lit pill reading "1.2×", following the
 * fingers. A tap on it goes back to 1× and the stops return. A phone with no
 * stops (one lens, the front camera) shows the same pill while zoomed in.
 *
 * Colours come from the two-state tuple idiom (`at()` from lib/pair), and the
 * unselected background is a zero-alpha cream rather than `transparent` for the
 * reason spelled out on `LengthChoiceState`.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { Camera, Motion, Radii, ZoomPillState } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { at } from '@/lib/pair';
import type { ZoomStop } from '@/lib/zoom';
import { Glass } from './glass';

/** Stops and the zoom pill swap with a short cross-fade (also the reduced-motion form). */
const FADE = FadeIn.duration(Motion.duration).reduceMotion(ReduceMotion.Never);

const TIMING = {
  duration: Motion.duration,
  easing: Easing.bezier(...Motion.bezier).factory(),
} as const;

type ZoomSelectorProps = {
  /** The stops this device can actually offer — see `stopsForDevice`. */
  stops: ZoomStop[];
  /** The label of the selected stop, or '' while pinching between them. */
  selected: string;
  /** The pinched zoom ("1.2×"), shown alone while no stop is selected. */
  live: string;
  onSelect: (stop: ZoomStop) => void;
  /** The lone zoom pill was tapped: back to 1×. */
  onReset: () => void;
};

export function ZoomSelector({ stops, selected, live, onSelect, onReset }: ZoomSelectorProps) {
  const pinched = selected === '' && live !== '';

  return (
    <View style={styles.root}>
      <Glass radius={Radii.pill} style={styles.group}>
        {pinched ? (
          // Faded in on its own view: a glass view's opacity is never animated.
          <Animated.View key="live" entering={FADE}>
            <ZoomPill
              stop={{ label: live, zoom: 0 }}
              selected
              accessibilityLabel={`Zoom ${live}. Back to 1×`}
              onPress={onReset}
            />
          </Animated.View>
        ) : (
          stops.map((stop) => (
            <Animated.View key={stop.label} entering={FADE}>
              <ZoomPill
                stop={stop}
                selected={stop.label === selected}
                onPress={() => onSelect(stop)}
              />
            </Animated.View>
          ))
        )}
      </Glass>
    </View>
  );
}

function ZoomPill({
  stop,
  selected,
  onPress,
  accessibilityLabel,
}: {
  stop: ZoomStop;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
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
      accessibilityLabel={accessibilityLabel ?? `Zoom ${stop.label}`}
      onPress={() => {
        haptic.select();
        onPress();
      }}>
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
