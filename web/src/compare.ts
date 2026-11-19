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
  summary: string;
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
    differences: { title: string; text: string }[];
    faq: Faq[];
  };
};

export const LEFT_APP: CompareApp = {
  slug: 'left',
  name: 'LEFT',
  url: 'https://leftmoment.com/',
  summary:
    'A disposable camera for events where the wait is the point: every guest gets the same limited roll, every photo gets one film look, and nobody sees anything until the whole group’s film is developed. Launching soon.',
  bestFor: 'parties, weddings and trips of up to 50 people who want it free, and anyone who wants a real reveal.',
  facts: {
    free: 'Up to 50 guests',
    paid: '$14.99 (100 guests), $19.99 (150), $24.99 (200). Once per event, no subscription',
    guestApp: 'No: link or QR code, then the app or the browser',
    roll: 'Host picks 5, 10, 16, 24 or 36; unlimited on paid events',
    reveal: 'Always at the end: hidden until the film is developed, then everyone’s at once',
    look: '4 film looks (Golden, Chrome, Faded, Mono), one per event, already in the viewfinder',
    video: 'No, photos only',
    extras: 'Missions: free photo dares for guests',
    guests: '200',
    kept: '6 months after the reveal (save them to your phone)',
    platforms: 'iOS and Android (launching soon); guests also in the browser',
  },
  sources: [],
};

const POV: CompareApp = {
  slug: 'pov',
  name: 'POV',
  url: 'https://pov.camera',
  summary:
    'The best-known disposable camera app, with the most App Store ratings. Guests join without a download, the host decides whether photos show live or later, and there are branding tools for business events.',
  bestFor: 'large events, live photo walls and business events that want their own branding.',
  facts: {
    free: 'Up to 10 guests',
    paid: 'From $4.99 (25 guests), up to 250+ guests',
    guestApp: 'No: App Clip on iPhone, web on Android',
    roll: 'Set by the host',
    reveal: 'Host’s choice: live during the event or later',
    look: 'Filters',
    video: 'Not stated',
    extras: 'Screen customisation, business branding, live slideshow',
    guests: '250+',
    kept: 'No end date stated',
    platforms: 'iOS, Android, App Clip, web',
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
      'LEFT vs POV, side by side: free up to 50 guests vs 10, an always-hidden reveal vs live photos, film looks, missions, storage and platforms. Checked 19 November 2026.',
    lede: 'Both apps put a disposable camera in every guest’s phone with one QR code. POV is the established one, built to be flexible: live or delayed photos, branding, very large events. LEFT is built around the wait: one roll each, one film look, and nothing to see until the film is developed.',
    pickThem: [
      'You want photos to show up live during the event, on phones or a screen.',
      'You are planning for more than 200 guests.',
      'It’s a business event that needs your own branding.',
      'You want the app with the longest track record and the most reviews.',
    ],
    pickUs: [
      'Your event has up to 50 guests and you’d rather not pay (POV is free up to 10).',
      'You want a real reveal: nobody sees a single photo until it’s over.',
      'You want the whole album to look like one roll of film.',
      'You want missions, small photo dares that get guests mixing.',
    ],
    differences: [
      {
        title: 'Price for a typical party',
        text: 'LEFT is free for up to 50 guests on a limited roll. POV is free for up to 10 guests, and paid tiers start at $4.99 for 25. For a 30-person birthday, LEFT costs nothing; POV is a paid event.',
      },
      {
        title: 'The reveal',
        text: 'POV lets the host choose: photos can appear live or be held back. On LEFT the film is always developed at the end, for everyone at the same moment. Less choice, on purpose: the waiting is what makes the morning after.',
      },
      {
        title: 'The look',
        text: 'POV offers filters. LEFT gives each event one of four film looks, which guests already see in the viewfinder, so every photo in the album belongs to the same roll.',
      },
      {
        title: 'Big and business events',
        text: 'POV goes past 250 guests and has branding and a live slideshow for companies. LEFT stops at 200 guests and is made for private events.',
      },
      {
        title: 'How long photos stay',
        text: 'POV states no end date for its galleries. LEFT keeps an album for 6 months after the reveal, so save the photos you want to keep.',
      },
      {
        title: 'Missions',
        text: 'LEFT can hand every guest one to three photo dares, like “a photo with someone you have never met”, free on every event. POV doesn’t advertise anything like it.',
      },
    ],
    faq: [
      {
        q: 'Is LEFT or POV cheaper?',
        a: 'For events of up to 50 guests, LEFT: it is free up to 50 guests on a limited roll, while POV is free up to 10 and paid from $4.99 for 25 guests (as listed on 19 November 2026). Above 50 guests, LEFT is $14.99 for 100, $19.99 for 150 and $24.99 for 200, once per event.',
      },
      {
        q: 'Do guests need to download an app for LEFT or POV?',
        a: 'Neither requires it. POV guests join through an App Clip on iPhone or the web on Android. LEFT guests open the link or scan the QR code and shoot in the app or right in the browser.',
      },
      {
        q: 'Can I see the photos during the event?',
        a: 'With POV, the host can choose live photos. With LEFT, every guest sees only their own shots until the film is developed at the end; the host can develop it early.',
      },
      {
        q: 'Which is better for a wedding?',
        a: 'If you want a live photo wall or have more than 200 guests, POV. If you want guests to wait for one shared reveal the morning after, with one film look and free up to 50 guests, LEFT.',
      },
    ],
  },
};

