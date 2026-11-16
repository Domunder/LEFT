/**
 * Renders the store listings' pictures into ../store-assets/: the screenshots
 * for the App Store and Google Play, Play's feature graphic, the App Store's
 * header and search-result pictures and both icons.
 *
 *   npm run store
 *
 * It starts the dev server with the store pages switched on (STORE_ASSETS,
 * see astro.config.mjs), photographs src/store/Shot.astro with an installed
 * Chrome (CHROME_PATH overrides where it is looked for) and writes PNGs
 * without an alpha channel — App Store Connect refuses one.
 */
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

process.env.STORE_ASSETS = '1';
const { dev } = await import('astro');

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(web, '..', 'store-assets');
const icon = path.resolve(web, '..', 'mobile', 'assets', 'images', 'icon.png');
const BG = '#101010';

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

const NAMES = ['camera', 'film', 'join', 'developing', 'album', 'moments'];
/** Viewport in points and device pixels per point: width * scale is the file's size. */
const SETS = [
  { dir: 'ios/iphone-6.9', page: 'ios', width: 440, height: 956, scale: 3 }, // 1320x2868
  { dir: 'ios/iphone-6.5', page: 'ios', width: 414, height: 896, scale: 3 }, // 1242x2688
  { dir: 'android/phone', page: 'android', width: 360, height: 640, scale: 3 }, // 1080x1920
];

const server = await dev({ root: web, logLevel: 'error', devToolbar: { enabled: false }, server: { port: 4391 } });
const origin = `http://localhost:${server.address.port}`;
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });

async function capture(id, { width, height, scale }, file) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  await page.goto(`${origin}/store-shot/${id}/`, { waitUntil: 'networkidle0' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
  });
  const shot = await page.screenshot({ type: 'png' });
  await page.close();
  await mkdir(path.dirname(file), { recursive: true });
  const { width: w, height: h } = await sharp(shot).flatten({ background: BG }).removeAlpha().png().toFile(file);
  console.log(`${path.relative(out, file)}  ${w}x${h}`);
}

try {
  for (const set of SETS) {
    for (const [index, name] of NAMES.entries()) {
      await capture(`${set.page}-${index + 1}`, set, path.join(out, set.dir, `${index + 1}-${name}.png`));
    }
  }
  await capture('feature', { width: 512, height: 250, scale: 2 }, path.join(out, 'android', 'feature-graphic-1024x500.png'));
  // The App Store's product-page header and search-result picture.
  await capture('header', { width: 1920, height: 823, scale: 2 }, path.join(out, 'ios', 'header-3840x1646.png'));
  await capture('search', { width: 1920, height: 1280, scale: 2 }, path.join(out, 'ios', 'search-results-3840x2560.png'));

  for (const [file, size] of [['ios/app-icon-1024.png', 1024], ['android/icon-512.png', 512]]) {
    await sharp(icon).resize(size, size).flatten({ background: BG }).removeAlpha().png().toFile(path.join(out, file));
    console.log(`${file}  ${size}x${size}`);
  }
} finally {
  await browser.close();
  await server.stop();
}
process.exit(0);
