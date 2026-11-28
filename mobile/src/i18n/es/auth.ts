import type { auth as source } from '../en/auth';
import type { Translation } from '../types';

export const auth: Translation<typeof source> = {
  working: 'Un momento…',
  createHeadline: 'Empieza tu propio\n*momento.*',
  createBody: 'Para ser anfitrión necesitas una cuenta. Inicia sesión y todo lo que hiciste como invitado se viene contigo.',
  keepHeadline: 'Tu carrete está\n*listo.*',
  keepBody: 'Participaste como invitado, así que solo vive en este teléfono. Inicia sesión y seguirá siendo tuyo.',
  keepPanelTitle: 'Conserva tus momentos',
  keepPanelBody: 'Estás haciendo fotos como invitado. Inicia sesión para conservar tus carretes si pierdes este teléfono.',
  dismiss: 'Cerrar',
  nameHeadline: '¿Cómo te\nllamamos?',
  nameBody: 'Así te verá tu grupo.',
  nameLabel: 'Tu nombre',
  deleteHeadline: '¿Eliminar tu *cuenta?*',
  deleteEvents: 'Los eventos que creaste se eliminan para todos, con todas las fotos.',
  deletePhotos: 'Las fotos que hiciste en otros eventos se quedan, pero sin vínculo contigo.',
  deletePurchases: 'Las compras no se reembolsan.',
  deleting: 'Eliminando…',
  deleteConfirm: 'Eliminar cuenta',
  deleted: 'Tu cuenta se ha eliminado.',
  deleteFailed: 'No se pudo eliminar tu cuenta.',
  legalUpdated: 'Última actualización: {date}',
  pushChannel: 'Tus eventos',
};
