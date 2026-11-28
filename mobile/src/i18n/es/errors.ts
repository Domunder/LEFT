import type { errors as source } from '../en/errors';
import type { Translation } from '../types';

export const errors: Translation<typeof source> = {
  signInToHost: 'Inicia sesión con Google o Apple para empezar tu propio momento.',
  accountInUse: 'Esa cuenta ya está en uso. Prueba con la otra opción.',
  signInFailed: 'No se pudo iniciar sesión. Comprueba tu conexión e inténtalo de nuevo.',
  joinInvalidCode: 'Ese código de invitación no corresponde a ningún evento. Pide al anfitrión un enlace o QR nuevo.',
  joinEnded: 'Este evento ya ha terminado.',
  joinUnavailable: 'Ahora mismo no es posible unirse. Inténtalo de nuevo en un momento.',
  joinFailed: 'No se pudo unir al grupo. Comprueba tu conexión e inténtalo de nuevo.',
  demoLimit: 'Hoy ya has probado la demo varias veces. Vuelve mañana.',
  googleNoSession: 'El inicio de sesión con Google no devolvió ninguna sesión',
  appleNoSession: 'El inicio de sesión con Apple no devolvió ninguna sesión',
  appleNoToken: 'Apple no devolvió ningún token de identidad',
  anonymousNoSession: 'El inicio de sesión anónimo no devolvió ninguna sesión',
  noSessionToLink: 'No hay ninguna sesión que vincular',
  linkIncomplete: 'La vinculación no se completó',
  nameLength: 'El nombre debe tener entre 1 y {max} caracteres',
};
