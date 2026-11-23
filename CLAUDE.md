@AGENTS.md

# LEFT — project guide

A disposable camera for events — weddings, parties, trips. Guests join by link or
QR with no sign-up, each gets a **limited roll of photos** ("17 left"), every
picture gets an analog look, and nothing is visible until the event ends and the
group's film is **developed** together.

**Photos only.** No video capture, no microphone, no video storage — that is a
product decision (the retro feel) and a cost decision (storage). Do not add it.

**Positioning:** the same idea as the app ONCE, far cheaper. The low price is the
acquisition lever; revenue comes later from physical products (Phase 2).

## Where the project stands

LEFT was a group-*video* app (one shared time budget, clips played back to back).
It is being reframed. **Read `docs/MILESTONES.md` first** — it is the plan.

- **Done (M0):** all video capture, playback, budget UI and the Live Activity are
  deleted.
- **Done (M1):** one baseline migration (`supabase/migrations/`) with rolls,
  photos, the reveal in RLS and the pricing (four tiers since
  `20261115010000_price_tiers.sql`); regenerated types; `lib/photos.ts`,
  `lib/storage.ts`, `lib/roll.ts`, `lib/tiers.ts`; onboarding 03 is the film/look
  picker and 05.1 picks group and roll. Verified against a local stack with SQL
  (roll, idempotent claim, reveal, storage policies, paid path).
- **Done (M2), run on a device (2026-11-15, by the user — "everything
  worked"):** the look pipeline (one Skia shader,
  `lib/look-shader.ts`), real look previews on 03, the camera
  (`(capture)/camera`) and the durable upload queue (`lib/upload-queue.ts`).
  The viewfinder is `components/ui/film-camera.tsx` (rewritten after a crash
  with `SkiaCamera`). Not individually confirmed by that test: the LED flash
  actually firing, the memory gauge staying flat, landscape photos, app-kill
  and no-signal behaviour.
- **Done (2026-11-15), built and run on an iPhone: the upgrade to Expo SDK 58**
  (RN 0.88, React 19.3, Reanimated 4.7, Worklets 0.13, Gesture Handler 3,
  Skia 2.14). Android has not been built.
- **Done (M3), run on a device (2026-11-15):** the album (`(library)/album/[id]`) with
  its "developing" state and the reveal, the shared `PhotoViewer`, save /
  share / moderation / "develop now", the library with real covers, and
  the `Glass` primitive (Liquid Glass on iOS 26+). See "Album, viewer and
  glass (M3)" below.
- **Done (2026-11-15), not run on a device: glass and motion in the remaining
  screens** — the camera's controls are glass (outside the viewfinder again
  since 2026-11-16), buttons give on press-in (`PressScale`), sheets drag (`SheetDrag`), the toast and
  10's chips move on springs. JS only, no new build. See "Album, viewer and
  glass (M3)" and the camera section.
- **Done (M4, 2026-11-16), verified against the local stack, never on a
  device:** push notifications — "developed" and a reminder an hour before the
  end. See "Notifications (M4)" below. **Needs a new native build**
  (`expo-notifications`, `expo-sharing`).
- **Done (M6 parts, 2026-11-16):** the 6-month retention purge (verified
  locally), legal texts rewritten for photos (an **unreviewed draft**), usage
  statistics and error reports behind an env key, cleanup. What is left needs
  accounts, a domain or a device — `docs/LAUNCH.md` is the ordered runbook.
- **Done (2026-11-16), server half verified against the local stack over
  HTTP, client half not run on a device: the security review.** See "Security
  review (2026-11-16)" below. **`linkIdentity` was rewritten and has never run
  on a device.**
- **Built (2026-11-16), branch `feature/web-camera`, run against the local
  stack in a desktop browser with a synthetic camera — never on a phone: the
  web camera.** See "The web camera" below.
- **Built (2026-11-16), same branch, first compiled on EAS 2026-11-18 (in
  TestFlight), never run on a device: the App Clip.** A SwiftUI target that a scanned
  invite opens without installing the app. See "The App Clip" below. **Needs
  a new native build** (the clip, the App Group, `@bacons/apple-targets`).
- **In progress (2026-11-17, merged into `feature/web-camera`): missions.** Server
  verified against the local stack with SQL; the migration is on the hosted
  project since 2026-11-18; screens built (typecheck and
  lint clean), **never run on a device**; the mission notifications are not
  built. See "Missions" below.
