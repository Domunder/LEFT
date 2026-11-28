import type { host as source } from '../en/host';
import type { Translation } from '../types';

export const host: Translation<typeof source> = {
  closeToCamera: 'Cerrar, volver a la cámara',
  closeToGroup: 'Cerrar, volver a tu grupo',
  closeToMoments: 'Cerrar, volver a tus momentos',
  inviteHeadline: 'Invita a tu grupo.\n*Déjalos entrar.*',
  inviteSubWaiting:
    'Enséñales el QR o envía el enlace —\npueden unirse antes de que empiece, o durante.',
  inviteSubCamera:
    'Enséñales el QR o envía el enlace —\npueden unirse mientras el carrete está en marcha.',
  inviteSubHost:
    'Enséñales el QR o envía el enlace —\ncuando estén dentro, las cámaras pueden abrirse.',
  shareLink: 'Enviar enlace',
  saveQr: 'Guardar QR',
  savePermission: 'Permite el acceso a las fotos en Ajustes para guardar el código.',
  saved: 'Guardado en tus fotos.',
  saveFailed: 'No se pudo guardar el código.',
  signInForInvite: 'Inicia sesión para ver la invitación de este evento.',
  seeWhoJoined: 'Ver quién se ha unido',
  inviteMessage:
    'Únete a "{name}" en LEFT — un número limitado de fotos por persona, reveladas juntas al terminar.\n\n{url}\n\nCódigo: {code}',

  showQr: 'Mostrar el código QR de invitación',
  groupEyebrow: 'Tu grupo',
  groupHeadline: {
    one: '*{count}*/{capacity} personas\nse ha unido.',
    other: '*{count}*/{capacity} personas\nse han unido.',
  },
  loadingGroup: 'Cargando tu grupo…',
  groupLoadFailed: 'No se pudo cargar tu grupo.\nComprueba tu conexión e inténtalo de nuevo.',
  waitingForMembers: 'Esperando a los invitados…',
  groupFull: 'El grupo está lleno',
  spotsLeft: { one: 'Queda {count} plaza', other: 'Quedan {count} plazas' },
  alreadyEnded: 'Este evento ya ha terminado.',
  startFailed: 'No se pudo iniciar el evento. Comprueba tu conexión e inténtalo de nuevo.',
  startTitle: '¿Iniciar el evento?',
  startBody: 'A partir de ahora todos pueden hacer fotos. No se puede deshacer.',
  startBodyMissions:
    'A partir de ahora todos pueden hacer fotos. Las misiones se reparten y ya no se pueden cambiar, y los invitados ya no pueden cambiar su nombre.',
  notYet: 'Aún no',
  start: 'Iniciar',
  starting: 'Iniciando…',
  startEvent: 'Iniciar el evento',

  coverFailed: 'No se pudo cambiar la imagen',
  coverHeadline: 'Cambia la *portada del evento.*',
  coverBody: 'Tus invitados la ven mientras esperan, con el look de tu carrete.',
  momentLoadFailed: 'No se pudo cargar este momento.',
  saving: 'Guardando…',

  purchaseUnsettled: 'Tu compra aún no se ha confirmado',
  eventNotCreated: 'No se creó el evento',
  momentDeleted: 'Este momento se ha eliminado.',
  nameLength: 'Un nombre tiene entre 1 y {max} caracteres.',
  onlyHostRename: 'Solo el anfitrión puede cambiar el nombre de este momento.',
  onlyHostDelete: 'Solo el anfitrión puede eliminar este momento.',
};
