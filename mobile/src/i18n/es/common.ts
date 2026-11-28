import type { common as source } from '../en/common';
import type { Translation } from '../types';

export const common: Translation<typeof source> = {
  continue: 'Continuar',
  cancel: 'Cancelar',
  back: 'Atrás',
  done: 'Listo',
  close: 'Cerrar',
  save: 'Guardar',
  share: 'Compartir',
  delete: 'Eliminar',
  remove: 'Quitar',
  ok: 'OK',
  notNow: 'Ahora no',
  openSettings: 'Abrir Ajustes',
  tryAgain: 'Reintentar',
  loading: 'Cargando…',
  you: 'Tú',
  guest: 'Invitado',
  checkConnection: 'Comprueba tu conexión e inténtalo de nuevo.',
  somethingWrong: 'Algo ha salido mal.',
  photos: { one: '{count} foto', other: '{count} fotos' },
  people: { one: '{count} persona', other: '{count} personas' },
};
