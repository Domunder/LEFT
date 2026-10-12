# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# LEFT

Group-video event app. Everyone at an event films into **one shared time budget** —
10s recorded by one person leaves 50s of a 60s budget for the whole group.

## Where things are

- Design spec: [`design/README.md`](design/README.md) — high-fidelity, values are final.
  [`design/LEFT App.dc.html`](design/LEFT%20App.dc.html) is a visual reference prototype;
  **recreate** it with React Native primitives, never port its HTML/CSS.
- Every screen file names its design screen number in a header comment.
- `src/components/dev/placeholder.tsx` is scaffolding — delete each usage as the
  real screen gets built, and delete the file once none remain.

## Conventions

- Design values live in `src/constants/theme.ts` and `src/constants/typography.ts`.
  Never hardcode a color, radius, or font size in a screen — add a token instead.
- Build screens from the primitives in `src/components/ui/`.
- Dark-only. There is no light theme.
- Portrait-locked. The Format screen picks a recording aspect ratio, not a device orientation.
- Add native packages with `npx expo install`, never plain `npm install`, so
  versions stay aligned to SDK 57.
