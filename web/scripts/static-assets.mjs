/**
 * Generates the files in public/ that are derived from other assets: the
 * social cards (1200x630) and the icons. Run with `npm run assets` after
 * changing a hero photo or the app icon; the results are committed.
 */
import sharp from 'sharp';

const photos = new URL('../src/assets/photos/', import.meta.url);
const out = new URL('../public/', import.meta.url);
const icon = new URL('../../mobile/assets/images/icon.png', import.meta.url);

const cards = [
  { file: 'og.jpg', photo: 'wedding-crowd.jpg', lines: ['One roll each.', 'Developed together.'] },
  { file: 'og-use-cases.jpg', photo: 'party-flash.jpg', lines: ['For the days', 'you want back.'] },
  { file: 'og-wedding.jpg', photo: 'wedding-friends.jpg', lines: ['Your wedding, through', 'every guest’s eyes.'] },
];

const overlay = ([first, second]) => `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#060608" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#060608" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#shade)"/>
  <text x="72" y="100" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="3" fill="#f0ede8">LEFT</text>
  <text x="72" y="452" font-family="Georgia, 'Times New Roman', serif" font-size="78" fill="#f0ede8">${first}</text>
  <text x="72" y="544" font-family="Georgia, 'Times New Roman', serif" font-size="78" font-style="italic" fill="#f0ede8">${second}</text>
</svg>`;

for (const card of cards) {
  await sharp(new URL(card.photo, photos).pathname.replace(/^\/(\w:)/, '$1'))
    .resize(1200, 630, { fit: 'cover', position: 'attention' })
    .modulate({ saturation: 0.9 })
    .composite([{ input: Buffer.from(overlay(card.lines)) }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(new URL(card.file, out).pathname.replace(/^\/(\w:)/, '$1'));
}

const iconPath = decodeURIComponent(icon.pathname.replace(/^\/(\w:)/, '$1'));
const outPath = (name) => decodeURIComponent(new URL(name, out).pathname.replace(/^\/(\w:)/, '$1'));
await sharp(iconPath).resize(180, 180).png().toFile(outPath('apple-touch-icon.png'));
await sharp(iconPath).resize(64, 64).png().toFile(outPath('favicon.png'));
console.log('public/ assets written');
