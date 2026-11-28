/**
 * The roll — how many shots each guest gets — and the group sizes 05.1 offers.
 *
 * **A display mirror with no authority.** `create_event()` validates the roll and
 * the group, `claim_shot()` counts the frames, `join_event()` holds the cap. If
 * this file drifts, a screen offers something the server refuses; nothing is
 * oversold.
 */

import { t } from '@/i18n';

/** `null` is the unlimited roll, as it is in `events.roll_size`. */
export type RollSize = number | null;

/** Film-roll sizes, smallest first, then unlimited. Mirrors the column's check. */
export const ROLL_SIZES: readonly RollSize[] = [5, 10, 16, 24, 36, null] as const;

/** What 05.1 preselects: the classic roll. */
export const DEFAULT_ROLL_SIZE = 24;

/**
 * 05.1's group presets. Seven, because the row of circles is drawn for seven
 * (`GroupRow.diameters`). `max_members` is a hard cap on joins.
 */
export const GROUP_PRESETS = [5, 10, 25, 50, 100, 150, 200] as const;

export const DEFAULT_GROUP_SIZE = 25;

export function isUnlimited(roll: RollSize): roll is null {
  return roll === null;
}

/** The numeral on a roll card: "24", or "∞". */
export function rollNumeral(roll: RollSize): string {
  return roll === null ? '∞' : String(roll);
}

/** Spoken form, for accessibility labels: "24 shots each". */
export function rollWords(roll: RollSize): string {
  return roll === null ? t('onboarding.rollUnlimitedEach') : t('onboarding.rollEach', { count: roll });
}

/**
 * The camera's counter. `shotsLeft` is what `claim_shot()` returned — null on an
 * unlimited roll, where there is nothing to count down.
 */
export function shotsLeftLabel(shotsLeft: number | null): string {
  if (shotsLeft === null) return '∞';
  return t('onboarding.shotsLeft', { count: shotsLeft });
}
