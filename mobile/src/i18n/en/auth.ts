import type { Namespace } from '../types';

export const auth = {
  working: 'Working…',
  createHeadline: 'Start your own\n*memory.*',
  createBody: 'Hosting needs an account. Sign in and everything you shot as a guest comes with you.',
  keepHeadline: 'Your film is\n*ready.*',
  keepBody: 'You shot as a guest, so it lives on this phone alone. Sign in and it stays yours.',
  keepPanelTitle: 'Keep your moments',
  keepPanelBody: 'You’re shooting as a guest. Sign in so your films stay yours if you lose this phone.',
  dismiss: 'Dismiss',
  nameHeadline: 'What should we\ncall you?',
  nameBody: 'This is how your group will see you.',
  nameLabel: 'Your name',
  deleteHeadline: 'Delete your *account?*',
  deleteEvents: 'Events you started are deleted for everyone, with all photos.',
  deletePhotos: 'Photos you took in other events stay, but not linked to you.',
  deletePurchases: 'Purchases are not refunded.',
  deleting: 'Deleting…',
  deleteConfirm: 'Delete Account',
  deleted: 'Your account has been deleted.',
  deleteFailed: "Couldn't delete your account.",
  legalUpdated: 'Last updated {date}',
  // Android's name for the notification channel, shown in the system settings.
  pushChannel: 'Your events',
} satisfies Namespace;
