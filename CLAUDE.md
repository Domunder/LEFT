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
  photos, the reveal in RLS and the single SKU; regenerated types; `lib/photos.ts`,
  `lib/storage.ts`, `lib/roll.ts`, `lib/tiers.ts`; onboarding 03 is the film/look
  picker and 05.1 picks group and roll. Verified against a local stack with SQL
  (roll, idempotent claim, reveal, storage policies, paid path); **not yet run on
  a device**.
- **Done (M2), partly run on a device:** the look pipeline (one Skia shader,
  `lib/look-shader.ts`), real look previews on 03, the camera
  (`(capture)/camera`) and the durable upload queue (`lib/upload-queue.ts`).
  Typecheck and lint are clean. The dev build with
  `react-native-vision-camera` 5 builds and the camera opens (2026-11-15). The
  viewfinder was then rewritten (`components/ui/film-camera.tsx`) after a crash
  on the camera; **that rewrite, the flash and the camera flip are not yet
  confirmed on a device** — it is JS only, no new build needed.
- **Done (2026-11-15), not run on a device: the upgrade to Expo SDK 58**
  (RN 0.88, React 19.3, Reanimated 4.7, Worklets 0.13, Gesture Handler 3,
  Skia 2.14). Typecheck, lint, `expo-doctor` and an iOS bundle export are
  clean; **no native build has been made**, so the camera stack on the new
  versions is unproven. The old dev build cannot load this bundle.
- **Done (M3), not run on a device:** the album (`(library)/album/[id]`) with
  its "developing" state and the reveal, the shared `PhotoViewer`, save /
  share / moderation / "develop now", the Films carousel with real covers, and
  the `Glass` primitive (Liquid Glass on iOS 26+). See "Album, viewer and
  glass (M3)" below.
- **Next:** a dev build on SDK 58, then the device pass for M2 and M3; the glass
  and motion audit of the older screens is proposed, not applied (MILESTONES).

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
Realtime, edge functions). Purchases: RevenueCat, one consumable SKU.

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
- `expo-video` stays for one thing only: the ambient background loop
  (`components/ui/background-video.tsx`) and 03's preview cards.

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
    (library)/            15/16 Films (carousel) · album/[id] (developing → reveal → album)
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
                          look-shader, upload-queue, notification-prefs,
                          my-shots, album, covers, motion
  types/database.ts       generated — `npm run db:types` at the root
supabase/                 migrations/ (one baseline), functions/, seed.sql
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
  against Worklets 0.13 / RN 0.88 **has not been built**; if the iOS build
  fails there, that pairing is the first suspect. `@react-native/metro-config`
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
  list the mode. **No flash has been seen on a device yet** (not with
  `expo-camera` either); `[camera] fire` and `[camera] torch` log every step in
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
  (seen as one tile top-left over the viewfinder). Landing still uses it.
- **A guest can see their own frames before the reveal** (decided 2026-11-15,
  replacing "no preview at all"): `(capture)/roll`, from the tile bottom-left of
  the camera, which shows the last photo taken. Both read `lib/my-shots.ts`:
  uploaded rows + frames still in the queue. Others' stay hidden — RLS.
- **Any member can invite from the camera** (decided 2026-11-15): the tile
  bottom-right of 13 opens 09 with `from=camera` — QR, link, back to the
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
  glass view's opacity (fade a wrapper). `GlassPanel` and `CircleIconButton`'s
  `glass` variant are the older blur surfaces; moving them over is part of the
  proposed audit, not done.
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
  poster's status capsule.
- **The reveal** plays once per film and phone (`left:reveal-seen:{id}` in
  AsyncStorage): the sheet waits dark until the first thumbnails are
  prefetched, then `RevealVeil`s clear one after another, a haptic at the start
  and at the end. Reduced motion: one cross-fade. Timings are `Album.reveal`.
- **Save and share** go through `lib/album.ts`: the original is downloaded
  once into the cache, saved with `MediaLibrary.Asset.create`, shared with RN's
  own `Share` (iOS only — Android's `Share` cannot send a file; `expo-sharing`
  would need adding). Owner or host can delete (`deletePhoto`, RLS).
- **`(auth)/keep` is reached when an anonymous guest leaves a developed album**
  (once, unless declined) — after the photos, never in front of them.
- **Films is a carousel** (decided 2026-11-15, replacing the artboard's list):
  a native horizontal scroll of `FilmPoster`s; neighbours recede with the
  scroll position; the film in front is blurred into the backdrop. Covers come
  from `lib/covers.ts` — your own latest shot while live, the album's first
  photo once developed (RLS decides, not the client), the tint until then.

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

- **Pricing: free up to 100 guests and a 36 roll. One SKU, "LEFT Unlimited"**
  (~5 CHF, one purchase per event, paid by the host at creation) unlocks the ∞
  roll and events up to 200 guests. `create_event()` is the authority; the
  pay-first-then-create flow in `hooks/use-event-creation.ts` stays.

Statuses: `setup → live → developed`. Clients cannot write `status`, `ends_at`,
`roll_size`, `max_members` or `shots_taken`, and cannot INSERT events or photos —
`create_event()` and `claim_shot()` are the doors.

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

## Asset defect

`assets/video/left-bg.mp4` has a malformed `tkhd` box (declares 16384x1080 instead
of 1080x1920). `background-video.tsx` works around it with an explicit 9:16 box
and `contentFit="fill"`. The real fix is a re-encode; then the workaround reverts
to `absoluteFill` + `cover`.

## Open gaps

The launch list lives in `docs/MILESTONES.md`. Things that bite during development:

- **Anonymous sign-ins must be enabled in the Supabase dashboard**, or every guest
  join fails quietly ("Joining isn't available right now"). Turn on CAPTCHA and
  the rate limit while there.
- **`pg_cron` must be enabled on the hosted project** or events never end on their own.
- **leftmoment.com does not exist, so invite links are dead** outside the dev scheme.
- **`@react-native-google-signin` cannot be imported in Expo Go** — it is behind a
  lazy `require()` inside `signInWithGoogle`. Keep it that way.
- **Apple gives a name exactly once.** Landing routes to `(auth)/name` when
  `resolveDisplayName()` is empty; the name must be written before `createEvent()`.
- **Onboarding draft state** is a Context mounted in the root layout; the
  `reset()` after a successful create is load-bearing.
- **Settings' two notification switches gate nothing** — there is no push
  infrastructure yet (M4).
- **The seed host cannot sign in with its password** — `signInWithPassword` for
  `devhost@left.local` answers "Database error querying schema" (seen 2026-11-15
  against the local stack). Not investigated; the app has no password sign-in.
- **A local stack from before M1 has the old schema** — run `npm run db:reset`
  at the root once (it wipes local data).
- `constants/legal.ts` still describes video; rewritten in M6.
- The store product `left_unlimited` does not exist yet (`mobile/docs/payments.md`).
- Unused dependencies to prune in M6 unless a milestone picks them up:
  `expo-device`, `expo-symbols`, `expo-web-browser`, `expo-linking`,
  `@gorhom/bottom-sheet`. (`expo-image` is needed by M3.)

## Constraints

- **Dark-only. Portrait-locked.**
- **Expo Go covers navigation only.** Camera, Skia, media library, Google/Apple sign-in,
  purchases, 09's "Save QR" and 08's QR scanner need a dev build
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
