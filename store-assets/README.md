# Store assets

Everything the two store listings ask for as a picture. Generated — do not
edit by hand: `cd web && npm run store` renders them again from the website's
phone mocks (`web/src/store/Shot.astro`, `web/scripts/store-assets.mjs`).

| File | Size | Goes to |
|---|---|---|
| `ios/iphone-6.9/1…6-*.png` | 1320×2868 | App Store Connect → the version → iPhone 6.9" Display. Required. |
| `ios/iphone-6.5/1…6-*.png` | 1242×2688 | iPhone 6.5" Display. Optional — Apple scales the 6.9" set down without it. |
| `ios/app-icon-1024.png` | 1024×1024, no alpha | Only where a form asks for it (the listing's icon comes from the build). |
| `android/phone/1…6-*.png` | 1080×1920 | Play Console → Main store listing → Phone screenshots (2–8). |
| `android/feature-graphic-1024x500.png` | 1024×500 | Main store listing → Feature graphic. Required. |
| `android/icon-512.png` | 512×512 | Main store listing → App icon. Required. |

Upload the screenshots in their numbered order: camera, film, join,
developing, album, moments. Each shows a part of one screen, not the whole
phone. The texts for the listings are in `docs/LAUNCH.md` §10.

Not here, because the app does not need it: iPad screenshots (the app is
iPhone-only, `supportsTablet: false`), Play's tablet screenshots (optional),
a promo video.

## Before uploading

- **The screens are the website's HTML mocks, not captures of the app.** Both
  stores expect screenshots that show the app as it is (Apple 2.3.3). Compare
  each with the real screen on a device; where they differ, fix the mock in
  `web/src/components/Phone.astro` and render again.
- **The photos are the website's Unsplash pictures** (`web/CREDITS.md`).
  `docs/LAUNCH.md` §10 asks for own photos with the consent of the people in
  them. Swap the files in `web/src/assets/photos/` and render again.
- The Android set shows the same screens in a plain handset instead of the
  iPhone frame; the screens themselves are the iOS layout.
