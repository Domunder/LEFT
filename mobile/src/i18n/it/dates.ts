import type { dates as source } from '../en/dates';
import type { Translation } from '../types';

export const dates: Translation<typeof source> = {
  unitDays: 'g',
  unitHours: 'h',
  unitMinutes: 'm',
  unitSeconds: 's',
  untilDays: { one: 'tra {count} giorno', other: 'tra {count} giorni' },
  untilDayHours: 'tra 1 giorno e {hours} h',
  untilHoursMinutes: 'tra {hours} h {minutes} min',
  untilHours: 'tra {hours} h',
  untilMinutes: 'tra {minutes} min',
  today: 'Oggi',
  endingDay: 'Giorno di fine',
  hour: 'Ora',
  minute: 'Minuto',
  amOrPm: 'AM o PM',
  am: 'AM',
  pm: 'PM',
};
