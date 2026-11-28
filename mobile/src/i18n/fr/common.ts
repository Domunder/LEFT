import type { common as source } from '../en/common';
import type { Translation } from '../types';

export const common: Translation<typeof source> = {
  continue: 'Continuer',
  cancel: 'Annuler',
  back: 'Retour',
  done: 'Terminé',
  close: 'Fermer',
  save: 'Enregistrer',
  share: 'Partager',
  delete: 'Supprimer',
  remove: 'Retirer',
  ok: 'OK',
  notNow: 'Pas maintenant',
  openSettings: 'Ouvrir les réglages',
  tryAgain: 'Réessayer',
  loading: 'Chargement…',
  you: 'Toi',
  guest: 'Invité',
  checkConnection: 'Vérifie ta connexion et réessaie.',
  somethingWrong: 'Une erreur est survenue.',
  photos: { one: '{count} photo', other: '{count} photos' },
  people: { one: '{count} personne', other: '{count} personnes' },
};
