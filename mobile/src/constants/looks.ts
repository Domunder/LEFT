/**
 * The film stocks a host can load — 03's four cards.
 *
 * Ids mirror the `film_look` enum; adding one means a migration, a swatch in
 * `LookSwatch`, and (from M2) a shader preset. Order is the order on screen.
 */

import type { FilmLook } from '@/lib/events';

export type LookOption = {
  id: FilmLook;
  name: string;
  /** One line a host can choose from. No jargon. */
  blurb: string;
};

export const LOOKS: readonly LookOption[] = [
  { id: 'golden', name: 'Golden', blurb: 'Warm and sunlit, a little soft.' },
  { id: 'chrome', name: 'Chrome', blurb: 'Cool, crisp, deep blues.' },
  { id: 'faded', name: 'Faded', blurb: 'Pale and pastel, washed by time.' },
  { id: 'mono', name: 'Mono', blurb: 'Black and white, heavy grain.' },
] as const;

export const DEFAULT_LOOK: FilmLook = 'golden';

export function lookName(id: FilmLook): string {
  return LOOKS.find((look) => look.id === id)?.name ?? id;
}
