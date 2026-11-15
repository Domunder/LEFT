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
- **Next:** `(capture)/camera` (M2) and `(library)/album/[id]` (M3) are
  placeholders (`components/dev/placeholder.tsx`). Create → invite → join → start
  works and stops at the camera placeholder.

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
03 Format · 05.1 film length/pricing · 10.1 budget info · 13 Camera · 14 Processing ·
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

Expo **SDK 54** / React Native 0.81 / React 19 / TypeScript / expo-router with
typed routes and the React Compiler. Backend: Supabase (Postgres, Auth, Storage,
Realtime, edge functions). Purchases: RevenueCat, one consumable SKU.

- Versioned docs: https://docs.expo.dev/versions/v54.0.0/. `expo-image` has no
  `resizeMode="repeat"`, so tiling needs RN's own `<Image>`.
- Add native packages with `npx expo install`.
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
    (capture)/            13 Camera (placeholder → M2)
    (library)/            15/16 Films · album/[id] (placeholder → M3)
    (modals)/             08 Join sheet · Delete account
    settings.tsx          20 Settings
    +native-intent.ts     invite link -> 11
  components/ui/          shared primitives
  components/dev/         placeholder.tsx — scaffold, delete when M3 is done
  constants/              theme.ts, typography.ts — all design values; looks.ts
  lib/                    supabase, auth, auth-errors, entry, events, photos,
                          storage, roll, tiers, purchases, realtime, invite,
                          event-end, film-status, film-tint, zoom,
                          notification-prefs
  types/database.ts       generated — `npm run db:types` at the root
supabase/                 migrations/ (one baseline), functions/, seed.sql
```

Vocabulary: an event is a **film**; a guest's allowance is their **roll**; an
event ends by being **developed**. "Film" in file names (`film-card`,
`film-status`) is that metaphor, not video — keep it.

Kept on purpose for M2: `lib/zoom.ts`, `zoom-selector.tsx`, `event-countdown.tsx`,
`grain-overlay.tsx`.

## The roll model

The server half exists (`supabase/migrations/20261115000000_baseline.sql`); the
camera and upload queue that use it are M2.

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
  retries. (The video version never had this — it was its biggest gap.)
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
(`lib/prompt-dismissal.ts`). `(auth)/keep` is currently unreachable — M3 routes to
it after the reveal.

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
- **A local stack from before M1 has the old schema** — run `npm run db:reset`
  at the root once (it wipes local data).
- `constants/legal.ts` still describes video; rewritten in M6.
- The store product `left_unlimited` does not exist yet (`mobile/docs/payments.md`).
- Unused dependencies to prune in M6 unless a milestone picks them up:
  `expo-device`, `expo-symbols`, `expo-web-browser`, `expo-linking`,
  `@gorhom/bottom-sheet`. (`expo-file-system`, `expo-image` are needed by M2/M3.)

## Constraints

- **Dark-only. Portrait-locked.**
- **Expo Go covers navigation only.** Camera, media library, Google/Apple sign-in,
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
