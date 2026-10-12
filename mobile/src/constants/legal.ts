/**
 * The Terms and Privacy documents.
 *
 * Content lives here rather than in the screens so the two routes stay thin and
 * the text can be lifted wholesale onto a website later without untangling it
 * from JSX.
 *
 * ---------------------------------------------------------------------------
 * BEFORE RELEASE — every [BRACKETED] value below must be filled in:
 *
 *   [LEGAL ENTITY NAME]   the company or sole trader operating LEFT
 *   [CONTACT EMAIL]       a monitored address; App Store review will use it
 *   [POSTAL ADDRESS]      required by the GDPR and by Apple's guidelines
 *   [JURISDICTION]        the country/state whose law governs the terms
 *   [DPO CONTACT]         only if you appoint one; otherwise delete that line
 *
 * These are a starting point drafted against how the app actually works, not
 * legal advice. Have a lawyer review them before shipping — particularly the
 * liability, refund and governing-law sections, which are jurisdiction-specific.
 * ---------------------------------------------------------------------------
 */

import type { LegalSection } from '@/components/ui/legal-page';

/** Bump both of these whenever the wording changes materially. */
export const LEGAL_UPDATED = '2026-08-21';

const ENTITY = '[LEGAL ENTITY NAME]';
const EMAIL = '[CONTACT EMAIL]';

export const TERMS_INTRO =
  `These terms are the agreement between you and ${ENTITY} ("we", "us") for use ` +
  'of the LEFT app. By creating an account or joining an event you accept them.';

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: 'What LEFT does',
    blocks: [
      'LEFT lets a group film into one shared time budget. Everyone at an event ' +
        'records into the same pool of seconds, and the clips are played back ' +
        'together, in the order they were filmed, as that group’s film.',
      'An event has a host, who creates it and sets its length, and guests, who ' +
        'join with an invite code. The budget is shared: seconds one member ' +
        'records are no longer available to the others.',
    ],
  },
  {
    heading: 'Your account',
    blocks: [
      'You sign in with Google or Apple. We never see or store a password.',
      'You must be old enough to consent to processing of your data in your ' +
        'country — at least 13, and older where local law requires it. If you are ' +
        'under the age of majority, you need your parent or guardian to agree to ' +
        'these terms on your behalf.',
      'You are responsible for what happens through your account. Tell us at ' +
        `${EMAIL} if you believe someone else is using it.`,
    ],
  },
  {
    heading: 'Your content',
    blocks: [
      'You keep ownership of every clip you record. We claim no rights over your ' +
        'footage beyond what is needed to run the service.',
      'By recording into an event you grant us a licence to store, process, ' +
        'transcode and share that clip with the other members of that event, and ' +
        'to include it in that event’s film. The licence exists so the app can ' +
        'function, and it ends when you delete the clip or the event is deleted.',
      'You also grant the other members of your event the right to view and save ' +
        'your clip as part of that film. Consider this before filming: a clip you ' +
        'contribute is visible to everyone in that group, and any of them can save ' +
        'it to their own device.',
    ],
  },
  {
    heading: 'What you may not do',
    blocks: [
      { bullets: [
        'Film anyone who has not agreed to be filmed, or in a place where filming is not permitted.',
        'Upload content that is unlawful, hateful, sexually explicit, or that depicts a minor inappropriately.',
        'Upload content you do not have the rights to, including music or footage owned by someone else.',
        'Share an invite code with people the host did not intend to include.',
        'Attempt to read, modify or exhaust another group’s budget, clips or event data.',
        'Reverse engineer the app, or use it through automated clients.',
      ] },
      'We may remove content or suspend an account that breaks these rules, and ' +
        'we may do so without notice where the content appears seriously harmful ' +
        'or unlawful.',
    ],
  },
  {
    heading: 'Payment',
    blocks: [
      'Events for small groups are free. Larger groups are a one-time charge for ' +
        'that event, shown before you pay. There is no subscription and no ' +
        'recurring charge.',
      'Payment is taken through the app store on your device, and their terms ' +
        'apply to the transaction itself. We do not receive or store your card ' +
        'details.',
      'A paid event unlocks a group size and a maximum film length. Because the ' +
        'event is created and usable immediately, purchases are generally final. ' +
        'Refund requests are handled by the app store you bought through, under ' +
        'their policy. If something went wrong on our side, contact us at ' +
        `${EMAIL} and we will try to put it right.`,
    ],
  },
  {
    heading: 'Availability',
    blocks: [
      'We work to keep LEFT running, but we do not promise it will be available ' +
        'without interruption. Filming depends on your device, its storage and ' +
        'your network — an event held somewhere with poor signal may not upload ' +
        'until later.',
      'We may change or discontinue features. If we discontinue something you ' +
        'have paid for, we will tell you and offer a reasonable remedy.',
    ],
  },
  {
    heading: 'Liability',
    blocks: [
      'Nothing here limits liability that cannot be limited by law, including for ' +
        'death or personal injury caused by negligence, or for fraud.',
      'Otherwise, and to the extent the law allows, we are not liable for lost ' +
        'footage, lost profits, or indirect or consequential loss, and our total ' +
        'liability is limited to what you paid us for the event in question.',
      'Keep your own copy of anything irreplaceable. LEFT is not a backup service.',
    ],
  },
  {
    heading: 'Ending your use',
    blocks: [
      'You can stop using LEFT at any time. You can delete your account from ' +
        'inside the app, under Settings → Delete Account; see the Privacy Policy ' +
        'for exactly what deletion removes and what it does not.',
      'We may end your access if you break these terms, or if we stop offering ' +
        'the service. Sections that by their nature survive — content licences ' +
        'already granted to your group, liability, and governing law — continue ' +
        'to apply.',
    ],
  },
  {
    heading: 'Changes to these terms',
    blocks: [
      'We may update these terms. If a change materially affects your rights we ' +
        'will tell you in the app before it takes effect. Continuing to use LEFT ' +
        'after that means you accept the updated terms.',
    ],
  },
  {
    heading: 'Governing law',
    blocks: [
      'These terms are governed by the laws of [JURISDICTION], and the courts of ' +
        '[JURISDICTION] have exclusive jurisdiction, except where consumer law in ' +
        'your country gives you the right to bring a claim locally.',
    ],
  },
  {
    heading: 'Contact',
    blocks: [`${ENTITY}\n[POSTAL ADDRESS]\n${EMAIL}`],
  },
];

