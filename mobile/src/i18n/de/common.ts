import type { common as source } from '../en/common';
import type { Translation } from '../types';

export const common: Translation<typeof source> = {
  continue: 'Weiter',
  cancel: 'Abbrechen',
  back: 'Zurück',
  done: 'Fertig',
  close: 'Schließen',
  save: 'Speichern',
  share: 'Teilen',
  delete: 'Löschen',
  remove: 'Entfernen',
  ok: 'OK',
  notNow: 'Nicht jetzt',
  openSettings: 'Einstellungen öffnen',
  tryAgain: 'Erneut versuchen',
  loading: 'Lädt…',
  you: 'Du',
  guest: 'Gast',
  checkConnection: 'Prüfe deine Verbindung und versuche es erneut.',
  somethingWrong: 'Etwas ist schiefgelaufen.',
  photos: { one: '{count} Foto', other: '{count} Fotos' },
  people: { one: '{count} Person', other: '{count} Personen' },
};
