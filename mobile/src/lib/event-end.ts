/**
 * Date helpers for 04 · Event End.
 *
 * The screen shows the ending moment as two rows — a date and a time — but the
 * draft and `CreateEventInput` both store one `Date` (see ./events.ts). These
 * keep that split/merge out of the screen, and keep it testable.
 *
 * Formatting goes through `Intl`, which Hermes ships with full ICU on SDK 54, so
 * the rows follow the device locale instead of a hardcoded en-GB-ish format.
 */

/** The hour filming ends on the default day — late enough to cover an evening event. */
const DEFAULT_END_HOUR = 23;

/**
 * Tomorrow at 23:00 local.
 *
 * The screen is never empty, matching 02/03 where a choice is always preselected,
 * so Continue has no disabled-by-default state to explain.
 */
export function defaultEndsAt(now: Date = new Date()): Date {
  const end = new Date(now);
  end.setDate(end.getDate() + 1);
  end.setHours(DEFAULT_END_HOUR, 0, 0, 0);
  return end;
}

/**
 * Take the calendar day from `date` and the clock time from `time`.
 *
 * Each picker returns a whole `Date`, but only edits half of it. Merging rather
 * than replacing is what keeps "change the day" from resetting the time to
 * whatever the picker happened to carry.
 */
export function mergeDateAndTime(date: Date, time: Date): Date {
  const merged = new Date(date);
  merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return merged;
}

/** "Sat, 22 Aug" — the Ending Date row's value. */
export function formatEndDate(value: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(value);
}