export const PRIVACY_INTRO =
  `This notice explains what ${ENTITY} collects when you use LEFT, why, and what ` +
  'you can do about it. We collect as little as the app can work with.';

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: 'Who is responsible',
    blocks: [
      `${ENTITY} is the data controller for the personal data described here.`,
      `Contact: ${EMAIL}\n[POSTAL ADDRESS]\n[DPO CONTACT — delete this line if you have not appointed one]`,
    ],
  },
  {
    heading: 'What we collect',
    blocks: [
      'From your sign-in provider, when you create an account:',
      { bullets: [
        'Your name, as Google or Apple reports it — this is what your group sees.',
        'Your email address. If you use Apple’s Hide My Email, we only ever receive the relay address.',
        'A user identifier that lets us recognise you when you sign in again.',
      ] },
      'We never receive your password. We do not ask for a date of birth, a phone ' +
        'number, or a postal address.',
      'From your use of the app:',
      { bullets: [
        'Events you create or join, their name, type, ending time, group size and film length.',
        'Video clips you record, and how many seconds of the shared budget they used.',
        'Your role in each event, and the display name you use there.',
        'Basic technical data such as device type and app version, used to diagnose crashes.',
      ] },
      'Clips are stored in private storage. They are readable only by members of ' +
        'the event the clip belongs to.',
    ],
  },
  {
    heading: 'Why we use it, and on what basis',
    blocks: [
      { bullets: [
        'To run the service — creating events, enforcing the shared budget, compiling films, showing your group who has joined. Basis: performance of our contract with you.',
        'To keep the service secure and prevent abuse. Basis: our legitimate interests.',
        'To fix faults and improve the app. Basis: our legitimate interests.',
        'To meet legal obligations, such as tax records for a purchase. Basis: legal obligation.',
      ] },
      'We do not use your footage to train machine-learning models, we do not ' +
        'profile you, and we do not make automated decisions with legal effects.',
    ],
  },
  {
    heading: 'Who else sees your data',
    blocks: [
      'Other members of an event see your display name and the clips you ' +
        'contribute to that event. They do not see your email address.',
      'We use these processors to run the service:',
      { bullets: [
        'Supabase — database, authentication and clip storage.',
        'Google and Apple — sign-in, and payment processing through their app stores.',
        'Expo — app delivery and crash diagnostics.',
      ] },
      'Each is bound to process data only on our instructions. We do not sell ' +
        'your personal data, and we do not share it with advertisers.',
    ],
  },
  {
    heading: 'Where your data is held',
    blocks: [
      'Data may be processed outside your country, including in the United ' +
        'States. Where data leaves the UK or the European Economic Area we rely ' +
        'on Standard Contractual Clauses or an adequacy decision to protect it.',
    ],
  },
  {
    heading: 'How long we keep it',
    blocks: [
      { bullets: [
        'Clips and events: until you or the host deletes them, or you delete your account.',
        'Account data: for as long as your account exists.',
        'Purchase records: as long as tax and accounting law requires, typically six years.',
        'Diagnostic logs: a short rolling window, normally under 90 days.',
      ] },
      'Deleting your account removes your account, every event you host — for ' +
        'all of its members, along with its clips and video files — and any ' +
        'purchase records tied to you.',
      'Clips you filmed in someone else’s event are not deleted. They stay in ' +
        'that event’s film, but are unlinked from you and no longer show your ' +
        'name. We do this because removing them would destroy part of a film ' +
        'belonging to other people, who filmed alongside you and in most cases ' +
        'paid for it. If you need such a clip removed, ask the host of that event ' +
        'to delete it, or contact us. A film already saved to another member’s ' +
        'device cannot be recalled in any case.',
    ],
  },
  {
    heading: 'Your rights',
    blocks: [
      'Depending on where you live, you can ask us to:',
      { bullets: [
        'Give you a copy of the data we hold about you.',
        'Correct it if it is wrong.',
        'Delete it, including your whole account.',
        'Restrict or object to how we use it.',
        'Send it to another service in a portable format.',
        'Withdraw consent, where we relied on consent.',
      ] },
      `Email ${EMAIL} and we will respond within one month. You can also ` +
        'complain to your local data protection authority — in the UK the ICO, ' +
        'and in the EU your national supervisory authority.',
    ],
  },
  {
    heading: 'Children',
    blocks: [
      'LEFT is not intended for children under 13, and we do not knowingly ' +
        'collect their data. If you believe a child has given us personal data, ' +
        `contact ${EMAIL} and we will delete it.`,
    ],
  },
  {
    heading: 'Filming other people',
    blocks: [
      'A clip you record may contain other people, and they have privacy rights ' +
        'too. Only film people who are happy to be filmed, and respect any venue ' +
        'that does not allow recording. If you appear in someone else’s clip ' +
        `and want it removed, ask the event host, or contact us at ${EMAIL}.`,
    ],
  },
  {
    heading: 'Changes to this notice',
    blocks: [
      'We will update this notice as the app changes, and will tell you in the ' +
        'app before a material change takes effect. The date at the top always ' +
        'reflects the current version.',
    ],
  },
];
