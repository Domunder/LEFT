/**
 * The "Lena & Tom" album as the hosted demo event holds it (K7WQ2HXD, filled
 * by seed-demo.mjs): the same 22 photos, in the order they were taken, graded
 * with the same golden look, written to src/assets/photos/lena-tom/ for the
 * store screenshots and the site's mocks. `NN-name.jpg` keeps the album's
 * order and who took each one.
 *
 *   node scripts/store-photos.mjs
 */
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { grade } from './lib/looks.mjs';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stock = path.join(web, '..', 'marketing', 'stock', 'wedding', 'couple-5');
const assets = path.join(web, 'src', 'assets', 'photos');
const out = path.join(assets, 'lena-tom');

/** The album in taken_at order, as the database returns it (photographer, source). */
const ALBUM = [
  ['Sara', '233k7Ojb2sU'],
  ['Sara', '4r7Dupk5PJo'],
  ['Jonas', '9dir4I7sPQk'],
  ['Mia', 'L27rR7WtM4A'],
  ['Mia', 'L4zdv_4j_nk'],
  ['Jonas', 'H2moddhpTSU'],
  ['Sara', '6OJDidyfsd4'],
  ['Sara', '997K7PrT3vo'],
  ['Jonas', 'K5LvizMO0Js'],
  ['Lukas', 'MI-kD5W0mG4'],
  ['Anna', 'ckZ7z1Oe3fo'],
  ['Lukas', 'MOuoQnpBAcY'],
  ['Mia', 'Lq1yLlIZHlo'],
  ['Anna', 'dgQRUaEh8ro'],
  ['Lukas', 'TWaGman8Quw'],
  ['Sara', 'wedding-toast'],
  ['Anna', 'iUDFiMsBQIY'],
  ['Jonas', 'wedding-champagne'],
  ['Mia', 'Lvu7bXRQAAg'],
  ['Mia', 'wedding-dance'],
  ['Lukas', 'c42cd7zGrAY'],
  ['Anna', 'lljv82wfEPs'],
];

const LONG_EDGE = 1800;
const fileOf = (id) =>
  /^[a-z]+-[a-z]+$/.test(id) ? path.join(assets, `${id}.jpg`) : path.join(stock, `alexander-mass-${id}-unsplash.jpg`);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const [index, [by, id]] of ALBUM.entries()) {
  const meta = await sharp(fileOf(id)).rotate().metadata();
  const scale = Math.min(1, LONG_EDGE / Math.max(meta.width, meta.height));
  const width = Math.round(meta.width * scale);
  const height = Math.round(meta.height * scale);
  const { data } = await sharp(fileOf(id))
    .rotate()
    .resize(width, height, { kernel: 'mitchell' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  grade(data, width, height, 'golden');
  const name = `${String(index + 1).padStart(2, '0')}-${by.toLowerCase()}.jpg`;
  await sharp(data, { raw: { width, height, channels: 3 } }).jpeg({ quality: 88 }).toFile(path.join(out, name));
  console.log(name, id);
}
