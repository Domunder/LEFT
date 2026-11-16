/**
 * Everything about the site that is not copy: names, links, prices.
 *
 * PLACEHOLDERS — fill these when the app is listed. While a store URL is
 * `null` the buttons say "Coming soon" and `/j/{CODE}` does not redirect.
 */
export const SITE = {
  name: 'LEFT',
  url: 'https://leftmoment.com',
  tagline: 'The disposable camera for events',
  /** App Store listing, e.g. https://apps.apple.com/app/id0000000000 */
  appStoreUrl: null as string | null,
  /** Play Store listing, e.g. https://play.google.com/store/apps/details?id=com.leftmoment.app */
  playStoreUrl: null as string | null,
  /** The app's custom scheme (mobile/app.json → scheme). */
  scheme: 'left',
  contactEmail: null as string | null,
} as const;

export const NAV = [
  { href: '/#how', label: 'How it works' },
  { href: '/use-cases/', label: 'Use cases' },
  { href: '/wedding/', label: 'Weddings' },
  { href: '/#pricing', label: 'Pricing' },
] as const;

/**
 * Mirrors `create_event()` on the server (see CLAUDE.md → Pricing). The store
 * is the authority on the final price; these are the US dollar prices.
 */
export const TIERS = [
  { id: 'free', price: 0, guests: 50, roll: 'Rolls of 5 to 36 photos', note: 'For most parties' },
  { id: 'left_small', price: 9.99, guests: 50, roll: 'Unlimited roll', note: 'Shoot all night' },
  { id: 'left_medium', price: 14.99, guests: 100, roll: 'Any roll, unlimited included', note: 'Most weddings' },
  { id: 'left_large', price: 19.99, guests: 150, roll: 'Any roll, unlimited included', note: 'Big celebrations' },
  { id: 'left_unlimited', price: 24.99, guests: 200, roll: 'Any roll, unlimited included', note: 'The whole village' },
] as const;

export const LOOKS = [
  { id: 'golden', name: 'Golden', blurb: 'Warm and nostalgic. Soft, sunny colour.' },
  { id: 'chrome', name: 'Chrome', blurb: 'Cool and calm. Muted greens and blues.' },
  { id: 'faded', name: 'Faded', blurb: 'Washed out and gentle, like an old print.' },
  { id: 'mono', name: 'Mono', blurb: 'Clean black and white. Timeless.' },
] as const;

export type Faq = { q: string; a: string };

export const HOME_FAQ: Faq[] = [
  {
    q: 'What is LEFT?',
    a: 'LEFT is a disposable camera app for events. The host creates an event, guests join with a link or QR code, and everyone gets the same limited roll of photos. The pictures stay hidden until the event ends, then the whole group’s film is developed at once into one shared album.',
  },
  {
    q: 'Do guests need an account?',
    a: 'No. A guest opens the invite link or scans the QR code, types a name, and starts shooting. There is no sign-up, no email and no password. Only the host signs in, with Apple or Google.',
  },
  {
    q: 'When can we see the photos?',
    a: 'When the event ends. The host picks the day and time the film is developed, and at that moment every photo appears for everyone in the group. Until then you can look at your own shots, but nobody else’s.',
  },
  {
    q: 'How many photos does each guest get?',
    a: 'The host chooses the roll: 5, 10, 16, 24 or 36 photos per guest, or an unlimited roll. Every guest gets the same. A counter on the camera shows how many shots you have left.',
  },
  {
    q: 'What does LEFT cost?',
    a: 'Events with up to 50 guests and a limited roll are free. An unlimited roll for up to 50 guests is $9.99, and larger groups are $14.99 (up to 100 guests), $19.99 (up to 150) and $24.99 (up to 200). The host pays once per event. Guests never pay, and there is no subscription.',
  },
  {
    q: 'What are the film looks?',
    a: 'The host picks one look for the whole event: Golden (warm), Chrome (cool), Faded (washed out) or Mono (black and white). The look is in the viewfinder while you shoot and in every photo, so the album feels like one roll of film.',
  },
  {
    q: 'Can I save and share the photos afterwards?',
    a: 'Yes. Once the film is developed, everyone in the event can open the album, save photos to their phone and share them.',
  },
  {
    q: 'Does LEFT record video?',
    a: 'No. LEFT takes photos only, on purpose. It is a disposable camera, not a camcorder.',
  },
  {
    q: 'Who can see our photos?',
    a: 'Only the people who joined your event. Before the film is developed, each guest sees only their own shots. The host can remove any photo, and guests can remove their own.',
  },
];
