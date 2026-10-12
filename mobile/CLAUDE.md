@AGENTS.md

# LEFT — project guide

A group-video event app. Everyone at a wedding, birthday, trip or party films
into **one shared time budget** — if someone records 10s of a 60s budget, the
whole group has 50s left. The clips play back to back as one shared film.
**Nothing is rendered and no video is generated**: the film *is* the clips, in
order. Pricing is one-time per event, tiered by group size, paid at creation and
free up to four people. No subscription.

## How we work together

Screen by screen, and deliberately: the user prompts → **Claude thinks and asks
clarifying questions** (`AskUserQuestion` for anything genuinely ambiguous — the
user prefers being asked over being surprised) → the user gives the go → only
then is code written.

- **One screen at a time**, finished functionally, not just visually. Shared
  code (a hook, a lib, a store) may be built whenever a screen needs it.
- **Read the design before designing a solution.** Open the prototype markup for
  the screen being built.
- **If the design is wrong or incoherent, say so and fix it** — the product
  should feel whole, not like 21 disconnected frames. Flag the change; never
  deviate silently.

## Spec authority

| Source | Role |
|---|---|
| `design/LEFT App.dc.html` | The prototype. **Pixel-accurate source of truth.** |
| `design/README.md` | The written handoff. Context, tokens, intent. |

**On conflict the prototype wins, and the conflict gets flagged to the user.**
Recreate it with React Native primitives — never port its HTML/CSS.

Deviations already decided (do not re-litigate) are recorded as header comments
in the screens themselves and in git history. The cross-cutting ones:

- **Auth is the app's entry, not the end of onboarding.** Landing (01) carries
  Google, Apple and Join. `lib/entry.ts` decides where a signed-in user lands.
  `ONBOARDING_STEPS` is 4. Screens 06 (name) and 07 (unlock) were folded away —
  06 is now the detour Apple forces, 07 lives inside 05.1.
- **Payment is a phase inside 05.1, not a screen** — a state machine in
  `hooks/use-event-creation.ts`, and a precondition of `createEvent()` for any
  group over four. It moved to 17 for as long as there was a rendered film to
  sell a clean copy of, and moved back when there was not.
- **Email/password was dropped.** Apple must appear on iOS anyway, and a third
  button does not fit the artboard's two-up row.
- **The prototype renders headlines in Georgia** because Newsreader is missing
  from its font `<link>`. The app is right; do not "fix" it to match.
- **The prototype's HTML comments use stale screen numbering.** Trust the visible
  frame label.
- **Invite links are `https://leftmoment.com/j/{CODE}`, not `left://`** — a
  custom scheme renders as dead text in WhatsApp/iMessage. The old scheme is
  still accepted by `app/+native-intent.ts`. There is no manual code entry
  anywhere: both real ways in (QR, tapped link) already carry the code.
- **What RN cannot draw is approximated, and the approximations are documented
  in place**: radial/conic gradients (concentric circles + one linear wedge),
  view blur, motion blur (opacity dip + scale swell). `react-native-svg` is now a
  dependency and is the exact-swap for `ambient-glow.tsx` if it ever matters.
- **Screens carry states the artboard does not draw** — loading, error, empty,
  permission-denied, out-of-budget. The artboard only ever draws the happy path.

## Stack

Expo **SDK 54** / React Native 0.81 / React 19 / TypeScript 6 / expo-router with
typed routes and the React Compiler enabled.

- Read the versioned docs at https://docs.expo.dev/versions/v54.0.0/. Two APIs
  already moved: `VideoView` takes `fullscreenOptions={{ enable: false }}`, not
  `allowsFullscreen`; `expo-image` has no `resizeMode="repeat"`, so tiling needs
  RN's own `<Image>`.
- Add native packages with `npx expo install`, never plain `npm install`.
- Backend is Supabase (`@supabase/supabase-js`), schema in `../supabase/`.

## Architecture

