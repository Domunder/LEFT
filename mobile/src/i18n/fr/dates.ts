import type { dates as source } from '../en/dates';
import type { Translation } from '../types';

export const dates: Translation<typeof source> = {
  unitDays: 'j',
  unitHours: 'h',
  unitMinutes: 'm',
  unitSeconds: 's',
  untilDays: { one: 'dans {count} jour', other: 'dans {count} jours' },
  untilDayHours: 'dans 1 jour {hours} h',
  untilHoursMinutes: 'dans {hours} h {minutes} min',
  untilHours: 'dans {hours} h',
  untilMinutes: 'dans {minutes} min',
  today: 'Auj.',
  endingDay: 'Jour de fin',
  hour: 'Heure',
  minute: 'Minute',
  amOrPm: 'AM ou PM',
  am: 'AM',
  pm: 'PM',
};
