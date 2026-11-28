import type { Namespace } from '../types';

export const dates = {
  // The countdown's units, beside the numerals: "01 d 23 h".
  unitDays: 'd',
  unitHours: 'h',
  unitMinutes: 'm',
  unitSeconds: 's',
  // How far away the ending is. Read inside a sentence: "The film is developed in 5 days."
  untilDays: { one: 'in {count} day', other: 'in {count} days' },
  untilDayHours: 'in 1 day {hours} h',
  untilHoursMinutes: 'in {hours} h {minutes} min',
  untilHours: 'in {hours} h',
  untilMinutes: 'in {minutes} min',
  // 04's wheels.
  today: 'Today',
  endingDay: 'Ending day',
  hour: 'Hour',
  minute: 'Minute',
  amOrPm: 'AM or PM',
  am: 'AM',
  pm: 'PM',
} satisfies Namespace;
