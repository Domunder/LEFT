/**
 * A wheel of days, turned sideways — the date half of 04's picker.
 *
 * It is the time wheel laid on its side: the day under the band in the middle
 * is the chosen one, the strip snaps a day at a time, and days fade and shrink
 * as they leave the centre, so they appear out of the card's edges rather than
 * being cut off by them. Tapping a day brings it to the middle.
 *
 * RN cannot blur a single view cheaply, so "out of focus" is drawn as opacity
 * and scale keyed on the live scroll offset — the same approximation
 * `wheel.tsx` makes for its cylinder.
 *
 * It edits only the day. The clock on `value` is kept, the way the time wheel
 * keeps the day.
 */

import { haptic } from '@/lib/haptics';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Colors, Ending, Wheel as WheelToken } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import {
  daysBetween,
  labelDays,
  mergeDateAndTime,
  upcomingDays,
  type DayLabel,
} from '@/lib/event-end';

const T = Ending.day;
const STEP = T.width + T.gap;

function tick() {
  haptic.select();
}

type DayStripProps = {
  /** The moment currently stored. Its day sits under the band; its clock is kept. */
  value: Date;
  /** The whole moment, moved to the day the wheel settled on. */
  onChange: (next: Date) => void;
  /**
   * The width the strip is about to be laid out at, when the caller knows it.
   * The days are drawn against it at once instead of a frame later, after the
   * strip has measured itself; the measurement still corrects it.
   */
  initialWidth?: number;
};

export function DayStrip({ value, onChange, initialWidth = 0 }: DayStripProps) {
  // Built and labelled once: a strip left open over midnight is a day stale,
  // which the screen's own "already passed" guard covers.
  const days = useMemo(() => labelDays(upcomingDays(T.count)), []);
  const scroll = useAnimatedRef<Animated.ScrollView>();
  const [width, setWidth] = useState(initialWidth);

  const selected = Math.min(Math.max(daysBetween(days[0].date, value), 0), days.length - 1);

  const scrollX = useSharedValue(selected * STEP);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  // One tick per day crossed, on the frame it crosses the band.
  useAnimatedReaction(
    () => Math.round(scrollX.value / STEP),
    (index, previous) => {
      if (previous !== null && index !== previous) scheduleOnRN(tick);
    }
  );

  // Follow a change made from outside (a shortcut). After the finger's own
  // scroll this is the offset the wheel already rests on, so it does nothing.
  useEffect(() => {
    if (width > 0) scroll.current?.scrollTo({ x: selected * STEP, animated: true });
  }, [selected, width, scroll]);

  /*
    The days are memoised, so what they call must keep its identity while the
    stored moment changes under it — hence the latest value in a ref.
  */
  const latest = useRef({ value, selected, onChange });
  latest.current = { value, selected, onChange };

  const choose = useCallback(
    (index: number) => {
      const now = latest.current;
      if (index !== now.selected) now.onChange(mergeDateAndTime(days[index].date, now.value));
    },
    [days]
  );

  const settle = useCallback(
    (offset: number) => {
      choose(Math.min(Math.max(Math.round(offset / STEP), 0), days.length - 1));
    },
    [choose, days]
  );

  const bringToCentre = useCallback(
    (index: number) => {
      scroll.current?.scrollTo({ x: index * STEP, animated: true });
      choose(index);
    },
    [choose, scroll]
  );

  // Half a strip of space either side, so the first and last day can centre.
  const inset = Math.max((width - T.width) / 2, 0);

  return (
    <View
      style={styles.root}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.band} pointerEvents="none" />

      {width > 0 ? (
        <Animated.ScrollView
          ref={scroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={STEP}
          decelerationRate="fast"
          contentOffset={{ x: selected * STEP, y: 0 }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.x)}
          contentContainerStyle={{ paddingHorizontal: inset, gap: T.gap }}
          accessibilityRole="adjustable"
          accessibilityLabel="Ending day">
          {days.map((day, index) => (
            <Day
              key={day.date.getTime()}
              day={day}
              index={index}
              today={index === 0}
              scrollX={scrollX}
              reach={width / 2}
              onPress={bringToCentre}
            />
          ))}
        </Animated.ScrollView>
      ) : null}
    </View>
  );
}

type DayProps = {
  day: DayLabel;
  index: number;
  today: boolean;
  scrollX: SharedValue<number>;
  /** Centre -> the strip's edge, where a day has faded out entirely. */
  reach: number;
  onPress: (index: number) => void;
};

/** Memoised: choosing a day re-renders the strip, not its sixty days. */
const Day = memo(function Day({ day, index, today, scrollX, reach, onPress }: DayProps) {
  const animated = useAnimatedStyle(() => {
    const distance = Math.abs(index * STEP - scrollX.value);
    return {
      opacity: interpolate(distance, [0, STEP, reach], [...T.fade], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(distance, [0, STEP, reach], [...T.scale], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View style={animated}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={day.spoken}
        onPress={() => onPress(index)}
        style={styles.day}>
        <Text style={styles.small}>{today ? 'Today' : day.weekday}</Text>
        <Text style={styles.numeral}>{day.date.getDate()}</Text>
        <Text style={styles.small}>{day.month}</Text>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: {
    height: T.height,
    justifyContent: 'center',
  },
  // The same band the time wheel draws, turned upright: one day wide.
  band: {
    position: 'absolute',
    alignSelf: 'center',
    width: T.width + T.gap,
    height: T.height,
    borderRadius: T.radius,
    backgroundColor: WheelToken.band.bg,
  },
  day: {
    width: T.width,
    height: T.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    ...Typography.weekday,
    color: Colors.textMuted,
  },
  numeral: {
    ...Typography.dayNumeral,
    color: Colors.text,
  },
});
