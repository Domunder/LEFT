# LEFT — website (leftmoment.com)

Static site built with [Astro](https://astro.build), meant for Cloudflare Pages.
English only. No client framework; two small inline scripts (scroll reveal, the
invite page).

```bash
cd web
npm install
npm run dev          # http://localhost:4321 (no /j/{CODE} rewrite here)
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
| `/j/{CODE}` | `src/pages/j/index.astro` | Invite landing; one page for every code via `public/_redirects` |
| `/terms/`, `/privacy/` | `src/components/LegalDocument.astro` | Rendered from `../mobile/src/constants/legal.ts` (the app's own source). **Unreviewed draft**: `noindex` and a notice while `LEGAL_DRAFT` is true |
| `/.well-known/apple-app-site-association` | `public/.well-known/` | Universal links (iOS) |
| `/.well-known/assetlinks.json` | `public/.well-known/` | App links (Android) |

Copy that is not page-specific — prices, looks, the home FAQ, store links —
lives in `src/site.ts`. The app's tokens are in `src/styles/global.css`. The
phone mocks are HTML/CSS (`src/components/Phone.astro`), not screenshots.

## Placeholders to fill before launch

| What | Where | Needs |
|---|---|---|
| App Store / Play Store links | `src/site.ts` (`appStoreUrl`, `playStoreUrl`) | the store listings. Until then the buttons read "Coming soon" and `/j/{CODE}` does not forward to a store. |
| Apple Team ID | `public/.well-known/apple-app-site-association` (`REPLACE_WITH_APPLE_TEAM_ID`) | Apple Developer account → Membership |
| Android signing fingerprint | `public/.well-known/assetlinks.json` (`REPLACE_WITH_SHA256_SIGNING_CERT_FINGERPRINT`) | `eas credentials` (or Play Console → App signing) |
| Terms and Privacy | `../mobile/src/constants/legal.ts` | legal review and the `[BRACKETED]` values; then set `LEGAL_DRAFT = false` (drops the notice and `noindex`) and remove the two entries from `UNLISTED` (`astro.config.mjs`) |
| Contact address | `src/site.ts` (`contactEmail`) | not shown anywhere yet |

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
