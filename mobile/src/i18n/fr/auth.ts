import type { auth as source } from '../en/auth';
import type { Translation } from '../types';

export const auth: Translation<typeof source> = {
  working: 'Un instant…',
  createHeadline: 'Lance ton propre\n*moment.*',
  createBody: 'Pour être hôte, il faut un compte. Connecte-toi et tout ce que tu as pris comme invité te suit.',
  keepHeadline: 'Ta pellicule est\n*prête.*',
  keepBody: 'Tu as participé comme invité, elle n’existe donc que sur ce téléphone. Connecte-toi et elle reste à toi.',
  keepPanelTitle: 'Garde tes moments',
  keepPanelBody: 'Tu photographies comme invité. Connecte-toi pour garder tes pellicules si tu perds ce téléphone.',
  dismiss: 'Fermer',
  nameHeadline: 'Comment\nt’appeler ?',
  nameBody: 'C’est ainsi que ton groupe te verra.',
  nameLabel: 'Ton prénom',
  deleteHeadline: 'Supprimer ton *compte ?*',
  deleteEvents: 'Les événements que tu as lancés sont supprimés pour tout le monde, avec toutes les photos.',
  deletePhotos: 'Les photos prises dans d’autres événements restent, sans lien avec toi.',
  deletePurchases: 'Les achats ne sont pas remboursés.',
  deleting: 'Suppression…',
  deleteConfirm: 'Supprimer le compte',
  deleted: 'Ton compte a été supprimé.',
  deleteFailed: 'Impossible de supprimer ton compte.',
  legalUpdated: 'Dernière mise à jour : {date}',
  pushChannel: 'Tes événements',
};
