import type { errors as source } from '../en/errors';
import type { Translation } from '../types';

export const errors: Translation<typeof source> = {
  signInToHost: 'Connecte-toi avec Google ou Apple pour lancer ton propre moment.',
  accountInUse: 'Ce compte est déjà utilisé. Essaie l’autre option.',
  signInFailed: 'Connexion impossible. Vérifie ta connexion et réessaie.',
  joinInvalidCode: 'Ce code d’invitation ne correspond à aucun événement. Demande un nouveau lien ou QR code à l’hôte.',
  joinEnded: 'Cet événement est déjà terminé.',
  joinUnavailable: 'Impossible de rejoindre pour le moment. Réessaie dans un instant.',
  joinFailed: 'Impossible de rejoindre le groupe. Vérifie ta connexion et réessaie.',
  demoLimit: 'Tu as déjà essayé la démo plusieurs fois aujourd’hui. Reviens demain.',
  googleNoSession: 'La connexion avec Google n’a renvoyé aucune session',
  appleNoSession: 'La connexion avec Apple n’a renvoyé aucune session',
  appleNoToken: 'Apple n’a renvoyé aucun jeton d’identité',
  anonymousNoSession: 'La connexion anonyme n’a renvoyé aucune session',
  noSessionToLink: 'Aucune session à associer',
  linkIncomplete: 'L’association n’a pas abouti',
  nameLength: 'Le nom doit comporter entre 1 et {max} caractères',
};
