/**
 * The Terms and the Privacy Policy.
 *
 * One source for both places they are shown: the app's `(legal)` screens and
 * the website's `/terms/` and `/privacy/` (`web/src/pages/` imports this file).
 * It therefore imports nothing — keep it that way, or the website build breaks.
 *
 * ---------------------------------------------------------------------------
 * NOT LEGALLY REVIEWED. These texts were drafted against how the app actually
 * works (2026-11-15); they are not legal advice and no lawyer has seen them.
 * `LEGAL_DRAFT` (a notice above the text, web pages `noindex`) was switched
 * off on 2026-11-16 for the release, by the operator's decision and without a
 * review. The texts are published as they are.
 *
 * BEFORE RELEASE
 *
 *  1. Have them reviewed — Swiss law (FADP/DSG, CO/OR) and the GDPR. The points
 *     a reviewer should look at first are marked `REVIEW:` below.
 *  2. Fill in every [BRACKETED] value. Filled 2026-11-16 (sole proprietor,
 *     Supabase in eu-west-1). No [EU REPRESENTATIVE] is appointed — see the
 *     REVIEW note under "Who is responsible".
 *
 *       [LEGAL ENTITY NAME]   the company or sole proprietor operating LEFT
 *       [POSTAL ADDRESS]      required by Swiss law, the GDPR and both stores
 *       [CONTACT EMAIL]       a monitored address; store review will use it
 *       [JURISDICTION]        governing law and place of jurisdiction
 *       [HOSTING REGION]      where the Supabase project runs (pick an EU region)
 *       [EU REPRESENTATIVE]   GDPR Art. 27 — only if one is required; else
 *                             delete the line
 *       [BACKUP RETENTION]    how long database backups are kept
 *
 *  3. Bump `LEGAL_UPDATED` when the wording changes.
 * ---------------------------------------------------------------------------
 */

/** A paragraph, or a bulleted list of them. */
export type LegalBlock = string | { bullets: string[] };

export type LegalSection = {
  heading: string;
  blocks: LegalBlock[];
};

/**
 * Shows the draft notice and keeps the web pages `noindex` while true.
 *
 * Off since 2026-11-16 by the operator's decision, for the release — **not**
 * because a lawyer has reviewed the texts: nobody has. The `REVIEW:` marks
 * below still stand.
 */
export const LEGAL_DRAFT = false;

/** Printed above both documents while `LEGAL_DRAFT` is true. */
export const LEGAL_DRAFT_NOTICE =
  'Draft. This text has not been legally reviewed yet.';

/** Bump whenever the wording changes materially. */
export const LEGAL_UPDATED = '2026-11-16';

const ENTITY = 'Dominik Rüegg';
const EMAIL = 'support@leftmoment.com';
const ADDRESS = 'Speerstrasse 14, 8640 Rapperswil, Switzerland';

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

