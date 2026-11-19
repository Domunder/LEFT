/**
 * Search pages: one per question people actually type ("qr code for wedding
 * photos", "photo booth alternative"), rendered by src/pages/[slug].astro.
 *
 * Decided with the user 2026-11-19: a few distinct, useful pages, not dozens
 * of near-copies (no city pages — Google treats those as scaled content).
 * Keep each page short. Facts only from src/site.ts / the root CLAUDE.md.
 */
import type { ImageMetadata } from 'astro';
import type { Faq } from './site';

import weddingToast from './assets/photos/wedding-toast.jpg';
import weddingCrowd from './assets/photos/wedding-crowd.jpg';
import partyDance from './assets/photos/party-dance.jpg';
import partyConfetti from './assets/photos/party-confetti.jpg';
import tripVan from './assets/photos/trip-van.jpg';
import partyToast from './assets/photos/party-toast.jpg';
import friendsLaugh from './assets/photos/friends-laugh.jpg';
import weddingChampagne from './assets/photos/wedding-champagne.jpg';

export type Guide = {
  slug: string;
  /** Link text in the footer and in "related". */
  short: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: [string, string];
  lede: string;
  photo: { src: ImageMetadata; alt: string; look: 'golden' | 'chrome' | 'faded' | 'mono' };
  points: { title: string; text: string }[];
  /** A numbered list: setup steps, or ideas. */
  list: { title: string; items: string[] };
  faq: Faq[];
  related: string[];
};

const JOIN = 'No. Guests open the link or scan the QR code, type a name and shoot, in the LEFT app or right in the browser. No account.';
const PRICE = 'Free for up to 50 guests. Bigger events are $14.99 (100 guests), $19.99 (150) or $24.99 (200), paid once by the host. No subscription.';

