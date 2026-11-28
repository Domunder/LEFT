import type { camera as source } from '../en/camera';
import type { Translation } from '../types';

export const camera: Translation<typeof source> = {
  noConnection: 'Sin conexión',
  cantReachHeadline: 'No se puede acceder a *tu evento.*',
  cantReachBody:
    'Este teléfono aún no ha abierto el evento, así que necesita conexión una vez. Después, la cámara funciona sin conexión.',
  developedHeadline: 'El carrete está *revelado.*',
  developedBody: 'Las cámaras están cerradas.',
  developedBodyUploading: {
    one: 'Las cámaras están cerradas. {count} foto sigue en camino. Mantén la app abierta.',
    other: 'Las cámaras están cerradas. {count} fotos siguen en camino. Mantén la app abierta.',
  },
  openAlbum: 'Abrir el álbum',
  lastPhotoHeadline: 'Esa fue tu *última foto.*',
  rollEmptyBody:
    'Tu carrete se ha acabado. Las fotos de todos aparecerán juntas cuando se revele el carrete.',
  rollEmptyBodyUploading: {
    one: 'Tu carrete se ha acabado. Las fotos de todos aparecerán juntas cuando se revele el carrete. {count} foto sigue en camino.',
    other:
      'Tu carrete se ha acabado. Las fotos de todos aparecerán juntas cuando se revele el carrete. {count} fotos siguen en camino.',
  },
  developedIn: 'Se revela en',
  seeFilm: 'Ver cómo va el carrete',
  backToMoments: 'Volver a tus momentos',
  permissionHeadline: 'LEFT necesita *tu cámara.*',
  permissionBody:
    'Solo se usa para hacer fotos de este evento. No se graba nada y no hay micrófono.',
  allowCamera: 'Permitir cámara',
  uploading: {
    one: '{count} foto sigue en camino.',
    other: '{count} fotos siguen en camino.',
  },

  noteFailed: 'La cámara no se ha iniciado. Cambia de cámara.',
  noteMissed: 'Esa no se ha guardado. Inténtalo de nuevo.',
  noteOffline: 'Sin conexión. Tus fotos están guardadas.',
  flashOn: 'Flash activado',
  flashOff: 'Flash desactivado',
  switchCamera: 'Cambiar de cámara',
  yourPhotos: 'Tus fotos',
  yourPhotosHint: 'Muestra las fotos que has hecho',
  invite: 'Invitar',
  inviteHint: 'Muestra el código QR y el enlace de este evento',
  takePhoto: 'Hacer foto',
  zoomA11y: 'Zoom {zoom}',
  zoomResetA11y: 'Zoom {zoom}. Volver a 1×',
  rollLeft: { one: 'restante', other: 'restantes' },
  rollLeftA11y: { one: '{count} foto restante', other: '{count} fotos restantes' },
  rollUnlimitedA11y: 'Fotos ilimitadas',
  countdownA11y: 'Quedan {time} para hacer fotos',

  backToCamera: 'Volver a la cámara',
  add: 'Añadir',
  addA11y: 'Añadir fotos de tu fototeca, quedan {count}',
  addFailedTitle: 'No se han podido añadir las fotos',
  addFailedBody: 'Inténtalo de nuevo.',
  importNotSignedIn: 'No has iniciado sesión.',
  yourPhotosHeadline: 'Tus *fotos.*',
  onlyYouSee: 'Solo tú puedes verlas hasta que se revele el carrete.',
  soFarOnlyYouSee: '{count} hasta ahora. Solo tú puedes verlas hasta que se revele el carrete.',
  nothingYet: 'Nada todavía. Tus fotos aparecerán aquí a medida que las hagas.',
  photoOf: 'Foto {index} de {count}',
  photoOfMission: 'Foto {index} de {count}, para la misión: {mission}',
  mission: 'Misión',
  missionChangeA11y: 'Misión: {mission}. Cambiarla.',
  missionMarkA11y: 'Asignar esta foto a una misión',
  missionsLocked: 'El carrete está revelado. Las misiones están bloqueadas.',
  missionNotYours: 'Esa misión no es una de las tuyas.',
  missionSaveFailed: 'No se ha podido guardar. Inténtalo de nuevo.',
};
