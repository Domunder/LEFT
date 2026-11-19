/**
 * The comparison pages (/compare/ and /compare/{slug}/).
 *
 * Every competitor fact comes from that app's own website or US App Store
 * listing, checked on CHECKED, with the source in `sources`. Comparative
 * advertising (EU 2006/114/EC, Swiss UWG Art. 3 lit. e) must be accurate and
 * verifiable: when a fact can't be confirmed, write "Not stated" rather than
 * guessing, and re-check every price at least twice a year (update CHECKED).
 *
 * LEFT's own facts mirror src/site.ts and the root CLAUDE.md.
 * Keep the copy short (the user, 2026-11-19): the table carries the detail.
 */
import type { Faq } from './site';

export const CHECKED = '2026-11-19';
export const CHECKED_LABEL = '19 November 2026';

export const ROWS = [
  { key: 'free', label: 'Free for' },
  { key: 'paid', label: 'Paid' },
  { key: 'guestApp', label: 'Guests need the app?' },
  { key: 'roll', label: 'Photos per guest' },
  { key: 'reveal', label: 'When photos appear' },
  { key: 'look', label: 'Film look' },
  { key: 'video', label: 'Video' },
  { key: 'extras', label: 'Extras' },
  { key: 'guests', label: 'Largest event' },
  { key: 'kept', label: 'Photos kept' },
  { key: 'platforms', label: 'Platforms' },
] as const;

type RowKey = (typeof ROWS)[number]['key'];

export type CompareApp = {
  slug: string;
  name: string;
  url: string;
  /** One line on the overview. */
  bestFor: string;
  facts: Record<RowKey, string>;
  sources: { label: string; url: string }[];
  /** Gets its own /compare/{slug}/ page. */
  page?: boolean;
  vs?: {
    titleTail: string;
    headline: string;
    description: string;
    lede: string;
    pickThem: string[];
    pickUs: string[];
    faq: Faq[];
  };
};

export const LEFT_APP: CompareApp = {
  slug: 'left',
  name: 'LEFT',
  url: 'https://leftmoment.com/',
  bestFor: 'Free events up to 50 guests and a real reveal at the end. Launching soon.',
  facts: {
    free: 'Up to 50 guests',
    paid: '$14.99 (100 guests), $19.99 (150), $24.99 (200), once per event',
    guestApp: 'No: app or browser',
    roll: 'Host picks 5–36; unlimited on paid events',
    reveal: 'Always at the end, everyone’s at once',
    look: '4 film looks, live in the viewfinder',
    video: 'No, photos only',
    extras: 'Missions (free photo dares)',
    guests: '200',
    kept: '6 months after the reveal',
    platforms: 'iOS and Android (launching soon), web for guests',
  },
  sources: [],
};

const POV: CompareApp = {
  slug: 'pov',
  name: 'POV',
  url: 'https://pov.camera',
  bestFor: 'Big events, live photo walls and business branding.',
  facts: {
    free: 'Up to 10 guests',
    paid: 'From $4.99 (25 guests), up to 250+',
    guestApp: 'No: App Clip or web',
    roll: 'Set by the host',
    reveal: 'Host’s choice: live or later',
    look: 'Filters',
    video: 'Not stated',
    extras: 'Branding, live slideshow',
    guests: '250+',
    kept: 'No end date stated',
    platforms: 'iOS, Android, web',
  },
  sources: [
    { label: 'pov.camera/pricing', url: 'https://pov.camera/pricing' },
    { label: 'pov.camera/faq', url: 'https://pov.camera/faq' },
    {
      label: 'POV blog: alternatives to disposable cameras at weddings',
      url: 'https://pov.camera/blog/the-best-alternatives-to-disposable-cameras-at-weddings',
    },
    { label: 'POV on the App Store', url: 'https://apps.apple.com/us/app/id1636032890' },
  ],
  page: true,
  vs: {
    titleTail: 'which disposable camera app fits your event?',
    headline: 'two takes on the disposable camera.',
    description:
      'LEFT vs POV: free up to 50 guests vs 10, an always-hidden reveal vs live photos, film looks, missions and storage. Checked 19 November 2026.',
    lede: 'POV is flexible: live photos, branding, huge events. LEFT is built around the wait.',
    pickThem: ['You want photos live during the event', 'More than 200 guests', 'A business event with branding'],
    pickUs: ['Up to 50 guests, free (POV: 10)', 'Nobody sees a photo until the end', 'One film look and missions'],
    faq: [
      {
        q: 'Is LEFT or POV cheaper?',
        a: 'Up to 50 guests, LEFT: it’s free, while POV is free up to 10 and paid from $4.99 for 25 (as listed on 19 November 2026).',
      },
      {
        q: 'Do guests need to download an app?',
        a: 'Not for either. POV uses an App Clip or the web; LEFT guests use the app or the browser.',
      },
    ],
  },
};