export const GUIDES: Guide[] = [
  {
    slug: 'qr-code-for-wedding-photos',
    short: 'QR code for wedding photos',
    title: 'QR code for wedding photos: collect every guest’s pictures | LEFT',
    description:
      'Put one QR code on the tables and every guest’s photos land in one album. No app needed for guests, free up to 50 guests.',
    eyebrow: 'Weddings',
    h1: ['One QR code,', 'every guest’s photos.'],
    lede: 'Print it on the table cards. Guests scan, shoot, and the album appears the morning after.',
    photo: { src: weddingToast, alt: 'Wedding guests raising their glasses at a long table', look: 'golden' },
    points: [
      { title: 'Nothing to install', text: 'Guests scan and shoot in the browser or the app. No account, no password.' },
      { title: 'One album, not 40 chats', text: 'Every photo goes to the same place, instead of being scattered across group chats.' },
      { title: 'Worth the wait', text: 'Photos stay hidden until the film is developed, so the album is a surprise.' },
    ],
    list: {
      title: 'How to set it up',
      items: [
        'Create the event in LEFT and pick a film look.',
        'Choose the roll: 24 or 36 photos per guest suits most weddings.',
        'Save the QR code and print it on table cards or the menu.',
        'Set the reveal for the morning after.',
      ],
    },
    faq: [
      { q: 'Do guests need to download an app?', a: JOIN },
      { q: 'What does it cost?', a: PRICE },
      {
        q: 'Does the QR code work without good signal?',
        a: 'Guests need a connection to join. After that they can keep shooting offline; photos upload on their own later.',
      },
    ],
    related: ['wedding-photo-sharing-app', 'wedding-photo-ideas-for-guests'],
  },
  {
    slug: 'wedding-photo-sharing-app',
    short: 'Wedding photo sharing app',
    title: 'Wedding photo sharing app: all guest photos in one album | LEFT',
    description:
      'A wedding photo sharing app with a twist: every guest gets a roll like a disposable camera, and the shared album is revealed after the wedding.',
    eyebrow: 'Weddings',
    h1: ['Every guest’s photos,', 'in one album.'],
    lede: 'Guests shoot on their phones, LEFT collects it all, and everyone sees the album at the same moment.',
    photo: { src: weddingCrowd, alt: 'Guests with sparklers around a wedding couple at night', look: 'golden' },
    points: [
      { title: 'No chasing photos', text: 'No “send me your pictures” messages for weeks. They are all in the album.' },
      { title: 'Looks like one film', text: 'One film look for the whole event, so the album feels like one roll.' },
      { title: 'Private', text: 'Only people in the event see the album. You can remove any photo.' },
    ],
    list: {
      title: 'How it works',
      items: [
        'Share the invite link or QR code.',
        'Each guest gets the same roll of photos.',
        'Photos stay hidden until the film is developed.',
        'Everyone saves and shares from the album.',
      ],
    },
    faq: [
      { q: 'Do guests need an account?', a: JOIN },
      { q: 'How long are photos kept?', a: 'Six months after the reveal. Save the ones you want to your phone.' },
      { q: 'What does it cost?', a: PRICE },
    ],
    related: ['qr-code-for-wedding-photos', 'digital-disposable-camera'],
  },
  {
    slug: 'disposable-camera-app-for-parties',
    short: 'Disposable camera app for parties',
    title: 'Disposable camera app for parties and birthdays | LEFT',
    description:
      'Turn every guest’s phone into a disposable camera for your party: a few shots each, and the photos develop the next morning. Free up to 50 guests.',
    eyebrow: 'Parties',
    h1: ['A disposable camera', 'for the whole party.'],
    lede: 'Ten shots each, nobody sees anything, and the photos develop the morning after.',
    photo: { src: partyDance, alt: 'Friends dancing at a party, lit by flash', look: 'chrome' },
    points: [
      { title: 'Fewer phones out', text: 'A small roll means one good shot, then back to the party.' },
      { title: 'The morning after', text: 'The best part of the night arrives with breakfast: everyone’s photos at once.' },
      { title: 'Free for most parties', text: 'Up to 50 guests costs nothing.' },
    ],
    list: {
      title: 'Set it up in a minute',
      items: [
        'Create the event and pick a look: Chrome or Mono suit a night out.',
        'Pick 10 or 16 shots per guest.',
        'Drop the link in the group chat.',
        'Set the reveal for 10 am the next day.',
      ],
    },
    faq: [
      { q: 'Do guests need the app?', a: JOIN },
      { q: 'What does it cost?', a: PRICE },
      { q: 'Can I see photos during the party?', a: 'Only your own. Everyone else’s appear when the film is developed. The host can develop it early.' },
    ],
    related: ['bachelorette-party-camera', 'photo-booth-alternative'],
  },
  {
    slug: 'bachelorette-party-camera',
    short: 'Bachelorette party camera',
    title: 'Bachelorette party disposable camera, on everyone’s phone | LEFT',
    description:
      'A disposable camera for the bachelorette or hen party: a limited roll for everyone, missions to complete, and the photos revealed after the weekend.',
    eyebrow: 'Bachelorette & hen parties',
    h1: ['What happens at the bachelorette', 'develops later.'],
    lede: 'Everyone gets a roll, the bride gets missions, and the photos stay hidden until it’s over.',
    photo: { src: partyConfetti, alt: 'Friends celebrating under falling confetti', look: 'golden' },
    points: [
      { title: 'Missions', text: 'Give each friend a few photo dares, free. Write personal ones for the bride.' },
      { title: 'Nothing leaks', text: 'No photo is visible until the film is developed. Not even to the group.' },
      { title: 'A real roll', text: 'A limited number of shots makes everyone choose their moment.' },
    ],
    list: {
      title: 'Mission ideas',
      items: [
        'The bride with a stranger’s hat',
        'The whole group in one mirror',
        'Someone mid-laugh, not posing',
        'The best dance move of the night',
        'The bride and the oldest person in the room',
      ],
    },
    faq: [
      { q: 'Do my friends need the app?', a: JOIN },
      { q: 'Are missions extra?', a: 'No. Missions are free on every event. Each guest gets one to three.' },
      { q: 'What does it cost?', a: PRICE },
    ],
    related: ['disposable-camera-app-for-parties', 'wedding-photo-ideas-for-guests'],
  },
  {
    slug: 'disposable-camera-app-for-trips',
    short: 'Disposable camera app for trips',
    title: 'Disposable camera app for group trips and holidays | LEFT',
    description:
      'A shared disposable camera for your group trip: everyone shoots on a roll, and the trip’s photos develop when you get home.',
    eyebrow: 'Trips',
    h1: ['The trip you can only see', 'once you’re home.'],
    lede: 'Ski week, road trip or a week by the sea: everyone shoots, and the film develops on the way back.',
    photo: { src: tripVan, alt: 'Friends sitting in an open van on a road trip', look: 'golden' },
    points: [
      { title: 'Everyone’s view', text: 'Not just the one friend with the good camera. Everyone’s roll, in one album.' },
      { title: 'Works offline', text: 'Shoot in the mountains, photos upload when there’s signal again.' },
      { title: 'Something to come home to', text: 'Set the reveal for the day after you’re back.' },
    ],
    list: {
      title: 'Set it up before you leave',
      items: [
        'Create the event and set the end to the day after you return.',
        'Pick 36 shots each, or unlimited for big groups.',
        'Share the link in the trip chat.',
      ],
    },
    faq: [
      { q: 'Does it work without signal?', a: 'Yes, after joining. Photos are stored on the phone and upload on their own later.' },
      { q: 'Do friends need the app?', a: JOIN },
      { q: 'What does it cost?', a: PRICE },
    ],
    related: ['digital-disposable-camera', 'disposable-camera-app-for-parties'],
  },
  {
    slug: 'photo-booth-alternative',
    short: 'Photo booth alternative',
    title: 'Photo booth alternative for weddings and parties | LEFT',
    description:
      'Instead of renting a photo booth, give every guest a disposable camera on their phone. Photos from the whole room, revealed after the event.',
    eyebrow: 'Weddings & parties',
    h1: ['A photo booth that', 'follows the party.'],
    lede: 'A booth stays in one corner. LEFT is in every guest’s pocket, all night.',
    photo: { src: partyToast, alt: 'Guests toasting with glasses at a party', look: 'golden' },
    points: [
      { title: 'The whole room', text: 'The dance floor, the bar, the kids’ table, not just the booth corner.' },
      { title: 'Nothing to rent', text: 'No hardware, no staff, no setup. Free up to 50 guests.' },
      { title: 'Candid, not posed', text: 'The photos people take when nobody is standing in front of a backdrop.' },
    ],
    list: {
      title: 'Booth or LEFT?',
      items: [
        'Want printed strips to take home? A booth does that; LEFT is digital.',
        'Want props and posed group shots? A booth is made for it.',
        'Want the whole night from every angle? That’s LEFT.',
        'You can also have both: the booth for posing, LEFT for everything else.',
      ],
    },
    faq: [
      { q: 'What does it cost?', a: PRICE },
      { q: 'Do guests need the app?', a: JOIN },
      { q: 'Can we print the photos?', a: 'Yes. Everyone can save the photos once the film is developed and print them anywhere.' },
    ],
    related: ['disposable-camera-app-for-parties', 'qr-code-for-wedding-photos'],
  },
  {
    slug: 'digital-disposable-camera',
    short: 'Digital disposable camera',
    title: 'Digital disposable camera app: film look, limited shots, a reveal | LEFT',
    description:
      'A digital disposable camera for groups: a limited roll per person, a film look in the viewfinder, and photos you only see once the film is developed.',
    eyebrow: 'The camera',
    h1: ['A disposable camera,', 'minus the plastic.'],
    lede: 'A limited roll, a film look, and the wait. Only the developing is faster.',
    photo: { src: friendsLaugh, alt: 'Friends laughing together outdoors', look: 'faded' },
    points: [
      { title: 'A counter, not a camera roll', text: 'The camera shows how many shots you have left. When it hits zero, you’re done.' },
      { title: 'Four film looks', text: 'Golden, Chrome, Faded or Mono, already in the viewfinder.' },
      { title: 'No peeking', text: 'Nobody sees the group’s photos until the film is developed.' },
    ],
    list: {
      title: 'Compared with a real disposable',
      items: [
        'No cameras to buy, collect or develop.',
        'Photos arrive in one shared album, not in a lab envelope.',
        'Everyone already has the camera: their phone.',
      ],
    },
    faq: [
      { q: 'How many photos do I get?', a: 'The host picks the roll: 5, 10, 16, 24 or 36 shots per person, or unlimited on paid events.' },
      { q: 'Does it record video?', a: 'No. Photos only, like a real disposable camera.' },
      { q: 'What does it cost?', a: PRICE },
    ],
    related: ['disposable-camera-app-for-trips', 'photo-booth-alternative'],
  },
  {
    slug: 'wedding-photo-ideas-for-guests',
    short: 'Wedding photo ideas for guests',
    title: 'Wedding photo ideas for guests: 12 shots to ask for | LEFT',
    description:
      '12 photo ideas to give your wedding guests, from the first dance to the after-party. Hand them out as missions so every guest has one.',
    eyebrow: 'Weddings',
    h1: ['Photo ideas', 'for your guests.'],
    lede: 'Give guests something to look for, and you get the photos your photographer can’t take.',
    photo: { src: weddingChampagne, alt: 'Champagne glasses being raised at a wedding', look: 'golden' },
    points: [
      { title: 'Hand them out as missions', text: 'LEFT gives each guest one to three, free. Nobody knows who got which.' },
      { title: 'Make some personal', text: '“Get Grandpa to show you his dance move” beats any list.' },
      { title: 'See them together', text: 'Each mission’s photo shows up in the album after the reveal.' },
    ],
    list: {
      title: '12 ideas',
      items: [
        'A photo with someone you have never met',
        'The couple, from where you’re sitting',
        'The oldest and youngest guest together',
        'Someone crying happy tears',
        'Your table, all of it, in one shot',
        'The best dance move of the night',
        'The shoes under the table',
        'The first person on the dance floor',
        'A toast, from behind the speaker',
        'The kitchen or the bar, mid-chaos',
        'Someone asleep before midnight',
        'The last people standing',
      ],
    },
    faq: [
      { q: 'How do missions work?', a: 'The host switches them on, edits the list, and every guest gets one to three when the event starts. Free on every event.' },
      { q: 'Do guests need the app?', a: JOIN },
      { q: 'What does it cost?', a: PRICE },
    ],
    related: ['qr-code-for-wedding-photos', 'bachelorette-party-camera'],
  },
];
