import type { dates as source } from '../en/dates';
import type { Translation } from '../types';

export const dates: Translation<typeof source> = {
  unitDays: 'T',
  unitHours: 'h',
  unitMinutes: 'm',
  unitSeconds: 's',
  untilDays: { one: 'in {count} Tag', other: 'in {count} Tagen' },
  untilDayHours: 'in 1 Tag {hours} h',
  untilHoursMinutes: 'in {hours} h {minutes} min',
  untilHours: 'in {hours} h',
  untilMinutes: 'in {minutes} min',
  today: 'Heute',
  endingDay: 'Endtag',
  hour: 'Stunde',
  minute: 'Minute',
  amOrPm: 'AM oder PM',
  am: 'AM',
  pm: 'PM',
};
