/**
 * 13 · Camera — PLACEHOLDER
 *
 * The video camera that lived here (shared time budget, takes, uploads) is gone.
 * What replaces it is a disposable camera: one shutter, a per-guest roll counter
 * ("17 left"), zoom and flash, no preview of what was shot. Milestone M2 in
 * docs/MILESTONES.md. `lib/zoom.ts`, `zoom-selector.tsx` and
 * `event-countdown.tsx` were kept for it.
 */

import { Placeholder } from '@/components/dev/placeholder';

export default function CameraScreen() {
  return (
    <Placeholder
      screen="13 · Camera"
      note="The disposable photo camera — one shutter and a roll that counts down. Built in milestone M2."
    />
  );
}
