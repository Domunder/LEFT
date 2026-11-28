import type { Namespace } from '../types';

export const onboarding = {
  // 02 · Event
  eventEyebrow: 'Event',
  eventHeadline: 'What are you\n*capturing?*',
  eventNameLabel: 'Name your event',
  typeWedding: 'Wedding',
  typeBirthday: 'Birthday',
  typeTrip: 'Trip',
  typeParty: 'Party',
  typeCompany: 'Company Event',
  typeGraduation: 'Graduation',
  typeOther: 'Other',
  placeholderWedding: "Sam & Alex's Wedding",
  placeholderBirthday: "Maya's 30th",
  placeholderTrip: 'Lisbon 2026',
  placeholderParty: "New Year's Eve",
  placeholderCompany: 'Summer Offsite',
  placeholderGraduation: 'Class of 2026',
  placeholderOther: 'Our Film',

  // 03 · Film (the look)
  lookEyebrow: 'Film',
  lookHeadline: 'Which film are\n*you loading?*',
  lookGoldenBlurb: 'Warm and nostalgic. Soft, sunny colour.',
  lookChromeBlurb: 'Cool and calm. Muted greens and blues.',
  lookFadedBlurb: 'Washed out and gentle, like an old print.',
  lookMonoBlurb: 'Clean black and white. Timeless.',

  // 03.1 · Event cover

  // 04 · Event end
  endingHeadline: 'When does\n*the event end?*',
  endingA11y: 'Ends {date} at {time}, {until}',
  endingA11yPast: 'Ends {date} at {time}, which has already passed',
  endingDeveloped: 'The film is developed {until}.',
  endingPast: 'That has already passed — pick a later time.',

  // 05.1 · Group and roll
  groupHeadline: 'How many people\n*for your event?*',
  groupSubcopy: 'Everyone gets their own roll of film.',
  groupUpTo: 'Up to {count} people',
  rollLabel: 'Shots per person',
  rollEach: '{count} photos each',
  rollUnlimitedEach: 'Unlimited photos each',
  shotsLeft: '{count} left',
  noSubscription: 'No subscription.',
  missionsTitle: 'Missions',
  missionsOn: 'Invite people first, then edit the missions.',
  missionsOff: 'Small photo missions for your guests.',
  ctaCreate: 'Create event',
  ctaPaid: 'Continue · {price}',
  ctaOpeningStore: 'Opening the store…',
  ctaConfirming: 'Confirming your purchase…',
  ctaWorking: 'Working…',
  changeEnding: 'Change ending time',
  errorEndPassed: 'That end time has passed. Pick a new one.',
  errorIncomplete: 'Something is missing. Go back and fill it in.',
  errorNeedSignIn: 'You need to be signed in to create an event.',
  errorGuestCannotCreate: 'Sign in with Google or Apple to create an event.',
  errorNoTransaction: 'The purchase completed but returned no transaction.',

  // 04.1 · The invitation (1.3.0)
  inviteHeadline: 'Your *invitation.*',
  inviteBody: 'This is what your guests see when they open the link.',
  inviteChangeImage: 'Change image',
  invitePreview: 'Preview',
  inviteUseDefault: 'Use default image',
  invitePreviewA11y: 'Preview the invitation full screen',
  inviteCardA11y: 'The invitation to {name}',
  inviteNameFallback: 'Your event',
} satisfies Namespace;
