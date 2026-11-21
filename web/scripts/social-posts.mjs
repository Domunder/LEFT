/**
 * Renders the social posts of one folder in ../marketing/posts/ into
 * ../marketing/queue/: per post the finished slides for TikTok (1080x1920) and
 * Instagram (1080x1350) and a caption.txt to paste.
 *
 *   npm run social              # posts/pilot
 *   npm run social -- 2026-W48  # posts/2026-W48
 *   SOCIAL_ONLY=weddings-1 npm run social
 *
 * A post is a Markdown file (written by the content-writer agent) whose
 * "## Slides" section is a list:
 *
 *   - photo: wedding-night.jpg     a file in marketing/stock/ or web/src/assets/photos/
 *     text: Plain words. *Italic emphasis.*
 *     hook: true                   larger type (slide 1)
 *     mark: true                   the LEFT wordmark under the text (single-image posts)
 *     focus: 0.4                   horizontal centre of the crop, 0–1 (default 0.5)
 *   - screen: android/phone/1-camera.png   a picture from store-assets/, shown whole;
 *     text: …                      with text: the headline is cut off and the text sits above the phone
 *   - brand: true                  the dark closing slide
 *     text: …
 *     kicker: leftmoment.com
 *
 * Photos are graded here with the app's look recipes — a JavaScript port of
 * the SkSL in mobile/src/lib/look-shader.ts (the fifth place its maths lives;
 * change it there first). The text is laid out by an installed Chrome
 * (CHROME_PATH overrides where it is looked for), like store-assets.mjs.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(web, '..');
const folder = process.argv[2] ?? 'pilot';
const postsDir = path.join(root, 'marketing', 'posts', folder);
const outDir = path.join(root, 'marketing', 'queue', folder);
const ONLY = process.env.SOCIAL_ONLY;

const BG = '#101010';
const INK = '#f0ede8';
/** Safe area in pixels (marketing/CLAUDE.md → Visual rules). */
const SAFE = { top: 120, bottom: 320, side: 60 };
const SIZES = [
  { dir: 'tiktok', width: 1080, height: 1920, bottom: SAFE.bottom },
  { dir: 'instagram', width: 1080, height: 1350, bottom: 150 },
];

const chrome = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((candidate) => candidate && existsSync(candidate));
if (!chrome) throw new Error('No Chrome found. Set CHROME_PATH to a Chrome or Edge executable.');

// ── The looks, read from the app's own file ────────────────────────────────

/** LOOK_RECIPES, LENS and GRAIN_CELLS out of mobile/src/constants/looks.ts. */
function readLooks() {
  const source = readFileSync(path.join(root, 'mobile', 'src', 'constants', 'looks.ts'), 'utf8');
  const literal = (name) => {
    const start = source.indexOf(`export const ${name}`);
    const open = source.indexOf('{', source.indexOf('=', start));
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      if (source[i] === '}') depth -= 1;
      if (depth === 0) return new Function(`return (${source.slice(open, i + 1)})`)();
    }
    throw new Error(`${name} not found in looks.ts`);
  };
  const cells = Number(/export const GRAIN_CELLS = (\d+)/.exec(source)?.[1]);
  if (!cells) throw new Error('GRAIN_CELLS not found in looks.ts');
  return { recipes: literal('LOOK_RECIPES'), fringe: literal('LENS').fringe, cells };
}
const LOOKS = readLooks();

const fract = (x) => x - Math.floor(x);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function hash(px, py) {
  let x = fract(px * 0.1031);
  let y = fract(py * 0.1031);
  let z = fract(px * 0.1031);
  const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
  x += d;
  y += d;
  z += d;
  return fract((x + y) * z);
}

/** The look shader over an RGB buffer of `width` x `height`, in place. */
function grade(pixels, width, height, look) {
  const r = LOOKS.recipes[look];
  if (!r) throw new Error(`Unknown look "${look}"`);
  const src = Buffer.from(pixels);
  const cell = Math.max(width, height) / LOOKS.cells;
  // One channel of the source at a fractional position, bilinear, clamped.
  const sample = (x, y, channel) => {
    const cx = Math.min(width - 1, Math.max(0, x));
    const cy = Math.min(height - 1, Math.max(0, y));
    const x0 = Math.floor(cx);
    const y0 = Math.floor(cy);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const fx = cx - x0;
    const fy = cy - y0;
    const at = (xx, yy) => src[(yy * width + xx) * 3 + channel];
    return (at(x0, y0) * (1 - fx) + at(x1, y0) * fx) * (1 - fy) + (at(x0, y1) * (1 - fx) + at(x1, y1) * fx) * fy;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      const ox = (x - width / 2) * LOOKS.fringe;
      const oy = (y - height / 2) * LOOKS.fringe;
      let c = [sample(x + ox, y + oy, 0) / 255, src[i + 1] / 255, sample(x - ox, y - oy, 2) / 255];

      const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      c = c.map((v, k) => ((l + (v - l) * r.saturation) * r.gain[k] - 0.5) * r.contrast + 0.5);

      const tone = Math.min(1, Math.max(0, 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]));
      const u = x / width - 0.5;
      const v = y / height - 0.5;
      const vignette = 1 - r.vignette * smoothstep(0.1, 0.5, u * u + v * v);
      const noise = (hash(Math.floor(x / cell), Math.floor(y / cell)) - 0.5) * r.grain * (1 - 0.6 * tone);
      for (let k = 0; k < 3; k += 1) {
        let value = c[k] + r.shadowTint[k] * (1 - tone) * (1 - tone) + r.highlightTint[k] * tone * tone;
        value = (r.fade + value * (1 - r.fade)) * vignette + noise;
        pixels[i + k] = Math.round(Math.min(1, Math.max(0, value)) * 255);
      }
    }
  }
}