const ONCE: CompareApp = {
  slug: 'once',
  name: 'Once',
  url: 'https://once.film',
  summary:
    'A disposable camera app with one-time pricing per event. Guests join without installing anything, the host picks an instant or delayed reveal, and photos are kept until the film is deleted.',
  bestFor: 'hosts on iPhone who want flexible reveal timing and photos kept without an end date.',
  facts: {
    free: 'Up to 5 guests',
    paid: 'Once per event, priced by guests up to 200; unlimited shots +$9.99',
    guestApp: 'No: link or QR code, web or App Clip',
    roll: 'Set by the host; unlimited as a paid add-on',
    reveal: 'Host’s choice: instant, or at the end or a set time',
    look: 'Film look, camera styles',
    video: 'Not offered',
    extras: 'Custom plans above 200 guests',
    guests: '200 (more on request)',
    kept: 'Until the film is deleted or the account closed',
    platforms: 'iOS; guests on the web; Android in development',
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
      'LEFT vs Once, side by side: free up to 50 guests vs 5, the reveal, film looks, missions, storage and platforms. Checked 19 November 2026.',
    lede: 'LEFT and Once share the idea: a disposable camera on every guest’s phone, paid once per event, no subscription. They differ in how much is free, how the reveal works and what guests get besides the camera.',
    pickThem: [
      'You want to choose between an instant and a delayed reveal.',
      'You want photos kept with no end date.',
      'You need more than 200 guests and want a custom plan.',
    ],
    pickUs: [
      'Your event has up to 50 guests and you’d rather not pay (Once is free up to 5).',
      'You want the reveal fixed: hidden until the end, then everyone’s photos at once.',
      'You want to pick one of four film looks for the whole album.',
      'You want missions, free photo dares for every guest.',
    ],
    differences: [
      {
        title: 'What’s free',
        text: 'Once is free for up to 5 participants. LEFT is free for up to 50 guests on a limited roll of 5 to 36 photos each. Above that, both charge once per event; LEFT’s prices are $14.99 (100 guests), $19.99 (150) and $24.99 (200).',
      },
      {
        title: 'The reveal',
        text: 'Once lets the host choose an instant or a delayed reveal. LEFT always develops the film at the end, for everyone at once, with a countdown in the camera. The host can still develop early.',
      },
      {
        title: 'Looks and missions',
        text: 'Once gives photos a film look. LEFT lets the host pick one of four, Golden, Chrome, Faded or Mono, shown live in the viewfinder, and can hand every guest a few photo missions for free.',
      },
      {
        title: 'How long photos stay',
        text: 'Once keeps a film until it is deleted or the account closes. LEFT keeps an album for 6 months after the reveal, so save what you want to keep.',
      },
    ],
    faq: [
      {
        q: 'Is LEFT or Once cheaper?',
        a: 'For events of up to 50 guests, LEFT: it is free up to 50 guests on a limited roll, while Once is free up to 5 participants (as listed on 19 November 2026). Both charge once per event above that, with no subscription.',
      },
      {
        q: 'Do guests need to download an app?',
        a: 'Not for either. Once guests join on the web or through an App Clip. LEFT guests open the invite link or scan the QR code and shoot in the app or right in the browser.',
      },
      {
        q: 'Do LEFT and Once record video?',
        a: 'No. Both are photo-only disposable cameras.',
      },
    ],
  },
};

