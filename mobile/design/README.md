# Handoff: LEFT — Collaborative Film App

## Overview
LEFT is a group-video event app: guests at an event (wedding, trip, party, etc.) share one time budget for filming, and their clips are played back together, in order, as a single shared film. Pricing is one-time per event, tiered by group size — no subscription. This handoff covers the full onboarding flow, guest join/invite flow, camera recording, film library, clip detail, notifications, and settings.

## About the Design Files
The files in this bundle (`LEFT App.dc.html`) are **design references built in HTML** — an interactive prototype showing intended layout, copy, states, and motion, not production code to copy directly. The task is to **recreate these designs in Expo (React Native)**, using Expo's own primitives and idioms — not by porting the HTML/CSS. Treat the HTML as a pixel-accurate spec, not a source file.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy are final. Recreate pixel-accurately using React Native styling (StyleSheet or a styling lib of your choice), translating each CSS value listed below to its RN equivalent.

## Global Design Tokens

**Colors**
- Background (near-black): `#101010`
- Card/frame background: `#141316`
- Off-white / primary text & accent: `#f0ede8`
- Muted text: `rgba(240,237,232, 0.3–0.55)` (opacity varies by hierarchy — see per-screen notes)
- Gold/amber status dot (e.g. "1 spot left"): `rgba(240,180,120,0.85)`
- Recording red: `#ff3b3b`
- Success green (status dot): `rgba(140,220,120,0.85)`

**Typography**
- Display/headline serif: **Newsreader** (fallback Georgia) — weight 340 (light), used with italic `<em>` spans for emphasis words. Headline sizes range 24–38px, line-height ~1.13–1.2, letter-spacing -0.015em.
- Numeric/price serif accent: **DM Serif Display** (fallback Georgia) — used for big numbers (group size counter, price, dial center readout).
- UI sans: **Inter**, weights 300–700. Body copy 13–15px, labels 11px uppercase with letter-spacing 0.12–0.14em.
- Monospace accent (camera REC counter, "camera feed" label): `ui-monospace`/system monospace.

**Shape & elevation**
- Buttons: fully rounded pills (`border-radius: 999px`), 17px vertical padding, primary button background `#f0ede8` with dark text `#0b0b0c`.
- Cards/sheets: 20–28px border radius.
- Phone frame chrome (prototype-only, not part of the app itself): 48px outer radius, 40px inner screen radius.
- Glass panels: `background: rgba(20,18,16,0.4)`, blurred backdrop (`backdrop-filter: blur(40–48px) saturate(160%)`) — in RN use `expo-blur`'s `<BlurView intensity=... tint="dark">`.

**Motion**
- Standard transition timing: 0.5–0.6s, `cubic-bezier(0.22,0.8,0.2,1)` (ease-out-ish) — use `react-native-reanimated` `withTiming` with a matching Bezier.
- Recording pulse / blink: 1.1s ease-in-out infinite opacity pulse.
- Dial "spin" motion blur: a filter-blur keyframe (0 → 2.5px → 0) over 0.55s triggered on selection change — in RN, approximate with a scale/opacity blur trick or a blurred duplicate layer faded in/out during the rotation `withTiming`.

## Screens

### 01 · Landing
**Purpose:** App entry / marketing splash before onboarding.
**Layout:** Full-bleed background video (`assets/left-bg.mp4`, muted/looped, `opacity:0.85`) with a bottom-to-top dark gradient overlay (`rgba(6,6,8,0.25)→0.97`) and a subtle grain/noise SVG overlay. Header row: logo mark (image, 22×22) + "LEFT" wordmark (uppercase, letter-spacing 0.06em) on the left; a circular glass icon button on the right. A frosted glass panel is pinned to the bottom (`left/right:16px, bottom:36px`, blurred, rounded 28px) containing: headline "Only one moment left?" (serif, italic second line), subcopy, and two full-width stacked pills — primary "Create an Event" (light bg) and secondary "Join an Event" (outline).
**Assets:** `assets/left-bg.mp4` (looping ambient video), `assets/left-logo.png` (logo mark, transparent PNG, white glyph).

