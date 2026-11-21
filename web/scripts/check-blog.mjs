/**
 * The blog's gate: runs before every build (`npm run build`) and on its own
 * (`npm run check:blog`). Articles are written by an agent and published
 * without a human read (the user's decision, 2026-11-21), so everything that
 * can be checked by a machine is checked here and fails the build:
 *
 * - length, one article per keyword, a photo that exists
 * - every dollar amount is one of LEFT's real prices
 * - no competitor names (those facts live in src/compare.ts, with sources)
 * - no external links, and every internal link leads to a page that exists
 *
 * What a machine cannot check is in marketing/seo/README.md.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(web, 'src/content/blog');

const WORDS = { min: 700, max: 1600 };
/** site.ts → TIERS, plus left_small (marketing/CLAUDE.md). */
const PRICES = new Set(['9.99', '14.99', '19.99', '24.99']);
/** Names from src/compare.ts. "Once" and "Scene" are words, so only as "the Once app". */
const COMPETITORS = [
  /\bPOV\b/,
  /\bLense\b/,
  /\bGuestCam\b/i,
  /\bWedUploader\b/i,
  /\bKululu\b/i,
  /\bDispo\b/,
  /\bLapse\b/,
  /\b(Once|Scene)\s+(app|camera)\b/,
  /\bONCE\b/,
];
const STATIC_ROUTES = ['/', '/blog/', '/wedding/', '/missions/', '/use-cases/', '/compare/', '/terms/', '/privacy/'];

const slugsIn = (file, pattern) =>
  [...readFileSync(join(web, file), 'utf8').matchAll(pattern)].map((match) => match[1]);

const files = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.md')) : [];
const posts = files.map((name) => {
  const raw = readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  return { name, slug: name.slice(0, -3), front: match?.[1] ?? null, body: match?.[2] ?? '' };
});

const routes = new Set([
  ...STATIC_ROUTES,
  ...posts.map((post) => `/blog/${post.slug}/`),
  ...slugsIn('src/guides.ts', /^\s{4}slug: '([^']+)'/gm).map((slug) => `/${slug}/`),
  ...slugsIn('src/compare.ts', /^\s{2}slug: '([^']+)'/gm).map((slug) => `/compare/${slug}/`),
]);

const field = (front, key) => front.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1].trim().replace(/^['"]|['"]$/g, '');

const errors = [];
const keywords = new Map();

for (const post of posts) {
  const fail = (message) => errors.push(`${post.name}: ${message}`);

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(post.slug) || post.slug.length > 60) {
    fail('the file name must be kebab-case, at most 60 characters');
  }
  if (post.front === null) {
    fail('no front matter');
    continue;
  }

  const keyword = field(post.front, 'keyword')?.toLowerCase();
  if (keyword) {
    if (keywords.has(keyword)) fail(`keyword "${keyword}" is already used by ${keywords.get(keyword)}`);
    keywords.set(keyword, post.name);
  }

  const photo = field(post.front, 'photo');
  if (photo && !existsSync(join(web, 'src/assets/photos', `${photo}.jpg`))) {
    fail(`photo "${photo}" is not in src/assets/photos/`);
  }

  const words = post.body.split(/\s+/).filter(Boolean).length;
  if (words < WORDS.min || words > WORDS.max) fail(`${words} words (allowed: ${WORDS.min}–${WORDS.max})`);

  if (/^# /m.test(post.body)) fail('no "# " heading in the body: the title is the h1');
  if (!/^## /m.test(post.body)) fail('no "## " sections');

  // Front matter and body: the FAQ answers are published too.
  const text = `${post.front}\n${post.body}`;

  for (const [, amount] of text.matchAll(/(?:US)?\$\s?(\d+(?:[.,]\d+)?)/g)) {
    if (!PRICES.has(amount)) fail(`"$${amount}" is not one of LEFT's prices (${[...PRICES].join(', ')}) — no other dollar amounts`);
  }

  for (const pattern of COMPETITORS) {
    const hit = text.match(pattern);
    if (hit) fail(`names a competitor ("${hit[0]}"): comparisons belong in src/compare.ts`);
  }

  if (/https?:\/\//i.test(text)) fail('external links and URLs are not allowed');
  if (/<\s*(script|iframe|img|a)\b/i.test(post.body)) fail('no raw HTML');
  if (/!\[/.test(post.body)) fail('no images in the body (the cover is the only photo)');

  for (const [, href] of post.body.matchAll(/\]\(([^)\s]+)[^)]*\)/g)) {
    const path = href.split('#')[0];
    if (!path.startsWith('/')) fail(`link "${href}" must be a site path starting with /`);
    else if (!routes.has(path)) fail(`link "${href}" leads to no page (paths end with /)`);
  }
}

if (errors.length) {
  console.error(`check-blog: ${errors.length} problem(s)\n` + errors.map((line) => `  - ${line}`).join('\n'));
  process.exit(1);
}
console.log(`check-blog: ${posts.length} article(s) ok`);
