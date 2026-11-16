# LEFT — website (leftmoment.com)

Static site built with [Astro](https://astro.build), meant for Cloudflare Pages.
English only. No client framework: a small inline script (scroll reveal) and
the web camera at `/j/{CODE}` (`src/shoot/`, plain TypeScript).

```bash
cd web
npm install
npm run dev          # http://localhost:4321 (no /j/{CODE} rewrite here: use /j/?c=CODE)
npm run build        # → dist/
npm run preview:cf   # dist/ served like Cloudflare Pages, http://localhost:8788
npm run assets       # regenerate public/og*.jpg and the icons
```

## Pages

| URL | File | Notes |
|---|---|---|
| `/` | `src/pages/index.astro` | Home: hero, how it works, looks, album, use cases, pricing, FAQ |
| `/use-cases/` | `src/pages/use-cases.astro` | Weddings first, then parties, trips, birthdays, more |
| `/wedding/` | `src/pages/wedding.astro` | The wedding landing page, own FAQ |
| `/j/{CODE}` | `src/pages/j/index.astro` + `src/shoot/` | The invite **and the web camera**: a guest without the app joins, shoots their roll and later sees the album here. One page for every code via `public/_redirects` |
| `/terms/`, `/privacy/` | `src/components/LegalDocument.astro` | Rendered from `../mobile/src/constants/legal.ts` (the app's own source), which `scripts/sync-legal.mjs` copies to `src/generated/` before every dev, build and check. **Unreviewed draft**: `noindex` and a notice while `LEGAL_DRAFT` is true |
| `/.well-known/apple-app-site-association` | `public/.well-known/` | Universal links (iOS) |
| `/.well-known/assetlinks.json` | `public/.well-known/` | App links (Android) |

Copy that is not page-specific — prices, looks, the home FAQ, store links —
lives in `src/site.ts`. The app's tokens are in `src/styles/global.css`. The
phone mocks are HTML/CSS (`src/components/Phone.astro`), not screenshots, inside a
real iPhone 17 Pro frame from `@mockifydev/react` (a dev dependency: only its
frame PNG and geometry are used at build time).

## The web camera (`/j/{CODE}`)

A guest without the app shoots in the browser (decided 2026-11-16). It is the
app's guest half on the same server doors — nothing new in Supabase:

| Step | App | Web |
|---|---|---|
| Identity | anonymous sign-in, AsyncStorage | anonymous sign-in, localStorage |
| Join | `join_event()` | same |
| Look | SkSL (`lib/look-shader.ts`) | WebGL port (`src/shoot/look-gl.ts`), same recipes |
| Queue | `lib/upload-queue.ts`, files | `src/shoot/queue.ts`, IndexedDB |
| Shot | `claim_shot()` → upload → `mark_photo_uploaded()` | same |
| Reveal | RLS + clock | same; the page switches to the album at `ends_at` |

- **Env:** `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (`.env.example`), set on Cloudflare Pages too. Without them the page says the
  camera is not switched on.
- **`scripts/sync-legal.mjs` copies `looks.ts` and `database.ts` from the app**
  besides the legal texts, so the recipes stay one source. **The shader maths
  is duplicated**: change `look-shader.ts` and `look-gl.ts` together.
- **The camera needs https** (or localhost). On a phone against a dev
  machine, use a tunnel or the deployed preview.
- No push on the web: the developing screen offers a calendar reminder
  (`.ics`) and the page polls every 15 s.
- In-app browsers (Instagram, some WhatsApp versions) often block the
  camera; the page says to open the link in Safari or Chrome.
- A guest who clears the browser's data is a new member with a new roll
  (bounded by `max_members`; the CAPTCHA item covers it) and loses frames still
  in the queue.

## Placeholders to fill before launch

| What | Where | Needs |
|---|---|---|
| App Store / Play Store links | `src/site.ts` (`appStoreUrl`, `playStoreUrl`) | the store listings. Until then the buttons read "Coming soon". `/j/{CODE}` no longer forwards to a store: phones without the app shoot in the browser. |
| Apple Team ID | `public/.well-known/apple-app-site-association` (`REPLACE_WITH_APPLE_TEAM_ID`) | Apple Developer account → Membership |
| Android signing fingerprint | `public/.well-known/assetlinks.json` (`REPLACE_WITH_SHA256_SIGNING_CERT_FINGERPRINT`) | `eas credentials` (or Play Console → App signing) |
| Terms and Privacy | `../mobile/src/constants/legal.ts` | filled in and published 2026-11-16 (`LEGAL_DRAFT = false`) without a legal review — still worth having one |
| Contact address | `src/site.ts` (`contactEmail`) | set; not shown anywhere yet except in the legal texts |

## Deploying (once the domain exists)

Cloudflare Pages project with root directory `web`, build command
`npm run build`, output directory `dist`. `public/_redirects` and
`public/_headers` are Pages files: the first rewrites `/j/*` to the invite
page, the second serves the association file as JSON and caches `/_astro/*`.
After the first deploy, check:

- `https://leftmoment.com/.well-known/apple-app-site-association` answers 200,
  `application/json`, no redirect.
- Google's Digital Asset Links tester accepts `assetlinks.json`.
- A link `https://leftmoment.com/j/DEV123` opens the app on a phone that has it.

## Photos

See `CREDITS.md`. Unsplash refuses scripted downloads from `unsplash.com`
(bot check); the files were fetched from its image CDN.
