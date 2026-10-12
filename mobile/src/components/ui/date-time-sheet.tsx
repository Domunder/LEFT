/**
 * The date/time picker behind 04's Ending Date / Ending Time pills.
 *
 * Hangs directly under the pill that opened it (see popover.tsx) rather than
 * rising from the bottom as a sheet, so the control and its options read as one
 * thing.
 *
 * Both halves are drawn in-app — a month grid (calendar.tsx) and a Clock-app-style
 * wheel (time-wheel.tsx) — rather than by `@react-native-community/datetimepicker`.
 * The system spinner was OS chrome in the middle of a screen built from the app's
 * own type and tokens, it rendered nothing at all on web, and it needed a Done
 * button to commit whatever it happened to be resting on.
 *
 * **There is no Done button, and nothing is staged.** The date applies and
 * dismisses, because a day is the whole choice. The time applies as each column
 * settles and stays open, because an hour without a minute is half of one. A
 * confirm step would only add a second full-width CTA competing with the screen's
 * own Continue, inside a popover.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { Picker, Wheel as WheelToken } from '@/constants/theme';
import { lastSelectableDay } from '@/lib/event-end';
import { Calendar } from './calendar';
import { PopoverPanel, type AnchorRect } from './popover';
import { TimeWheel } from './time-wheel';

/**
 * How tall each picker is — the popover only needs this to decide whether it still
 * fits below the pill or must flip above it, so a sum of the tokens is enough and
 * avoids a measure-then-reposition flash.
 *
 * Both are genuinely constant rather than estimates that drift with the content:
 * the calendar always draws six weeks, and the wheel always shows the same number
 * of rows however many items are on it.
 */
const WEEKS_SHOWN = 6;

const CALENDAR_HEIGHT =
  Picker.header.height +
  Picker.header.gap +
  Picker.weekdayHeight +
  Picker.weekdayGap +
  WEEKS_SHOWN * (Picker.cellSize + Picker.rowGap);

const TIME_HEIGHT = WheelToken.itemHeight * WheelToken.visibleCount;

type DateTimeSheetProps = {
  mode: 'date' | 'time';
  /** The moment currently stored — seeds the calendar or the wheel. */
  value: Date;
  /** The pill this hangs from, in window coordinates. */
  anchor: AnchorRect;
  /** Earliest selectable day, so a past ending cannot be chosen. */
  minimumDate?: Date;
  /** Called with the whole new moment on every change. */
  onChange: (next: Date) => void;
  /** Tapped outside, or a day was picked. */
  onDismiss: () => void;
};

export function DateTimeSheet({
  mode,
  value,
  anchor,
  minimumDate,
  onChange,
  onDismiss,
}: DateTimeSheetProps) {
  /**
   * The calendar's tick. The wheel fires its own, once per row crossed rather than
   * once per committed value, so it is deliberately not routed through here —
   * doing both would double every tick.
   */
  function selectDay(next: Date) {
    // Web has no haptics engine; calling through is a no-op but noisy in logs.
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    onChange(next);
    onDismiss();
  }

  return (
    <PopoverPanel
      anchor={anchor}
      contentHeight={mode === 'date' ? CALENDAR_HEIGHT : TIME_HEIGHT}
      onDismiss={onDismiss}>
      {mode === 'date' ? (
        <Calendar
          value={value}
          minimumDate={minimumDate}
          maximumDate={lastSelectableDay()}
          onSelect={selectDay}
        />
      ) : (
        <TimeWheel value={value} onChange={onChange} />
      )}
    </PopoverPanel>
  );
}

