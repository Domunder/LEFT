import type { host as source } from '../en/host';
import type { Translation } from '../types';

export const host: Translation<typeof source> = {
  closeToCamera: 'Schließen, zurück zur Kamera',
  closeToGroup: 'Schließen, zurück zu deiner Gruppe',
  closeToMoments: 'Schließen, zurück zu deinen Momenten',
  inviteHeadline: 'Lade deine Gruppe ein.\n*Lass sie rein.*',
  inviteSubWaiting:
    'Zeig ihnen den QR-Code oder schick den Link —\nsie können vor dem Start dazukommen oder mittendrin.',
  inviteSubCamera:
    'Zeig ihnen den QR-Code oder schick den Link —\nsie können dazukommen, solange der Film läuft.',
  inviteSubHost:
    'Zeig ihnen den QR-Code oder schick den Link —\nsobald sie drin sind, können die Kameras starten.',
  shareLink: 'Link teilen',
  saveQr: 'QR sichern',
  savePermission: 'Erlaube den Fotozugriff in den Einstellungen, um den Code zu sichern.',
  saved: 'In deinen Fotos gesichert.',
  saveFailed: 'Der Code konnte nicht gesichert werden.',
  signInForInvite: 'Melde dich an, um die Einladung zu diesem Event zu sehen.',
  seeWhoJoined: 'Sehen, wer dabei ist',
  inviteMessage:
    'Komm zu „{name}“ auf LEFT — jeder hat nur eine begrenzte Zahl Fotos, und am Ende werden alle gemeinsam entwickelt.\n\n{url}\n\nCode: {code}',

  showQr: 'QR-Code der Einladung zeigen',
  groupEyebrow: 'Deine Gruppe',
  groupHeadline: {
    one: '*{count}*/{capacity} Personen\nist dabei.',
    other: '*{count}*/{capacity} Personen\nsind dabei.',
  },
  loadingGroup: 'Deine Gruppe lädt…',
  groupLoadFailed:
    'Deine Gruppe konnte nicht geladen werden.\nPrüfe deine Verbindung und versuche es erneut.',
  waitingForMembers: 'Warten auf Gäste…',
  groupFull: 'Gruppe ist voll',
  spotsLeft: { one: '{count} Platz frei', other: '{count} Plätze frei' },
  alreadyEnded: 'Dieses Event ist schon vorbei.',
  startFailed:
    'Das Event konnte nicht gestartet werden. Prüfe deine Verbindung und versuche es erneut.',
  startTitle: 'Event starten?',
  startBody: 'Ab jetzt können alle fotografieren. Das lässt sich nicht rückgängig machen.',
  startBodyMissions:
    'Ab jetzt können alle fotografieren. Die Missionen werden verteilt und lassen sich danach nicht mehr ändern, und Gäste können ihren Namen nicht mehr ändern.',
  notYet: 'Noch nicht',
  start: 'Starten',
  starting: 'Startet…',
  startEvent: 'Event starten',

  coverFailed: 'Das Bild konnte nicht geändert werden',
  coverHeadline: 'Deine *Einladung.*',
  coverBody: 'Das sehen deine Gäste, wenn sie den Link öffnen.',
  momentLoadFailed: 'Dieser Moment konnte nicht geladen werden.',
  saving: 'Speichert…',

  purchaseUnsettled: 'Dein Kauf wurde noch nicht bestätigt',
  eventNotCreated: 'Das Event wurde nicht erstellt',
  momentDeleted: 'Dieser Moment wurde gelöscht.',
  nameLength: 'Ein Name hat 1 bis {max} Zeichen.',
  onlyHostRename: 'Nur der Gastgeber kann diesen Moment umbenennen.',
  onlyHostDelete: 'Nur der Gastgeber kann diesen Moment löschen.',
};