const ONCE: CompareApp = {
  slug: 'once',
  name: 'Once',
  url: 'https://once.film',
  bestFor: 'iPhone hosts who want to choose when photos appear, kept with no end date.',
  facts: {
    free: 'Up to 5 guests',
    paid: 'Once per event, up to 200 guests; unlimited shots +$9.99',
    guestApp: 'No: web or App Clip',
    roll: 'Set by the host; unlimited extra',
    reveal: 'Host’s choice: instant or later',
    look: 'Film look',
    video: 'Not offered',
    extras: 'Custom plans above 200',
    guests: '200 (more on request)',
    kept: 'Until deleted',
    platforms: 'iOS, web for guests (Android in development)',
  },
  sources: [
    { label: 'once.film/pricing', url: 'https://once.film/pricing' },
    { label: 'once.film/privacy', url: 'https://once.film/privacy' },
    {
      label: 'Once on the App Store',
      url: 'https://apps.apple.com/us/app/once-disposable-camera-event/id6754265953',
    },
  ],
  page: true,
  vs: {
    titleTail: 'disposable camera apps compared',
    headline: 'the same idea, different defaults.',
    description:
      'LEFT vs Once: free up to 50 guests vs 5, the reveal, film looks, missions and storage. Checked 19 November 2026.',
    lede: 'Same idea, both paid once per event. They differ in what’s free and how the reveal works.',
    pickThem: ['You want an instant or a delayed reveal', 'Photos kept with no end date', 'More than 200 guests'],
    pickUs: ['Up to 50 guests, free (Once: 5)', 'One reveal at the end, for everyone', 'Four film looks and missions'],
    faq: [
      {
        q: 'Is LEFT or Once cheaper?',
        a: 'Up to 50 guests, LEFT: it’s free, while Once is free up to 5 (as listed on 19 November 2026). Both charge once per event above that.',
      },
      {
        q: 'Do LEFT and Once record video?',
        a: 'No. Both take photos only.',
      },
    ],
  },
};

const LENSE: CompareApp = {
  slug: 'lense',
  name: 'Lense',
  url: 'https://lense.app',
  bestFor: 'Very large events, video, and a year of storage.',
  facts: {
    free: 'Up to 7 guests',
    paid: 'CHF 14 (50 guests), CHF 30 (100), up to CHF 90 (500), once per event',
    guestApp: 'No: QR code or link',
    roll: 'Up to 25; unlimited +CHF 9',
    reveal: 'Host’s choice: instant, later or private',
    look: 'Optional film effect',
    video: 'Yes, +CHF 9',
    extras: 'Review photos before the reveal',
    guests: '500',
    kept: '12 months',
    platforms: 'iOS, Android, web',
  },
  sources: [
    { label: 'lense.app/pricing', url: 'https://lense.app/pricing' },
    { label: 'Lense on the App Store', url: 'https://apps.apple.com/us/app/id6444442256' },
  ],
  page: true,
  vs: {
    titleTail: 'which event camera app to pick?',
    headline: 'everything, or one good roll.',
    description:
      'LEFT vs Lense: free up to 50 guests vs 7, photos only vs video, the reveal, film looks and storage. Checked 19 November 2026.',
    lede: 'Lense does everything, video included. LEFT does less on purpose: photos, one roll, one reveal.',
    pickThem: ['Guests should film video too', 'More than 200 guests', 'Photos stored for a year'],
    pickUs: ['Up to 50 guests, free (Lense: 7)', 'Photos only, like a real disposable', 'One reveal at the end, every time'],
    faq: [
      {
        q: 'Is LEFT or Lense cheaper?',
        a: 'Up to 50 guests, LEFT: it’s free, while Lense is free up to 7 and CHF 14 for 50 (as listed on 19 November 2026).',
      },
      {
        q: 'Which one records video?',
        a: 'Lense, as a paid add-on. LEFT is photos only.',
      },
    ],
  },
};

const SCENE: CompareApp = {
  slug: 'scene',
  name: 'Scene',
  url: 'https://apps.apple.com/app/id6758879648',
  bestFor: 'A reveal plus video or an audio guestbook.',
  facts: {
    free: 'Up to 5 guests (first 10 events)',
    paid: '$19.99 (50 guests), $39.99 (100), $59.99 (150)',
    guestApp: 'No: browser',
    roll: 'Set by the host; unlimited +$9.99',
    reveal: 'At the host’s reveal time',
    look: '3 styles: Original, Vintage, B&W',
    video: 'Yes, +$9.99',
    extras: 'Audio guestbook, slideshow',
    guests: '150, more as add-ons',
    kept: 'Not stated',
    platforms: 'iOS, web for guests',
  },
  sources: [{ label: 'Scene on the App Store', url: 'https://apps.apple.com/app/id6758879648' }],
};

/** The competitors, most searched first. */
export const APPS: CompareApp[] = [POV, ONCE, LENSE, SCENE];

export const COMPARE_FAQ: Faq[] = [
  {
    q: 'Which disposable camera app is free?',
    a: 'All have a small free tier. On 19 November 2026: LEFT up to 50 guests, POV 10, Lense 7, Once and Scene 5.',
  },
  {
    q: 'Do guests have to download an app?',
    a: 'Not with any app on this page: guests open a link or scan a QR code.',
  },
  {
    q: 'Which apps keep photos hidden until the end?',
    a: 'LEFT always, Scene at the host’s reveal time. POV, Once and Lense let the host choose.',
  },
];
