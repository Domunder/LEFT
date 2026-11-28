import type { library as source } from '../en/library';
import type { Translation } from '../types';

export const library: Translation<typeof source> = {
  title: 'Momente',
  settings: 'Einstellungen',
  joinGroup: 'Gruppe beitreten',
  startMoment: 'Moment starten',
  loadFailed:
    'Deine Momente konnten nicht geladen werden.\nPrüfe deine Verbindung und versuche es erneut.',
  sectionDeveloped: 'Entwickelt',
  more: 'Mehr',
  sample: 'Beispiel',

  startHeadline: 'Starte deinen\n*Moment*',
  startBody: 'Begrenzte Fotos für alle. Nichts ist zu sehen,\nbis der Film entwickelt ist.',

  statusNotStarted: 'Nicht gestartet',
  statusDeveloped: 'Entwickelt',
  statusLive: 'Läuft gerade',
  statusTimeLeft: 'noch {time}',

  heroUnlimitedRoll: 'unbegrenzter Film',
  heroPhotosEach: 'Fotos pro Person',
  heroJoined: 'dabei',
  heroPhotos: { one: 'Foto', other: 'Fotos' },
  heroPeople: { one: 'Person', other: 'Personen' },
  heroShotsLeft: { one: 'Foto übrig', other: 'Fotos übrig' },
  heroUntilDevelops: 'bis zur Entwicklung',
  heroUntilDevelopsA11y: '{time} bis zur Entwicklung. Stand des Films ansehen',
  heroA11y: '{title}, {status}',
  inviteAndStart: 'Einladen & starten',
  open: 'Öffnen',
  openAlbum: 'Album öffnen',
  openCamera: 'Kamera öffnen',
  seeYourFilm: 'Film ansehen',

  rowA11y: '{title}. {when}. {photos}, {people}.',
  rowSampleA11y: '{title}. {when}. {photos}, {people}. Es werden Beispielbilder gezeigt.',

  menuDelete: 'Moment löschen',
  menuRemove: 'Aus Momente entfernen',
  deleteTitle: '„{name}“ löschen?',
  deletePhotosForYou: {
    one: '{count} Foto wird für dich gelöscht.',
    other: 'Alle {count} Fotos werden für dich gelöscht.',
  },
  deletePhotosForAll: {
    one: '{count} Foto wird für alle {people} Personen gelöscht.',
    other: 'Alle {count} Fotos werden für alle {people} Personen gelöscht.',
  },
  deleteEmptyForYou: 'Der Moment wird für dich gelöscht.',
  deleteEmptyForAll: 'Der Moment wird für alle {people} Personen gelöscht.',
  deleteNoUndo: 'Das lässt sich nicht rückgängig machen.',
  deleteNoRefund: 'Dein Kauf wird nicht erstattet.',
  deleteFailed: 'Der Moment konnte nicht gelöscht werden',
  removeTitle: '„{name}“ entfernen?',
  removeBody:
    'Er verschwindet auf diesem Telefon aus deinen Momenten. Deine Fotos bleiben in der Gruppe, und der Einladungslink bringt ihn zurück.',
  removeFailed: 'Der Moment konnte nicht entfernt werden',

  goBack: 'Zurück',
  dismissNotification: 'Mitteilung schließen',

  // 1.3.0 · event settings
  menuSettings: 'Event-Einstellungen',
};