### 02 · Onboarding — Event
**Purpose:** Pick what kind of event this is (affects placeholder copy/icons downstream).
**Layout:** Back button + centered 5-dot progress indicator (dot 1 of 5, active dot rendered as a 24px-wide pill, others 6px). Serif headline "What are you capturing?". A wrapped row of pill buttons, one per event type: Wedding, Birthday, Trip, Party, Graduation, Company Event, Other (icon + label, active state = filled `#f0ede8` bg with dark icon/text, inactive = outline). Once a type is picked, a "Name your film" text input fades in above the Continue button, pre-filled placeholder text keyed to the event type (e.g. "Sam & Alex's Wedding").
**State:** `eventType`, `filmName`.

### 03 · Onboarding — Format
**Purpose:** Choose portrait (9:16) or landscape (16:9) recording format.
**Layout:** Back button (real, not placeholder) + centered dot indicator (dot 2 of 5). Two side-by-side "film frame" preview cards: each is styled like a real film-strip cell — a dark perforation band (rounded sprocket-hole squares) top and bottom, a recessed video window in the middle (autoplaying looping bg video, slight grayscale/contrast filter, radial vignette), aspect ratio 9:16 for the vertical card and 16:9 for the horizontal. Selected card gets a brighter border/shadow and full-opacity video; unselected is dimmed. Labels "Portrait"/"Landscape" below.
**State:** `format` ('vertical' | 'horizontal').

### 04 · Onboarding — Event End
**Purpose:** Set when the shared filming window closes.
**Layout:** Back button. Serif headline "When does filming end?" + subcopy. Two rows, each a label ("Ending Date"/"Ending Time", uppercase small caps) on the left and a pill button on the right showing the current value with a calendar/clock icon, separated by a hairline divider. Continue pill pinned to bottom. (In this prototype the pills are static display — wire up native date/time pickers in implementation.)
**State:** `eventEndDate`, `eventEndTime`.

### 05.1 · Group Size + Film Length + Pricing (combined)
**Purpose:** One screen combining three onboarding decisions: group size, film length, and the resulting price — designed to reduce onboarding steps.
**Layout:** Back button. Headline "How many people for your film?" + subcopy. Row: "Up to {N} people" (serif) left, computed price right (from the pricing tier table below). Below that, a row of 7 circles increasing in diameter (14→31px) representing preset group-size tiers (4,10,25,50,100,150,200) with their number labeled underneath; the active tier's circle is filled solid `#f0ede8` with a soft outer ring glow, others are just an outline. Tapping a circle jumps `groupSize` to that preset.
Divider line, then "FILM LENGTH" label, then a **glossy black 3D dial** (~148px): outer ring = white/black knurled-tooth pattern (`repeating-conic-gradient`), inner face = radial-gradient glossy black plastic with a diagonal light-streak highlight and a top light-reflection blob (blend mode screen), a thin pointer notch above it. 7 fixed tick marks are spaced evenly around the dial (one per possible duration: 30s,60s,2m,4m,6m,8m,10m) — available ticks (based on current group size) are brighter/taller, unavailable ticks are very dim and short, selected tick is brightest/tallest. The whole tick layer rotates via CSS transform so the selected tick sits under the pointer, with a brief blur-pulse animation on change. A glossy center cap shows the selected duration as text (serif). Below the dial: a per-person time estimate, and a **legend row** of small pills (one per duration) — selectable ones outlined and tappable, current one filled solid, unavailable ones faded/non-interactive — so users can always see what's available even if they don't want to use the dial.
Bottom: primary pill button, label = "Continue Free" or "Unlock for $X.XX" depending on tier.
**State:** `groupSize` (int, 4–200), `duration` (seconds, one of 30/60/120/240/360/480/600), `dialSpinning` (bool, drives the blur-pulse animation).
**Logic:** `durationsForGroup(groupSize)` returns the 2–3 valid durations for a given group size (smaller groups → shorter max durations). Pricing tiers (see table below) are matched by `groupSize` range.

