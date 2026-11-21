# Store assets

Everything the two store listings ask for as a picture. Generated — do not
edit by hand: `cd web && npm run store` renders them again from the website's
phone mocks (`web/src/store/Shot.astro`, `web/scripts/store-assets.mjs`).

| File | Size | Goes to |
|---|---|---|
| `ios/iphone-6.9/1…8-*.png` | 1320×2868 | App Store Connect → the version → iPhone 6.9" Display. Required. |
| `ios/iphone-6.5/1…8-*.png` | 1242×2688 | iPhone 6.5" Display. Optional — Apple scales the 6.9" set down without it. |
| `ios/header-3840x1646.png` | 3840×1646 | The version → Header and Search Results → Header. Optional. |
| `ios/search-results-3840x2560.png` | 3840×2560 | Header and Search Results → Search Results. Optional — without it the screenshots are shown. |
| `ios/app-clip-header-1800x1200.png` | 1800×1200 (Apple's required size) | The version → App Clip → Header Image. The card a guest sees after scanning an invite; no text in the image (Apple's rule — the card prints the subtitle and the button). |
| `ios/app-icon-1024.png` | 1024×1024, no alpha | Only where a form asks for it (the listing's icon comes from the build). |
| `android/phone/1…8-*.png` | 1080×1920 | Play Console → Main store listing → Phone screenshots (2–8). |
| `android/feature-graphic-1024x500.png` | 1024×500 | Main store listing → Feature graphic. Required. |
| `android/icon-512.png` | 512×512 | Main store listing → App icon. Required. |

Upload the screenshots in their numbered order: camera, missions, album,
mission-photo (a print in the viewer with its mission), invite, film,
developing, moments (2026-11-18; the name screen is no longer shown). Each is a
composition under the headline (2026-11-19): a phone tilted a few degrees,
sometimes a second one behind it, and prints floating beside or above it —
placed in `SHOTS` in `Shot.astro`. The texts for the listings are in `docs/LAUNCH.md` §10.

Not here, because the app does not need it: iPad screenshots (the app is
iPhone-only, `supportsTablet: false`), Play's tablet screenshots (optional),
a promo video.

## Before uploading

- **The screens are the website's HTML mocks, not captures of the app.** Both
  stores expect screenshots that show the app as it is (Apple 2.3.3). Compare
  each with the real screen on a device; where they differ, fix the mock in
  `web/src/components/Phone.astro` and render again.
- **The album, Moments and the invite show "Lena & Tom"** (2026-11-21), the
  demo wedding on the hosted project (invite `K7WQ2HXD`): the same 22 photos
  in the album's order, graded with its golden look by
  `node web/scripts/store-photos.mjs` into `web/src/assets/photos/lena-tom/`
  (list in `web/src/store/lena-tom.ts`). Each screen's header uses a
  different photo of the couple; in the app one event image heads all three
  — on the hosted event that is the kiss on the hill (album photo 5, set
  2026-11-21 at `photos/{event}/cover.jpg`).
- **The photos are the website's Unsplash pictures** (`web/CREDITS.md`).
  `docs/LAUNCH.md` §10 asks for own photos with the consent of the people in
  them. Swap the files in `web/src/assets/photos/` and render again.
- The Android set and the feature graphic use an Android handset drawn in CSS
  (the mock library only has iPhones) with Android's status bar; the screens
  themselves are the same layouts as on iOS.
- No photo appears twice across a set of eight, except where a print echoes
  its own phone (the film picker's looks, Moments' strips); every moment on
  the Moments screen has a full strip.