const LENSE: CompareApp = {
  slug: 'lense',
  name: 'Lense',
  url: 'https://lense.app',
  summary:
    'A flexible event camera with published prices in Swiss francs, events of up to 500 guests, optional video and a year of storage. The host can review photos before the reveal.',
  bestFor: 'big events, hosts who want video too, and anyone who wants photos stored for a year.',
  facts: {
    free: 'Up to 7 guests',
    paid: 'CHF 4 (25 guests), CHF 14 (50), CHF 30 (100), up to CHF 90 (500). Once per event',
    guestApp: 'No: QR code or link',
    roll: 'Up to 25 per guest; unlimited +CHF 9',
    reveal: 'Host’s choice: instant, delayed or private',
    look: 'Optional film effect, colour adjustments',
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
      'LEFT vs Lense, side by side: free up to 50 guests vs 7, photos only vs video, the reveal, film looks, storage and prices. Checked 19 November 2026.',
    lede: 'Lense is the flexible one: video, up to 500 guests, a reveal you can set any way and a year of storage. LEFT does less on purpose: photos only, one roll each, one film look, and a reveal at the end that nobody can peek at.',
    pickThem: [
      'You want guests to film video clips too.',
      'You expect more than 200 guests.',
      'You want photos stored for a full year.',
      'You want to review and remove photos before anyone sees them.',
    ],
    pickUs: [
      'Your event has up to 50 guests and you’d rather not pay (Lense is free up to 7).',
      'You want photos only, like a real disposable camera.',
      'You want one shared reveal at the end, every time.',
      'You want missions, free photo dares for every guest.',
    ],
    differences: [
      {
        title: 'What’s free',
        text: 'Lense is free for up to 7 guests and costs CHF 14 for 50. LEFT is free for up to 50 guests on a limited roll, and $14.99 / $19.99 / $24.99 for 100 / 150 / 200 guests.',
      },
      {
        title: 'Photos only',
        text: 'Lense offers video as an add-on. LEFT takes photos only, on purpose: it is a disposable camera, not a camcorder.',
      },
      {
        title: 'The reveal',
        text: 'Lense can reveal instantly, later or never (private). LEFT always holds every photo until the film is developed, then shows the whole group’s at once.',
      },
      {
        title: 'Size and storage',
        text: 'Lense goes up to 500 guests and stores photos for 12 months. LEFT stops at 200 guests and keeps an album for 6 months after the reveal.',
      },
    ],
    faq: [
      {
        q: 'Is LEFT or Lense cheaper?',
        a: 'For events of up to 50 guests, LEFT: it is free up to 50 guests on a limited roll, while Lense is free up to 7 and CHF 14 for 50 guests (as listed on 19 November 2026). For 100 guests, Lense lists CHF 30 and LEFT $14.99.',
      },
      {
        q: 'Do guests need to download an app?',
        a: 'Not for either. Lense guests join with a QR code or link. LEFT guests open the invite link or scan the QR code and shoot in the app or right in the browser.',
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
  summary:
    'A newer iPhone app where guests shoot in the browser, photos unlock at the host’s reveal time, and the unfiltered original is kept next to the styled one.',
  bestFor: 'hosts who want a reveal plus video or an audio guestbook as extras.',
  facts: {
    free: 'Up to 5 guests (a host’s first 10 events)',
    paid: '$9.99 (25 guests), $19.99 (50), $39.99 (100), $59.99 (150)',
    guestApp: 'No: browser',
    roll: 'Set by the host; unlimited +$9.99',
    reveal: 'At the host’s reveal time, all at once',
    look: '3 styles: Original, Vintage, B&W',
    video: 'Yes, +$9.99',
    extras: 'Audio guestbook, venue slideshow',
    guests: '150, more as add-ons',
    kept: 'Not stated',
    platforms: 'iOS (host); guests in the browser',
  },
  sources: [{ label: 'Scene on the App Store', url: 'https://apps.apple.com/app/id6758879648' }],
};

/** The competitors, most searched first. */
export const APPS: CompareApp[] = [POV, ONCE, LENSE, SCENE];

export const COMPARE_FAQ: Faq[] = [
  {
    q: 'Which disposable camera app is free?',
    a: 'All of them have a small free tier. As listed on 19 November 2026: LEFT is free up to 50 guests, POV up to 10, Lense up to 7, Once up to 5, and Scene up to 5 for a host’s first 10 events. Bigger events pay once per event; none of them needs a subscription for a private event.',
  },
  {
    q: 'Do guests have to download an app?',
    a: 'Not with any of the apps on this page. Guests open a link or scan a QR code and shoot in the browser or through an App Clip. LEFT guests can use the app or the browser.',
  },
  {
    q: 'Which apps keep the photos hidden until the end?',
    a: 'LEFT always does: nobody sees anyone else’s photos until the film is developed. Scene unlocks photos at the host’s reveal time. POV, Once and Lense let the host choose between showing photos live and holding them back.',
  },
  {
    q: 'Which apps record video?',
    a: 'Lense and Scene offer video as a paid add-on. LEFT and Once take photos only.',
  },
  {
    q: 'Is an app cheaper than real disposable cameras?',
    a: 'Usually, by a lot. A single-use film camera with about 27 shots, plus developing and scans, often comes to $30 or more per camera, and someone has to collect them all. An app uses the phones your guests already carry, and the photos arrive digitally in one album.',
  },
  {
    q: 'Is a shared Google Photos album an alternative?',
    a: 'It works and is free, but every photo is visible the moment it is added, there is no limit and no look. Disposable camera apps add the roll, the film look and, with LEFT, the reveal.',
  },
];