- **Built (2026-11-21): the SEO blog** — `leftmoment.com/blog/`, Markdown
  articles in `web/src/content/blog/`, two a week from the backlog in
  `marketing/seo/keywords.md`, written by the `blog-writer` agent and
  **published unread** (the user's decision). `web/scripts/check-blog.mjs`
  fails the build on a wrong price, a competitor's name, an external or dead
  link. Rules: `marketing/seo/README.md`.
- **Built (2026-11-23): the demo** — `leftmoment.com/j/TRYLEFT`, a private
  demo moment per visitor, and a floating "Try LEFT" badge on the website.
  Server verified against the local stack over HTTP, the web half walked in a
  desktop browser; the App Clip half (with its new album) **never compiled**,
  the app's `(guest)/demo` never run. **Not on the hosted project yet.** See
  "The demo" below.
- **Next:** the user's items in `docs/LAUNCH.md`; in code: "Report photo"
  (Apple 1.2), a CAPTCHA token for anonymous sign-in, the first Android build.

## How we work together

Step by step, and deliberately: the user prompts → **Claude thinks and asks
clarifying questions** (`AskUserQuestion` for anything genuinely ambiguous — the
user prefers being asked over being surprised) → the user gives the go → only
then is code written.

- **One screen at a time**, finished functionally, not just visually.
- **Read the design before designing a solution.**
- **If the design is wrong or incoherent, say so and fix it.** Flag the change;
  never deviate silently.
- Agents in `.claude/agents/`: `supabase-backend` (schema, RLS, RPCs),
  `screen-builder` (one screen end to end), `launch-auditor` (read-only audit),
  and for marketing `trend-researcher`, `content-strategist`, `content-writer`,
  `prospect-finder`
  (rules in `marketing/CLAUDE.md`, plan in `marketing/STRATEGY.md`).

## Spec authority

| Source | Role |
|---|---|
| `mobile/design/LEFT App.dc.html` | The prototype. Pixel-accurate for the screens that still exist. |
| `mobile/design/README.md` | The written handoff — tokens, type, motion. |
| `docs/LAUNCH.md` | The launch runbook (German): everything only the user can do, in order. |

**The visual language is final**: `#101010` dark, off-white `#f0ede8`, Newsreader
headlines with italic emphasis, DM Serif numerals, Inter UI, pill buttons, glass
panels, the travelling ambient glow. Recreate with React Native primitives —
never port HTML/CSS.

**These frames predate the reframe and are not valid specs any more:**
03 Format · 05.1 film length/pricing · 10.1 budget info · 13 Camera (rebuilt in M2) · 14 Processing ·
17 Clip detail · 18 toast copy · 19 Lockscreen. New screens for them are designed
in the existing language, applying the `apple-design` skill, and every decision
is flagged to the user.

Deviations already decided (do not re-litigate):

- **Auth is the app's entry, not the end of onboarding.** Landing (01) carries
  Google, Apple and Join. `lib/entry.ts` decides where a signed-in user lands.
- **Email/password was dropped.**
- **The prototype renders headlines in Georgia** because Newsreader is missing
  from its font `<link>`. The app is right.
- **Invite links are `https://leftmoment.com/j/{CODE}`, not `left://`** — a custom
  scheme renders as dead text in WhatsApp/iMessage. No manual code entry anywhere.
- **What RN cannot draw is approximated and documented in place** (radial/conic
  gradients, view blur).
- **Screens carry states the artboard does not draw** — loading, error, empty,
  permission-denied, roll empty, event ended.

## Design principles (apple-design)

Applied to every new or rebuilt screen:

- **Respond on press-in.** Shutter, pills and tiles react on touch-down; commit on up.
- **Springs, not timed curves, for anything touched.** Critically damped by
  default; bounce only when a flick carried momentum (viewer dismiss, sheets).
- **Interruptible, 1:1 gestures** with velocity handoff and rubber-banding — the
  album viewer (swipe, pinch, drag-to-dismiss) is where this matters most.
- **Spatial consistency.** A photo opens from its tile and returns to it.
- **Harmony.** Shutter animation, haptic and (optional) sound on the same frame.
  Haptics only for meaningful moments: shutter, last shot, reveal.
- **Materials.** Glass for floating chrome over the viewfinder and album; never
  glass on glass.
- **Reduced motion / Dynamic Type** respected: cross-fades instead of travel,
  layouts that survive large text.
- **Delight is the reveal.** The one moment that gets real choreography is the
  film developing. Everything else stays quiet.

## Stack

Expo **SDK 58** / React Native 0.88 / React 19.3 / TypeScript 6 / expo-router with
typed routes and the React Compiler. Backend: Supabase (Postgres, Auth, Storage,
Realtime, edge functions). Purchases: RevenueCat, four consumable SKUs, one
purchase per event.

- Versioned docs: https://docs.expo.dev/versions/v58.0.0/. `expo-image` has no
  `resizeMode="repeat"`, so tiling needs RN's own `<Image>`.
- Add native packages with `npx expo install`.
- **SDK 58 changes that bit during the upgrade:** expo-router no longer ships
  React Navigation (`ThemeProvider`, `DarkTheme`, `useIsFocused` come from
  `expo-router`); `expo-file-system`'s `move`/`copy`/`write` are async
  (awaited in `lib/upload-queue.ts`); `expo-media-library`'s default export is
  the new object API (`MediaLibrary.Asset.create(uri)` saves a file);
  `StyleSheet.absoluteFillObject` is gone (`absoluteFill`); view refs are typed
  `ViewInstance` / `TextInputInstance`.
- **Three React Compiler lint rules are off** in `eslint.config.js`
  (`immutability`, `refs`, `set-state-in-effect`): they flag Reanimated's
  `shared.value = x` and patterns in the device-tuned camera files. Revisit in M6.
- Gesture Handler 3 deprecates the builder API (`Gesture.Pan()`), which the
  camera's pinch and `PhotoViewer` use. It works; migrate both together.
- **`expo-video` is unused since 2026-11-16** (the backdrop became a photo
  slideshow) but stays installed with its config plugin: removing it changes
  the native build. Prune it with the next build.

## Architecture

```
mobile/src/
  app/                    expo-router routes
    index.tsx             01 Landing
    (onboarding)/         02 Event · 03 Film (look) · 04 Ending · 05.1 Group + roll
    (auth)/               Your name · Keep your film · Start your own
    (legal)/              Terms · Privacy
    (host)/               09 Invite · 10 Your group
    (guest)/              11 Name · 12 Waiting
    (capture)/            13 Camera · Your shots (roll)
    (library)/            15/16 Moments (list of cards) · album/[id] (developing → reveal → album)
    (modals)/             08 Join (the QR scanner) · Delete account
    settings.tsx          20 Settings
    +native-intent.ts     invite link -> 11
  components/ui/          shared primitives
  constants/              theme.ts, typography.ts — all design values; looks.ts
                          (the looks and their shader recipes)
  hooks/                  use-camera-session (event + roll + queue for 13), …
  lib/                    supabase, auth, auth-errors, entry, events, photos,
                          storage, roll, tiers, purchases, realtime, invite,
                          event-end, film-status, film-tint, zoom,
                          look-shader, upload-queue, notification-prefs, push,
                          analytics, my-shots, album, covers, motion,
                          clip-handoff
  types/database.ts       generated — `npm run db:types` at the root
mobile/targets/clip/      the App Clip (SwiftUI) — see "The App Clip"
mobile/plugins/           with-worklets-headers, with-app-clip
supabase/
  migrations/             baseline, price tiers, notifications, service_role
                          grants, retention, photo reports, security hardening
  functions/              create-event, delete-account, restore-purchases,
                          revenuecat-webhook, send-notifications,
                          purge-expired-events
  seed.sql
web/                      leftmoment.com (Astro, static) — web/README.md
docs/                     MILESTONES.md, LAUNCH.md
```

Vocabulary: an event is a **film**; a guest's allowance is their **roll**; an
event ends by being **developed**. "Film" in file names (`film-poster`,
`film-status`) is that metaphor, not video — keep it.

## The camera and the looks (M2)

- **One shader, two callers.** `lib/look-shader.ts` holds the only SkSL; a look
  is a recipe in `constants/looks.ts` (`LOOK_RECIPES`). `LookPreview` draws it on
  03's cards over `assets/images/look-sample.jpg`, `developPhoto()` runs it
  offscreen over a capture and encodes original (long edge 3600, JPEG 90) +
  thumbnail (1080, JPEG 78). Change a look in the recipe and both follow.
  Recipes are provisional.
- **Sharpness (2026-11-19, the user: "the photos look soft").** Every resize of
  a photo is bicubic (`RESAMPLE`, Mitchell): linear filtering with mipmaps
  blended in the half-size level on the 0.75x shrink and softened every print.
  The capture asks for `qualityPrioritization: 'quality'` (Deep Fusion, Smart
  HDR), in the clip too. Originals went from 3000 to 3600 px, thumbnails from
  640 to 1080. **Not seen on a device.**
- **The looks are colour schemes, not effects** (decided 2026-11-15): warm
  (Golden), cool (Chrome), washed out (Faded), black and white (Mono) — muted
  and clean, with only a trace of grain, vignette and lens fringing (`LENS`) in
  the print. **The viewfinder draws no grain at all**, only the colour.
- **The viewfinder shows the film, natively, at screen resolution**
  (2026-11-19, the user, replacing the Skia viewfinder of 2026-11-15, which
  copied 1024x768 frames through JS and looked soft full screen). The camera
  is `react-native-vision-camera` 5; `components/ui/film-camera.tsx` hands
  each frame (`FHD_4_3`, 1440x1920 like the clip; the preview-size cap was
  dropped the same day, it gave softer frames) to VisionCamera's
  `FrameRenderer` and disposes it, and `<NativeFrameRendererView>` shows it.
  **LEFT patches that renderer** (`mobile/patches/react-native-vision-camera+5.2.4.patch`,
  applied by `patch-package` on `postinstall`): it draws each frame through
  the clip's Metal shader into a `CAMetalLayer`, aspect-fill, the camera's
  buffer as a texture without a copy. The look reaches it through the App
  Group's UserDefaults (`left.viewfinder.look`, JSON of `liveLookUniforms()`,
  written with `ExtensionStorage`) because the renderer's spec has only
  `renderFrame`. **A VisionCamera upgrade must carry the patch over.** Mono's
  viewfinder is black and white. Seen on a device 2026-11-19 (build 18):
  "way better".
- **No Skia GPU call on the camera thread — ever.** `SkiaCamera` (from
  `react-native-vision-camera-skia`) shades frames on the GPU on the camera's
  GCD queue and crashed the app about 20 s after the camera opened
  (2026-11-15: `EXC_BREAKPOINT` on `com.margelo.camera.frame` in
  `GrResourceCache`, under `JsiSkImage::makeNonTextureImage`). RN Skia keeps one
  GPU context per *thread*, and that queue changes threads. Do not go back to
  `SkiaCamera`, `Skia.Surface.MakeOffscreen` or `MakeImageFromNativeBuffer` in a
  frame worklet. The package is still installed (removing it changes the native
  build); prune it in M6.
- **`expo-camera` stays for one thing: 08's QR scanner** (and its config plugin
  writes the camera permission string). Do not put overlays with
  `mixBlendMode` over a camera preview: on iOS they paint over the picture.
- **`react-native-worklets` is Expo 58's own version (0.13) again** — the pin
  to 0.8.3 and the `expo.install.exclude` entry are gone. VisionCamera 5.2.4
  against Worklets 0.13 / RN 0.88 builds and runs on iOS (2026-11-15). `@react-native/metro-config`
  is a dev dependency only because Worklets lists it as a peer — keep it on
  RN's version.
- **`plugins/with-worklets-headers.js` is load-bearing for the iOS build.**
  Without React-Core's private header path on the `VisionCameraWorklets` pod,
  EAS fails with `'React/RCTMessageThread.h' file not found` / `could not build
  module 'RNWorklets'` (seen 2026-11-15 with worklets 0.7.4).
- **Zoom stops are real lenses only.** The back camera is the phone's virtual
  multi-lens device; `lib/zoom.ts` turns its `zoomLensSwitchFactors` into stops
  and labels them as ratios to the wide lens (0.5× / 1× / the telephoto's true
  factor). One lens and the front camera get no stops — the control hides,
  pinch still zooms. After a pinch the stops give way to one lit pill with
  the live zoom ("1.2×", as the system camera does; the user, 2026-11-18); a
  tap on it returns to 1× and the stops. **Not seen on a device.**
- **Flash** (`fire` / `lightTorch` in `camera.tsx`): the LED is lit as a torch
  through the camera controller `Camera.flash.leadMs` before the exposure and
  read back; the front camera turns the viewfinder white instead. The camera's
  own `flashMode: 'on'` is only requested when the torch could not be confirmed
  lit — the library drops that request silently when the photo output does not
  list the mode. **The flash was not individually confirmed in the 2026-11-15
  device test** (it had never fired before it); `[camera] fire` and `[camera] torch` log every step in
  dev.
- **The shutter is ready when the session runs *and* was configured for the
  selected camera** (`onStarted`/`onStopped` plus `onConfigured` in
  `camera.tsx`). `onStarted` does not fire again after a flip — the running
  session is only reconfigured — so gating on it alone left the shutter dead.
