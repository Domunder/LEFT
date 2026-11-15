# LEFT

A disposable-camera app for events. Guests join by link or QR, get a limited
roll of photos, and the pictures stay hidden until the event ends — then the
whole group's film is "developed" at once. **Photos only. There is no video
capture and none should be added.**

## Where things are

- `mobile/` — the Expo app (SDK 58, expo-router, TypeScript). Run commands from there.
- `supabase/` — schema, RLS, RPCs, edge functions. Migrations are the source of truth.
- `docs/MILESTONES.md` — what is left until launch, and the open decisions.
- `mobile/design/` — the prototype and handoff. Visual language is final; some
  screens predate the photo reframe (see CLAUDE.md → Spec authority).

## Conventions

- Design values live in `mobile/src/constants/theme.ts` and `typography.ts`.
  Never hardcode a color, radius, font size or spacing in a screen — add a token.
- Build screens from the primitives in `mobile/src/components/ui/`.
- Dark-only. Portrait-locked.
- Limits (roll size, group size, reveal) are enforced by the server, never by the client.
- Add native packages with `npx expo install`, never plain `npm install`.
- Schema changes are migrations; regenerate types with `npm run db:types` at the root.
- Before calling anything done: `npm run typecheck` and `npm run lint` in `mobile/`, both clean.