/** "23:00" — the Ending Time row's value, in the locale's 12/24-hour convention. */
export function formatEndTime(value: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

/**
 * Whether the locale puts times on a 24-hour clock.
 *
 * Drives whether the time grid shows 0-23 hours or 1-12 plus an AM/PM row.
 */
export function prefersHour24(): boolean {
  const parts = new Intl.DateTimeFormat(undefined, { hour: '2-digit' }).formatToParts(
    new Date(2020, 0, 1, 13, 0, 0)
  );
  return !parts.some((part) => part.type === 'dayPeriod');
}

/**
 * How far ahead the calendar lets you page. A year covers any real event, and it
 * is what stops the next-month arrow rather than letting someone wander into 2049.
 */
const DATE_RANGE_DAYS = 365;

/** Weeks the month grid always draws. Fixed, so the popover never changes height. */
const WEEKS_SHOWN = 6;

/** Midnight on the given day — the unit the calendar steps in. */
function startOfDay(value: Date): Date {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** Whole days from `from` to `to`, ignoring the time of day. */
export function daysBetween(from: Date, to: Date): number {
  // Round rather than floor: a DST boundary makes some "days" 23 or 25 hours.
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** Same calendar day, ignoring the time of day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Same calendar month — what the calendar's arrows are disabled against. */
export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Midnight on the first of the given month. */
export function startOfMonth(value: Date): Date {
  const month = new Date(value);
  month.setDate(1);
  month.setHours(0, 0, 0, 0);
  return month;
}

/**
 * Step whole months, from the first of the month.
 *
 * Always anchored to the 1st, so stepping from the 31st cannot skip a month the
 * way `setMonth` does — March 31 + 1 month is April 31, which is May 1.
 */
export function addMonths(value: Date, delta: number): Date {
  const month = startOfMonth(value);
  month.setMonth(month.getMonth() + delta);
  return month;
}

/** The last day the calendar offers, `DATE_RANGE_DAYS` out from today. */
export function lastSelectableDay(from: Date = new Date()): Date {
  const last = startOfDay(from);
  last.setDate(last.getDate() + DATE_RANGE_DAYS);
  return last;
}

/**
 * Which weekday a week starts on locally, as 0 = Sunday.
 *
 * `Intl.Locale` carries this as `weekInfo.firstDay` (1 = Monday ... 7 = Sunday),
 * but it is a late addition to the spec and is spelled two ways across engines,
 * so both are tried and neither is assumed. The design's reference starts on
 * Sunday, which is the fallback.
 */
export function weekStartsOn(): number {
  type WeekInfo = { firstDay?: number };
  try {
    const tag = new Intl.DateTimeFormat().resolvedOptions().locale;
    const locale = new Intl.Locale(tag) as Intl.Locale & {
      weekInfo?: WeekInfo;
      getWeekInfo?: () => WeekInfo;
    };
    const firstDay = locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay;
    // 7 is Sunday there and 0 here; every other value is the same number.
    if (typeof firstDay === 'number') return firstDay % 7;
  } catch {
    // An engine without Intl.Locale — Sunday it is.
  }
  return 0;
}

/**
 * The 42 days the month grid draws — six whole weeks.
 *
 * Always 42, with leading and trailing days borrowed from the neighbouring
 * months, so a 5-row month and a 6-row month produce the same panel height and
 * the popover does not jump as you page through the year.
 */
export function monthMatrix(month: Date, firstDay: number = weekStartsOn()): Date[] {
  const first = startOfMonth(month);
  const lead = (first.getDay() - firstDay + 7) % 7;
  const start = new Date(first);
  start.setDate(start.getDate() - lead);

  return Array.from({ length: WEEKS_SHOWN * 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    return day;
  });
}

/**
 * The grid's column headings — "Su Mo Tu…", rotated to the local week start.
 *
 * `Intl` offers 'narrow' (one letter, so Tuesday and Thursday are both "T") and
 * 'short' (three), and the design wants two. Short, trimmed, is the only one that
 * stays unambiguous and still fits the cell.
 */
export function weekdayLabels(firstDay: number = weekStartsOn()): string[] {
  const format = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  // 2024-01-07 was a Sunday, so the offset walks the week from Sunday.
  return Array.from({ length: 7 }, (_, i) =>
    format.format(new Date(2024, 0, 7 + ((firstDay + i) % 7))).slice(0, 2)
  );
}

/** "August 2026" — the calendar's title row. */
export function formatMonthTitle(month: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month);
}

/** Hours the time wheel offers — 0-23, or 1-12 on a 12-hour locale. */
export function hourOptions(hour24: boolean): number[] {
  return hour24
    ? Array.from({ length: 24 }, (_, i) => i)
    : Array.from({ length: 12 }, (_, i) => i + 1);
}

/**
 * Minutes the time wheel offers — every one of them.
 *
 * A 5-minute step was enough while this was a grid of chips, where sixty of them
 * would not fit. A wheel scrolls, so the coarse step bought nothing and cost the
 * host the ability to end filming at, say, 23:59.
 */
export function minuteOptions(): number[] {
  return Array.from({ length: 60 }, (_, i) => i);
}

/**
 * Split a Date into the values the time wheel should show as selected.
 *
 * Nothing is rounded: every minute 0-59 is a row, so any stored moment already
 * lands on one. This used to snap to a 5-minute step, which could round 58 up
 * past the hour and carry into the next one — there is no step to snap to now.
 */
export function toClockParts(value: Date, hour24: boolean) {
  const h = value.getHours();
  return {
    /** 0-23, or 1-12. */
    hour: hour24 ? h : ((h + 11) % 12) + 1,
    minute: value.getMinutes(),
    isPm: h >= 12,
  };
}

/** Rebuild a 24-hour hour from a 12-hour wheel's hour + meridiem. */
export function toHour24(hour: number, isPm: boolean): number {
  const base = hour % 12;
  return isPm ? base + 12 : base;
}

/**
 * How long is left before filming closes, as the two units 13 draws.
 *
 * The camera's bottom-left readout — `01 d` `23 h`. Two units rather than a full
 * clock because the number is ambient: it tells someone at a party roughly how
 * much of the event is left, not when to leave.
 *
 * The pair steps down as the deadline nears (d/h, then h/m, then m/s), so the
 * readout stays informative instead of sitting at `00 d 00 h` for the last hour.
 * Past the deadline both read zero — the screen decides what to do about that.
 */
export function countdownParts(
  endsAt: Date,
  now: Date = new Date()
): [{ value: string; unit: string }, { value: string; unit: string }] {
  const totalSeconds = Math.max(0, Math.floor((endsAt.getTime() - now.getTime()) / 1000));

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (days > 0) {
    return [
      { value: pad(days), unit: 'd' },
      { value: pad(hours), unit: 'h' },
    ];
  }
  if (hours > 0) {
    return [
      { value: pad(hours), unit: 'h' },
      { value: pad(minutes), unit: 'm' },
    ];
  }
  return [
    { value: pad(minutes), unit: 'm' },
    { value: pad(seconds), unit: 's' },
  ];
}

/** Whether the filming window has closed. */
export function hasEnded(endsAt: Date, now: Date = new Date()): boolean {
  return endsAt.getTime() <= now.getTime();
}
