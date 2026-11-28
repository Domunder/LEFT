import type { Namespace } from '../types';

export const album = {
  // --- loading ---
  gone: 'This moment was deleted.',
  loadFailed: 'Couldn’t load the album.\nCheck your connection and try again.',
  more: 'More',

  // --- before the reveal ---
  /** `{time}` is the countdown, "01 d, 23 h". */
  countdownA11y: '{time} until the film is developed',
  /** `{photos}` and `{people}` are counted nouns: "12 photos", "5 people". */
  soFar: '{photos} so far, from {people}.\nEveryone’s appear when the film is developed.',
  camera: 'Camera',
  backToCamera: 'Back to the camera',
  developing: 'Developing…',
  developNow: 'Develop now',
  developNowA11y: 'Develop the film now',
  developTitle: 'Develop the film now?',
  developBody: 'Closes every camera and shows the photos to everyone.',
  developNotYet: 'Not yet',
  develop: 'Develop',
  developFailed: 'Couldn\'t develop the film',
  hiddenA11y: 'A photo, hidden until the film is developed in {time}',
  hiddenByA11y: 'A photo by {author}, hidden until the film is developed in {time}',
  yourPhotoOf: 'Your photo {index} of {count}',
  emptyWaiting: 'No photos yet.\nThey show up here as they are taken.',

  // --- developed ---
  emptyDeveloped: 'Nobody took a photo.\nThe film came back blank.',
  statPhotos: { one: 'Photo', other: 'Photos' },
  statPeople: { one: 'Person', other: 'People' },
  /** `{photos}` and `{people}` are counted nouns: "12 photos", "5 people". */
  statsA11y: '{photos}, {people}',
  saveAll: 'Save all',
  saveAllA11y: { one: 'Save all {count} photo', other: 'Save all {count} photos' },
  shareAlbum: 'Share the album',
  shareMessage: 'Our photos from {name}: {url}',
  shareAlbumFailed: 'Couldn\'t share the album.',
  photoOf: 'Photo {index} of {count}',
  photoOfBy: 'Photo {index} of {count}, by {author}',
  photoOfMission: 'Photo {index} of {count}, a mission',
  photoOfByMission: 'Photo {index} of {count}, by {author}, a mission',

  // --- add from the library ---
  add: 'Add',
  addA11y: 'Add photos from your library, {count} left',
  adding: { one: 'Adding {count} photo…', other: 'Adding {count} photos…' },
  addFailed: 'Couldn\'t add the photos.',

  // --- the viewer ---
  closePhoto: 'Close photo',
  missionLabel: 'Mission · ',
  missionA11y: 'Mission: {mission}',
  saveThis: 'Save this photo',
  shareThis: 'Share this photo',
  deleteThis: 'Delete this photo',
  reportThis: 'Report this photo',

  // --- save / share ---
  allowPhotoAccess: 'Allow photo access in Settings to save.',
  saving: 'Saving…',
  saved: 'Saved to your photos.',
  saveFailed: 'Couldn\'t save the photo.',
  preparing: 'Preparing…',
  shareFailed: 'Couldn\'t share the photo.',
  saveAllTitle: { one: 'Save all {count} photo?', other: 'Save all {count} photos?' },
  saveAllBody: 'They go to your photo library.',
  savingProgress: 'Saving {index} / {count}',
  savedAll: { one: 'Saved {count} photo.', other: 'Saved {count} photos.' },
  savedSome: 'Saved {saved} of {count}. Try again for the rest.',
  saveAllFailed: 'Couldn\'t save the photos.',

  // --- delete / report ---
  deleteTitle: 'Delete this photo?',
  deleteMineBody: 'It is removed from the album for everyone.',
  deleteOthersBody: '{author} and everyone else lose it too.',
  deleteUnknownBody: 'Its photographer and everyone else lose it too.',
  photoDeleted: 'Photo deleted.',
  deleteFailed: 'Couldn\'t delete the photo.',
  reportTitle: 'Report this photo?',
  reportBody: 'We check reports within 24 hours. The host can also delete it.',
  report: 'Report',
  reported: 'Reported. Thank you.',
  reportFailed: 'Couldn\'t send the report.',

  // 1.3.0 · reveal modes
  showsIn: 'Everyone’s photos show in',
  endsIn: 'The event ends in',
} satisfies Namespace;