- **The frame worklet must never throw, and `film-camera.tsx` and `camera.tsx`
  are `'use no memo'`.** An exception leaving the worklet aborts the app
  (margelo/react-native-vision-camera#4219); the React Compiler breaks worklets
  passed to the camera (#3748). With the compiler off, everything handed to the
  camera hooks needs a stable identity (`useMemo`/`useCallback`).
- **Frames arrive upright: `enablePhysicalBufferRotation` is always on**, for
  both cameras, and the front camera's are mirrored natively (`mirrorMode`).
  Constant on purpose: changing it recreates the frame output, its queue and
  its worklet runtime on every flip. The preview is pinned to `'up'`
  (portrait-locked app); the photo output follows the phone
  (`useOrientation('device')`), so a sideways phone takes a landscape picture.
  Selfies are saved mirrored, as previewed.
- **Metal is fine on the camera thread; Skia is not.** The patched renderer
  draws on VisionCamera's frame queue — Metal devices, queues and pipelines
  are thread-safe, unlike Skia's per-thread GPU context. `[camera] frame`
  logs the real frame size in dev.
- **Photos are captured at 4:3, up to 3024x4032**, as JPEG (`usePhotoOutput`).
- **`GrainOverlay`'s tiled image does not repeat reliably over a large area**
  (seen as one tile top-left over the viewfinder). Nothing uses it any more;
  the component is kept on purpose.
- **Superseded 2026-11-18 (the user): the viewfinder is full screen** (top edge
  to the shutter bar, bottom corners rounded); header and flash · zoom · flip
  are glass over it, with soft scrims. Prints are centre-cropped to the frame's
  aspect (`cropAspect` through `enqueueShot` → `developPhoto`). **Not seen on a
  device.** The older note follows for history:
- **Every camera control sits outside the viewfinder** (decided 2026-11-16 by
  the user, after seeing the 2026-11-15 version with the chrome floating in
  the picture on a device — do not move it back in): the roll counter in the
  header under the event's name, flash · zoom · flip in a row under the frame,
  "Your shots" · shutter · invite in the bottom row. The controls keep the
  glass look (`GlassButton`, `Glass` tiles) although they sit on the dark
  page. Only the status note is drawn inside the frame. **The new arrangement
  has not been seen on a device.**
- **A guest can see their own frames before the reveal** (decided 2026-11-15,
  replacing "no preview at all"): `(capture)/roll`, from the tile left of
  the shutter, which shows the last photo taken. Both read `lib/my-shots.ts`:
  uploaded rows + frames still in the queue. Others' stay hidden — RLS.
- **Any member can invite from the camera** (decided 2026-11-15): the tile
  right of 13's shutter opens 09 with `from=camera` — QR, link, back to the
  camera, without the host's "See who's joined". Members can read their
  event's `invite_code` (RLS), so no server change.
- **The shutter only enqueues.** `enqueueShot()` moves the capture into
  `Paths.document/shots/` and writes the entry to AsyncStorage; develop → claim →
  upload → `markPhotoUploaded` happen in the queue, each step recorded and
  repeatable. `startUploadQueue()` runs from the root layout and re-drains on
  reconnect, on foreground and with backoff.
- **Shooting works offline** (decided). The counter is the server's last count
  minus unclaimed queued frames (`useCameraSession`), floored at zero, so the roll
  cannot be overdrawn. Frames still unclaimed when the event ends are counted
  and uploaded since 2026-11-21 (they used to be refused and dropped).
- `developPhoto()` is synchronous on the JS thread (a few hundred ms per frame).
  If the shutter feels sticky during bursts, move it to a worklet runtime.
- Skia must never be touched at import time — keep it inside functions.

## Album, viewer and glass (M3)

- **One material: `components/ui/glass.tsx`.** `Glass` is Liquid Glass
  (`expo-glass-effect`) on iOS 26+, a blur with a tinted fill elsewhere, and a
  solid surface under "Reduce Transparency". `GlassButton` is the round or
  capsule control on it. Glass only over imagery (viewer, album grid, film
  posters, the Films backdrop) — never glass on glass, and never animate a
  glass view's opacity (fade a wrapper). `GlassPanel`, `CircleIconButton`'s
  `glass` variant, the zoom selector and the toast draw on `Glass` since
  2026-11-15; the camera's close button is glass too, and so are its controls
  around the viewfinder (nothing is glass *over* the viewfinder any more). `PillButton`'s `glass` variant is a flat fill, no
  blur: it sits inside glass panels and on the solid sheet.
- **Press feedback is `components/ui/press-scale.tsx`.** `PressScale` is a
  `Pressable` that springs towards a smaller scale on touch-down (`Press`
  tokens, `Springs.press`) and commits on release; `PillButton`,
  `CircleIconButton`, `AuthButton` and `ShareButton` are built on it. Its
  `style` is a plain style, not Pressable's function form. Glass controls use
  `GlassButton`.
- **Sheets drag: `components/ui/sheet-drag.tsx`.** `SheetDrag` wraps a bottom
  sheet's surface (`Sheet`, 08's panel): 1:1 with the finger, rubber band
  upwards, release projects the flick and either leaves with its velocity or
  settles (`SheetMotion`). The surface must be drawn `SheetMotion.overdraw`
  past the screen edge by its owner. `Sheet` takes `locked` while its action
  runs. `@gorhom/bottom-sheet` is still unused.
- **The toast and 10's member chips move on `Springs.settle`**; under reduced
  motion they cross-fade. A chip only springs in for someone who joined after
  the roster was first shown (`arriving`).
- **One viewer: `components/ui/photo-viewer.tsx`**, for "Your shots" and the
  album. An overlay inside the screen that owns the grid (not a route, not a
  `Modal`) so the tile's rect and the viewer share a coordinate space. It
  opens from the tile and returns to the *current* photo's tile (`originFor`;
  the grid scrolls it into view in `onIndexChange`). One pan picks its axis
  after `Viewer.slop`: sideways pages, down drags away, on a zoomed photo it
  pans. Release hands velocity to the spring and lands where the flick was
  going (`lib/motion.ts`: `project`, `rubberband`). Gesture state lives in
  shared values — a plain object captured by two gesture callbacks is two
  private copies.
- **Springs are tokens** (`Springs` in `theme.ts`): `settle` (critically
  damped) by default, `momentum` only after a release, `press` for touch-down.
- **`PhotoTile` + `useTileRegistry`** (`photo-tile.tsx`) are the grid half:
  press-in feedback and the tile rects.
- **The album is one route with two states**, decided by `isDeveloped()`.
  **Before the reveal it is a gallery** (2026-11-23, the user, replacing
  `DevelopingFilm`'s "Nothing to see yet"): `DevelopingHero` (the event
  image, a large countdown, "N photos so far", Camera and the host's
  "Develop now" as glass capsules), then every photo three to a row — the
  viewer's own sharp and openable, everyone else's a **blurhash** smudge
  with the photographer's name and a small countdown (`HiddenPhotoTile`),
  refreshed every 30 s. The smudge is computed on the device from the
  thumbnail and sent with `mark_photo_uploaded(…, p_blurhash)`;
  `event_gallery()` hands members id, author, size and blurhash — never a
  path — so the reveal still holds in RLS (migration
  `20261123000000_gallery_before_develop.sql`). The web camera and the App
  Clip have the same gallery (`blurhash` npm package; `Blurhash.swift`).
  Tapping a moment still opens the camera while shots are left, the gallery
  once the roll is used up. **Not seen on a device; the clip never
  compiled.**
- **A developed album opens with `AlbumHero`** (`album-hero.tsx`; decided
  2026-11-16 by the user, from a reference, replacing the three-column grid
  under a small title): one of the album's photos, drawn at random per visit,
  full-bleed and going dark towards the event's name, the two counts and
  "Save all" · "Share"; under it the prints (three to a row since
  2026-11-21). The hero shows the thumbnail first and the original over it,
  it stretches on overscroll, and a tap opens it in the viewer. The back
  button and ••• float. **Not seen on a device.**
- **No reveal animation** (2026-11-21, the user, replacing the veils that
  cleared one after another: the album was locked while they played). A
  developed album is usable at once; its first open on a phone gives one
  haptic and fires `reveal_seen` (`left:reveal-seen:{id}`). `RevealVeil` and
  `Album.reveal` are deleted. The "delight is the reveal" principle now lives
  in the developing state and the push, not in a choreography.
- **The album grid is three to a row** (2026-11-21, the user), the
  photographer's name small on each print, a glass target badge on a mission
  photo. The hero's "Save all" and a new "Share" (the moment's invite link,
  which opens the album for members) are two small glass capsules under the
  counts, replacing the full-width white pill. **Not seen on a device.**
- **Save and share** go through `lib/album.ts`: the original is downloaded
  once into the cache, saved with `MediaLibrary.Asset.create`, shared with RN's
  own `Share` on iOS and `expo-sharing` on Android (lazily required; **never
  run**). Owner or host can delete (`deletePhoto`, RLS).
- **08 is the QR scanner itself** (2026-11-21, the user: on the sheet it was
  not clear the "Scan QR Code" card could be tapped). "Scan the host's QR
  code." at the top, a glass note at the bottom that a link, tapped in
  messages, opens LEFT. No sheet, no slideshow behind it. Not seen on a device.
