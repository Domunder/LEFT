import type { camera as source } from '../en/camera';
import type { Translation } from '../types';

export const camera: Translation<typeof source> = {
  noConnection: 'Pas de connexion',
  cantReachHeadline: 'Impossible de joindre *ton événement.*',
  cantReachBody:
    'Ce téléphone n’a pas encore ouvert l’événement : il lui faut une connexion la première fois. Ensuite, l’appareil photo fonctionne hors ligne.',
  developedHeadline: 'La pellicule est *développée.*',
  developedBody: 'Les appareils photo sont fermés.',
  developedBodyUploading: {
    one: 'Les appareils photo sont fermés. {count} photo est encore en route. Garde l’app ouverte.',
    other:
      'Les appareils photo sont fermés. {count} photos sont encore en route. Garde l’app ouverte.',
  },
  openAlbum: 'Ouvrir l’album',
  lastPhotoHeadline: 'C’était ta *dernière photo.*',
  rollEmptyBody:
    'Ta pellicule est terminée. Les photos de tout le monde apparaîtront ensemble quand la pellicule sera développée.',
  rollEmptyBodyUploading: {
    one: 'Ta pellicule est terminée. Les photos de tout le monde apparaîtront ensemble quand la pellicule sera développée. {count} photo est encore en route.',
    other:
      'Ta pellicule est terminée. Les photos de tout le monde apparaîtront ensemble quand la pellicule sera développée. {count} photos sont encore en route.',
  },
  developedIn: 'Développée dans',
  seeFilm: 'Voir où en est la pellicule',
  backToMoments: 'Retour à tes moments',
  permissionHeadline: 'LEFT a besoin de *ton appareil photo.*',
  permissionBody:
    'Il sert uniquement à prendre des photos pour cet événement. Rien n’est enregistré, et il n’y a pas de micro.',
  allowCamera: 'Autoriser l’appareil photo',
  uploading: {
    one: '{count} photo est encore en route.',
    other: '{count} photos sont encore en route.',
  },

  noteFailed: 'L’appareil photo n’a pas démarré. Change de caméra.',
  noteMissed: 'Photo non enregistrée. Réessaie.',
  noteOffline: 'Hors ligne. Tes photos sont en sécurité.',
  flashOn: 'Flash activé',
  flashOff: 'Flash désactivé',
  switchCamera: 'Changer de caméra',
  yourPhotos: 'Tes photos',
  yourPhotosHint: 'Affiche les photos que tu as prises',
  invite: 'Inviter',
  inviteHint: 'Affiche le QR code et le lien de cet événement',
  takePhoto: 'Prendre une photo',
  zoomA11y: 'Zoom {zoom}',
  zoomResetA11y: 'Zoom {zoom}. Revenir à 1×',
  rollLeft: { one: 'restante', other: 'restantes' },
  rollLeftA11y: { one: '{count} photo restante', other: '{count} photos restantes' },
  rollUnlimitedA11y: 'Photos illimitées',
  countdownA11y: 'Encore {time} pour prendre des photos',

  backToCamera: 'Retour à l’appareil photo',
  add: 'Ajouter',
  addA11y: 'Ajouter des photos de ta photothèque, {count} restantes',
  addFailedTitle: 'Impossible d’ajouter les photos',
  addFailedBody: 'Réessaie.',
  importNotSignedIn: 'Tu n’es pas connecté.',
  yourPhotosHeadline: 'Tes *photos.*',
  onlyYouSee: 'Tu es la seule personne à les voir tant que la pellicule n’est pas développée.',
  soFarOnlyYouSee:
    '{count} pour l’instant. Tu es la seule personne à les voir tant que la pellicule n’est pas développée.',
  nothingYet: 'Rien pour l’instant. Tes photos apparaîtront ici au fur et à mesure.',
  photoOf: 'Photo {index} sur {count}',
  photoOfMission: 'Photo {index} sur {count}, pour la mission : {mission}',
  mission: 'Mission',
  missionChangeA11y: 'Mission : {mission}. La modifier.',
  missionMarkA11y: 'Associer cette photo à une mission',
  missionsLocked: 'La pellicule est développée. Les missions sont verrouillées.',
  missionNotYours: 'Cette mission ne fait pas partie des tiennes.',
  missionSaveFailed: 'Impossible d’enregistrer. Réessaie.',
};
