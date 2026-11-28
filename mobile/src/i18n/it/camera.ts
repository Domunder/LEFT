import type { camera as source } from '../en/camera';
import type { Translation } from '../types';

export const camera: Translation<typeof source> = {
  noConnection: 'Nessuna connessione',
  cantReachHeadline: 'Impossibile raggiungere *il tuo evento.*',
  cantReachBody:
    'Questo telefono non ha ancora aperto l’evento, quindi la prima volta gli serve una connessione. Poi la fotocamera funziona offline.',
  developedHeadline: 'Il rullino è *sviluppato.*',
  developedBody: 'Le fotocamere sono chiuse.',
  developedBodyUploading: {
    one: 'Le fotocamere sono chiuse. {count} foto è ancora in arrivo. Tieni l’app aperta.',
    other: 'Le fotocamere sono chiuse. {count} foto sono ancora in arrivo. Tieni l’app aperta.',
  },
  openAlbum: 'Apri l’album',
  lastPhotoHeadline: 'Quella era la tua *ultima foto.*',
  rollEmptyBody:
    'Il tuo rullino è finito. Le foto di tutti appariranno insieme quando il rullino sarà sviluppato.',
  rollEmptyBodyUploading: {
    one: 'Il tuo rullino è finito. Le foto di tutti appariranno insieme quando il rullino sarà sviluppato. {count} foto è ancora in arrivo.',
    other:
      'Il tuo rullino è finito. Le foto di tutti appariranno insieme quando il rullino sarà sviluppato. {count} foto sono ancora in arrivo.',
  },
  developedIn: 'Sviluppo tra',
  seeFilm: 'Guarda come va il rullino',
  backToMoments: 'Torna ai tuoi momenti',
  permissionHeadline: 'LEFT ha bisogno della *tua fotocamera.*',
  permissionBody:
    'Serve solo a scattare foto per questo evento. Non viene registrato nulla e non c’è microfono.',
  allowCamera: 'Consenti fotocamera',
  uploading: {
    one: '{count} foto è ancora in arrivo.',
    other: '{count} foto sono ancora in arrivo.',
  },

  noteFailed: 'La fotocamera non si è avviata. Cambia fotocamera.',
  noteMissed: 'Foto non salvata. Riprova.',
  noteOffline: 'Offline. Le tue foto sono al sicuro.',
  flashOn: 'Flash attivo',
  flashOff: 'Flash spento',
  switchCamera: 'Cambia fotocamera',
  yourPhotos: 'Le tue foto',
  yourPhotosHint: 'Mostra le foto che hai scattato',
  invite: 'Invita',
  inviteHint: 'Mostra il codice QR e il link di questo evento',
  takePhoto: 'Scatta foto',
  zoomA11y: 'Zoom {zoom}',
  zoomResetA11y: 'Zoom {zoom}. Torna a 1×',
  rollLeft: { one: 'rimasta', other: 'rimaste' },
  rollLeftA11y: { one: '{count} foto rimasta', other: '{count} foto rimaste' },
  rollUnlimitedA11y: 'Foto illimitate',
  countdownA11y: 'Ancora {time} per scattare',

  backToCamera: 'Torna alla fotocamera',
  add: 'Aggiungi',
  addA11y: 'Aggiungi foto dalla tua libreria, {count} rimaste',
  addFailedTitle: 'Impossibile aggiungere le foto',
  addFailedBody: 'Riprova.',
  importNotSignedIn: 'Accesso non effettuato.',
  yourPhotosHeadline: 'Le tue *foto.*',
  onlyYouSee: 'Solo tu puoi vederle finché il rullino non viene sviluppato.',
  soFarOnlyYouSee:
    '{count} finora. Solo tu puoi vederle finché il rullino non viene sviluppato.',
  nothingYet: 'Ancora niente. Le tue foto appariranno qui man mano che le scatti.',
  photoOf: 'Foto {index} di {count}',
  photoOfMission: 'Foto {index} di {count}, per la missione: {mission}',
  mission: 'Missione',
  missionChangeA11y: 'Missione: {mission}. Cambiala.',
  missionMarkA11y: 'Assegna questa foto a una missione',
  missionsLocked: 'Il rullino è sviluppato. Le missioni sono bloccate.',
  missionNotYours: 'Quella missione non è tra le tue.',
  missionSaveFailed: 'Impossibile salvare. Riprova.',
};
