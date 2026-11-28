import type { Namespace } from '../types';

export const library = {
  // --- 15/16 · Moments ---
  title: 'Moments',
  settings: 'Settings',
  joinGroup: 'Join a group',
  startMoment: 'Start a moment',
  loadFailed: 'Couldn’t load your moments.\nCheck your connection and try again.',
  sectionDeveloped: 'Developed',
  more: 'More',
  sample: 'Sample',

  // --- the empty library ---
  startHeadline: 'Start your\n*moment*',
  startBody: 'Limited photos each. Nothing shows until\nthe film is developed.',

  // --- a moment's status ---
  statusNotStarted: 'Not started',
  statusDeveloped: 'Developed',
  statusLive: 'Live now',
  /** `{time}` is the countdown, "01d 23h". */
  statusTimeLeft: '{time} left',

  // --- the moment in the spotlight: a number over each of these ---
  heroUnlimitedRoll: 'unlimited roll',
  heroPhotosEach: 'photos each',
  heroJoined: 'joined',
  heroPhotos: { one: 'photo', other: 'photos' },
  heroPeople: { one: 'person', other: 'people' },
  heroShotsLeft: { one: 'shots left', other: 'shots left' },
  heroUntilDevelops: 'until it develops',
  heroUntilDevelopsA11y: '{time} until it develops. See how the film is doing',
  heroA11y: '{title}, {status}',
  inviteAndStart: 'Invite & start',
  open: 'Open',
  openAlbum: 'Open album',
  openCamera: 'Open camera',
  seeYourFilm: 'See your film',

  // --- a row ---
  /** `{photos}` and `{people}` are counted nouns: "12 photos", "5 people". */
  rowA11y: '{title}. {when}. {photos}, {people}.',
  rowSampleA11y: '{title}. {when}. {photos}, {people}. Showing sample pictures.',

  // --- rename / delete / remove ---
  menuDelete: 'Delete moment',
  menuRemove: 'Remove from Moments',
  deleteTitle: 'Delete “{name}”?',
  /** Chosen by the number of photos. */
  deletePhotosForYou: {
    one: 'All {count} photo is deleted for you.',
    other: 'All {count} photos are deleted for you.',
  },
  /** Chosen by the number of photos; `{people}` is the group's size, two or more. */
  deletePhotosForAll: {
    one: 'All {count} photo is deleted for all {people} people.',
    other: 'All {count} photos are deleted for all {people} people.',
  },
  deleteEmptyForYou: 'The moment is deleted for you.',
  deleteEmptyForAll: 'The moment is deleted for all {people} people.',
  deleteNoUndo: 'This can\'t be undone.',
  deleteNoRefund: 'Your purchase isn\'t refunded.',
  deleteFailed: 'Couldn\'t delete the moment',
  removeTitle: 'Remove “{name}”?',
  removeBody:
    'It disappears from your Moments on this phone. Your photos stay in the group, and the invite link brings it back.',
  removeFailed: 'Couldn\'t remove the moment',

  // --- shared chrome ---
  goBack: 'Go back',
  dismissNotification: 'Dismiss notification',

  // 1.3.0 · event settings
  menuSettings: 'Event settings',
} satisfies Namespace;
