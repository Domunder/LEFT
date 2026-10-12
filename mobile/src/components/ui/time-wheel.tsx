/**
 * The time wheel behind 04's Ending Time pill.
 *
 * Hour and minute columns — plus AM/PM where the locale wants it — running under
 * one selection band, the iOS Clock app's arrangement. Each column is a `Wheel`;
 * the curve and the fade live there, and this owns the band, the layout and the
 * split/merge back onto the stored moment.
 *
 * Both number columns are endless: minutes run 58, 59, 00, 01 and hours 22, 23,
 * 00, 01, in either direction, so setting a time near midnight is one flick
 * rather than a long scroll back the other way. The meridiem column is not — two
 * rows spinning forever would only be a way to lose track of which is showing.
 *
 * There is no Done button. A column reports when it settles on a new row, which
 * applies immediately; the popover stays open, because an hour without a minute
 * is half a choice, and it closes on a tap outside.
 *
 * The band is drawn here rather than per column so it is one continuous shape
 * across all of them, as Apple's is — three separate bands with gaps between them
 * would read as three controls.
 */

import { StyleSheet, View } from 'react-native';

import { Wheel as WheelToken } from '@/constants/theme';
import {
  hourOptions,
  minuteOptions,
  prefersHour24,
  toClockParts,
  toHour24,
} from '@/lib/event-end';
import { Wheel, type WheelItem } from './wheel';

type TimeWheelProps = {
  /** The moment currently stored. Its clock seeds the columns; its day is kept. */
  value: Date;
  /** The whole moment with the new clock time on it. */
  onChange: (next: Date) => void;
};

export function TimeWheel({ value, onChange }: TimeWheelProps) {
  // Pure functions of the device locale, which cannot change while the panel is
  // open, so there is nothing to hold in state.
  const hour24 = prefersHour24();
  const parts = toClockParts(value, hour24);

  const hours = hourOptions(hour24);
  const minutes = minuteOptions();

  /** Rebuild the whole moment, keeping the day. */
  function setClock(hour: number, minute: number, isPm: boolean) {
    const next = new Date(value);
    next.setHours(hour24 ? hour : toHour24(hour, isPm), minute, 0, 0);
    onChange(next);
  }

  return (
    <View style={styles.root}>
      <View style={styles.band} pointerEvents="none" />

      <View style={styles.columns}>
        <Wheel
          items={numerals(hours, 'h')}
          index={Math.max(0, hours.indexOf(parts.hour))}
          onIndexChange={(i) => setClock(hours[i], parts.minute, parts.isPm)}
          loop
          accessibilityLabel="Hour"
        />

        <Wheel
          items={numerals(minutes, 'm')}
          index={Math.max(0, minutes.indexOf(parts.minute))}
          onIndexChange={(i) => setClock(parts.hour, minutes[i], parts.isPm)}
          loop
          accessibilityLabel="Minute"
        />

        {/*
          Only on a 12-hour locale, where the hour column runs 1-12 and cannot say
          which half of the day it means. A third wheel rather than a pair of
          buttons, so the whole control turns the same way.
        */}
        {!hour24 && (
          <Wheel
            items={[
              { key: 'am', label: 'AM' },
              { key: 'pm', label: 'PM' },
            ]}
            index={parts.isPm ? 1 : 0}
            onIndexChange={(i) => setClock(parts.hour, parts.minute, i === 1)}
            accessibilityLabel="AM or PM"
          />
        )}
      </View>
    </View>
  );
}

/** Zero-padded rows, so 09 and 10 are the same width in the column. */
function numerals(values: number[], prefix: string): WheelItem[] {
  return values.map((value) => ({
    key: `${prefix}${value}`,
    label: String(value).padStart(2, '0'),
  }));
}

const styles = StyleSheet.create({
  root: {
    height: WheelToken.itemHeight * WheelToken.visibleCount,
    justifyContent: 'center',
  },
  columns: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: WheelToken.columnGap,
  },
  // Centred by construction: the wheel shows an odd number of rows, so half the
  // leftover height sits above the middle one.
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (WheelToken.itemHeight * (WheelToken.visibleCount - 1)) / 2,
    height: WheelToken.itemHeight,
    borderRadius: WheelToken.band.radius,
    backgroundColor: WheelToken.band.bg,
  },
});
