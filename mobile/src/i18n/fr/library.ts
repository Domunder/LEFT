import type { library as source } from '../en/library';
import type { Translation } from '../types';

export const library: Translation<typeof source> = {
  title: 'Moments',
  settings: 'Réglages',
  joinGroup: 'Rejoindre un groupe',
  startMoment: 'Lancer un moment',
  loadFailed: 'Impossible de charger tes moments.\nVérifie ta connexion et réessaie.',
  sectionDeveloped: 'Développés',
  more: 'Plus',
  sample: 'Exemple',

  startHeadline: 'Lance ton\n*moment*',
  startBody: 'Un nombre limité de photos chacun. Rien n’est\nvisible avant le développement.',

  statusNotStarted: 'Pas commencé',
  statusDeveloped: 'Développé',
  statusLive: 'En cours',
  statusTimeLeft: 'encore {time}',

  heroUnlimitedRoll: 'pellicule illimitée',
  heroPhotosEach: 'photos chacun',
  heroJoined: 'dans le groupe',
  heroPhotos: { one: 'photo', other: 'photos' },
  heroPeople: { one: 'personne', other: 'personnes' },
  heroShotsLeft: { one: 'photo restante', other: 'photos restantes' },
  heroUntilDevelops: 'avant le développement',
  heroUntilDevelopsA11y: '{time} avant le développement. Voir où en est la pellicule',
  heroA11y: '{title}, {status}',
  inviteAndStart: 'Inviter et lancer',
  open: 'Ouvrir',
  openAlbum: 'Ouvrir l’album',
  openCamera: 'Ouvrir l’appareil photo',
  seeYourFilm: 'Voir ta pellicule',

  rowA11y: '{title}. {when}. {photos}, {people}.',
  rowSampleA11y: '{title}. {when}. {photos}, {people}. Images d’exemple affichées.',

  menuDelete: 'Supprimer le moment',
  menuRemove: 'Retirer de Moments',
  deleteTitle: 'Supprimer « {name} » ?',
  deletePhotosForYou: {
    one: '{count} photo est supprimée pour toi.',
    other: 'Les {count} photos sont supprimées pour toi.',
  },
  deletePhotosForAll: {
    one: '{count} photo est supprimée pour les {people} personnes.',
    other: 'Les {count} photos sont supprimées pour les {people} personnes.',
  },
  deleteEmptyForYou: 'Le moment est supprimé pour toi.',
  deleteEmptyForAll: 'Le moment est supprimé pour les {people} personnes.',
  deleteNoUndo: 'Cette action est irréversible.',
  deleteNoRefund: 'Ton achat n’est pas remboursé.',
  deleteFailed: 'Impossible de supprimer le moment',
  removeTitle: 'Retirer « {name} » ?',
  removeBody:
    'Il disparaît de tes Moments sur ce téléphone. Tes photos restent dans le groupe, et le lien d’invitation le fait revenir.',
  removeFailed: 'Impossible de retirer le moment',

  goBack: 'Retour',
  dismissNotification: 'Fermer la notification',

  // 1.3.0 · event settings
  menuSettings: 'Réglages de l’événement',
};
