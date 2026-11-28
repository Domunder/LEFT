import type { library as source } from '../en/library';
import type { Translation } from '../types';

export const library: Translation<typeof source> = {
  title: 'Momentos',
  settings: 'Ajustes',
  joinGroup: 'Unirse a un grupo',
  startMoment: 'Empezar un momento',
  loadFailed: 'No se han podido cargar tus momentos.\nComprueba tu conexión e inténtalo de nuevo.',
  sectionDeveloped: 'Revelados',
  more: 'Más',
  sample: 'Ejemplo',

  startHeadline: 'Empieza tu\n*momento*',
  startBody: 'Fotos limitadas para cada uno. No se ve nada\nhasta que se revela el carrete.',

  statusNotStarted: 'Sin empezar',
  statusDeveloped: 'Revelado',
  statusLive: 'En directo',
  statusTimeLeft: 'quedan {time}',

  heroUnlimitedRoll: 'carrete ilimitado',
  heroPhotosEach: 'fotos por persona',
  heroJoined: 'en el grupo',
  heroPhotos: { one: 'foto', other: 'fotos' },
  heroPeople: { one: 'persona', other: 'personas' },
  heroShotsLeft: { one: 'foto restante', other: 'fotos restantes' },
  heroUntilDevelops: 'para el revelado',
  heroUntilDevelopsA11y: '{time} para el revelado. Ver cómo va el carrete',
  heroA11y: '{title}, {status}',
  inviteAndStart: 'Invitar y empezar',
  open: 'Abrir',
  openAlbum: 'Abrir álbum',
  openCamera: 'Abrir cámara',
  seeYourFilm: 'Ver tu carrete',

  rowA11y: '{title}. {when}. {photos}, {people}.',
  rowSampleA11y: '{title}. {when}. {photos}, {people}. Se muestran imágenes de ejemplo.',

  menuDelete: 'Eliminar momento',
  menuRemove: 'Quitar de Momentos',
  deleteTitle: '¿Eliminar «{name}»?',
  deletePhotosForYou: {
    one: 'Se elimina {count} foto para ti.',
    other: 'Se eliminan las {count} fotos para ti.',
  },
  deletePhotosForAll: {
    one: 'Se elimina {count} foto para las {people} personas.',
    other: 'Se eliminan las {count} fotos para las {people} personas.',
  },
  deleteEmptyForYou: 'El momento se elimina para ti.',
  deleteEmptyForAll: 'El momento se elimina para las {people} personas.',
  deleteNoUndo: 'Esto no se puede deshacer.',
  deleteNoRefund: 'Tu compra no se reembolsa.',
  deleteFailed: 'No se ha podido eliminar el momento',
  removeTitle: '¿Quitar «{name}»?',
  removeBody:
    'Desaparece de tus Momentos en este teléfono. Tus fotos se quedan en el grupo, y el enlace de invitación lo recupera.',
  removeFailed: 'No se ha podido quitar el momento',

  goBack: 'Atrás',
  dismissNotification: 'Cerrar notificación',

  // 1.3.0 · event settings
  menuSettings: 'Ajustes del evento',
};
