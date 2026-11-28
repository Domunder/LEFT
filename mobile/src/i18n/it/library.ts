import type { library as source } from '../en/library';
import type { Translation } from '../types';

export const library: Translation<typeof source> = {
  title: 'Momenti',
  settings: 'Impostazioni',
  joinGroup: 'Unisciti a un gruppo',
  startMoment: 'Inizia un momento',
  loadFailed: 'Impossibile caricare i tuoi momenti.\nControlla la connessione e riprova.',
  sectionDeveloped: 'Sviluppati',
  more: 'Altro',
  sample: 'Esempio',

  startHeadline: 'Inizia il tuo\n*momento*',
  startBody: 'Foto limitate per ciascuno. Non si vede nulla\nfinché il rullino non è sviluppato.',

  statusNotStarted: 'Non iniziato',
  statusDeveloped: 'Sviluppato',
  statusLive: 'In corso',
  statusTimeLeft: 'ancora {time}',

  heroUnlimitedRoll: 'rullino illimitato',
  heroPhotosEach: 'foto a testa',
  heroJoined: 'nel gruppo',
  heroPhotos: { one: 'foto', other: 'foto' },
  heroPeople: { one: 'persona', other: 'persone' },
  heroShotsLeft: { one: 'foto rimasta', other: 'foto rimaste' },
  heroUntilDevelops: 'allo sviluppo',
  heroUntilDevelopsA11y: '{time} allo sviluppo. Guarda come va il rullino',
  heroA11y: '{title}, {status}',
  inviteAndStart: 'Invita e inizia',
  open: 'Apri',
  openAlbum: 'Apri album',
  openCamera: 'Apri fotocamera',
  seeYourFilm: 'Vedi il tuo rullino',

  rowA11y: '{title}. {when}. {photos}, {people}.',
  rowSampleA11y: '{title}. {when}. {photos}, {people}. Sono mostrate immagini di esempio.',

  menuDelete: 'Elimina momento',
  menuRemove: 'Rimuovi da Momenti',
  deleteTitle: 'Eliminare “{name}”?',
  deletePhotosForYou: {
    one: '{count} foto viene eliminata per te.',
    other: 'Tutte le {count} foto vengono eliminate per te.',
  },
  deletePhotosForAll: {
    one: '{count} foto viene eliminata per tutte le {people} persone.',
    other: 'Tutte le {count} foto vengono eliminate per tutte le {people} persone.',
  },
  deleteEmptyForYou: 'Il momento viene eliminato per te.',
  deleteEmptyForAll: 'Il momento viene eliminato per tutte le {people} persone.',
  deleteNoUndo: 'Non si può annullare.',
  deleteNoRefund: 'Il tuo acquisto non viene rimborsato.',
  deleteFailed: 'Impossibile eliminare il momento',
  removeTitle: 'Rimuovere “{name}”?',
  removeBody:
    'Scompare dai tuoi Momenti su questo telefono. Le tue foto restano nel gruppo, e il link di invito lo riporta indietro.',
  removeFailed: 'Impossibile rimuovere il momento',

  goBack: 'Indietro',
  dismissNotification: 'Chiudi notifica',

  // 1.3.0 · event settings
  menuSettings: 'Impostazioni dell’evento',
};
