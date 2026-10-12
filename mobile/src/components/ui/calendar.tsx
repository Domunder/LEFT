/**
 * The month grid behind 04's Ending Date pill.
 *
 * Six whole weeks, always — `monthMatrix` pads with the neighbouring months' days
 * so a 5-row month and a 6-row month come out the same height and the popover does
 * not jump as you page through the year.
 *
 * There is no confirm button. A tap on a day is the choice and the sheet closes on
 * it; the arrows only change which month is drawn, so paging never dismisses.
 */

import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Picker } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import {
  addMonths,
  formatEndDate,
  formatMonthTitle,
  isSameDay,
  isSameMonth,
  mergeDateAndTime,
  monthMatrix,
  startOfMonth,
  weekdayLabels,
  weekStartsOn,
} from '@/lib/event-end';
import { CircleIconButton } from './circle-back-button';
import { PickerCell } from './picker-cell';

type CalendarProps = {
  /** The moment currently stored. Its day is the selection; its clock is kept. */
  value: Date;
  /** Earliest selectable day, inclusive. */
  minimumDate?: Date;
  /** Latest selectable day, inclusive. */
  maximumDate?: Date;
  /** The chosen day, already merged with `value`'s time of day. */
  onSelect: (day: Date) => void;
};

export function Calendar({ value, minimumDate, maximumDate, onSelect }: CalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(value));

  // Both fixed for the life of the panel: "today" must not shift under the ring
  // mid-session, and the week start cannot change while the app is running.
  const [today] = useState(() => new Date());
  const [firstDay] = useState(() => weekStartsOn());

  const labels = useMemo(() => weekdayLabels(firstDay), [firstDay]);
  const weeks = useMemo(() => toWeeks(monthMatrix(month, firstDay)), [month, firstDay]);

  // Disabled at the bounds rather than clamped, so nobody pages into a month with
  // nothing selectable in it and is left wondering why the days do not respond.
  const canGoBack = minimumDate === undefined || month > startOfMonth(minimumDate);
  const canGoForward = maximumDate === undefined || month < startOfMonth(maximumDate);

  function selectable(day: Date): boolean {
    if (minimumDate && day < startOfDayOf(minimumDate)) return false;
    if (maximumDate && day > startOfDayOf(maximumDate)) return false;
    return true;
  }

  return (
    <View>
      <View style={styles.header}>
        <CircleIconButton
          icon="chevron-left"
          variant="outline"
          size={Picker.header.buttonSize}
          iconSize={Picker.header.iconSize}
          disabled={!canGoBack}
          onPress={() => setMonth(addMonths(month, -1))}
          accessibilityLabel="Previous month"
        />

        <Text style={styles.title}>{formatMonthTitle(month)}</Text>

        <CircleIconButton
          icon="chevron-right"
          variant="outline"
          size={Picker.header.buttonSize}
          iconSize={Picker.header.iconSize}
          disabled={!canGoForward}
          onPress={() => setMonth(addMonths(month, 1))}
          accessibilityLabel="Next month"
        />
      </View>

      <View style={styles.weekdays}>
        {labels.map((label, i) => (
          <Text key={i} style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {weeks.map((week, i) => (
          <View key={i} style={styles.row}>
            {week.map((day) => {
              const isSelected = isSameDay(day, value);
              return (
                <PickerCell
                  key={day.getTime()}
                  label={String(day.getDate())}
                  selected={isSelected}
                  ringed={!isSelected && isSameDay(day, today)}
                  muted={!isSameMonth(day, month)}
                  disabled={!selectable(day)}
                  // The day carries the stored time of day with it, so changing
                  // the date never resets the hour the host already picked.
                  onPress={() => onSelect(mergeDateAndTime(day, value))}
                  accessibilityLabel={formatEndDate(day)}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Midnight, so a bound carrying a time of day does not disqualify its own day. */
function startOfDayOf(value: Date): Date {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** The flat 42 days as six rows of seven. */
function toWeeks(days: Date[]): Date[][] {
  const columns = Picker.columns;
  return Array.from({ length: days.length / columns }, (_, i) =>
    days.slice(i * columns, i * columns + columns)
  );
}

const styles = StyleSheet.create({
  header: {
    height: Picker.header.height,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Picker.header.gap,
  },
  title: {
    ...Typography.pickerTitle,
    color: Colors.text,
  },
  weekdays: {
    flexDirection: 'row',
    height: Picker.weekdayHeight,
    alignItems: 'center',
    marginBottom: Picker.weekdayGap,
  },
  weekday: {
    ...Typography.weekday,
    flex: 1,
    textAlign: 'center',
    color: Colors.textFaint,
  },
  grid: {
    rowGap: Picker.rowGap,
  },
  row: {
    flexDirection: 'row',
  },
});