export const TERMS_INTRO =
  `These terms are the agreement between you and ${ENTITY} ("we", "us") for the ` +
  'use of the LEFT app and the website leftmoment.com. By creating an event, ' +
  'joining one, or signing in, you accept them.';

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: 'What LEFT is',
    blocks: [
      'LEFT is a disposable camera for events. A host creates an event and ' +
        'invites guests with a link or a QR code. Every guest gets the same ' +
        'limited number of photos — their roll. Each photo is given the look the ' +
        'host chose for the event.',
      'Until the event ends, you can see only the photos you took yourself. When ' +
        'the event ends — at the time the host set, or earlier if the host ' +
        'decides so — the photos are "developed": from then on every member of ' +
        'the event can see, save and share all of them.',
      'LEFT takes photos only. It does not record video or sound.',
    ],
  },
  {
    heading: 'Guests and accounts',
    blocks: [
      'Joining an event as a guest needs no account. You enter a name, and the ' +
        'app creates an anonymous session that lives on your phone. If you ' +
        'delete the app, sign out, or lose the phone, that session — and with it ' +
        'your access to the event — cannot be recovered, unless you connected it ' +
        'to a Google or Apple account beforehand. The app offers this after the ' +
        'photos are developed.',
      'Creating an event requires signing in with Google or Apple. We never see ' +
        'or store a password.',
      // REVIEW: age of digital consent — 13 is the store minimum; 16 applies in
      // several EU member states. Decide the age the service is offered at.
      'You must be at least 13 years old, and older where the law of your ' +
        'country sets a higher age for agreeing to the use of your data (16 in ' +
        'several European countries). If you are a minor, a parent or guardian ' +
        'must agree to these terms for you.',
      `You are responsible for what happens through your session or account. Tell us at ${EMAIL} if you believe someone else is using it.`,
    ],
  },
  {
    heading: 'Your photos',
    blocks: [
      'You keep the rights to every photo you take. We claim nothing beyond what ' +
        'is needed to run the service.',
      'By taking a photo in an event you allow us to store it, to create a ' +
        'smaller preview of it, and to show it to the members of that event once ' +
        'it is developed. This permission ends when the photo is deleted.',
      'You also allow the other members of that event to view, save and share ' +
        'your photo for personal, non-commercial purposes. Consider this before ' +
        'you take a picture: once developed, everyone in the group can keep a ' +
        'copy, and a copy saved to someone else’s phone cannot be recalled.',
      'A photo that has been taken uses one frame of your roll. Frames are not ' +
        'given back, including when the photo is deleted later.',
    ],
  },
  {
    heading: 'Photos of other people',
    blocks: [
      'Your photos will usually show other people. You are responsible for ' +
        'having the right to take and share them:',
      { bullets: [
        'Only photograph people who are fine with it, and stop when someone asks you to.',
        'Take particular care with children: photograph them only with the agreement of a parent or guardian.',
        'Respect places and occasions where photography is not allowed.',
        'If someone asks for a photo of them to be removed, delete it, or ask the host to.',
      ] },
      'As a host you invite the group and can delete any photo in your event. ' +
        'Tell your guests that photos are being taken and shared within the ' +
        'group, and act on requests to remove a picture.',
    ],
  },
  {
    heading: 'What you may not do',
    blocks: [
      { bullets: [
        'Take or upload pictures that are unlawful, hateful, harassing or sexually explicit, or that show a minor inappropriately.',
        'Photograph people secretly, or in situations where they can expect privacy.',
        'Use photos from an event commercially, or publish pictures of other people, without their agreement.',
        'Pass an invitation to people the host did not mean to invite.',
        'Try to see photos before they are developed, to get around the limits of a roll or a group, or to reach another group’s data.',
        'Reverse engineer the app, or use the service through automated clients.',
      ] },
      'We may remove content or block access where these rules are broken, and ' +
        'without notice where the content appears seriously harmful or unlawful.',
    ],
  },
  {
    heading: 'Prices and payment',
    blocks: [
      'An event for up to 50 guests with a limited roll is free. A larger group, ' +
        'or an unlimited roll, is a one-time payment for that one event. The ' +
        'price is shown before you pay. There is no subscription and no ' +
        'recurring charge.',
      'Limits apply to every event: at most 200 guests, a duration of at most 31 ' +
        'days, and — as fair use of the unlimited roll — at most 150 photos per ' +
        'guest.',
      'Payment is taken by the app store on your phone (Apple App Store or ' +
        'Google Play), and their terms apply to the transaction. We do not ' +
        'receive or store your payment details.',
      // REVIEW: right of withdrawal for digital content (EU consumer law) and
      // the wording of its waiver at purchase; Swiss law has no general one.
      'The event is created and usable immediately after payment, so a purchase ' +
        'is generally final. Refunds are handled by the app store you bought ' +
        'from, under its rules. If something went wrong on our side, write to ' +
        `${EMAIL} and we will try to put it right.`,
    ],
  },
  {
    heading: 'How long photos are kept',
    blocks: [
      'An event and its photos are deleted six months after the event was ' +
        'developed. Save the pictures you want to keep to your own phone before ' +
        'then. LEFT is not a backup or an archive.',
      'The host can delete the event or single photos earlier, and you can ' +
        'delete your own photos at any time.',
    ],
  },
  {
    heading: 'Availability',
    blocks: [
      'We work to keep LEFT running, but we do not promise that it is available ' +
        'without interruption or free of errors.',
      'Taking photos depends on your phone, its storage and its connection. ' +
        'Photos taken without a connection are sent later; a photo that could ' +
        'not be sent before the event ended is not accepted any more and is ' +
        'lost. Notifications may arrive late or not at all.',
      'We may change or discontinue features. If we discontinue something you ' +
        'paid for and have not been able to use, we will offer a reasonable ' +
        'remedy.',
    ],
  },
  {
    heading: 'Liability',
    blocks: [
      // REVIEW: limitation of liability under Swiss CO art. 100 and consumer law.
      'We are liable without limitation for damage caused intentionally or by ' +
        'gross negligence, and wherever the law does not allow liability to be ' +
        'limited.',
      'Beyond that, and as far as the law allows, we are not liable for lost ' +
        'photos, lost profit, or indirect or consequential damage, and our total ' +
        'liability is limited to the amount you paid us for the event concerned.',
      'We are not responsible for the content of photos taken by users, or for ' +
        'what members of an event do with photos they saved.',
    ],
  },
  {
    heading: 'Ending your use',
    blocks: [
      'You can stop using LEFT at any time. You can delete your account or guest ' +
        'session in the app under Settings → Delete Account; the Privacy Policy ' +
        'explains what that removes and what it does not.',
      'We may end your access if you break these terms, or if we stop offering ' +
        'the service. In the latter case we will give reasonable notice so that ' +
        'photos can be saved.',
    ],
  },
  {
    heading: 'Changes to these terms',
    blocks: [
      'We may update these terms. If a change materially affects your rights we ' +
        'will tell you in the app before it takes effect. If you continue to use ' +
        'LEFT after that, the updated terms apply.',
    ],
  },
  {
    heading: 'Governing law',
    blocks: [
      // REVIEW: governing law and venue — Swiss law / seat of the entity is the
      // obvious choice; consumers keep their mandatory local protections.
      'These terms are governed by Swiss law. The courts of Rapperswil-Jona, ' +
        'Switzerland, have jurisdiction, unless mandatory consumer law gives ' +
        'you the right to bring a claim where you live.',
    ],
  },
  {
    heading: 'Contact',
    blocks: [`${ENTITY}\n${ADDRESS}\n${EMAIL}`],
  },
];

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

