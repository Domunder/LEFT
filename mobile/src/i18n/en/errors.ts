import type { Namespace } from '../types';

export const errors = {
  signInToHost: 'Sign in with Google or Apple to start a memory of your own.',
  accountInUse: 'That account is already in use. Try the other option.',
  signInFailed: "Couldn't sign in. Check your connection and try again.",
  joinInvalidCode: "That invite code doesn't match an event. Ask the host for a fresh link or QR.",
  joinEnded: 'This event has already ended.',
  joinUnavailable: "Joining isn't available right now. Please try again shortly.",
  joinFailed: "Couldn't join the group. Check your connection and try again.",
  demoLimit: 'You’ve tried the demo a few times today. Come back tomorrow.',
  googleNoSession: 'Google sign-in returned no session',
  appleNoSession: 'Apple sign-in returned no session',
  appleNoToken: 'Apple returned no identity token',
  anonymousNoSession: 'Anonymous sign-in returned no session',
  noSessionToLink: 'There is no session to link',
  linkIncomplete: 'Linking did not complete',
  nameLength: 'Name must be between 1 and {max} characters',
} satisfies Namespace;