**Pricing tiers:**
| Group size | Price | Notes |
|---|---|---|
| Up to 4 | Free | 30s or 60s · 720p · watermark |
| 5–10 | $2.99 | up to 2m · 4K · no expiry |
| 11–25 | $7.99 | up to 4m · 4K · no expiry |
| 26–50 | $19.99 | up to 6m · 4K · no expiry |
| 51–100 | $34.99 | up to 8m · 4K · no expiry |
| 101–150 | $59.99 | up to 10m · 4K · no expiry |
| 151–200 | $79.99 | up to 10m · 4K · no expiry |

### 06 · Onboarding — Sign Up
**Purpose:** Account creation gate before the group can be created.
**Layout:** Full-bleed looping background video (same `left-bg.mp4` asset as Landing, `opacity:0.55`) with a dark gradient overlay. Back button (glass, top-left). Centered headline "Your memories start here" (serif) + subcopy "Sign in to prepare for your special occasion." Two equal-width pill buttons pinned near the bottom, side by side: "Google" (G icon) and "Email" (envelope icon), both solid `#f0ede8` bg with dark text/icon.

### 06.1 · Onboarding — Sign Up with Email
**Purpose:** Email/password account creation form (reached from the "Email" button on 06).
**Layout:** Back button. Headline "Sign up with email." Three labeled text inputs (Name, Email, Password) — dark translucent fields, rounded 14px, uppercase small-caps labels above each. Bottom: "Create Account" solid pill button + fine-print terms line.
**State:** form fields (uncontrolled in prototype; wire to real form state/validation).

### 07/08 · Join Group Sheet & Invite/Share
*(Numbered 08–09 in the file — the Unlock/pricing screen originally at 07 was removed and folded into 05.1.)*
**08 · Join Group Sheet:** Bottom-sheet-style screen (video bg + dark scrim) for a guest joining via invite code — code entry and "Join" CTA.
**09 · Invite/Share:** Host-side screen for sharing the join code/link — big code display, share button, copy-link affordance.

### 10 · Your Group
**Purpose:** Host's roster screen before starting the event.
**Layout:** Header row: back button on the left, a small circular "i" info button on the **right**. Uppercase label "Your Group", serif headline "{N} people have joined." A wrapped row of member chips (avatar-initial circle + name). A small pill status badge ("1 spot left"). Bottom: solid "Start the Event" pill button with a film-camera icon.
**State:** `groupMembers` (list of {initials, name}).

### 10.1 · Your Group — Info (popup)
**Purpose:** Explains the shared-time-budget concept, opened via the info icon on screen 10.
**Layout:** Screen 10 shown dimmed/blurred behind a dark scrim (`rgba(4,4,5,0.72)`, `backdrop-filter: blur(6px)`). A bottom sheet card (rounded 26px, drag-handle bar at top) contains: serif headline "One film. One shared budget.", explanatory body copy, a horizontal progress bar (rounded, `#f0ede8`→`#cfc9bd` gradient fill showing % used), a caption row ("2m 18s used" / "1m 12s left · shared by 5"), and a "Got it" dismiss button.
**Note:** This is a modal/sheet — implement as a React Navigation modal or a bottom-sheet component (e.g. `@gorhom/bottom-sheet`), not a separate route.

### 11 · Guest — Your Name
**Purpose:** Guest onboarding step for entering their display name after joining via invite.
### 12 · Guest — Waiting for Host
**Purpose:** Holding screen for guests after joining, before the host starts filming. Includes a pulsing "waiting" ring animation (`wait-ping` keyframe: scale 1→2.2, opacity 0.4→0, /1.5s cycle typical).

### 13 · Camera
**Purpose:** Main recording interface.
**Layout:** Full-bleed camera viewfinder (video/feed placeholder). Top bar: event name + a shared-budget progress bar beneath it (thin rounded bar, fill color/width driven by `camProgressPct`/`camBarColor`). While recording, a top-left pill shows a pulsing red dot + "REC {seconds}s" (monospace). Standard record button at bottom, flash/zoom controls.
**State:** `camIsRecording`, `camClipSeconds`, `camProgressPct`, `camBarColor`, `zoom`, `flash`.