- **Rename and delete (2026-11-21, the user):** a long press on a Moments
  card or the album's ••• opens one menu (`hooks/use-moment-actions.ts`).
  The host renames in any state (iOS `Alert.prompt` — Android has no Rename
  yet) and deletes for everyone after a system alert; the row goes by RLS
  ("host can delete"), cascades take the rest, a purchase stays consumed, and
  the files are left to the daily orphan sweep. A guest only gets "Remove
  from Moments", hidden on that phone (`lib/hidden-moments.ts`) until they
  join again. A deleted moment's album reads "This moment was deleted."
  (`EventGoneError`). **Not seen on a device.**
- **`(auth)/keep` is reached when an anonymous guest leaves a developed album**
  (once, unless declined) — after the photos, never in front of them.
- **A member can report someone else's photo** (2026-11-16, required by both
  stores): the flag in the album viewer, where the host and the photographer
  have the bin instead. `reportPhoto()` → `report_photo()` → `photo_reports`,
  which no client can read. Nothing notifies the operator and the photo stays
  visible until someone acts — the daily query is in `docs/LAUNCH.md` §11.
  The copy promises a look within 24 hours. **Not seen on a device.**
- **Seven changes of 2026-11-16 (the user's list), none seen on a device:**
  the camera's countdown is a button to the film's developing state (the only
  way to the host's "develop now" on an unlimited roll, where the roll-empty
  screen never comes); a moment's strip with nothing to show holds sample
  pictures tagged "Sample" (`MomentCard`'s `samples`); the developing state's
  frames are filled per existing photo and blurred past recognition — the
  viewer's own frames, then stand-ins, because RLS hands out nobody else's;
  the Moments list runs to the physical bottom edge and dissolves there
  (`Screen edges={['top']}`, `ScrollEdge`'s `inset`); 09's two buttons are
  drawn on `Glass` (a restyled QR code was tried and reverted the same day
  — the plain square-module code stays, to be safe for scanners); 10 reads
  "3/50 people" and "47 spots left"; Landing has no glass panel — copy and
  buttons stand on the gradient (`VideoOverlay.gradientColors`) so the
  people in the photos stay visible.
- **The library's title is "Moments"** (2026-11-16, the user; was "Your
  Moments"), and its list blurs and dissolves into the page at the top and
  bottom edge instead of being cut off (`components/ui/scroll-edge.tsx`,
  tokens `ScrollEdge`). Since 2026-11-18 it is one smooth gradient in
  `Colors.bg` and no blur: the stacked blurs showed as steps on a device, and a
  real progressive blur needs a masked view (native, new build). The list
  scrolls up under the "Moments" header and fades out behind it, still
  faintly visible. **Not seen on a device.**
- **The library: the running moment full-bleed, then rows** (2026-11-21,
  the user, from mockups, replacing the compact cards of 2026-11-16, which
  replaced the full-screen carousel of 2026-11-15 — do not go back to
  either). One moment is in the spotlight, `MomentHero` (`moment-hero.tsx`),
  from the screen's top edge with "Moments" and the buttons floating over it,
  fading into the page — no card, no border: **the first live moment**
  (its latest own photo drifting slowly, "Live now", the shots left, the
  countdown — a tap opens the developing state and the host's "develop
  now" — and "Open camera"), else **one waiting to be started** (the
  soonest to end: the roll, who joined, "Invite & start" for the host —
  the user, 2026-11-21, replacing "a moment in setup does not take it"),
  and **only when every moment is developed, the last developed one**: its
  album's first photo, "Developed", the counts side by side and a
  small glass "Open album" capsule beside them — not the full-width pill,
  which stuck out (the user); a tap anywhere on the photo opens it too.
  Without a photo of its own it shows **an unblurred sample as a mock
  picture** ("for now", the user) — no "Sample" tag on the hero. Every other moment is a `MomentRow`
  (`moment-row.tsx`) on the page: name, "42 photos · 18 people", when
  ("October", "01d 23h left", "Not started"), and a small stack of up to
  three prints (`STACK_SIZE`) **without a white frame** (the user), with a
  **glass** "+N" badge (or "Sample"); a hairline between rows, the developed
  ones under "Developed". Prints are the album's first photos once
  developed, **the viewer's own latest frames** before (RLS returns nothing
  else) — `lib/covers.ts`. The photo count before the reveal is the
  roster's `shots_taken`, summed (`listMyEventSummaries`). A running moment
  opens its camera, or the developing state once the viewer's roll is used
  up. A second running moment is a row and loses the old card's separate
  capsule and strip targets. The top `ScrollEdge` fades in only once the
  hero has scrolled away. **With no moments** the screen is the one large
  `NewMomentCard` stack of sample prints ("Start your moment", join
  capsule) — the only place the stock pictures (`constants/samples.ts`) and
  `PhotoStack` are still used. **Not seen on a device.**
- **04 Event End is one screen, no popovers** (decided 2026-11-15): the
  question, then the answer written large (day, time, "developed in 5 days"),
  and two wheels straight on the screen, no card — `DayStrip` (days sideways, the centred
  day is the choice, days fade and shrink towards the edges) and `TimeWheel`.
  A row of shortcuts was tried and removed the same day (too crowded). The
  wheels mount with the screen, which is only affordable because `Wheel`
  mounts just the rows near its band (a window of ±16 that follows the scroll;
  rows are placed absolutely) and date formatters are built once
  (`labelDays()`) — mounting all ~350 rows and constructing
  `Intl.DateTimeFormat` per day per render made the screen slow to open.
  **Not seen on a device:** whether a very hard fling outruns the window. The month grid, popover and value pill are deleted,
  and so are their tokens.

## The roll model

The server half is `supabase/migrations/20261115000000_baseline.sql`; the camera
and upload queue that use it are described above.

- **Roll size is chosen by the host per event: 5, 10, 16, 24, 36 or ∞.** Stored on
  the event (`null` = unlimited). Every guest gets the same roll.
- **The roll is server-authoritative.** `claim_shot(event, photo_id)` counts under
  a lock on the caller's member row and returns `shots_left` (null = unlimited);
  the client never decrements as truth. The photo id is minted on the device, so
  the claim is idempotent — a retry on bad venue Wi-Fi cannot burn two frames —
  and a frame is never refunded. Refusals carry `hint`: `roll_empty`,
  `event_closed` (`lib/photos.ts` turns them into typed errors). "Unlimited" has a
  fair-use ceiling of 150 per guest (`unlimited_roll_cap()`).
- **One look per event**, picked by the host on 03 (replaces Format). The look is
  baked into the JPEG on the device at capture; the server stores the result.
- **Reveal is enforced by RLS, not by the app.** Until the event is developed a
  member can read only their own photo rows and storage objects.
  `is_event_developed()` is true by status **or by the clock**, so photos become
  readable at `ends_at` to the second; the pg_cron job (`develop_expired_events`,
  every minute) only flips `status` so realtime can tell open apps. The host can
  develop early with `end_event()`. `isDeveloped()` in `lib/events.ts` mirrors it.
- **Uploads must belong to a claimed frame.** The bucket's insert policy checks
  the file name against the caller's `photos` rows:
  `{event_id}/{user_id}/{photo_id}.jpg` and `…_thumb.jpg` (`lib/storage.ts`).
- **Photos can be added from the phone's library** (2026-11-21, the user):
  an "Add" glass capsule in Your shots and in a developed album's top bar
  opens Apple's picker (`expo-image-picker`, required lazily — **needs a new
  native build**) for up to the shots left; any photo, kept without the look
  (`imported` on the queue entry, `developPhoto(…, null)`). **The roll is the
  only limit, also after the end**: `claim_shot()` refuses only `setup` since
  `20261121145855_claims_after_develop.sql` (so camera frames still queued at
  the end now upload too). Not seen on a device.
- **`max_members` is a hard cap** (`join_event` refuses with `hint = 'full'`), and
  joining stays open after the event is developed so a latecomer's link opens
  the album.
- **Uploads are durable.** A captured file is moved somewhere persistent and
  queued before the shutter animation finishes; the queue survives app kills and
  retries (`lib/upload-queue.ts`). (The video version never had this — it was
  its biggest gap.)
- **Design for Phase 2 now:** keep a print-capable original (long edge ~3000px)
  plus a thumbnail, with width/height, author and capture time on the row; go
  through one storage seam (`lib/storage.ts`) so the bucket can move to
  Cloudflare R2; never hard-delete before the retention window.
- **Retention is 6 months after the event was developed** (decided
  2026-11-15, was 12) and it deletes the whole event: files, photo rows, roster
  and the event row. `purge-expired-events` (edge function, woken daily by
  pg_cron) removes the files through the storage API — SQL cannot delete
  files — and then calls `purge_event()`. **"Never earlier" lives in the
  database:** `purge_event()` refuses an event that is not developed, is
  younger than `retention_period()`, or still has objects in the bucket.
- **The event image** (2026-11-21, the user): 03.1 (`(onboarding)/cover`,
  after the look; onboarding is 5 steps now) picks one of the six stock
  pictures or the host's own photo, previewed in the look. 05.1 applies it
  right after the event exists (`applyCover`, best effort). `events.cover`:
  null / `sample-N` / `upload` (file at `photos/{event}/cover.jpg`, so the
  purge and account deletion take it with the photos; members read it any
  time, only the host writes — migration `20261121162520_event_cover.sql`).
  Drawn through the look (`LookPreview`'s `source`) behind 12 and the top of
  09. The host changes it any time through "Change image" in the moment's
  menu (`(host)/cover`, the same `CoverPicker`). **It heads the moment everywhere**
  (the user, 2026-11-21): the Moments spotlight and the album's header draw
  it (`EventCoverImage`) instead of the latest or a random photo. The six stock choices show
  no people (`assets/images/covers/`, also in the web camera and the clip as
  `sample-N.jpg`). **Not yet on the Moments list**: that list was being redesigned in a
  parallel session (`MomentHero`/`MomentRow`) at the time. Not seen on a
  device.
- **12 has no cards** (2026-11-21, the user): the wait with a larger ping,
  "24 photos each" and "Develops Sat, 22 Nov at 23:00" as plain lines, "How
  it works" as underlined text with an icon and chevron, and a glass QR
  button top left that opens 09 (`from=waiting`) for any member.
- **A swipe-through intro after 11** (`(guest)/intro`, 2026-11-21, the user,
  replacing steps that made 12 scroll): once per moment and phone
  (`lib/guest-intro.ts`), then 12. Pages: the roll written huge ("24 —
  photos. That's your whole roll.") over a still of the camera (`MiniCamera`
  in the moment's look); hidden until the end (own print clear, others dark);
  missions, only when on ("up to N", an example); the end date → "Got it".
  Skip at the top. 12 is one screen again: the card, "24 photos each ·
  develops Sat, 22 Nov, 23:00" and a "How it works" link that replays the
  intro. A developed moment skips it. 12 has the sample photo in the
  moment's look fading into the page, two chips (roll, end) and a "How it
  works" row with an icon and a chevron. **Not seen on a device.**
- **"Start the Event" stays** (decided 2026-11-15): the host's tap on 10 moves
  the event from `setup` to `live`; guests wait on 12 until then.
- **A browser guest sees the album on the web** (decided 2026-11-16,
  replacing "no web album" of 2026-11-15) — only through `/j/{CODE}`, only for
  members, by the same RLS. There is still no public or host web album.

- **Pricing (final, decided 2026-11-15, replacing "free up to 100, one SKU"):** free
  up to 50 guests on a finite roll; `left_small` (US$9.99) for the unlimited
  roll in a group up to 50; `left_medium` (US$14.99) up to 100 guests;
  `left_large` (US$19.99) up to 150; `left_unlimited` (US$24.99) up to 200. One purchase per event, paid by the
  host at creation. A purchase unlocks a group size; `create_event()` is the
  authority (`free_max_members()`, `unlock_max_members()` — migration
  `20261115010000_price_tiers.sql`), `lib/tiers.ts` mirrors it for the button,
  and the pay-first-then-create flow in `hooks/use-event-creation.ts` stays.
  05.1 shows the price on the button only; under the choices a paid event says
  "No subscription." and a free one says nothing.

Statuses: `setup → live → developed`. Clients cannot write `status`, `ends_at`,
`roll_size`, `max_members` or `shots_taken`, cannot INSERT events or photos, and
cannot UPDATE a photo row or DELETE a roster row — `create_event()`,
`claim_shot()` and `mark_photo_uploaded()` are the doors.

## The web camera (2026-11-16)

- **`leftmoment.com/j/{CODE}` is a camera for guests without the app**
  (`web/src/pages/j/index.astro`, `web/src/shoot/`): name → (waiting) →
  camera → developing → album. Phones with the app never see it (universal
  links). Details: `web/README.md`.
- **The app comes first** (2026-11-21, the user): a new guest sees "Join the
  film" with only the store buttons and a quiet "Continue in the browser";
  the name form then carries a note that the browser version is limited,
  with a link back. "Open in LEFT" is gone (universal links and the App
  Clip's card cover it). A guest who already joined in that browser goes
  straight back in. Android gets the same screen ("Coming soon to Google
  Play" until `SITE.playStoreUrl` is set).
- **Same server doors, no migration:** anonymous sign-in, `join_event()`,
  `claim_shot()`, the pinned storage paths, `mark_photo_uploaded()`, RLS for
  the reveal. A door that changes for the app changes in `web/src/shoot/api.ts`
  too.
- **The look is a WebGL port of the SkSL** (`web/src/shoot/look-gl.ts`) fed by
  the app's own recipes (copied by `web/scripts/sync-legal.mjs`). Change the
  shader in both files.
- **Upload queue on IndexedDB** (`web/src/shoot/queue.ts`), the app's order and
  refusal handling. The counter is the server's minus unclaimed queued frames.
- **No push on the web**: a calendar reminder and a 15 s poll.
- **Missions on the web (2026-11-17)**, the guest half only, through the same
  RPCs (`api.ts`): "Are you one of these?" on the join form, the "Missions
  1/3" capsule and the armed "Next photo: …" in the camera, the intro sheet
  once per event, "Mission" in Your shots' viewer (re-tag or "Not a
  mission"), and the caption in the album. The queue tags after the claim
  (claim → tag → upload) and drops a refused tag, never the photo; writes to
  a queued entry merge (`update()`), so a re-tag during the upload survives.
  Run against the local stack with a synthetic camera, online and offline —
  never on a phone. Hosts still plan missions in the app only.
- **The App Clip came second** (decided 2026-11-16): a QR-invoked App Clip
  must stay under 15 MB, which the RN app with Skia and VisionCamera cannot,
  so it is a small native SwiftUI target — "The App Clip" below. On an iPhone
  the clip's card appears over `/j/` (the `apple-itunes-app` meta tag,
  `Base.astro`'s `appClip`); the web camera stays for everyone else.
- **Not seen on a phone:** real camera resolution in Safari/Chrome, the torch
  (only Chrome on Android exposes it), the white front flash, save via the
  share sheet, in-app browsers.

## The App Clip (2026-11-16)

**Since 2026-11-23 the clip has the album and the demo — see "The demo"; that code has never compiled.** **Compiled on EAS since 2026-11-18, never run.** The user is on Windows; the
clip builds only on EAS (the GitHub workflow), and nothing in it has run on a
phone. Its EAS credentials (the clip's own provisioning profile) were set up
interactively once with `eas credentials`; a CI build cannot create them. Decided with the user: shoot + developing (no album in
the clip), hand-off through the App Group, `com.leftmoment.app.clip`,
`@bacons/apple-targets`.

- **Scanning an invite opens a native clip, no install:** name (11) →
  waiting (12) → camera (13) → the developing state with a countdown and
  "Get LEFT" (`SKOverlay`). The album is the full app's. A phone *with* the
  app opens the app (universal link); without either, Safari shows the web
  camera with the clip's card on top.
- **SwiftUI and system frameworks only** (`mobile/targets/clip/*.swift`): no
  React Native, no Supabase SDK, no packages. That is what keeps it far under
  the 15 MB limit for QR invocation (iOS 17+, the clip's deployment target).
  Fonts are the app's (Newsreader, Inter, DM Serif — ~1 MB in `Fonts/`).
  Expected 2–4 MB; App Store Connect shows the real size per build.
- **How it gets into the build:** `@bacons/apple-targets` reads
  `targets/clip/expo-target.config.js`, adds the target (product type
  on-demand-install-capable), the "Embed App Clips" phase and the clip's
  entitlements (`appclips:leftmoment.com`, the App Group, the parent app id).
  **`exportJs: false` is load-bearing** — the package bundles React Native
  into a clip by default. `plugins/with-app-clip.js` then gives the clip the
  app's version (the package hardcodes 1.0; the store rejects a mismatch),
  passes `EXPO_PUBLIC_SUPABASE_URL` and the key into its Info.plist (as
  scheme + host: an unquoted `//` in project.pbxproj reads as a comment), and
  regenerates the looks. **It must stay listed before `@bacons/apple-targets`
  in app.json** — mods run in reverse order, and its Xcode action needs the
  target to exist. `ios.appleTeamId` is set because the package needs it.
- **`targets/clip/Info.plist` is ours, not generated** (the package writes one
  only when none exists, with a storyboard the clip does not have).
  `Assets.xcassets` in that folder *is* generated on every prebuild and is
  gitignored.
- **Same server doors as the app and the web camera** (`Server.swift` mirrors
  `web/src/shoot/api.ts`): anonymous sign-in (`/auth/v1/signup`), refresh,
  `join_event`, `claim_shot`, uploads to the pinned paths with `x-upsert`,
  `mark_photo_uploaded`. No migration. A door that changes for the app
  changes in `Server.swift` too.
- **The looks are a Metal port of the SkSL** (`LookRenderer.swift`), compiled
  from source at runtime (`makeLibrary(source:)`) so the target needs no
  Metal build flags. The recipes, `LENS`, `GRAIN_CELLS` and `PhotoOutput` are
  generated into `LooksGenerated.swift` from `constants/looks.ts` by
  `scripts/sync-clip-looks.mjs` — on every prebuild, and committed. **The
  shader's maths now lives in four places** (SkSL, WebGL, the clip's Metal,
  and the same Metal in the VisionCamera patch); change all four. The maths runs on sRGB-encoded values, as Skia's does: textures are
  `unorm`, never `_srgb`.
- **The viewfinder is 1920x1440** (2026-11-19): `viewfinderFormat()` in
  `Camera.swift` picks the 4:3 format with those video frames that still takes
  12 MP photos, instead of leaving it to the `.photo` preset. **Not seen.**
- **The viewfinder shows the film** (no grain): AVFoundation BGRA frames →
  `CVMetalTextureCache` (no copy) → the shader → a `CAMetalLayer`, drawn on
  the camera's queue. Metal may be used from any thread — the Skia
  per-thread-context crash of the app's camera does not apply here.
- **Photos:** 4:3, at most 12 MP (a 48 MP sensor would only be scaled down to
  the 3000 px print), JPEG, oriented by `RotationCoordinator` (a sideways
  phone takes a landscape picture), selfies mirrored on the connection as
  previewed. `Developer` bakes the look: original 3000 px at 0.88, thumbnail
  640 px at 0.72 — the app's `PhotoOutput`. Back flash is the system flash;
  the front flash is a white screen for `leadMs` (320 ms).
- **The app's 2026-11-18 design, ported (same day, the user; written on
  Windows, never compiled before the next EAS build, never seen):** the
  viewfinder is full screen to the shutter bar, bottom corners rounded, with
  the header (name, "17 left" warming over the last three, "Missions 1/3",
  the "01 d 23 h" countdown → developing) and flash · zoom · flip as glass
  over it on scrims (`CameraTokens` in `Theme.swift`). **Zoom has the lens
  stops and the live "1.2×" pill** (`lib/zoom.ts` ported into `Camera.swift`;
  the start lens is now the wide one on a wide + tele phone too). Prints are
  centre-cropped to the frame (`Developer.develop(cropAspect:)`). Glass is
  `.glass(shape)`: Liquid Glass on iOS 26, a material before, solid under
  Reduce Transparency. Your photos is a full screen like the app's roll;
  11's names are 02's pills with "None of these", and a pick fills the name
  field; copy follows the app's vocabulary. No close button and no invite
  tile in the clip.
- **Three camera changes of 2026-11-19 (the user, after TestFlight), never
  compiled:** the clip stays portrait and, like Apple's Camera, only the
  icons turn upright when the phone is sideways (flash, flip, zoom labels,
  last-shot tile; the header does not turn) — the shutter never moves. While
  a mission is armed the "Missions 0/1" capsule is hidden and "Next photo: …"
  takes its place with a gap under the counter; tapping the note opens the
  list. Your photos' single frame pages sideways through all frames
  (`TabView` page style).
- **Swift sources must be saved as UTF-8.** `LEFTClipActivity.swift` was once
  saved through a Windows codepage and showed "itâ€™s" on the Lock Screen.
- **Live Activity (2026-11-18, the user: "stay in the notifications so I can
  tap and see I have 4 more photos").** `targets/clip-activity`: a widget
  extension with Live Activities only, embedded **in the clip** (Apple's
  rule), bundle ID `com.leftmoment.app.clip.activity`, entitlement
  `com.apple.developer.on-demand-install-capable`. `@bacons/apple-targets`
  embeds widgets in the main app; `with-app-clip.js` moves the embed and the
  dependency into the clip on every prebuild. Lock Screen and Dynamic Island
  show the count, the open missions and a self-ticking countdown; a tap
  opens the invite URL, i.e. the clip's camera. Started on entering the
  camera, updated locally on every change (`ClipModel.liveRoll` →
  `LiveRoll.sync`), ended an hour after the clip sees the film developed.
  **No push updates** (needs APNs): with the clip closed only the countdown
  moves; `staleDate` is the event's end. `RollActivityAttributes` is
  duplicated in both targets (`targets/_shared` would also compile into the
  RN app) — keep the two files identical. System serif in the extension, not
  DM Serif (fonts would double in the clip). **Unverified in any way but
  config resolution: Windows cannot prebuild iOS.**
- **Upload queue on files in the App Group folder** (`UploadQueue.swift`,
  `clip-shots/`): the app's order (claim → upload both → mark), its refusal
  handling, retry on reconnect (`NWPathMonitor`), on foreground and with
  backoff. The counter is the server's last `shots_left` minus unclaimed and
  still-developing frames. **Every change to it happens in one step**
  (2026-11-19: it rolled 15 → 14, back to 15 and to 14 again, because the
  frame left "developing" before the queue was re-read): `enqueue()` returns
  the new `UnclaimedCount`, the claim and refusal notifications carry it next
  to `shots_left`, and its `revision` keeps an older count from winning.
  The app's `RollCounter` rolls its digits the way the clip's
  `.numericText()` does (slide and fade, no blur). **Neither seen on a
  device.**
- **Hand-off to the full app: the App Group** `group.com.leftmoment.app`
  (both targets carry it). The clip keeps its session (access + refresh
  token, user id) under `left.clip.session` in the group's UserDefaults and
  re-reads it before every refresh. On the app's first launch
  `lib/clip-handoff.ts` adopts it with `auth.setSession()` — only when the app
  has no session of its own — and deletes it; the root layout runs it before
  its session check. Same user, same roll; the film is in Moments.
  `ExtensionStorage` (from `@bacons/apple-targets`) is the native reader; in
  a build without it, its JS is a no-op.
- **Accepted:** frames still queued in the clip when the app replaces it stay
  in the App Group folder, undrained by the app. A refresh token the clip can
  no longer use (revoked, or rotated by the app) ends that identity; the next
  join is a new member with a fresh roll — the known gap.
- **Back swipes (2026-11-19, the user):** a drag in from the left edge closes
  the viewer (app: mode 4 in `PhotoViewer`, with the screen's own swipe-back
  off while a photo is open; clip: `EdgeSwipeBack`) and, in the clip, takes
  Your photos back to the camera (a full-screen cover has no back swipe of
  its own). **Not seen on a device.**
- **Polling, no realtime:** waiting and camera re-read the event every 15 s
  and on foreground.
- **On reopening, the clip asks for its roster row before the event**
  (`ClipModel.load`): RLS hides the event from a non-member, so a guest whose
  row is gone (deleted account) saw "This invite link doesn’t work any more"
  instead of 11 (2026-11-19, build 15).
- **Missions (2026-11-18, `Missions.swift`, `YourShots.swift`).** The
  guest half, as in the app: "Are you one of these?" on 11 (claimed after
  the join); "Missions 1/3" under the counter opens the list, a tap arms the
  next frame ("Next photo: …" at the frame's top edge); the queue tags
  after the claim (claim → tag → upload → mark, a refused tag drops the tag,
  never the photo). **Your photos** — the tile left of the shutter — is the
  guest's own frames (queued files, then signed URLs) with "Mission" on a
  frame to tag it afterwards. **Its viewer is the app's `PhotoViewer`**
  (2026-11-19, the user, for the release): full screen, swipe sideways,
  pinch and double-tap zoom (a `UIScrollView` per page), a tap hides the
  chrome, glass ✕ and "3 / 12", the caption and "Mission" at the bottom. It
  opens from its tile and closes into the current photo's tile with drag
  down — the iOS 18 zoom transition; on iOS 17 a plain cover with its own
  drag down. **Never compiled before the next EAS build.** **No intro sheet** (the
  user's call). Server calls checked against the local stack over HTTP.
- **Invite codes have no I, O, 0 or 1** (`[A-HJ-NP-Z2-9]{6,12}`, here and in
  `lib/invite.ts`): a link with one is "not a LEFT invite". The seed's
  `DEV123` is such a code. The hosted test event is `DEVTEST` (2026-11-18,
  missions on, named people Markus and Anna). "Try again" only shows when
  there is a code to retry — it used to fall through to "Scan an invite".
- **Testing from TestFlight:** App Store Connect → TestFlight → the build →
  App Clip Invocations (`https://leftmoment.com/j/DEVTEST`), then open it
  from the TestFlight app. Local Experiences need the clip installed as a
  clip (Xcode), which a TestFlight install is not.
- **The user's steps** (App Group identifier, EAS credentials for the clip,
  App Clip experiences in App Store Connect, local experience for testing,
  the size check) are `docs/LAUNCH.md` §7a; device checks in §8.

## The demo (2026-11-23)

Decided with the user: a private demo per visitor, "Develop now" instead of a
countdown, sample guests already inside, a floating badge on every page.

- **`TRYLEFT` is a reserved code, not an invite.** A client that meets it
  signs in anonymously and calls `start_demo()` instead of `join_event()`:
  the app (`+native-intent.ts` → `(guest)/demo`, `lib/demo.ts`), the web
  camera (`openDemo()` in `web/src/shoot/app.ts`) and the clip
  (`ClipModel.startDemo`). All three skip name, intro and waiting and open
  the camera.
- **`start_demo()`** (migration `20261123010000_demo.sql`) returns the
  caller's demo — the one still running, the one developed within the last
  hour (so the link reopens its album), else a new one: live, roll 5, 24 h,
  the caller is the **host**. That is why "Develop now" is the ordinary
  `end_event()` and no policy changed. Five a day per user
  (`hint = 'demo_limit'`).
- **The sample guests live in one template event** (`events.demo =
  'template'`, invite `LEFTDEMPLATE`, a host nobody can sign in as). Four
  anonymous users joined and uploaded ten stock photos through the normal
  doors: `node web/scripts/seed-demo.mjs LEFTDEMPLATE` (publishable key; a
  second run is refused with "full"). A visitor's demo (`demo = 'visitor'`)
  copies the roster and the photo **rows**; the files are never copied — the
  rows point into the template's folder, which one storage policy lets any
  signed-in user read. So a `storage_path` is not always under its own
  event's folder: sign what the row says.
- **Retention:** a visitor's demo is purged 7 days after it developed
  (`demo_retention()`), the template never. Demos enqueue no notifications.
- **The clip has an album now** (replacing "the album is the full app's"):
  once any moment is developed, the clip shows the prints three to a row, the
  viewer, and "Get LEFT". No save, share, delete or report there. The web
  camera and the clip show "Develop now" to whoever is `host_id`.
- **The badge** is `web/src/components/TryBadge.astro` (`Base.astro`'s
  `tryBadge`, off on `/j/` and the legal pages): a QR card on wide screens, a
  "Try it now" pill on touch devices, dismissible, hidden while the footer is
  on screen.
- **The website links to `/j/TRYLEFT`** (`SITE.demoPath`; the user,
  2026-11-23, with 1.2.0 about to be released). The released 1.1.0 clip and
  app treat TRYLEFT as an invite and fail ("This invite link doesn’t work any
  more"), so the QR code is broken on iPhones until 1.2.0 is out. `/try` is
  the same demo in the browser only, without the clip's card (`app.ts` reads
  it as the demo) — the fallback: set `demoPath` to `/try`. The badge's
  dismissal lasts for the visit only.
- **To go live:** the migration on the hosted project, then the seed script
  against it, then push the website; the clip and the app need a new build.
  Until the migration is there, `/j/TRYLEFT` shows "Couldn’t start the demo".

## Missions (2026-11-17)

Small photo challenges ("A photo with someone you have never met"), free on
every event. Migration `20261117000000_missions.sql`, client `lib/missions.ts`.
Decided by the user — do not re-litigate:

- **Off by default; 1–3 per guest** (`events.missions_per_guest`, null = off),
  switched on 05.1 or on the host's Missions screen (`(host)/missions`, from
  10). **Creating goes 05.1 → 09 (QR) → 10, missions on or not** (2026-11-19,
  the user, replacing 05.1 → Missions → 09 of 2026-11-18): the host plans the
  missions from 10's Missions row while guests join; 10 has a QR button back
  to 09. **"Start the Event" asks first** (a system alert: the missions are
  handed out and locked, names can no longer change).
- **The planning screen (2026-11-18, the user):** the count is one row with a
  sliders drawer; changing it never touches the list — "Generate N more"
  (`generate_missions()`, migration `20261118000000_missions_generate_move.sql`)
  tops the list up to `max_members` × per guest (personal ones included,
  ceiling 200), unused library missions first, then repeats. **Laid out like
  Apple Reminders** (the user's pick, same day): one mission list, each row
  carries its assignee chip on the right (tap → "Who gets this?" sheet:
  Anyone · every guest · someone not here yet), swipe left deletes, "Select"
  deletes several. A "Guests" row opens a sheet listing everyone who joined
  automatically plus named people, with a + for a name. A joined guest gets a
  `mission_people` row only when a mission is first given to them
  (`ensurePersonFor`). `components/ui/mission-assign.tsx`. Drag-and-drop was
  built and removed the same day. Later the same day (the user): the 1·2·3
  count left the screen — the top card reads "12 of 50 guests get a mission"
  with a + that generates the rest, on/off is a switch beside the title, 05.1
  only has the switch, sheets lift above the keyboard. The list is newest
  first; rows have no Cancel and save on blur. An "Auto-assign" button was
  built and removed (the start deals unassigned missions anyway);
  `auto_assign_missions()` (migration `20261118010000_…`) stays on the
  server, unused. **Not seen on a device.**
- **The host plans before the start, and the start locks it.** The list is
  seeded from a library matched to the event type (`event_type_missions()`,
  20 each, then `general_missions()`, 60), as long as the group could use, at
  most 200 per event. The host rewrites, adds, deletes, and names people
  (typed, for someone not there yet, or linked to a guest who joined) with
  personal missions. Everything is refused once `status <> 'setup'`.
- **Each mission goes to one guest.** Dealt by `deal_missions()` when the
  host starts the event, round by round (everyone's first before anyone's
  second), personal missions first; with fewer missions than guests some get
  none. A late joiner is dealt leftovers by `my_missions()`. No rerolls.
- **A guest claims a name on 11** (`claim_mission_person`), one name each,
  first come first served; a host-linked guest picks nothing. **Names first**
  (2026-11-19, the user, app and clip): the host's names are rows, "Add your
  name" at the end opens the field, tapping a name closes it again; a picked
  name becomes the guest's display name. Only names nobody else holds are
  listed (`mission_people_for_invite()` returns the caller's own as `mine`,
  migration `20261119000000_mission_names_mine.sql`, on the hosted project
  since 2026-11-19), and 11 asks again every 10 s so a taken name disappears. While
  waiting (12) a guest can go back to 11 ("Are you on the list?" / "Change
  your name") until the start; a late joiner still sees unclaimed names.
  **Not seen on a device.**
- **A photo is tagged, never written**: `set_photo_mission()`, one photo ↔ one
  mission, until the film is developed. The upload queue tags after the claim
  as its own step (claim → tag → upload); a refused tag drops the tag, never
  the photo. In the camera, a "Missions 1/3" capsule under the roll counter
  arms the next shot ("Next photo: …" at the viewfinder's top edge); "Your
  shots" can tag a photo afterwards; the viewer captions "Mission · …".
- **The reveal holds**: before developing, a guest reads only their own cards
  and their own photos' tags (RLS on `member_missions`, `event_missions`).
- **Not built:** the mission push notifications (a halfway nudge, the count in
  the last-hour reminder). The web camera and the App Clip (2026-11-18) have
  them. **Nothing seen on a device.**

## Notifications (M4)

- **Two messages, decided and sent by the server.** "Your photos are
  developed." when an event's status flips (trigger on `events`), and a
  reminder `reminder_lead()` (60 min) before the end to guests who still have
  shots, for events of at least 3 h (`enqueue_ending_reminders()`, every
  minute). An event with no photos develops silently.
- **The outbox is `public.notifications`**, one row per event and kind
  (`unique`), which is what makes every writer idempotent.
  `send-notifications` claims rows, asks `notification_recipients()` who gets
  them — that function applies 20's two switches — sends through Expo's push
  API and deletes tokens Expo reports dead. The copy lives in
  `supabase/functions/_shared/expo-push.ts`.
- **Postgres wakes edge functions through pg_net** (`invoke_edge_function()`),
  reading `project_url` and `service_role_key` from **Vault**. Without those
  two secrets nothing breaks — the outbox waits and the purge never runs. The
  functions authenticate the caller by comparing the service-role key.
- **`push_tokens` is keyed by token, not by user**: a phone has one token
  whoever is signed in, the last to register owns it. Written only through
  `register_push_token()` / `unregister_push_token()`.
- **Client: `lib/push.ts`.** `expo-notifications` is `require()`d lazily, so a
  dev build made before the package was added keeps running (without
  notifications). The permission is asked in context, never on first launch:
  a guest waiting on 12, the host on 09, about a second after the first shot
  (`askForPushOnce()`). No foreground handler is set — nothing is shown while
  the app is open. A tap opens the album or the camera (root layout).
- **The switches** (`lib/notification-prefs.ts`) live in AsyncStorage and are
  copied to the token row on every `syncPush()`.
- **`service_role` needs explicit table grants.** On current Supabase a table
  created by a migration gives it none, and RLS bypass does not help. A new
  table an edge function touches needs a `grant … to service_role`
  (`20261115030000_service_role_grants.sql` covers the existing ones — before
  it, the purchase ledger could not be written at all).
- **Real delivery is untested**: it needs APNs/FCM credentials and a device.

## Analytics and legal texts

- **`lib/analytics.ts`: PostHog (EU), JavaScript only, off without
  `EXPO_PUBLIC_POSTHOG_KEY`** — the SDK is not even loaded. Four events
  (`event_created`, `event_joined`, `photo_taken`, `reveal_seen`), fired from
  `lib/`, plus uncaught JS errors. No `identify()`, no names, titles or codes
  in properties. Native crashes are not covered. `mobile/docs/analytics.md`.
- **`constants/legal.ts` is the one source for the app and the website**
  (`web/src/components/LegalDocument.astro` imports it), so it must import
  nothing. **No lawyer has reviewed it.** `LEGAL_DRAFT` (a notice above the
  text, web pages `noindex`) is off since 2026-11-16 — the user's decision for
  a worldwide release, knowing the gaps (no EU representative under GDPR
  Art. 27). Never present it as reviewed; `REVIEW:` comments mark what a
  lawyer should look at.

## Security review (2026-11-16)

Migration `20261116010000_security_hardening.sql`. What it changed, and what
must stay that way:

- **Clients never delete an `event_members` row** — it holds `shots_taken`,
  and delete + `join_event()` was a fresh roll. There is no leave / remove-guest
  feature; if one is built it is an RPC that keeps the count (a flag, not a
  delete).
- **Clients never write a `photos` row.** `claim_shot()` inserts,
  `mark_photo_uploaded(photo, width, height)` attaches the upload — it derives
  both paths from the row and checks the two files exist. `storage_path` used
  to be client-written, and account deletion (service role) and moderation
  deleted whatever it named. **Never delete files by a path read from a row
  with elevated rights**: list the bucket by event prefix
  (`event_storage_paths()`), as `delete-account` and the purge do.
- **The bucket's insert *and* update policies pin the whole path, and only
  while the row is `pending`.** The update policy's `WITH CHECK` is what a
  storage "move" is checked against. Once attached, a print cannot be
  replaced; a queue retry that meets the refusal asks `mark_photo_uploaded()`
  (a no-op on an attached row) and drops the entry (`upload()` in
  `lib/upload-queue.ts`).
- **In a policy on `storage.objects`, write `objects.name`.** Inside a
  subquery over `events` a bare `name` is the *event's* name: the baseline's
  delete policy did that, so host moderation removed no file and a host who
  renamed their event to `{its id}/x` could delete every file they could see.
- **Files whose event is gone are swept by the daily purge**
  (`orphaned_storage_paths()`), so `delete-account` may stay best-effort on
  files.
- **Invite codes are 8 characters from a CSPRNG** (old 6-character codes keep
  working). Still open: `join_event()` has no attempt limit — the CAPTCHA /
  rate-limit item covers it.
- **The purchase ledger is keyed by the store's transaction id by every
  writer** (`ledgerIdOf()`); the client's id (RevenueCat's) only finds the
  purchase. Storing the client's id recorded each purchase twice.
- **`linkIdentity()` links with the native ID token** and only reports success
  for a user who is no longer anonymous and kept their id. The bare
  `auth.linkIdentity({ provider })` is a browser flow and does nothing in RN.
  Needs "manual linking" on in the hosted project.
- **Known and left open:** a guest gets a fresh roll with every new anonymous
  identity (bounded by `max_members`; needs the CAPTCHA item); sandbox
  purchases unlock events (App Review buys in sandbox); realtime DELETE events
  carry primary keys to any subscriber; a purchase could be restored to a new
  account after its buyer's account was deleted.

## Guests have no account

**A guest never signs up.** Link or QR → a name on 11 → in, via Supabase
**anonymous sign-in** (`signInAnonymously()` in `lib/auth.ts`): a real
`auth.users` row with the `authenticated` role, so every policy must be safe for
anonymous users. The session persists; `signInAnonymously()` is idempotent.

**The sign-in prompt comes after the reveal, not before.** `linkIdentity()`
attaches Google or Apple to the *same* user id. It lives in `(auth)/keep` with
`keep-your-film.tsx` as the library fallback; both share one dismissal per user
(`lib/prompt-dismissal.ts`). The album routes to `(auth)/keep` when a guest
leaves it after the reveal.

**A guest cannot host.** `create_event()` reads `auth.users.is_anonymous` and
refuses with `hint = 'anonymous'`; the library's plus routes an anonymous session
to `(auth)/create`. `INSERT` on `public.events` is revoked — `create_event()` is
the only door.

## The ambient glow

A large soft light that **travels and dims through onboarding**.

- Positions live in `GlowPreset` in `constants/theme.ts`, as screen fractions.
- Rendered **once** by `(onboarding)/_layout.tsx` behind the Stack; a screen
  claims its position with `useGlow('event')` on focus.
- It only shows because onboarding screens use `<Screen transparent>`, the Stack
  sets a transparent `contentStyle`, and `Colors.bg` is painted once on the layout
  root. **Breaking any of those three hides the glow.**
- `(library)` and `(host)` get theirs from their layout. A viewfinder never has one.

## The photo backdrop

Landing (01) and the three auth screens sit on
`components/ui/background-slideshow.tsx` (2026-11-16, replacing the looping
video and its 8 MB file — the user's call: "fancy, but not a video"). Four
photos since 2026-11-21 (`assets/images/backdrop/`, 9:16: two wedding pictures,
the road trip, the dinner; no party pictures — the user) each
travel slowly — zoom plus a slight drift, alternating direction — and the next
dissolves in over the one before, which stays opaque underneath so the fade
never dips to black. Timings and travel are `Backdrop` in `theme.ts`; the
screens keep their `VideoOverlay` opacity and gradient. Reduced motion:
cross-fade only. It advances only while its screen is focused. **Not seen on a
device.**

## Open gaps

The launch list lives in `docs/MILESTONES.md`. Things that bite during development:

- **"Edge Function returned a non-2xx status code" on creating an event,
  locally, usually means the edge runtime container is down** (seen
  2026-11-15: `supabase_edge_runtime_LEFT` had exited while the rest of the
  stack ran, so `create-event` answered 503). `docker start
  supabase_edge_runtime_LEFT`, or restart the stack.
- **Anonymous sign-ins must be enabled in the Supabase dashboard**, or every guest
  join fails quietly ("Joining isn't available right now"). Set the rate limit
  while there. **Do not turn on CAPTCHA yet:** the app sends no captcha token,
  so with it on no guest could join.
- **A new or renamed edge function is not served locally until the stack
  restarts** (`npm run db:stop && npm run db:start`): the edge runtime gets its
  function list at start, and answers "Function not found" until then.
- **Push and retention need two Vault secrets** (`project_url`,
  `service_role_key`) — locally (README) and on the hosted project
  (`docs/LAUNCH.md`).
- **Reports notify nobody and there is no user blocking** — the operator has
  to run the daily query (`docs/LAUNCH.md` §11).
- **`pg_cron` must be enabled on the hosted project** or events never end on their own.
- **leftmoment.com is not bought yet, so invite links are dead** outside the dev scheme.
- **`@react-native-google-signin` cannot be imported in Expo Go** — it is behind a
  lazy `require()` inside `signInWithGoogle`. Keep it that way.
- **Apple gives a name exactly once.** Landing routes to `(auth)/name` when
  `resolveDisplayName()` is empty; the name must be written before `createEvent()`.
- **Onboarding draft state** is a Context mounted in the root layout; the
  `reset()` after a successful create is load-bearing.
- **A hand-inserted `auth.users` row needs `''` in its token columns**
  (`confirmation_token`, `recovery_token`, `email_change_token_new`,
  `email_change`), or GoTrue answers "Database error querying schema" on
  password sign-in. `seed.sql` does this; the seed host can sign in.
- **A local stack from before M1 has the old schema** — run `npm run db:reset`
  at the root once (it wipes local data).
- The store products `left_small`, `left_medium`, `left_large` and `left_unlimited` do not
  exist yet (`mobile/docs/payments.md`).
- `react-native-vision-camera-skia` is unused but still installed: removing it
  changes the native iOS build, which cannot be built here. `expo-linking` and
  `expo-symbols` are peers of `expo-router` and stay; `expo-device` is read by
  PostHog for the device model.

## Constraints

- **Dark-only. Portrait-locked.**
- **Expo Go covers navigation only.** Camera, Skia, media library, Google/Apple sign-in,
  purchases, notifications, 09's "Save QR" and 08's QR scanner need a dev build
  (`mobile/docs/social-sign-in.md`).
- **`.env` is optional, but data screens look broken without it.** Copy
  `mobile/.env.example` to `.env`. **On a device use the machine's LAN IP, not
  127.0.0.1.**

## Three failures that look like code bugs

**"Network request failed" means the LAN IP moved.** `npm run db:status`, put the
WLAN IP (not `vEthernet (WSL)`) into `mobile/.env`, then `npx expo start --clear`
— `EXPO_PUBLIC_*` are baked in at bundle time, so skipping `--clear` makes the fix
look like it failed.

**Supabase errors are usually not `Error` objects.** `error` is a plain object,
so `String(e)` gives `"[object Object]"`. Always go through `messageFor()`
(`lib/auth-errors.ts`).

**`babel.config.js` is load-bearing.** `react-native-worklets/plugin` must be
listed, **last**, and it is not `react-native-reanimated/plugin`. Without it the
bundle is clean and the app white-screens at runtime — invisible to typecheck and
lint. Check this first after animation work.

## Walking the app without a provider

- **"Skip sign-in (dev)" on Landing** signs in anonymously *for real* — it reaches
  the library and the guest half, and cannot create an event.
- **`supabase/seed.sql`** (`npm run db:reset`) seeds an event with a host
  (`devhost@left.local` / `devpassword`) and two guests. Invite code **`DEV123`**.

## Before calling anything done

```bash
cd mobile
npm run typecheck    # tsc --noEmit
npm run lint         # expo lint
```

Both must be clean. Then run it and look at the screen on a device — a passing
typecheck is not evidence that a screen looks right.
