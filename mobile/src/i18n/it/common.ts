import type { common as source } from '../en/common';
import type { Translation } from '../types';

export const common: Translation<typeof source> = {
  continue: 'Continua',
  cancel: 'Annulla',
  back: 'Indietro',
  done: 'Fine',
  close: 'Chiudi',
  save: 'Salva',
  share: 'Condividi',
  delete: 'Elimina',
  remove: 'Rimuovi',
  ok: 'OK',
  notNow: 'Non ora',
  openSettings: 'Apri Impostazioni',
  tryAgain: 'Riprova',
  loading: 'Caricamento…',
  you: 'Tu',
  guest: 'Ospite',
  checkConnection: 'Controlla la connessione e riprova.',
  somethingWrong: 'Qualcosa è andato storto.',
  photos: { one: '{count} foto', other: '{count} foto' },
  people: { one: '{count} persona', other: '{count} persone' },
};
