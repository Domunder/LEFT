import type { Namespace } from '../types';

export const host = {
  // 09 · Invite
  closeToCamera: 'Close, back to the camera',
  closeToGroup: 'Close, back to your group',
  closeToMoments: 'Close, back to your moments',
  inviteHeadline: 'Invite your group.\n*Let them in.*',
  inviteSubWaiting: 'Show them the QR or send the link —\nthey can join before it starts, or during.',
  inviteSubCamera: 'Show them the QR or send the link —\nthey can join while the film is running.',
  inviteSubHost: 'Show them the QR or send the link —\nonce they’re in, the cameras can open.',
  shareLink: 'Share Link',
  saveQr: 'Save QR',
  savePermission: 'Allow photo access in Settings to save the code.',
  saved: 'Saved to your photos.',
  saveFailed: "Couldn't save the code.",
  signInForInvite: 'Sign in to see this event’s invite.',
  seeWhoJoined: "See who's joined",
  /** Sent to other people through the share sheet; `{url}` is the invite link. */
  inviteMessage:
    'Join "{name}" on LEFT — a limited number of photos each, developed together when it ends.\n\n{url}\n\nCode: {code}',

  // 10 · Your group
  showQr: 'Show the invite QR code',
  groupEyebrow: 'Your Group',
  groupHeadline: {
    one: '*{count}*/{capacity} people\nhas joined.',
    other: '*{count}*/{capacity} people\nhave joined.',
  },
  loadingGroup: 'Loading your group…',
  groupLoadFailed: 'Couldn’t load your group.\nCheck your connection and try again.',
  waitingForMembers: 'Waiting for members…',
  groupFull: 'Group is full',
  spotsLeft: { one: '{count} spot left', other: '{count} spots left' },
  alreadyEnded: 'This event has already ended.',
  startFailed: "Couldn't start the event. Check your connection and try again.",
  startTitle: 'Start the event?',
  startBody: "Everyone can take photos from now on. This can't be undone.",
  startBodyMissions:
    "Everyone can take photos from now on. The missions are handed out and can't be changed after this, and guests can no longer change their name.",
  notYet: 'Not yet',
  start: 'Start',
  starting: 'Starting…',
  startEvent: 'Start the Event',

  // Change image
  coverFailed: "Couldn't change the image",
  coverHeadline: 'Your *invitation.*',
  coverBody: 'This is what your guests see when they open the link.',
  momentLoadFailed: 'Couldn’t load this moment.',
  saving: 'Saving…',

  // lib/events.ts — errors that can reach the screen
  purchaseUnsettled: 'Your purchase has not been confirmed yet',
  eventNotCreated: 'The event was not created',
  momentDeleted: 'This moment was deleted.',
  nameLength: 'A name is 1 to {max} characters.',
  onlyHostRename: 'Only the host can rename this moment.',
  onlyHostDelete: 'Only the host can delete this moment.',
} satisfies Namespace;
