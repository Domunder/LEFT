/**
 * Downloads Unsplash photos into ../marketing/stock/{set}/ and logs each one
 * in ../marketing/stock/LICENSES.md.
 *
 *   npm run stock -- wedding-a https://unsplash.com/collections/AbC123/some-name
 *   npm run stock -- party https://unsplash.com/photos/some-slug-AbCdEfGhIjK …
 *
 * Takes collection links and single photo links, mixed. Needs
 * UNSPLASH_ACCESS_KEY in ../marketing/.env (gitignored).
 *
 * Unsplash's rules, followed here: every used photo triggers its
 * download_location; the photographer is credited (LICENSES.md); Unsplash+
 * photos are skipped (paid licence). Demo keys allow 50 API requests an hour:
 * one per 30 photos of a collection, one per single photo link, plus one per
 * download. Image files themselves do not count.
 */
import { existsSync, readFileSync } from 'node:fs';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const stock = path.join(root, 'marketing', 'stock');
const licences = path.join(stock, 'LICENSES.md');

const [set, ...links] = process.argv.slice(2);
if (!set || !links.length || !/^[a-z0-9-]+$/.test(set)) {
  throw new Error('Usage: npm run stock -- <set-name, e.g. wedding-a> <unsplash links…>');
}

const env = path.join(root, 'marketing', '.env');
const key = existsSync(env) && /^UNSPLASH_ACCESS_KEY=(.+)$/m.exec(readFileSync(env, 'utf8'))?.[1].trim();
if (!key) throw new Error('UNSPLASH_ACCESS_KEY is missing in marketing/.env');

let remaining = '?';
async function api(url) {
  const response = await fetch(url.startsWith('http') ? url : `https://api.unsplash.com${url}`, {
    headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
  });
  remaining = response.headers.get('x-ratelimit-remaining') ?? remaining;
  if (!response.ok) throw new Error(`Unsplash ${response.status} on ${url}: ${await response.text()}`);
  return response.json();
}

/** Every photo the links name, collections expanded. */
async function resolve(link) {
  const url = new URL(link);
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'collections' && parts[1]) {
    const photos = [];
    for (let page = 1; ; page += 1) {
      const batch = await api(`/collections/${parts[1]}/photos?per_page=30&page=${page}`);
      photos.push(...batch);
      if (batch.length < 30) return photos;
    }
  }
  if (parts[0] === 'photos' && parts[1]) return [await api(`/photos/${parts[1].slice(-11)}`)];
  throw new Error(`Not an Unsplash collection or photo link: ${link}`);
}

const logged = readFileSync(licences, 'utf8');
const dir = path.join(stock, set);
await mkdir(dir, { recursive: true });

let added = 0;
for (const link of links) {
  for (const photo of await resolve(link)) {
    if (photo.premium || photo.plus) {
      console.log(`skip  ${photo.id}  Unsplash+ (paid)`);
      continue;
    }
    const slug = (photo.slug ?? photo.id).replace(/[^a-z0-9-]/gi, '').slice(0, 60);
    const file = `${slug.endsWith(photo.id) ? slug : `${slug}-${photo.id}`}.jpg`;
    const relative = `${set}/${file}`;
    if (logged.includes(`\`${relative}\``) && existsSync(path.join(dir, file))) {
      console.log(`have  ${relative}`);
      continue;
    }
    // Unsplash's rule: tell it the photo is being used.
    await api(photo.links.download_location);
    const image = await fetch(`${photo.urls.raw}&w=2400&fm=jpg&q=88`);
    if (!image.ok) throw new Error(`Image ${photo.id}: ${image.status}`);
    const bytes = Buffer.from(await image.arrayBuffer());
    await writeFile(path.join(dir, file), bytes);
    const { width, height } = await sharp(bytes).metadata();
    const author = `[${photo.user.name.replace(/\|/g, '/')}](${photo.user.links.html})`;
    await appendFile(
      licences,
      `| \`${relative}\` | ${photo.links.html} | ${author} | Unsplash License | ${set} | ${new Date().toISOString().slice(0, 10)} |\n`,
    );
    added += 1;
    console.log(`got   ${relative}  ${width}x${height}  ${photo.user.name}`);
  }
}
console.log(`${added} new photo(s) in marketing/stock/${set}/ · ${remaining} API requests left this hour`);
