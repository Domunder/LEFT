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
  `screen-builder` (one screen end to end), `launch-auditor` (read-only audit).

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
    (modals)/             08 Join sheet · Delete account
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
                          analytics, my-shots, album, covers, motion
  types/database.ts       generated — `npm run db:types` at the root
supabase/
  migrations/             baseline, price tiers, notifications, service_role
                          grants, retention
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
  offscreen over a capture and encodes original (long edge 3000) + thumbnail
  (640). Change a look in the recipe and both follow. Recipes are provisional.
- **The looks are colour schemes, not effects** (decided 2026-11-15): warm
  (Golden), cool (Chrome), washed out (Faded), black and white (Mono) — muted
  and clean, with only a trace of grain, vignette and lens fringing (`LENS`) in
  the print. **The viewfinder draws no grain at all**, only the colour.
- **The viewfinder shows the film, exactly.** The camera is
  `react-native-vision-camera` 5; the viewfinder is our own
  `components/ui/film-camera.tsx` (`FilmCamera`). The frame output delivers
  small BGRA frames, the frame worklet copies each into a CPU image and hands
  it to the JS thread, and a `<Canvas>` draws it through the same shader as the
  JPEG (uniforms from `liveLookUniforms()`) — the same tree as `LookPreview`.
  Mono's viewfinder is black and white.
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
  pinch still zooms.
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
- **A frame's pixels are freed by the garbage collector, not by `dispose()`**
  (a no-op in Skia 2.2.12; not re-checked on 2.14), and a JS heap only counts an image's megabytes if
  the image was *made* in it. So `film-camera.tsx` sends the raw `SkData`
  across and makes an image in each runtime it passes (JS thread: a throwaway,
  to be charged; UI thread: the one drawn). Handing one image across runtimes
  leaks about 90 MB/s until some heap happens to collect. **Watch the memory
  gauge on the first device run.**
- **Keep the preview frames small.** Every frame is copied once (about 3 MB at
  768x1024) and uploaded to the GPU on draw. Hence `HD_4_3`,
  `enablePreviewSizedOutputBuffers` and 30 fps in `film-camera.tsx`, and the
  camera skips frames while the JS or UI thread is behind (`MAX_IN_FLIGHT`).
  `[camera] frame` logs the real frame size in dev.
- **Photos are captured at 4:3, up to 3024x4032**, as JPEG (`usePhotoOutput`).
- **`GrainOverlay`'s tiled image does not repeat reliably over a large area**
  (seen as one tile top-left over the viewfinder). Nothing uses it any more;
  the component is kept on purpose.
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
  cannot be overdrawn. Accepted risk: frames still unclaimed when the event ends
  are refused by the server and dropped.
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
- **The album is one route with two states**, decided by `isDeveloped()`:
  `DevelopingFilm` (countdown, photo count from the roster's `shots_taken` —
  the photo rows are hidden by RLS — and the host's "develop now"), then the
  grid. It is reached from the camera's roll-empty state and from a live
  card's status capsule.
- **A developed album opens with `AlbumHero`** (`album-hero.tsx`; decided
  2026-11-16 by the user, from a reference, replacing the three-column grid
  under a small title): one of the album's photos, drawn at random per visit,
  full-bleed and going dark towards the event's name, the two counts and
  "Save all"; under it the prints two to a row with the photographer's name
  on each. The hero shows the thumbnail first and the original over it, it
  stretches on overscroll, a tap opens it in the viewer, and in the reveal it
  is print 0. Only the back button floats. **Not seen on a device.**
- **The reveal** plays once per film and phone (`left:reveal-seen:{id}` in
  AsyncStorage): the sheet waits dark until the first thumbnails are
  prefetched, then `RevealVeil`s clear one after another, a haptic at the start
  and at the end. Reduced motion: one cross-fade. Timings are `Album.reveal`.
- **Save and share** go through `lib/album.ts`: the original is downloaded
  once into the cache, saved with `MediaLibrary.Asset.create`, shared with RN's
  own `Share` on iOS and `expo-sharing` on Android (lazily required; **never
  run**). Owner or host can delete (`deletePhoto`, RLS).
- **`(auth)/keep` is reached when an anonymous guest leaves a developed album**
  (once, unless declined) — after the photos, never in front of them.
- **A member can report someone else's photo** (2026-11-16, required by both
  stores): the flag in the album viewer, where the host and the photographer
  have the bin instead. `reportPhoto()` → `report_photo()` → `photo_reports`,
  which no client can read. Nothing notifies the operator and the photo stays
  visible until someone acts — the daily query is in `docs/LAUNCH.md` §11.
  The copy promises a look within 24 hours. **Not seen on a device.**
- **The library's title is "Moments"** (2026-11-16, the user; was "Your
  Moments"), and its list blurs and dissolves into the page at the top and
  bottom edge instead of being cut off (`components/ui/scroll-edge.tsx`,
  tokens `ScrollEdge`): stacked blurs under a gradient in `Colors.bg`, since
  RN has no progressive blur. **Not seen on a device.**
- **The library is a list of compact cards** (decided
  2026-11-16 by the user, replacing the full-screen carousel of photo stacks
  of 2026-11-15 — thumbnails blown up to the screen looked soft and only one
  moment fitted; do not go back). Each moment is a `MomentCard`
  (`moment-card.tsx`): name, "42 photos · 18 people", a status capsule and a
  strip of four photos whose last tile is blurred and reads "+N" when there
  are more. A developed moment shows its album's first photos; one that is
  not shows **the viewer's own latest frames** (RLS returns nothing else), or
  empty frames — `lib/covers.ts`. The photo count before the reveal is the
  roster's `shots_taken`, summed (`listMyEventSummaries`). A running moment
  opens its camera, or the album's developing state once the viewer's roll is
  used up; its status capsule opens the developing state (the host's "develop
  now") and its strip "Your shots". **With no moments** the screen is
  the one large `NewMomentCard` stack of sample prints ("Start your moment",
  join capsule) — the only place the stock pictures (`constants/samples.ts`)
  and `PhotoStack` are still used. **Not seen on a device.**
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
- **"Start the Event" stays** (decided 2026-11-15): the host's tap on 10 moves
  the event from `setup` to `live`; guests wait on 12 until then.
- **No web album for now** (decided 2026-11-15). Developed albums are seen in
  the app only.

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
`roll_size`, `max_members` or `shots_taken`, and cannot INSERT events or photos —
`create_event()` and `claim_shot()` are the doors.

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

Landing (01), the join sheet (08) and the three auth screens sit on
`components/ui/background-slideshow.tsx` (2026-11-16, replacing the looping
video and its 8 MB file — the user's call: "fancy, but not a video"). Six
photos (`assets/images/backdrop/`, 9:16 crops of the website's pictures) each
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
- **There is no "report photo"** — Apple's guideline 1.2 expects one for
  user-generated content. Only the host's and the author's delete exist.
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
