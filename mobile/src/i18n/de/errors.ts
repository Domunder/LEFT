import type { errors as source } from '../en/errors';
import type { Translation } from '../types';

export const errors: Translation<typeof source> = {
  signInToHost: 'Melde dich mit Google oder Apple an, um einen eigenen Moment zu starten.',
  accountInUse: 'Dieses Konto wird schon verwendet. Probier die andere Option.',
  signInFailed: 'Anmelden hat nicht geklappt. Prüfe deine Verbindung und versuche es erneut.',
  joinInvalidCode: 'Dieser Einladungscode passt zu keinem Event. Bitte den Gastgeber um einen neuen Link oder QR-Code.',
  joinEnded: 'Dieses Event ist schon zu Ende.',
  joinUnavailable: 'Beitreten ist gerade nicht möglich. Versuche es gleich noch einmal.',
  joinFailed: 'Beitreten hat nicht geklappt. Prüfe deine Verbindung und versuche es erneut.',
  demoLimit: 'Du hast die Demo heute schon ein paar Mal ausprobiert. Komm morgen wieder.',
  googleNoSession: 'Die Anmeldung mit Google hat keine Sitzung geliefert',
  appleNoSession: 'Die Anmeldung mit Apple hat keine Sitzung geliefert',
  appleNoToken: 'Apple hat kein Identitätstoken geliefert',
  anonymousNoSession: 'Die anonyme Anmeldung hat keine Sitzung geliefert',
  noSessionToLink: 'Es gibt keine Sitzung zum Verknüpfen',
  linkIncomplete: 'Die Verknüpfung wurde nicht abgeschlossen',
  nameLength: 'Der Name muss zwischen 1 und {max} Zeichen lang sein',
};