```
src/
  app/                    expo-router routes — one file per design screen
    index.tsx             01 Landing
    (onboarding)/         02 Event · 03 Format · 04 Ending · 05.1 Group size
    (auth)/               06 Your name · Keep your film · Start your own
    (legal)/              Terms · Privacy — store-required, not in the prototype
    (host)/               09 Invite · 10 Your group
    (guest)/              11 Name · 12 Waiting
    (capture)/            13 Camera · 14 Processing
    (library)/            15/16 Films · 17 Clip detail
    (modals)/             08 Join sheet · 10.1 Group info · Delete account
    settings.tsx          20 Settings
    +native-intent.ts     maps incoming deep links onto routes (invite link -> 11)
  components/ui/          shared primitives — build screens from these
  constants/              theme.ts, typography.ts — all design values
  lib/                    supabase, auth, auth-errors, entry, events, budget,
                          pricing, tiers, purchases, invite, clips, clip-*,
                          film-status, film-tint, live-activity, zoom
  plugins/ modules/       withLiveActivity.js + Swift widget, ActivityKit module (19)
  types/database.ts       generated; refresh with `npm run db:types` at the root
```

**Never hardcode a color, radius, font size or spacing value in a screen.** Add a
token to `constants/` and use it. This is the rule most often broken by accident
and the most annoying to clean up later.

Two design screens are deliberately **not** routes: **18 · toast**
(`components/ui/toast.tsx`, hosted once in the root layout, raised with
`useToast()`) and **19 · lockscreen** (an iOS Live Activity — native code plus a
config plugin, impossible in Expo Go *and* in the current dev build).

## The shared budget model

The one decision the whole app rests on. Read before touching the camera.

**The budget is server-authoritative. A client never decrements it.** If two
phones each trusted a local "20s left", both would film 20s and overspend.

**A hold is a place in a queue, not a claim on seconds.** The first version got
this backwards: a hold was subtracted from what everyone else could see, so the
first person to press record was granted the whole pool and every other phone
read "out of filming time" with nine minutes left.

