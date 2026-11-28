import type { Namespace } from '../types';

export const camera = {
  // --- 13 · Camera: the states around the viewfinder ---
  noConnection: 'No connection',
  cantReachHeadline: 'Can\'t reach *your event.*',
  cantReachBody:
    'This phone hasn\'t opened the event yet, so it needs a connection once. After that the camera works offline.',
  developedHeadline: 'The film is *developed.*',
  developedBody: 'The cameras are closed.',
  developedBodyUploading: {
    one: 'The cameras are closed. 1 photo is still on its way. Keep the app open.',
    other: 'The cameras are closed. {count} photos are still on their way. Keep the app open.',
  },
  openAlbum: 'Open the album',
  lastPhotoHeadline: 'That was your *last photo.*',
  rollEmptyBody:
    'Your roll is used up. Everyone\'s photos appear together when the film is developed.',
  rollEmptyBodyUploading: {
    one: 'Your roll is used up. Everyone\'s photos appear together when the film is developed. 1 photo is still on its way.',
    other:
      'Your roll is used up. Everyone\'s photos appear together when the film is developed. {count} photos are still on their way.',
  },
  developedIn: 'Developed in',
  seeFilm: 'See how the film is doing',
  backToMoments: 'Back to your moments',
  permissionHeadline: 'LEFT needs *your camera.*',
  permissionBody:
    'It is only used to take photos for this event. Nothing is recorded, and there is no microphone.',
  allowCamera: 'Allow camera',
  uploading: {
    one: '1 photo is still on its way.',
    other: '{count} photos are still on their way.',
  },

  // --- 13 · Camera: the viewfinder ---
  noteFailed: 'The camera didn\'t start. Switch cameras to retry.',
  noteMissed: 'That one didn\'t save. Try again.',
  noteOffline: 'Offline. Your photos are saved.',
  flashOn: 'Flash on',
  flashOff: 'Flash off',
  switchCamera: 'Switch camera',
  yourPhotos: 'Your photos',
  yourPhotosHint: 'Shows the photos you have taken',
  invite: 'Invite',
  inviteHint: 'Shows the QR code and the link to this event',
  takePhoto: 'Take photo',
  zoomA11y: 'Zoom {zoom}',
  zoomResetA11y: 'Zoom {zoom}. Back to 1×',
  /** The word after the rolling number: "17 left". */
  rollLeft: { one: 'left', other: 'left' },
  rollLeftA11y: { one: '{count} photo left', other: '{count} photos left' },
  rollUnlimitedA11y: 'Unlimited photos',
  /** `{time}` is the countdown, "01 d, 23 h". */
  countdownA11y: '{time} left to shoot',

  // --- Your shots ---
  backToCamera: 'Back to the camera',
  add: 'Add',
  addA11y: 'Add photos from your library, {count} left',
  addFailedTitle: 'Couldn\'t add the photos',
  addFailedBody: 'Try again.',
  importNotSignedIn: 'Not signed in.',
  yourPhotosHeadline: 'Your *photos.*',
  onlyYouSee: 'Only you can see these until the film is developed.',
  soFarOnlyYouSee: '{count} so far. Only you can see these until the film is developed.',
  nothingYet: 'Nothing yet. Your photos show up here as you take them.',
  photoOf: 'Photo {index} of {count}',
  photoOfMission: 'Photo {index} of {count}, for the mission: {mission}',
  mission: 'Mission',
  missionChangeA11y: 'Mission: {mission}. Change it.',
  missionMarkA11y: 'Mark this photo for a mission',
  missionsLocked: 'The film is developed. Missions are locked.',
  missionNotYours: 'That mission isn’t one of yours.',
  missionSaveFailed: 'Couldn’t save. Try again.',
} satisfies Namespace;