export const PRIVACY_INTRO =
  `This policy explains which personal data ${ENTITY} processes when you use the ` +
  'LEFT app or the website leftmoment.com, why, and what rights you have. It is ' +
  'written for the Swiss Federal Act on Data Protection (FADP) and the EU ' +
  'General Data Protection Regulation (GDPR). We collect as little as the app ' +
  'can work with.';

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: 'Who is responsible',
    blocks: [
      `${ENTITY} is the controller of the personal data described here.`,
      `${ENTITY}\n${ADDRESS}\n${EMAIL}`,
      // REVIEW: no EU representative (GDPR Art. 27) is appointed. LEFT is offered
      // worldwide, the EU included — the operator's decision of 2026-11-16, taken
      // knowing that Art. 27 will normally require one. Name it here once appointed.
    ],
  },
  {
    heading: 'What we process',
    blocks: [
      'If you join as a guest, without an account:',
      { bullets: [
        'The name you type in. The other members of the event see it.',
        'An anonymous user identifier, stored on your phone, that lets the app recognise you as the same guest.',
      ] },
      'If you sign in with Google or Apple:',
      { bullets: [
        'Your name and email address, as the provider reports them. With Apple’s Hide My Email we only receive the relay address.',
        'A user identifier from the provider. We never receive your password.',
      ] },
      'When you use the app:',
      { bullets: [
        'The events you create or join: name, type, look, ending time, group size, roll size, and your role in them.',
        'The photos you take in an event — a full-size image and a small preview — with their size, the time they were taken and who took them.',
        'How many photos of your roll you have used.',
        'If you allow notifications: a push token for your phone and which of the two notifications you switched on.',
        'If you buy an event: which product you bought, when, in which store, the price and currency, and the store’s transaction number. We do not receive your payment details.',
        'Technical data needed to deliver the service, such as IP address, device type, operating system and app version, in server logs.',
      ] },
      'Photos usually show people, including people who are not users of LEFT. ' +
        'We process these images only to store them for the event and show them ' +
        'to its members. We do not analyse faces, we do not identify people in ' +
        'photos, and we do not use photos to train machine-learning models.',
      'The app does not ask for your location, your contacts or your microphone. ' +
        'It asks for the camera, and — only when you save a picture — for ' +
        'permission to add to your photo library. Photos are processed on your ' +
        'phone before upload; the uploaded file does not contain the camera’s ' +
        'location data.',
      // REVIEW: confirm with the final analytics configuration (lib/analytics.ts).
      'Usage statistics and error reports, if you have not switched them off in ' +
        'Settings: that an event was created or joined, that a photo was taken, ' +
        'that an album was revealed, and technical details of errors. These are ' +
        'linked to a random identifier on your phone — not to your name, your ' +
        'email address or your photos — and never contain image content.',
    ],
  },
  {
    heading: 'Why, and on what legal basis',
    blocks: [
      { bullets: [
        'To provide the service — creating and joining events, counting rolls, storing photos, developing them for the group, sending the notifications you asked for. Basis: performance of the contract with you.',
        'To process purchases and keep the records the law requires. Basis: performance of the contract, and legal obligations.',
        'To keep the service secure and to prevent abuse. Basis: our legitimate interests.',
        'To find errors and understand in aggregate how the app is used. Basis: our legitimate interests; you can object at any time by switching this off in Settings.',
        'To send notifications to your phone. Basis: your consent, which you give through the system prompt and can withdraw in Settings or in your phone’s settings.',
      ] },
      'We do not use your data for advertising, we do not create profiles of ' +
        'you, and we make no automated decisions that have legal or similarly ' +
        'significant effects on you.',
      // REVIEW: the basis for people who appear in photos without being users
      // (legitimate interests of the photographer/group; household exemption for
      // the users themselves), and the controller/host allocation of roles.
      'For people who appear in photos, we store the images on behalf of the ' +
        'members of the event, on the basis of their and our legitimate interest ' +
        'in keeping a private record of a shared occasion. Anyone shown in a ' +
        'photo can ask for it to be removed — see "If you appear in a photo".',
    ],
  },
  {
    heading: 'Who can see your data',
    blocks: [
      'Members of an event see the names of the other members and how many ' +
        'photos each has taken. Before the event is developed, nobody but you ' +
        'can see your photos — this is enforced on our servers, not just hidden ' +
        'in the app. After it is developed, all members of that event can see ' +
        'your photos together with your name. They never see your email address.',
      'Anyone with the invitation link can join an event until it is full, ' +
        'including after it has been developed, and then sees its photos. Share ' +
        'the link only with people who belong to the event.',
      'We use the following service providers, who process data on our behalf:',
      { bullets: [
        'Supabase — database, sign-in and photo storage, hosted in the European Union (Ireland).',
        'Apple and Google — sign-in, in-app purchases through their stores, and delivery of push notifications.',
        'RevenueCat — validation and records of in-app purchases.',
        'Expo — delivery of push notifications to Apple and Google.',
        'PostHog (EU hosting) — usage statistics and error reports.',
        'Cloudflare — delivery of the website.',
      ] },
      'We do not sell personal data and we do not pass it to advertisers. We ' +
        'disclose data to authorities only where the law obliges us to.',
    ],
  },
  {
    heading: 'Where your data is processed',
    blocks: [
      // REVIEW: complete once the hosting region and the processors' DPAs/SCCs
      // are settled; list the countries for FADP art. 19.
      'Our database and photo storage are located in the European Union (Ireland). Some of ' +
        'the providers named above are based in, or may access data from, other ' +
        'countries, including the United States. Where data is transferred to a ' +
        'country without an adequate level of data protection, we rely on the ' +
        'safeguards the law provides — in particular the EU standard ' +
        'contractual clauses, with the adaptations required for Switzerland, or ' +
        'the provider’s certification under the Swiss–US and EU–US Data Privacy ' +
        'Framework.',
    ],
  },
  {
    heading: 'How long we keep it',
    blocks: [
      { bullets: [
        'Events, their photos and their guest lists: six months after the event was developed. Then the photos, the image files and the event itself are deleted automatically.',
        'Earlier, if the host deletes the event or a photo, or you delete your own photo.',
        'Your account or guest session: until you delete it.',
        'Push tokens: until you sign out, delete your account, or the token stops working.',
        'Purchase records in our database: until you delete your account. The app stores, and our own accounting, keep transaction records for as long as tax and accounting law requires — in Switzerland ten years.',
        'Server logs, usage statistics and error reports: a short rolling period, normally no longer than 90 days.',
        'Backups: deleted data can remain in encrypted backups for up to 7 days before it is overwritten.',
      ] },
    ],
  },
  {
    heading: 'Deleting your account',
    blocks: [
      'You can delete your account or guest session in the app under Settings → ' +
        'Delete Account. This removes your account and sign-in data, your ' +
        'memberships, your push tokens, our record of your purchases, and every ' +
        'event you host — for all of its members, together with all of its photos.',
      // REVIEW: keeping a deleted user's photos in other people's events,
      // unattributed (photos.user_id on delete set null). Chosen so that one
      // guest leaving does not tear holes in a group's album; a reviewer should
      // confirm it, or the cascade is changed to delete them.
      'Photos you took in events hosted by someone else are not deleted with ' +
        'your account. They stay in that event’s album until the event is ' +
        'deleted, but are no longer linked to you and no longer show your name. ' +
        'If you want them removed, delete them before you delete your account, ' +
        `ask the host, or write to ${EMAIL}.`,
      'Copies that other members have already saved to their own phones are ' +
        'outside our control.',
    ],
  },
  {
    heading: 'If you appear in a photo',
    blocks: [
      'You do not need to be a user of LEFT to have rights over a picture of ' +
        'you. If you appear in a photo and want it removed, ask the person who ' +
        'took it or the host of the event — both can delete it in the app — or ' +
        `write to ${EMAIL} with enough detail for us to find the event. We will ` +
        'remove the photo where you are entitled to it.',
    ],
  },
  {
    heading: 'Your rights',
    blocks: [
      'Under the FADP and the GDPR you can, within the limits of the law:',
      { bullets: [
        'Ask whether we process data about you, and receive a copy of it.',
        'Have incorrect data corrected.',
        'Have your data deleted.',
        'Have its processing restricted, or object to it.',
        'Receive the data you gave us in a common electronic format.',
        'Withdraw a consent you gave, with effect for the future.',
      ] },
      `Write to ${EMAIL}. We answer within 30 days. We may need to ask for ` +
        'information that lets us confirm who you are — a guest without an ' +
        'account is known to us only by the name they typed and their session.',
      'You can also complain to a supervisory authority: in Switzerland the ' +
        'Federal Data Protection and Information Commissioner (FDPIC), in the ' +
        'EU or EEA the data protection authority of your country.',
    ],
  },
  {
    heading: 'Children',
    blocks: [
      'LEFT is not intended for children under 13, and we do not knowingly ' +
        'collect data from them. If you believe a child has given us personal ' +
        `data, write to ${EMAIL} and we will delete it.`,
    ],
  },
  {
    heading: 'Security',
    blocks: [
      'Data is encrypted in transit. Photos are kept in private storage; access ' +
        'is checked on the server for every request, by event membership and by ' +
        'whether the event has been developed. No system is perfectly secure; if ' +
        'a breach puts your rights at risk we will inform you and the ' +
        'authorities as the law requires.',
    ],
  },
  {
    heading: 'The website',
    blocks: [
      'leftmoment.com sets no cookies and contains no tracking or advertising. ' +
        'Our hosting provider processes technical data such as your IP address ' +
        'to deliver the pages. An invitation link (leftmoment.com/j/…) contains ' +
        'the event’s invitation code and opens the app; the website itself does ' +
        'not store it.',
    ],
  },
  {
    heading: 'Changes to this policy',
    blocks: [
      'We update this policy when the app or the law changes, and tell you in ' +
        'the app before a material change takes effect. The date at the top is ' +
        'the date of the current version.',
    ],
  },
];