1. **Record-start** — `reserve_budget(event_id, seconds)` row-locks the event and
   takes a queue place, granting against `available_seconds` (`budget_seconds -
   used_seconds`, blind to everyone's holds). **Every member sees the same number
   and may film against it at once.** `granted_seconds` is still the hard cap;
   `0` still means the group is out. Holds expire after 15 minutes.
   **A take is also capped at `max_take_seconds()` (20s) however much is left**, so
   `granted_seconds` is `least(asked, affordable, 20)`. One member cannot spend the
   group's pool in a single hold, and the film ends up made of short shots.
   `Camera.maxTakeSeconds` in `constants/theme.ts` is the client's copy — it draws
   the countdown and the record ring, and the two numbers must be kept equal.
2. **Record-stop** — `commit_reservation(reservation_id, actual_seconds)` records
   the length and settles the queue as far as it can. Discarded takes call
   `release_reservation`, which also drains the queue.

Overspending is prevented at settlement, **in the order takes started**
(`budget_reservations.created_at`, stamped before the camera rolls). With 50s and
A starting before B:

| A films | B films | Result |
|---|---|---|
| 10s | 10s | both kept — 20s used |
| 50s | 50s | A kept, **B dropped entirely** |
| 40s | 20s | A kept at 40s, **B truncated to its first 10s** |

`resolve_takes()` is the whole rule: walk one event's unresolved reservations in
start order, charge each `least(ceil(filmed), held, budget - used)`, and **stop
dead at the first take still rolling**.

**So a commit has three answers**: `'charged'`, `'dropped'`, `'waiting'` — the
last meaning an earlier take is still rolling, so this one's price depends on a
length nobody knows yet. That latency is forced by the rule, not the
implementation.

| | Answers | Used by |
|---|---|---|
| `available_seconds()` | "how much may I claim?" | reserve, the bar, the toast |
| `remaining_seconds()` | "how much is unaccounted for?" | nothing load-bearing |

Progress bars update from realtime `UPDATE`s on `public.events`; a phone learns
its own waiting take's fate from realtime on `public.budget_reservations`. RLS
there is "members can read", so `subscribeToMyTakes` filters on `user_id` itself.

**A truncated take is trimmed at playback, not on disk** — the file is still 20s,
`clips.duration_seconds` says 10. There is no ffmpeg in this project.

### How the camera settles a take

```
reserve_budget -> record -> commit_reservation -> upload -> markClipUploaded
  (queue place)              (charged|dropped|waiting)     (bucket)
```

`lib/clips.ts` owns all of it (`finishTake`). The ordering matters:

- **The storage path is keyed by reservation id, not clip id**, so the path is
  knowable before a clip row exists and a 'waiting' take can upload immediately
  instead of being held hostage by an unrelated member's take. `attachUpload()`
  joins the two once the clip id arrives.
- **A failed upload does not throw.** The take is reported, the recording is
  still cached, the row is marked `clip_status: 'failed'`. Fired without await so
  a slow venue network never blocks the next take.
- **A dropped take uploads nothing** — no row for a file to belong to.
- A take under `Camera.minClipSeconds`, or an abandoned one (background, unmount,
  camera error), calls `release_reservation`.

### The double-count race (worth not repeating)

The bar once read 22 after a 10s take: the camera inferred "my take landed" from
`used_seconds` rising, and the realtime UPDATE routinely beat the commit's own
HTTP response. Two rules replace it, and neither can race:

- **`used_seconds` is monotonic** — every write goes through `Math.max`, so a
  late frame is a no-op rather than a correction.
- **A pending take is retired only by an explicit verdict about that
  reservation**, never by watching the budget move.

The same race reappeared as a brief spike. Two things close that window: the
camera **defers realtime `used_seconds` while one of its own takes is in flight**
(`commitsInFlight` / `applyRemoteUsed`, flushed at `onCommitted` — not when
`finishTake` resolves, which is after the upload), and `resolve_takes()` **writes
the reservation verdict before the `events` bump**, so a phone is told "stop
counting your take" before it is told "the budget moved".

### How an event ends

```
setup --start_event()--> live --finish_event()--> processing --compile_film()--> ready
```

- **`finish_event()`** is called by whichever member's phone notices the budget
  hit zero — the budget is shared, so not just the host's. Idempotent and
  row-locked. It **refuses while any budget remains** (so a client cannot cut
  everyone short) and **while any take is unresolved** (the last filmer's footage
  has not been priced yet).
- **Everyone else is carried along by realtime**, not by anything they did — 13
  routes to 14 on 'processing', 14 routes onward on 'ready'.
- **`compile_film()` makes no video**; it marks the event watchable. 14 calls it
  once uploads finish and routes onward. Nothing else happens, and nothing here
  should ever be made to wait on something that does.
- **Clips are ordered by when recording *started***, not when it stopped: the
  reservation's `created_at` is passed explicitly, because `commit_reservation()`
  runs on stop and `now()` reversed two members who started together.

### The film

**The film is the clips, played back to back, and there is nothing else.** No
ffmpeg, no rendering service, no generated video. `compile_film()` makes no video
either — it moves the event to 'ready', which means "every clip that is coming has
arrived", and 17 is watchable the moment that is true.

A rendering API (Shotstack) briefly sat on top of this, stitching the clips into
one mp4 and *selecting* which takes made the cut. It is gone, and three things
went with it: `events.film_seconds` (the pool and the film are one number again),
the 2.5x capture ratio that existed only to give the selector something to choose
between, and the watermark/4K paywall, which had nothing left to sell.

So a `PlaylistEntry` carries one offset — `sequenceOffsetSeconds` — and it means
what it says. Every clip with a file is in the film. **A clip is trimmed at
playback, not on disk**: `timeUpdate` stops it at `duration_seconds`, which is
what the group was *charged*, and the file itself can be longer. That cut is the
one thing keeping the film inside the budget it sold.

Seam: `hooks/use-clip-playlist.ts`. Do not reintroduce a second playback path
without also reintroducing everything above.

Three playback facts: `playToEnd` carries no payload, so auto-advance needs
`useEventListener`, not `useEvent` (the latter holds null forever and the film
silently stops after one clip); there is **one player**, swapped with
`replaceAsync` under a short scrim (expo-video binds a player to one surface);
signed URLs are re-minted at clip boundaries when the batch will not outlive the
rest of the film.

## Guests have no account

**A guest never signs up.** Link or QR → a name on 11 → in. That works via
Supabase **anonymous sign-in** (`signInAnonymously()` in `lib/auth.ts`): a real
`auth.users` row with no email or provider. The schema needs one — `join_event()`
requires `auth.uid()`, every RLS policy keys off membership, `clips.user_id` must
point somewhere. Anonymous users carry the `authenticated` role, so **every
existing policy already accepts them**. The session persists across restarts, and
`signInAnonymously()` is idempotent — minting a second identity would orphan the
first one's membership.

**The sign-in prompt comes after the film, not before.** `linkIdentity()`
attaches Google or Apple to the *same* user id, so membership and clips survive.
It fires from `(auth)/keep` (14 replaces onto it when the event turns 'ready')
with `components/ui/keep-your-film.tsx` as the library fallback; both share one
dismissal, remembered per user id (`lib/prompt-dismissal.ts`).

**A guest can join, film and watch. A guest cannot host** — an anonymous identity
lives in one device's AsyncStorage and nowhere else. Gated in two places:
`create_event()` reads `auth.users.is_anonymous` and refuses with
`hint = 'anonymous'` (the **column**, not `auth.jwt()`, which is stale until the
session refreshes), and the library's plus routes an anonymous session to
`(auth)/create`. This applies to Landing's dev skip too — it signs in anonymously
*for real*, so testing the host flow needs a dev build.

**Events are server-created for the same reason.** `INSERT` on `public.events` is
revoked from clients; `create_event()` is the only door, and it *derives* the
budget rather than trusting one. It also claims the purchase, in the same
transaction as the insert. See `docs/payments.md`.

## Money: paid to make, free to keep

**Creating an event is free up to four people and paid above that, and the ask is
on 05.1, before the party.** It sat on 17 instead for as long as the thing being
sold was a *clean re-render* of a watermarked film. With no renderer there is
nothing to charge for after the fact — the clips are the group's own footage and
were always downloadable unwatermarked — so the charge went back to creation.

**One number, one moment.**

| | Decided | Does what |
|---|---|---|
| Group size | 05.1, before the party | sizes `budget_seconds`, and prices the event |

`public.budget_plan(max_members)` is the authority on how much a group may film —
`create_event()` derives it rather than taking it from a client, which is what let
five of the old six copies of the tier table go. `lib/pricing.ts` is a **display
mirror with no authority**; if it drifts a screen quotes slightly wrong copy and
nothing is oversold.

| Group | Shared filming time | Each person films | Price |
|---|---|---|---|
| ≤4 | 60s | ~15s | free |
| ≤10 | 2m | ~12s | $4.99 |
| ≤25 | 4m | ~9s | $14.99 |
| ≤50 | 6m | ~7s | $14.99 |
| ≤100 | 8m | ~4s | $29.99 |
| ≤200 | 10m | ~3s | $29.99 |

**The budget and the film are the same number.** They came apart while a renderer
selected a short film out of a 2.5x pool of footage; with the clips played whole
there is no surplus to select from, and a pool bigger than the film would just be
footage nobody watches. Pick two minutes, film two minutes, watch two minutes.

05.1's picker may only make the pool **shorter** — each tier's options top out at
its default, and `create_event()` refuses anything longer, which is what makes
offering the choice safe at all. The options are drawn face-up
(`components/ui/film-length-choices.tsx`), each labelled with the per-person
filming time it buys.

Three SKUs, priced on the group size the host picks:

| Group | Price | Product ID |
|---|---|---|
| ≤4 | free | — |
| ≤10 | $4.99 | `left_film_unlock_10` |
| ≤50 | $14.99 | `left_film_unlock_50` |
| any | $29.99 | `left_film_unlock_unlimited` |

The ids read `left_film_unlock_*` because they are the ids the store rows will be
created with, and renaming a SKU that has ever shipped strands the receipts bought
under it. **The SKU table exists in two places**: `lib/tiers.ts` (display) and
`public.unlock_max_members()` (authority, and it still honours the six superseded
`left_event_tier_*` ids so nobody is stranded with an unspendable receipt).

**Pay first, then create.** A purchase that exists but is never spent is
recoverable — it sits unconsumed and pays for the next attempt. An event that
exists but was never paid for is not. `create_event()` claims the cheapest
covering receipt `for update skip locked` in the same transaction as the insert,
so it cannot be spent twice and a failed insert burns nothing.

## Build status

**Every screen is built.** 01–18 and 20 are done, plus the routes the prototype
never drew: `(legal)/terms`, `(legal)/privacy`, `(modals)/delete-account`,
`(auth)/keep` and `(auth)/create`. `components/dev/placeholder.tsx` is gone.

Not verified: **19 · Live Activity** (scaffolded, never executed — needs a new
dev build), the guest sign-in upgrades (need a provider Expo Go lacks), account
deletion and Restore Purchases. See Open gaps.

## The ambient glow

A large soft light on eight screens that **travels and dims through onboarding** —
low right at step 1, sweeping up and left, centered overhead by pricing. A motif,
not per-screen decoration.

- Positions live in `GlowPreset` in `constants/theme.ts`, as screen fractions.
  Edit the arc there, in one place.
- Rendered **once**, by `(onboarding)/_layout.tsx`, behind the Stack — a screen
  rendering its own would slide in with it and the travel would be invisible. A
  screen claims its position with `useGlow('event')`, on focus, so going back
  moves the light back.
- It only shows through because onboarding screens use `<Screen transparent>`,
  the Stack sets a transparent `contentStyle`, and `Colors.bg` is painted once on
  the layout root. **Breaking any of those three hides the glow.**
- `(library)` and `(host)` get theirs from their layout; 14, 17 and settings
  mount their own — a viewfinder must not have a light bleeding across it.

## Asset defect

**`assets/video/left-bg.mp4` has a malformed `tkhd` box** — the transform matrix
is shifted 4 bytes, so it declares 16384x1080 instead of the true 1080x1920. Any
player that trusts it plus `contentFit="cover"` gives a wildly over-zoomed crop.
`components/ui/background-video.tsx` works around it by sizing an explicit 9:16
box with `contentFit="fill"`. **The real fix is to re-encode**
(`ffmpeg -i left-bg.mp4 -c copy fixed.mp4`), after which the workaround reverts
to `absoluteFill` + `cover`. The dropped grain overlay
(`components/ui/grain-overlay.tsx`, kept but unrendered) is probably waiting on
the same fix — what read as noise was likely compression blocking amplified by
this bug.

## Open gaps

Known, deliberate, worth resurfacing when the relevant screen comes up.

**Blocking release**

- **Terms / Privacy are drafted but unreviewed.** Every `[BRACKETED]` value must
  be filled and a lawyer must review — checklist at the top of
  `constants/legal.ts`. They also need hosting at public URLs for the stores.
- **Store products do not exist.** The three SKUs charge through RevenueCat as
  *consumables* attached to no entitlement (a non-consumable, or a consumable
  inside an entitlement, would make the second event free).
  `lib/purchases.ts` is the seam, `public.purchases` the ledger — RevenueCat
  validates receipts but does not track whether a consumable has been *spent*,
  which is also why Restore Purchases needs the server half. Nothing here is
  testable until `docs/payments.md` is walked.
- **leftmoment.com does not exist, so invites are dead.** 09 emits
  `https://leftmoment.com/j/{CODE}` (`lib/invite.ts` — the one place to change
  it). The site owes: `GET /j/{CODE}` forwarding to the stores;
  `/.well-known/apple-app-site-association` as `application/json`, **no redirect,
  no extension**, `appID: {TEAMID}.com.leftmoment.app`, `/j/*` path; and
  `/.well-known/assetlinks.json` with the release cert's SHA-256. `app.json`
  already carries the entitlement and intent filters, since adding one later
  forces a rebuild and a resubmission. Test with
  `npx uri-scheme open "https://leftmoment.com/j/K7MP2Q" --ios`.
- **`app.json` carries a placeholder Google iOS URL scheme**
  (`...REPLACE_WITH_REVERSED_IOS_CLIENT_ID`). Baked in at native-build time, so
  the dev build must be rebuilt after filling it. See `docs/social-sign-in.md`.
- **Anonymous sign-ins must be enabled in the Supabase dashboard** (Auth →
  Providers), or every guest join fails at the first step. **Turn on CAPTCHA and
  the rate limit while there.** 11 shows "Joining isn't available right now"
  rather than a raw error, so the symptom is quiet — check this first if joins
  fail.
- ~~Nothing ends an event whose `ends_at` passes with budget left.~~ **Closed.**
  `close_expired_events()` runs on `pg_cron` every five minutes: it settles the
  event's takes and moves it to 'processing'. `finish_event()` still refuses while
  budget remains, and should — that guard exists to distrust *clients*, and a
  clock is not a client. **If `pg_cron` is not enabled on the hosted project,
  events will not end on their own** — the migration raises a notice rather than
  failing, so check for it. It matters less than it did: with the pool equal to
  the film, filming the lot is roughly what a party does, so exhausting the budget
  is the ordinary ending and the clock is the backstop.

**Durability owed**

- **Failed uploads are never retried.** The clip is charged, has a row, sits in
  the cache, is marked `failed` — and nothing recovers it. 17 is the obvious
  place for a retry (a fileless clip already renders as a dimmed inert tile), but
  the local uri is not persisted anywhere. **It needs somewhere durable to live
  first**, which also fixes the next gap.
- **A waiting take's file is orphaned if the screen unmounts before its verdict.**
  The path sits in `waitingPaths` on the camera until `attachUpload()` runs.
  Navigate away in that window and the row has no `storage_path` while the bytes
  sit in the bucket forever. Cheap to reconstruct once uploads have a durable
  home — the path derives from the reservation id.
- **17's clip thumbnails cost one video load each and are not cached.**
  `use-clip-thumbnails` walks clips on an off-screen player; a twenty-clip film
  opens twenty remote sources. A `VideoThumbnail` is a native image reference and
  `expo-image` cannot write one to disk, so it rebuilds every visit.
- **Signed clip URLs are never cached, deliberately** — a module-level cache
  would outlive sign-out and hand the next person on the device a live URL into
  the previous person's event.
- **Nothing keeps the screen awake while recording.** `expo-keep-awake` is the
  fix and is not installed.
- **Refunds are unhandled.** A `CANCELLATION` webhook should arguably mark the
  ledger row and the event. Delete Account does not refund either, and says so.

**Unverified**

- **19's Live Activity has never run.** Plugin, SwiftUI views, ActivityKit module
  and JS bridge all exist and are wired into the camera. It **cannot be built or
  tested from Windows**, needs a *new* dev build
  (`eas build -p ios --profile development`), and the app group
  `group.com.leftmoment.app` must exist on both bundle ids or signing fails.
  **Updates only land while the app is foregrounded** — reaching a backgrounded
  activity needs an ActivityKit push token and an APNs push, neither of which
  exists. That is the gap between the scaffold and the feature, and it is not
  small. `@bacons/apple-targets` is the escape hatch if `withXcodeProject`
  misbehaves.
- **The guest sign-in upgrades have never run.** `linkIdentity()` from
  `(auth)/keep` and `keep-your-film.tsx` needs a provider Expo Go lacks. Walk
  both on a dev build and check the user id is unchanged afterwards.
- **Account deletion** (`supabase/functions/delete-account` +
  `prepare_account_deletion()`) needs two things exercised on a real stack: that
  storage objects for hosted events actually go (no FK reaches into the bucket),
  and that `purchases_consumed_together` does not fire. Test the case where the
  deleted user's own purchase paid for the event being destroyed.

**Half-wired**

- **Recording quality.** `CameraView` takes `videoQuality` and nothing sets it,
  so every event records at the device default. There is no longer an output half
  to key it against — what is filmed is what is watched — so the only open
  question is whether to raise the floor for everybody.
- **The webhook is asynchronous.** The app reaches `createEvent()` milliseconds
  after paying, so the `create-event` edge function asks RevenueCat's REST API
  directly and writes the ledger row itself; the webhook is the durability
  backstop and its later insert is a no-op. `hooks/use-event-creation.ts` retries
  on a backoff behind "Confirming your purchase…", holding a paid transaction in a
  ref so **a retry never charges twice**. `create_event()` also accepts any receipt
  bought in the last 15 minutes whatever its tier, closing the dead end where a
  host bumps the group size while the store sheet is open and pushes past the band
  just paid for.
- **20's "Film is ready" switch gates nothing** — there is no push
  infrastructure. "Someone films a clip" is live (it gates 18's toast, raised
  app-wide by `ClipArrivalsProvider`), but still in-app only: a closed app
  reaches nobody.
- **Onboarding draft state** is a Context in `lib/onboarding-draft.tsx`, mounted
  in the **root** layout because the screen that spends it sits in `(auth)`.
  Leaving onboarding does not discard it, so the `reset()` after a successful
  create is load-bearing — without it the next event starts prefilled. There is
  no global store beyond this.
- **Apple gives a name exactly once**, on the credential at first sign-in, and a
  Hide-My-Email address is not a usable fallback. Landing routes to `(auth)/name`
  when `resolveDisplayName()` is empty. The name must be written **before**
  `createEvent()` — `add_host_as_member()` reads `raw_user_meta_data ->> 'name'`
  at insert time.
- **`@react-native-google-signin` cannot be imported in Expo Go** — it uses
  `TurboModuleRegistry.getEnforcing` at module scope, so a static import would
  crash everything importing `lib/auth.ts`, root layout included. It is behind a
  lazy `require()` inside `signInWithGoogle`. `expo-apple-authentication` is
  import-safe.

## Constraints

- **Dark-only.** No light theme.
- **Portrait-locked.** Screen 03 picks a *recording* aspect ratio, not a device
  orientation (`filmAspect` in `lib/clip-media.ts` sizes 17's hero from it). 17's
  large view rotates the *picture*, which is why it is a modal rather than
  expo-video's native fullscreen — though it still sets `nativeControls`, so
  playback there gets the platform's real scrubber and AirPlay. Nothing unlocks
  an orientation, and nothing should without re-locking every other screen by
  hand.
- **`events.format` is the only authority on the shape of a playback frame.**
  Every surface on 17 — hero and large view — draws the group's chosen ratio and
  letterboxes anything that does not match. `use-clip-playlist` used to measure
  the loaded track (`sourceLoad` / `videoTrackChange`) and override the format;
  that was removed because **iOS records portrait as a 1920x1080 track plus a
  rotation flag**, so an upright clip measured as landscape — the box flipped to
  16:9 around a portrait picture and the large view offered to rotate a portrait
  film. Do not measure the track again.
- **Expo Go covers most of this**, but the camera, media library, Google/Apple
  sign-in, in-app purchases, 09's "Save QR", 08's QR scanner and any Live
  Activity need a dev build. Setup: `docs/social-sign-in.md`, `docs/payments.md`.
- **`.env` is optional, but screens that read data look broken without it.**
  `lib/supabase.ts` builds its client lazily, so the app boots and navigates with
  no credentials and every query throws. Copy `.env.example` to `.env`
  (`npm run db:status` reprints the URL and key). **On a device use the machine's
  LAN IP, not 127.0.0.1** — localhost is the phone itself.

## Three failures that look like code bugs

### "Network request failed" means the LAN IP moved

`.env` points at the local Supabase stack by LAN IP, and that IP belongs to
whatever network the machine is on. Switch from hotspot to WiFi and every request
fails with a bare `Network request failed`. All three steps, in order — skipping
the last is what makes the fix look like it did not work:

```bash
npm run db:status                     # reprints the API URL and keys, but as
                                      # 127.0.0.1 — you need the LAN IP on that port
# edit mobile/.env -> EXPO_PUBLIC_SUPABASE_URL=http://<LAN-IP>:54321
npx expo start --clear                # REQUIRED: EXPO_PUBLIC_* are baked in at
                                      # bundle time
```

Find the IP with `Get-NetIPAddress -AddressFamily IPv4` and take the WLAN one —
not `vEthernet (WSL)`, which the phone cannot reach. In development
`messageFor()` catches this and names the host it failed to reach.

### Supabase errors are usually not `Error` objects

`postgrest-js` only constructs a real `PostgrestError` when the caller opted into
`throwOnError`. Everywhere else `error` is a **plain object**, and this project
uses `if (error) throw error` throughout — so `e instanceof Error` is false for
most real failures and `String(e)` gives **`"[object Object]"`**. Always go
through `messageFor()` (`lib/auth-errors.ts`); under `__DEV__` it also folds in
`code`, `hint` and `details`, which is where Postgres puts the half of a
constraint violation that tells you what happened.

### babel.config.js is load-bearing

`react-native-worklets/plugin` must be listed explicitly — it rewrites `'worklet'`
functions and gesture callbacks to run on the UI thread, and without it they
compile to ordinary JS and throw the moment the UI thread calls one. **The
failure is a runtime error after a perfectly clean bundle**: white screen, dies
on reload, invisible to `typecheck`, `lint` and `expo export`. If the app
white-screens after animation work, check this file first.

- The plugin must stay **last** in `plugins`.
- It is `react-native-worklets/plugin`, **not** `react-native-reanimated/plugin` —
  worklets moved packages in Reanimated 4 and the old path still resolves.
- Naming `babel-preset-expo` makes it a direct dependency; do not remove it from
  `package.json` while this config exists.

Verify it is running:

```bash
npx expo export --platform ios --clear --output-dir /tmp/x
strings /tmp/x/_expo/static/js/ios/*.hbc | grep -c __workletHash   # must be > 0
```

## Walking the app in Expo Go

Google and Apple are native-only and auth is the app's entry, so **nothing past
Landing can be signed into in Expo Go**. Two things make it walkable:

- **"Skip sign-in (dev)" on Landing** signs in *anonymously and for real* and
  takes the same route a provider does. Navigating past the gate is not enough on
  its own: `events.host_id` is `auth.uid()`, so with no session `createEvent()`
  throws and the roster is empty. It reaches the library, **not onboarding, and
  cannot create an event** — it exercises the guest half (join, film, watch, the
  `keep` upgrade) and stops at `(auth)/create`.
- **`supabase/seed.sql`** (`npm run db:reset`) seeds an event with three of four
  members — Marcus (host, `devhost@left.local` / `devpassword`), Yuki and Priya.
  Invite code **`DEV123`**, so `https://leftmoment.com/j/DEV123` opens 11 and a
  fourth guest can join for real. The members are real `auth.users` rows, not
  bare uuids — every RLS policy keys off `auth.uid()`, so a membership pointing
  at a nonexistent user is corrupt the moment anything joins against it.

**The camera (13) still needs a dev build** — `recordAsync` has no Expo Go
implementation. Everything up to it is reachable with the above.

## Before calling anything done

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # expo lint
```

Both must be clean. Then run it (`npm start`) and check the screen on a device —
typecheck passing is not evidence that a screen looks right.
