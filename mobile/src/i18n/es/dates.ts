import type { dates as source } from '../en/dates';
import type { Translation } from '../types';

export const dates: Translation<typeof source> = {
  unitDays: 'd',
  unitHours: 'h',
  unitMinutes: 'm',
  unitSeconds: 's',
  untilDays: { one: 'en {count} día', other: 'en {count} días' },
  untilDayHours: 'en 1 día y {hours} h',
  untilHoursMinutes: 'en {hours} h {minutes} min',
  untilHours: 'en {hours} h',
  untilMinutes: 'en {minutes} min',
  today: 'Hoy',
  endingDay: 'Día de fin',
  hour: 'Hora',
  minute: 'Minuto',
  amOrPm: 'AM o PM',
  am: 'AM',
  pm: 'PM',
};
