import type { Namespace } from '../types';

export const common = {
  continue: 'Continue',
  cancel: 'Cancel',
  back: 'Back',
  done: 'Done',
  close: 'Close',
  save: 'Save',
  share: 'Share',
  delete: 'Delete',
  remove: 'Remove',
  ok: 'OK',
  notNow: 'Not now',
  openSettings: 'Open Settings',
  tryAgain: 'Try again',
  loading: 'Loading…',
  you: 'You',
  guest: 'Guest',
  checkConnection: 'Check your connection and try again.',
  somethingWrong: 'Something went wrong.',
  photos: { one: '{count} photo', other: '{count} photos' },
  people: { one: '{count} person', other: '{count} people' },
} satisfies Namespace;