/** A photo cropped to the slide's shape and graded, as a data URL. */
async function developed(file, look, { width, height }, focus) {
  const meta = await sharp(file).rotate().metadata();
  const scale = Math.max(width / meta.width, height / meta.height);
  const scaledW = Math.max(width, Math.round(meta.width * scale));
  const scaledH = Math.max(height, Math.round(meta.height * scale));
  const left = Math.round(Math.min(scaledW - width, Math.max(0, scaledW * focus - width / 2)));
  const top = Math.round((scaledH - height) / 2);
  const { data } = await sharp(file)
    .rotate()
    .resize(scaledW, scaledH, { kernel: 'mitchell' })
    .extract({ left, top, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  grade(data, width, height, look);
  const jpeg = await sharp(data, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

/**
 * A store screenshot without its headline (the top 18.5 %), as a data URL:
 * the phone and prints stay, the slide's own text takes the headline's place.
 */
async function withoutHeadline(file) {
  const { width, height } = await sharp(file).metadata();
  const top = Math.round(height * 0.185);
  const png = await sharp(file).extract({ left: 0, top, width, height: height - top }).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

// ── Post files ─────────────────────────────────────────────────────────────

function parsePost(file) {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const front = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!front) throw new Error(`${file}: no front matter`);
  const meta = Object.fromEntries(
    front[1].split('\n').map((line) => {
      const at = line.indexOf(':');
      return [line.slice(0, at).trim(), line.slice(at + 1).replace(/#.*$/, '').trim()];
    }),
  );
  const section = (name) => new RegExp(`^## ${name}\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm').exec(text)?.[1].trim() ?? '';
  const slides = [];
  for (const line of section('Slides').split('\n')) {
    const entry = /^(- |  )([a-z_]+):\s*(.*)$/.exec(line);
    if (!entry) continue;
    if (entry[1] === '- ') slides.push({});
    if (!slides.length) throw new Error(`${file}: a slide must start with "- "`);
    slides[slides.length - 1][entry[2]] = entry[3].trim();
  }
  if (!slides.length) throw new Error(`${file}: no slides`);
  const caption = [
    section('Caption').replace(/^### /gm, '— ').trim(),
    `— Hashtags\n${section('Hashtags')}`,
    `— Sound (pick in the app)\n${section('Sound')}`,
  ].join('\n\n');
  return { meta, slides, caption };
}

function findPhoto(name) {
  const candidates = [path.join(root, 'marketing', 'stock', name), path.join(web, 'src', 'assets', 'photos', name)];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`Photo "${name}" is neither in marketing/stock/ nor in web/src/assets/photos/`);
  return found;
}

// ── Layout ─────────────────────────────────────────────────────────────────

const font = (pkg, file) => pathToFileURL(path.join(web, 'node_modules', pkg, 'files', file)).href;
const escape = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** Escaped text with *emphasis* as italics. */
const rich = (value) => escape(value).replace(/\*([^*]+)\*/g, '<em>$1</em>');

function page(slide, size, image) {
  const hook = slide.hook === 'true';
  const type = slide.brand ? 92 : hook ? 88 : 72;
  const body = slide.screen && slide.text
    ? `<div class="top"><p class="text">${rich(slide.text)}</p></div>
       <div class="phone"><img src="${image}"></div>`
    : slide.screen
    ? `<img class="screen" src="${image}">`
    : slide.brand
      ? `<div class="glow"></div>
         <div class="brand"><p class="text">${rich(slide.text ?? '')}</p>
         <p class="kicker">${escape(slide.kicker ?? '')}<span>by LEFT</span></p></div>`
      : `<img class="photo" src="${image}"><div class="scrim"></div>
         <div class="copy"><p class="text">${rich(slide.text ?? '')}</p>
         ${slide.mark === 'true' ? '<p class="mark">LEFT<span>a disposable camera for your night</span></p>' : ''}</div>`;
  return `<!doctype html><meta charset="utf-8"><style>
    @font-face { font-family: Newsreader; font-weight: 200 800; src: url("${font('@fontsource-variable/newsreader', 'newsreader-latin-wght-normal.woff2')}"); }
    @font-face { font-family: Newsreader; font-style: italic; font-weight: 200 800; src: url("${font('@fontsource-variable/newsreader', 'newsreader-latin-wght-italic.woff2')}"); }
    @font-face { font-family: Inter; font-weight: 100 900; src: url("${font('@fontsource-variable/inter', 'inter-latin-wght-normal.woff2')}"); }
    * { margin: 0; box-sizing: border-box; }
    body { width: ${size.width}px; height: ${size.height}px; background: ${BG}; color: ${INK}; overflow: hidden; position: relative; }
    .photo, .scrim, .glow { position: absolute; inset: 0; width: 100%; height: 100%; }
    .scrim { background: linear-gradient(to top, rgba(16,16,16,.86) 0%, rgba(16,16,16,.62) 28%, rgba(16,16,16,0) 62%); }
    .screen { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
    .copy { position: absolute; left: ${SAFE.side + 12}px; right: ${SAFE.side + 12}px; bottom: ${size.bottom + 20}px; }
    .text { font: 500 ${type}px/1.1 Newsreader, serif; letter-spacing: -0.015em; text-wrap: balance; text-shadow: 0 2px 24px rgba(0,0,0,.45); }
    .text em { font-style: italic; font-weight: 400; }
    .mark, .kicker { font: 600 30px/1 Inter, sans-serif; letter-spacing: .22em; text-transform: uppercase; margin-top: 44px; opacity: .92; }
    .mark span, .kicker span { letter-spacing: .04em; text-transform: none; font-weight: 400; opacity: .7; margin-left: 20px; }
    .glow { background: radial-gradient(ellipse 70% 42% at 50% 34%, rgba(214,170,120,.28), rgba(16,16,16,0) 70%); }
    .brand { position: absolute; left: ${SAFE.side + 12}px; right: ${SAFE.side + 12}px; top: 50%; transform: translateY(-50%); text-align: center; }
    .brand .kicker { margin-top: 64px; }
    .top { position: absolute; left: ${SAFE.side + 12}px; right: ${SAFE.side + 12}px; top: ${SAFE.top + 30}px; text-align: center; }
    .top .text { font-size: 72px; }
    .phone { position: absolute; left: 0; right: 0; top: ${Math.round(size.height * 0.22)}px; bottom: 0; }
    .phone img { width: 100%; height: 100%; object-fit: contain; object-position: center bottom;
      -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 18%); mask-image: linear-gradient(to bottom, transparent 0%, black 18%); }
  </style>${body}`;
}

// ── Run ────────────────────────────────────────────────────────────────────

if (!existsSync(postsDir)) throw new Error(`No posts in ${postsDir}`);
const files = readdirSync(postsDir).filter((name) => name.endsWith('.md') && name !== 'README.md').sort();
const scratch = path.join(os.tmpdir(), `left-social-${process.pid}`);
await mkdir(scratch, { recursive: true });
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });

try {
  for (const name of files) {
    const id = name.replace(/\.md$/, '');
    if (ONLY && id !== ONLY) continue;
    const post = parsePost(path.join(postsDir, name));
    const target = path.join(outDir, id);
    await rm(target, { recursive: true, force: true });
    for (const size of SIZES) {
      await mkdir(path.join(target, size.dir), { recursive: true });
      for (const [index, slide] of post.slides.entries()) {
        let image = '';
        if (slide.photo) image = await developed(findPhoto(slide.photo), post.meta.look, size, Number(slide.focus ?? 0.5));
        if (slide.screen && slide.text) image = await withoutHeadline(path.join(root, 'store-assets', slide.screen));
        else if (slide.screen) image = pathToFileURL(path.join(root, 'store-assets', slide.screen)).href;
        const html = path.join(scratch, 'slide.html');
        await writeFile(html, page(slide, size, image));
        const tab = await browser.newPage();
        await tab.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
        await tab.goto(pathToFileURL(html).href, { waitUntil: 'load' });
        await tab.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
        });
        const shot = await tab.screenshot({ type: 'png' });
        await tab.close();
        await sharp(shot).flatten({ background: BG }).jpeg({ quality: 92 }).toFile(path.join(target, size.dir, `${index + 1}.jpg`));
      }
    }
    await writeFile(path.join(target, 'caption.txt'), `${post.meta.account} · day ${post.meta.day}\n\n${post.caption}\n`);
    console.log(`${id}  ${post.slides.length} slide(s)`);
  }
} finally {
  await browser.close();
  await rm(scratch, { recursive: true, force: true });
}
