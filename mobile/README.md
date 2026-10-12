# LEFT — mobile app

Expo (SDK 57) app for LEFT: a group-video event app where everyone at an event
films into **one shared time budget**. If someone records 10s of a 60s budget,
the whole group has 50s left. Clips compile into a single shared film.

Screens are being built one at a time. **01 · Landing is done**; the rest are
still placeholders, each carrying a comment describing what belongs there, keyed
to its number in [`design/README.md`](design/README.md).

The per-screen build status table and the project's working conventions live in
[`CLAUDE.md`](CLAUDE.md) — start there.

## Running it

```bash
npm install
npm start
```

Then press `a` for an Android emulator, or scan the QR code with **Expo Go** on
an iPhone. iOS simulators need macOS; from Windows, Expo Go on a real device is
the way to see iOS.

Other scripts: `npm run typecheck`, `npm run lint`.

## Layout

```
assets/
  images/                 icons and art the app actually loads
  video/                  left-bg.mp4, the ambient background loop
  originals/logos/        source logo exports at every size (not bundled)
design/                   the design handoff + interactive HTML prototype
src/
  app/                    expo-router routes — one file per design screen
    index.tsx             01 Landing
    (onboarding)/         02 Event · 03 Format · 04 Ending · 05.1 Group size
    (auth)/               06 Sign up
    (host)/               09 Invite · 10 Your group
    (guest)/              11 Name · 12 Waiting
    (capture)/            13 Camera · 14 Processing
    (library)/            15/16 Films · 17 Clip detail
    (modals)/             08 Join sheet · 10.1 Group info
    settings.tsx          20 Settings
  components/
    ui/                   shared primitives (see below)
    dev/placeholder.tsx   SCAFFOLD — delete as screens get built
  constants/              theme.ts (colors, radii, spacing, motion), typography.ts
  hooks/use-app-fonts.ts  Newsreader / DM Serif Display / Inter
  lib/                    supabase.ts, auth.ts
  types/database.ts       placeholder for generated Supabase types
```

Two design screens are deliberately **not** routes:

- **18 · In-app toast** — an overlay, stubbed at `src/components/ui/toast.tsx`.
- **19 · Lockscreen notification** — an iOS Live Activity. Needs native code and
  a config plugin; impossible in Expo Go.

## Primitives

`src/components/ui/` — build screens out of these rather than restyling from scratch:

| | |
|---|---|
| `screen.tsx` | Safe-area wrapper, `#101010` background, 28px screen padding |
| `screen-header.tsx` | Back button + centered step dots + optional right action |
| `circle-back-button.tsx` | 38×38 circular icon button, flat or blurred-glass fill |
| `progress-dots.tsx` | The 5-step onboarding indicator |
| `pill-button.tsx` | The CTA pill — `primary`, `secondary` and `glass` variants |
| `glass-panel.tsx` | Frosted `BlurView` surface for panels over video |
| `background-video.tsx` | Full-bleed looping `left-bg.mp4` (Landing, Format, Sign Up) |
| `grain-overlay.tsx` | Tiled film-grain noise over the background video |
| `sheet.tsx` | Scrim + bottom sheet chrome for the modal routes |
| `typography.tsx` | `Display` / `Em` / `Numeric` / `Body` / `Label` / `Caption` / `Mono` |

All design values live in `src/constants/theme.ts` and `typography.ts`,
transcribed from the handoff. Add to those rather than hardcoding colors or
font sizes in a screen.

## Supabase

Only the launch session check on Landing uses it so far — if a session exists the
app skips Landing and opens the Films library. Everything else is unwired. To
activate:

```bash
cp .env.example .env      # then fill in the two values
```

`src/lib/supabase.ts` creates the client lazily, so the app runs fine without a
`.env` — you only get an error if something actually calls Supabase.
`src/lib/auth.ts` holds the Google and Apple wrappers screen 06 uses. There is no
email/password path — the app never handles a password.

Both providers use the native ID-token flow and **need a dev build**; in Expo Go
the buttons are disabled and a dev-only bypass keeps the flow walkable. Getting
the client IDs and keys is documented in [docs/social-sign-in.md](docs/social-sign-in.md).

## Known constraints

- **Expo Go covers this skeleton**, but the camera work, media library, Google
  and Apple sign-in and any Live Activity will need a dev build
  (`npx expo run:ios` on a Mac, or EAS Build).
- The app is **portrait-locked**. The Format screen's portrait/landscape choice
  is the recording aspect ratio, not device orientation.
- Fonts load at runtime via `expo-font` so they work in Expo Go. On a dev build,
  the `expo-font` config plugin can embed them at build time instead.
