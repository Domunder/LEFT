import type { host as source } from '../en/host';
import type { Translation } from '../types';

export const host: Translation<typeof source> = {
  closeToCamera: 'Fermer, retour à l’appareil photo',
  closeToGroup: 'Fermer, retour à ton groupe',
  closeToMoments: 'Fermer, retour à tes moments',
  inviteHeadline: 'Invite ton groupe.\n*Fais-les entrer.*',
  inviteSubWaiting:
    'Montre-leur le QR code ou envoie le lien —\nils peuvent rejoindre avant le début, ou pendant.',
  inviteSubCamera:
    'Montre-leur le QR code ou envoie le lien —\nils peuvent rejoindre tant que la pellicule tourne.',
  inviteSubHost:
    'Montre-leur le QR code ou envoie le lien —\nune fois qu’ils sont là, les appareils peuvent s’ouvrir.',
  shareLink: 'Envoyer le lien',
  saveQr: 'Garder le QR',
  savePermission: 'Autorise l’accès aux photos dans les réglages pour enregistrer le code.',
  saved: 'Enregistré dans tes photos.',
  saveFailed: 'Impossible d’enregistrer le code.',
  signInForInvite: 'Connecte-toi pour voir l’invitation de cet événement.',
  seeWhoJoined: 'Voir qui est là',
  inviteMessage:
    'Rejoins « {name} » sur LEFT — un nombre limité de photos chacun, développées ensemble à la fin.\n\n{url}\n\nCode : {code}',

  showQr: 'Afficher le QR code d’invitation',
  groupEyebrow: 'Ton groupe',
  groupHeadline: {
    one: '*{count}*/{capacity} personnes\na rejoint.',
    other: '*{count}*/{capacity} personnes\nont rejoint.',
  },
  loadingGroup: 'Chargement de ton groupe…',
  groupLoadFailed: 'Impossible de charger ton groupe.\nVérifie ta connexion et réessaie.',
  waitingForMembers: 'En attente des invités…',
  groupFull: 'Le groupe est complet',
  spotsLeft: { one: '{count} place restante', other: '{count} places restantes' },
  alreadyEnded: 'Cet événement est déjà terminé.',
  startFailed: 'Impossible de démarrer l’événement. Vérifie ta connexion et réessaie.',
  startTitle: 'Démarrer l’événement ?',
  startBody: 'Tout le monde peut prendre des photos dès maintenant. C’est irréversible.',
  startBodyMissions:
    'Tout le monde peut prendre des photos dès maintenant. Les missions sont distribuées et ne peuvent plus être modifiées, et les invités ne peuvent plus changer de nom.',
  notYet: 'Pas encore',
  start: 'Démarrer',
  starting: 'Démarrage…',
  startEvent: 'Démarrer l’événement',

  coverFailed: 'Impossible de changer l’image',
  coverHeadline: 'Ton *invitation.*',
  coverBody: 'Voilà ce que tes invités voient en ouvrant le lien.',
  momentLoadFailed: 'Impossible de charger ce moment.',
  saving: 'Enregistrement…',

  purchaseUnsettled: 'Ton achat n’a pas encore été confirmé',
  eventNotCreated: 'L’événement n’a pas été créé',
  momentDeleted: 'Ce moment a été supprimé.',
  nameLength: 'Un nom fait entre 1 et {max} caractères.',
  onlyHostRename: 'Seul l’hôte peut renommer ce moment.',
  onlyHostDelete: 'Seul l’hôte peut supprimer ce moment.',

  // 1.3.0 · event settings
  settingsTitle: 'Réglages de l’événement',
  settingsName: 'Nom',
  settingsEnds: 'Fin',
  settingsEndOver: 'L’événement est terminé.',
  settingsEndMinusHour: '1 heure plus tôt',
  settingsEndPlusHour: '1 heure plus tard',
  settingsEndPlusDay: '1 jour plus tard',
  settingsReveal: 'Photos visibles',
  settingsRevealFixed: 'Fixé depuis le début de l’événement.',
  settingsInvitation: 'Image de l’invitation',
};
