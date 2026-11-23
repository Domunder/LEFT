/**
 * Fills demo events on the hosted project with guests and photos, through the
 * same doors the app uses: anonymous sign-in → join_event → claim_shot →
 * upload original + thumbnail → mark_photo_uploaded. Each photo is graded
 * with the event's look (lib/looks.mjs, the app's own recipes).
 *
 *   SUPABASE_URL=… SUPABASE_KEY=<publishable key> node scripts/seed-demo.mjs [CODE …]
 *
 * With codes, only those events are filled. `LEFTDEMPLATE` is the template of
 * the website's demo (supabase/migrations/20261123010000_demo.sql): the
 * migration creates it empty and with room for exactly these four guests, so
 * a second run is refused with "full" instead of doubling the photos.
 *
 * The events themselves are created (and later developed and back-dated) in
 * SQL by whoever runs this; this script only plays the guests. Photos are the
 * licensed stock in marketing/stock/ and src/assets/photos/
 * (marketing/stock/LICENSES.md, web/CREDITS.md).
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { encode } from 'blurhash';
import { grade } from './lib/looks.mjs';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stock = path.join(web, '..', 'marketing', 'stock');
const assets = path.join(web, 'src', 'assets', 'photos');
const { SUPABASE_URL, SUPABASE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Set SUPABASE_URL and SUPABASE_KEY (publishable).');

const couple5 = (id) => path.join(stock, 'wedding', 'couple-5', `alexander-mass-${id}-unsplash.jpg`);
const asset = (name) => path.join(assets, `${name}.jpg`);

/** Each guest's photos, in the order they were taken, with the hour taken. */
const EVENTS = [
  {
    code: 'LEFTDEMPLATE',
    look: 'golden',
    day: '2026-11-21',
    guests: {
      Lea: [['dinner-table', 20], ['birthday-candle', 21], ['party-toast', 22]],
      Ben: [['dinner-candle', 20], ['party-wine', 21], ['party-confetti', 23]],
      Noah: [['friends-laugh', 21], ['party-flash', 23]],
      Emma: [['party-dance', 23], ['party-floor', 24]],
    },
  },
  {
    code: 'K7WQ2HXD',
    look: 'golden',
    day: '2026-09-19',
    guests: {
      Sara: [['233k7Ojb2sU', 15], ['4r7Dupk5PJo', 15], ['6OJDidyfsd4', 16], ['997K7PrT3vo', 17], ['wedding-toast', 19]],
      Jonas: [['9dir4I7sPQk', 15], ['H2moddhpTSU', 16], ['K5LvizMO0Js', 17], ['wedding-champagne', 20]],
      Mia: [['L27rR7WtM4A', 16], ['L4zdv_4j_nk', 16], ['Lq1yLlIZHlo', 18], ['Lvu7bXRQAAg', 21], ['wedding-dance', 22]],
      Lukas: [['MI-kD5W0mG4', 17], ['MOuoQnpBAcY', 18], ['TWaGman8Quw', 19], ['c42cd7zGrAY', 22]],
      Anna: [['ckZ7z1Oe3fo', 17], ['dgQRUaEh8ro', 18], ['iUDFiMsBQIY', 20], ['lljv82wfEPs', 23]],
    },
  },
  {
    code: 'B3PZRM8A',
    look: 'faded',
    day: '2026-10-17',
    guests: {
      Lea: [['dinner-table', 20], ['birthday-candle', 21], ['party-toast', 22]],
      Ben: [['dinner-candle', 20], ['party-wine', 21], ['party-confetti', 23]],
      Noah: [['friends-laugh', 21], ['party-flash', 23]],
      Emma: [['party-dance', 23], ['party-floor', 24]],
    },
  },
  {
    code: 'T9LXWV4C',
    look: 'chrome',
    day: '2026-10-31',
    guests: {
      Elias: [['trip-van', 10], ['trip-car', 12]],
      Nora: [['trip-trunk', 11], ['trip-surf', 15]],
      Finn: [['trip-friends', 14], ['trip-sunset', 18]],
    },
  },
];

const fileOf = (id) => (/^[a-z]+-[a-z]+$/.test(id) ? asset(id) : couple5(id));

/** Original (long edge ≤ 3600, JPEG 90) and thumbnail (1080, JPEG 78), graded. */
async function develop(file, look) {
  const meta = await sharp(file).rotate().metadata();
  const scale = Math.min(1, 3600 / Math.max(meta.width, meta.height));
  const width = Math.round(meta.width * scale);
  const height = Math.round(meta.height * scale);
  const { data } = await sharp(file).rotate().resize(width, height, { kernel: 'mitchell' }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  grade(data, width, height, look);
  const raw = { raw: { width, height, channels: 3 } };
  const original = await sharp(data, raw).jpeg({ quality: 90 }).toBuffer();
  const thumb = await sharp(data, raw).resize(1080, 1080, { fit: 'inside', kernel: 'mitchell' }).jpeg({ quality: 78 }).toBuffer();
  // The smudge others see before the reveal, as the devices compute it.
  const small = await sharp(thumb).resize(32, 32, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(small.data), small.info.width, small.info.height, 4, 3);
  return { original, thumb, width, height, blurhash };
}

function must({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message ?? JSON.stringify(error)}`);
  return data;
}

const only = process.argv.slice(2).map((code) => code.toUpperCase());
for (const event of EVENTS.filter((e) => only.length === 0 || only.includes(e.code))) {
  for (const [name, shots] of Object.entries(event.guests)) {
    // GUESTS=Emma,Noah finishes a run that stopped halfway.
    if (process.env.GUESTS && !process.env.GUESTS.split(',').includes(name)) continue;
    const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
    const { user } = must(await db.auth.signInAnonymously(), `${name}: sign-in`);
    const eventId = must(await db.rpc('join_event', { p_invite_code: event.code, p_display_name: name }), `${name}: join`);
    for (const [id, hour] of shots) {
      const photoId = randomUUID();
      const minute = Math.floor(Math.random() * 60);
      const takenAt = new Date(`${event.day}T${String(hour % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+02:00`);
      if (hour >= 24) takenAt.setUTCDate(takenAt.getUTCDate() + 1);
      const { original, thumb, width, height, blurhash } = await develop(fileOf(id), event.look);
      must(await db.rpc('claim_shot', { p_event_id: eventId, p_photo_id: photoId, p_taken_at: takenAt.toISOString() }), `${name}: claim`);
      const base = `${eventId}/${user.id}/${photoId}`;
      for (const [p, body] of [[`${base}.jpg`, original], [`${base}_thumb.jpg`, thumb]]) {
        must(await db.storage.from('photos').upload(p, body, { contentType: 'image/jpeg', upsert: true }), `${name}: upload`);
      }
      must(await db.rpc('mark_photo_uploaded', { p_photo_id: photoId, p_width: width, p_height: height, p_blurhash: blurhash }), `${name}: mark`);
      console.log(`  ${event.code} ${name}: ${id}`);
    }
  }
}
console.log('done');