### 14 · Creating Your Film (processing)
**Purpose:** Loading state while everyone's clips finish uploading. (Originally "while the shared film compiles" — nothing compiles them; see CLAUDE.md.) Centered spinner (`spin` keyframe, 1s linear infinite) + status copy.

### 15/16 · Your Films (empty / populated)
**Purpose:** Library of the user's events/films.
**Layout (populated):** Header "Your Films" + settings gear icon. List of event cards, each with an ambient blurred background pulled from the event's dominant image color, title, date, thumbnail strip.
**Layout (empty):** Centered illustration/icon, "No films yet." headline, subcopy, "Start a shared memory" CTA button. Settings gear icon present here too.

### 17 · Clip Detail
**Purpose:** Watch the event's film — every clip played back to back, in order — with the contributing clips below as a chapter list. (Originally "an individual contributor's clip or the compiled hero film"; there is no compiled film. See CLAUDE.md.)
**Layout:** Full-bleed video/thumbnail with ambient blurred background matching the event's dominant color. Contributor clips: name badge bottom-left, download button top-right. Main/hero film: Download + Share buttons side-by-side instead.

### 18 · In-App Notification (toast)
**Purpose:** Mockup of an in-app toast notification (e.g. "new clip added"). Slides in from top (`toast-in` keyframe).

### 19 · Lockscreen Notification
**Purpose:** Mockup of an iOS Live-Activity-style lockscreen notification showing shared-budget consumption via a progress bar. Background is a dark navy gradient (`linear-gradient(160deg,#0c1018,#05060a,#000)`) distinct from the rest of the app (mimics iOS lockscreen chrome, not in-app UI).

### 20 · Settings
**Purpose:** Standard settings screen — account, notifications, event management, etc. Header with back button; grouped list rows.

## Interactions & Behavior Summary
- All primary CTAs are full-width rounded pills, `#f0ede8` bg / `#0b0b0c` text, with a subtle inset top highlight + drop shadow (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 12px rgba(0,0,0,0.3)`).
- Onboarding back buttons are always a 38×38 circular glass button, top-left, containing a left-chevron icon.
- Progress-dot indicators (where present) are centered horizontally in the header row via absolute positioning — not inline with the back button.
- The film-length dial is the one genuinely custom interactive control: tapping any available tick (on the dial) or any pill (in the legend row below it) sets `duration` and triggers a ~0.55s rotate + blur-pulse animation.
- Selecting a group-size preset circle updates `groupSize`, which cascades to: available durations (may reset `duration` if the current value is no longer valid), the pricing tier match, and the price shown.

## Assets
- `assets/left-bg.mp4` — looping ambient background video, used on Landing (01), Format previews (03), and Sign Up (06).
- `assets/left-logo.png` — transparent PNG logo mark (white glyph), used in the Landing header.
- Google fonts: Newsreader, DM Serif Display, Inter (loaded via Google Fonts `<link>` in the prototype — use `expo-font`/`@expo-google-fonts` packages in Expo).

## Suggested Expo packages
- `expo-router` — navigation/screens.
- `expo-av` or `expo-video` — background video playback (autoplay, loop, muted).
- `expo-blur` — glass/frosted panels (`BlurView`).
- `expo-linear-gradient` — all gradient overlays.
- `react-native-reanimated` — dial rotation, motion-blur pulse, progress bar fills, pulsing "waiting" ring, blink/toast animations.
- `@expo-google-fonts/newsreader`, `@expo-google-fonts/dm-serif-display`, `@expo-google-fonts/inter` — typography.
- `@gorhom/bottom-sheet` — the Group Info popup (10.1) and any join/invite sheets.

## Files
- `LEFT App.dc.html` — the full interactive prototype (all screens above), for visual/behavioral reference only.
- `assets/` — video and logo assets referenced above.
