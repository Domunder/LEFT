import type { errors as source } from '../en/errors';
import type { Translation } from '../types';

export const errors: Translation<typeof source> = {
  signInToHost: 'Accedi con Google o Apple per creare un momento tutto tuo.',
  accountInUse: 'Questo account è già in uso. Prova con l’altra opzione.',
  signInFailed: 'Accesso non riuscito. Controlla la connessione e riprova.',
  joinInvalidCode: 'Questo codice d’invito non corrisponde a nessun evento. Chiedi all’organizzatore un nuovo link o QR.',
  joinEnded: 'Questo evento è già terminato.',
  joinUnavailable: 'Al momento non è possibile unirsi. Riprova tra poco.',
  joinFailed: 'Impossibile unirsi al gruppo. Controlla la connessione e riprova.',
  demoLimit: 'Oggi hai già provato la demo alcune volte. Torna domani.',
  googleNoSession: 'L’accesso con Google non ha restituito alcuna sessione',
  appleNoSession: 'L’accesso con Apple non ha restituito alcuna sessione',
  appleNoToken: 'Apple non ha restituito alcun token di identità',
  anonymousNoSession: 'L’accesso anonimo non ha restituito alcuna sessione',
  noSessionToLink: 'Non c’è nessuna sessione da collegare',
  linkIncomplete: 'Il collegamento non è stato completato',
  nameLength: 'Il nome deve avere tra 1 e {max} caratteri',
};
