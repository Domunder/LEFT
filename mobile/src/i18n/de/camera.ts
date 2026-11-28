import type { camera as source } from '../en/camera';
import type { Translation } from '../types';

export const camera: Translation<typeof source> = {
  noConnection: 'Keine Verbindung',
  cantReachHeadline: 'Dein Event ist *nicht erreichbar.*',
  cantReachBody:
    'Dieses Telefon hat das Event noch nie geöffnet und braucht dafür einmal eine Verbindung. Danach funktioniert die Kamera auch offline.',
  developedHeadline: 'Der Film ist *entwickelt.*',
  developedBody: 'Die Kameras sind geschlossen.',
  developedBodyUploading: {
    one: 'Die Kameras sind geschlossen. {count} Foto ist noch unterwegs. Lass die App geöffnet.',
    other:
      'Die Kameras sind geschlossen. {count} Fotos sind noch unterwegs. Lass die App geöffnet.',
  },
  openAlbum: 'Album öffnen',
  lastPhotoHeadline: 'Das war dein *letztes Foto.*',
  rollEmptyBody:
    'Dein Film ist voll. Die Fotos von allen erscheinen gemeinsam, sobald der Film entwickelt ist.',
  rollEmptyBodyUploading: {
    one: 'Dein Film ist voll. Die Fotos von allen erscheinen gemeinsam, sobald der Film entwickelt ist. {count} Foto ist noch unterwegs.',
    other:
      'Dein Film ist voll. Die Fotos von allen erscheinen gemeinsam, sobald der Film entwickelt ist. {count} Fotos sind noch unterwegs.',
  },
  developedIn: 'Entwicklung in',
  seeFilm: 'Stand des Films ansehen',
  backToMoments: 'Zurück zu deinen Momenten',
  permissionHeadline: 'LEFT braucht *deine Kamera.*',
  permissionBody:
    'Sie wird nur für Fotos von diesem Event genutzt. Es wird nichts aufgezeichnet, und es gibt kein Mikrofon.',
  allowCamera: 'Kamera erlauben',
  uploading: {
    one: '{count} Foto ist noch unterwegs.',
    other: '{count} Fotos sind noch unterwegs.',
  },

  noteFailed: 'Kamera nicht gestartet. Wechsle die Kamera.',
  noteMissed: 'Nicht gespeichert. Versuch es noch mal.',
  noteOffline: 'Offline. Deine Fotos sind gesichert.',
  flashOn: 'Blitz an',
  flashOff: 'Blitz aus',
  switchCamera: 'Kamera wechseln',
  yourPhotos: 'Deine Fotos',
  yourPhotosHint: 'Zeigt die Fotos, die du gemacht hast',
  invite: 'Einladen',
  inviteHint: 'Zeigt den QR-Code und den Link zu diesem Event',
  takePhoto: 'Foto aufnehmen',
  zoomA11y: 'Zoom {zoom}',
  zoomResetA11y: 'Zoom {zoom}. Zurück zu 1×',
  rollLeft: { one: 'übrig', other: 'übrig' },
  rollLeftA11y: { one: '{count} Foto übrig', other: '{count} Fotos übrig' },
  rollUnlimitedA11y: 'Unbegrenzt viele Fotos',
  countdownA11y: 'Noch {time} zum Fotografieren',

  backToCamera: 'Zurück zur Kamera',
  add: 'Hinzufügen',
  addA11y: 'Fotos aus deiner Mediathek hinzufügen, noch {count} übrig',
  addFailedTitle: 'Fotos konnten nicht hinzugefügt werden',
  addFailedBody: 'Versuch es noch mal.',
  importNotSignedIn: 'Nicht angemeldet.',
  yourPhotosHeadline: 'Deine *Fotos.*',
  onlyYouSee: 'Nur du siehst sie, bis der Film entwickelt ist.',
  soFarOnlyYouSee: 'Bisher {count}. Nur du siehst sie, bis der Film entwickelt ist.',
  nothingYet: 'Noch nichts. Deine Fotos erscheinen hier, sobald du sie machst.',
  photoOf: 'Foto {index} von {count}',
  photoOfMission: 'Foto {index} von {count}, für die Mission: {mission}',
  mission: 'Mission',
  missionChangeA11y: 'Mission: {mission}. Ändern.',
  missionMarkA11y: 'Dieses Foto einer Mission zuordnen',
  missionsLocked: 'Der Film ist entwickelt. Die Missionen sind gesperrt.',
  missionNotYours: 'Diese Mission gehört nicht zu deinen.',
  missionSaveFailed: 'Speichern fehlgeschlagen. Versuch es noch mal.',

  // 1.3.0 · the upload hint in the shutter bar
  uploadingHint: { one: '1 Foto wird hochgeladen', other: '{count} Fotos werden hochgeladen' },
};
