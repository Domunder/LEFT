/**
 * A single scrolling wheel column — one of the columns in 04's time picker.
 *
 * Built from a plain ScrollView with `snapToInterval` rather than a native picker:
 * a platform view renders nothing at all on web and in Expo Go and styles itself
 * with OS chrome, and the point of this screen is that it is drawn in the app's
 * own type and tokens.
 *
 * Rows fade, shrink and tilt with distance from the centre, so the column reads as
 * the surface of a turning cylinder the way the iOS Clock app's does. RN cannot
 * draw a real cylinder; a per-row `perspective` + `rotateX` + `scale` keyed on
 * distance is the approximation, and at five rows the seams do not show.
 *
 * All three are driven by the live scroll offset rather than by the committed
 * index, so the curve tracks the finger continuously instead of snapping a frame
 * late. The band behind the centre row is drawn by the *parent*, once across every
 * column — see time-wheel.tsx.
 *
 * A column can also be `loop`ed, which is what rolls 59 on to 00 and 23 on to 00
 * instead of stopping at the end of the list. See LOOP_TARGET_ROWS for how.
 */

import * as Haptics from 'expo-haptics';
import { useMemo, useRef } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { Colors, Wheel as WheelToken } from '@/constants/theme';
import { Typography } from '@/constants/typography';

/** Rows of blank space above and below, so the first and last item can centre. */
const PAD_COUNT = Math.floor(WheelToken.visibleCount / 2);

/**
 * Roughly how many rows a looping column renders.
 *
 * The endless wheel is the usual trick rather than a real ring: the list is
 * stamped out several times over, and once the scroll has settled the column
 * jumps back to the middle copy, so the rows under the finger never run out. The
 * count is a balance — enough copies that no one fling reaches an end before that
 * jump happens, few enough that the column stays a cheap ScrollView.
 */
const LOOP_TARGET_ROWS = 150;

/** Copies of the list a looping column stamps out. Odd, so one copy is the middle. */
function copyCount(length: number): number {
  const wanted = Math.ceil(LOOP_TARGET_ROWS / length);
  return Math.max(3, wanted % 2 === 0 ? wanted + 1 : wanted);
}

export type WheelItem = {
  /** Stable identity for the row. */
  key: string;
  /** What the row displays. */
  label: string;
};

type WheelProps = {
  items: readonly WheelItem[];
  /** Index of the selected row. Seeds the scroll position; not re-applied after. */
  index: number;
  /** Fired when the wheel settles on a new row. */
  onIndexChange: (index: number) => void;
  /**
   * Wrap past both ends — 59 → 00 → 01, 23 → 00 → 01 — instead of stopping.
   * Wrong for a short list like AM/PM, which has no cylinder to turn.
   */
  loop?: boolean;
  /** Spoken name for the column, e.g. "Hour". */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Wheel({
  items,
  index,
  onIndexChange,
  loop = false,
  accessibilityLabel,
  style,
}: WheelProps) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const copies = loop ? copyCount(items.length) : 1;
  // Where the middle copy starts. Every settle returns here, so there is always
  // the same long run of rows left in both directions.
  const middleStart = Math.floor(copies / 2) * items.length;

  const rows = useMemo(
    () =>
      Array.from({ length: copies }, (_, copy) =>
        items.map((item) => ({ key: `${item.key}#${copy}`, label: item.label }))
      ).flat(),
    [items, copies]
  );

  const initialOffset = (middleStart + index) * WheelToken.itemHeight;
  const offset = useSharedValue(initialOffset);
  // The last index we reported, so the haptic fires once per row crossed rather
  // than on every scroll frame that rounds to the same row.
  const lastReported = useRef(index);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      offset.value = event.contentOffset.y;
    },
  });

  function settle(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const row = Math.round(event.nativeEvent.contentOffset.y / WheelToken.itemHeight);
    const clamped = Math.min(Math.max(row, 0), rows.length - 1);
    // Which item of the real list that row is a copy of.
    const selected = ((clamped % items.length) + items.length) % items.length;

    if (loop) recentre(selected, clamped);

    if (selected === lastReported.current) return;
    lastReported.current = selected;
    // Web has no haptics engine; calling through is a no-op but noisy in logs.
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    onIndexChange(selected);
  }

  /**
   * Put the settled row back on the middle copy, without animating.
   *
   * Every copy is identical, so the jump is invisible: the row under the band
   * reads the same before and after. `offset` is written by hand too, because the
   * scroll event that would update it lands a frame later, and for that frame the
   * curve would be drawn against the copy we just left.
   */
  function recentre(selected: number, row: number) {
    if (row === middleStart + selected) return;
    const target = (middleStart + selected) * WheelToken.itemHeight;
    offset.value = target;
    scrollRef.current?.scrollTo({ y: target, animated: false });
  }

  return (
    <View style={[styles.column, style]}>
      <Animated.ScrollView
        ref={scrollRef}
        // contentOffset rather than scrollTo-on-mount: this positions the wheel
        // before first paint, so it never flashes at the top and slides down.
        contentOffset={{ x: 0, y: initialOffset }}
        showsVerticalScrollIndicator={false}
        snapToInterval={WheelToken.itemHeight}
        decelerationRate="fast"
        // Both are needed for full coverage: momentum-end fires after a fling,
        // scroll-end after a slow drag that never gains momentum.
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        accessibilityLabel={accessibilityLabel}
        contentContainerStyle={styles.content}>
        {rows.map((item, i) => (
          <WheelRow key={item.key} label={item.label} position={i} offset={offset} />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

type WheelRowProps = {
  label: string;
  position: number;
  offset: ReturnType<typeof useSharedValue<number>>;
};

function WheelRow({ label, position, offset }: WheelRowProps) {
  const animated = useAnimatedStyle(() => {
    const centre = position * WheelToken.itemHeight;
    // Signed: positive means this row has passed above the centre of the window,
    // which is the half of the cylinder whose top edge leans away from the eye.
    const signed = (offset.value - centre) / WheelToken.itemHeight;
    const distance = Math.abs(signed);

    const degrees = Math.max(
      -WheelToken.maxDegrees,
      Math.min(WheelToken.maxDegrees, signed * WheelToken.degreesPerRow)
    );

    return {
      opacity: interpolate(distance, [0, 1, 2], [...WheelToken.fade], Extrapolation.CLAMP),
      transform: [
        { perspective: WheelToken.perspective },
        { rotateX: `${degrees}deg` },
        { scale: interpolate(distance, [0, 1, 2], [...WheelToken.scale], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.row, animated]}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  column: {
    height: WheelToken.itemHeight * WheelToken.visibleCount,
    width: WheelToken.columnWidth,
  },
  content: {
    paddingVertical: WheelToken.itemHeight * PAD_COUNT,
  },
  row: {
    height: WheelToken.itemHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Typography.wheel,
    color: Colors.text,
  },
});
