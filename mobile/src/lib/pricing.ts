/**
 * Group size and shared filming time for 05.1.
 *
 * **This module has no authority.** It mirrors `public.budget_plan()` so a screen
 * can quote a number without a round trip, and that is all it does — the server
 * derives `budget_seconds` itself and accepts only a *shorter* one from a client.
 * If the two drift, a screen shows a slightly wrong promise and nothing is
 * oversold. That asymmetry is deliberate and it is what let five of the old six
 * copies of the tier table be deleted.
 *
 * Two things changed shape here, and they are worth stating plainly because the
 * old names survive in git and mean different things now:
 *
 *   * **There is one duration, not two.** `budgetSeconds` used to be 2.5x
 *     `filmSeconds`, because a renderer selected the film out of a larger pool of
 *     footage. Nothing renders any more, so the surplus was footage nobody would
 *     ever watch. The number a host picks is the pool *and* the running time.
 *   * **The price is back on this screen.** It moved to 17 when the thing being
 *     sold was a clean render; with no render there is nothing to sell after the
 *     fact. The SKU table lives in `./tiers.ts` — deliberately still separate, so
 *     that what a group *gets* and what it *costs* stay two questions.
 *
 * Kept pure and free of React so the screen stays thin and the rules stay
 * testable — the same split `./event-end.ts` makes for 04.
 */

export const GROUP_PRESETS = [4, 10, 25, 50, 100, 150, 200] as const;

/**
 * Every duration the app offers anywhere, ascending — the union of what
 * `adjustOptionsFor()` hands out.
 *
 * Nothing renders it; it exists so `assertPlanInvariant()` has something to check
 * the per-group option lists against, and so the full set is stated once rather
 * than inferred from six tier constants. It outlived the meter that used to draw
 * its last entry as a full-scale value.
 */
export const ALL_DURATIONS = [30, 60, 120, 240, 360, 480, 600] as const;

/**
 * The durations this group may choose between, shortest first.
 *
 * The **last entry is the default and the ceiling at once** — `create_event()`
 * accepts a shorter pool and refuses a longer one, which is what makes offering
 * the choice on 05.1 safe at all.
 *
 * Bigger groups get more because the pool is shared: 30s split across a hundred
 * people is a third of a second each, which is not a film.
 *
 * Held as module constants rather than built per call. Identity matters — the
 * screen keys animations off these arrays, and a fresh array every render would
 * re-run styles when nothing had changed.
 */
const OPTIONS_TINY = [30, 60] as const;
const OPTIONS_SMALL = [60, 120] as const;
const OPTIONS_MEDIUM = [120, 240] as const;
const OPTIONS_LARGE = [240, 360] as const;
const OPTIONS_XL = [240, 360, 480] as const;
const OPTIONS_XXL = [360, 480, 600] as const;

export function adjustOptionsFor(group: number): readonly number[] {
  if (group <= 4) return OPTIONS_TINY;
  if (group <= 10) return OPTIONS_SMALL;
  if (group <= 25) return OPTIONS_MEDIUM;
  if (group <= 50) return OPTIONS_LARGE;
  if (group <= 100) return OPTIONS_XL;
  return OPTIONS_XXL;
}

/**
 * The filming time this group gets unless the host says otherwise.
 *
 * Mirrors the CASE in `budget_plan()`. This is the number 05.1 shows as a
 * consequence of the group — the recommendation and the ceiling at once.
 */
export function budgetSecondsFor(group: number): number {
  const options = adjustOptionsFor(group);
  return options[options.length - 1];
}

/**
 * Keep a chosen duration legal for the current group.
 *
 * Growing or shrinking the group changes what is on offer. 05.1 resets to the
 * default rather than clamping — a duration picked for a different group is not
 * a preference worth preserving — but this exists for anything restoring a
 * draft, where the alternative is sending the server a number it will refuse.
 */
export function clampBudgetSeconds(seconds: number, group: number): number {
  const available = adjustOptionsFor(group);
  return available.includes(seconds) ? seconds : budgetSecondsFor(group);
}

/** "30s", "2m", "1m 30s" — the meter readout and the Adjust pills. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

/**
 * The same span in prose, for a sentence rather than a readout.
 *
 * "2m" is right on a dial and wrong mid-sentence. Every duration on offer is
 * either 30 seconds or a whole number of minutes, so this stays short.
 */
export function formatDurationWords(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

/**
 * Roughly how long each person gets to film.
 *
 * **Capture time and screen time are the same thing again.** They came apart
 * while a renderer selected a short film out of a large pool of footage; with the
 * clips played whole and in order, a person's share of the pool is also their
 * share of what everyone watches. So this number means what a host would assume
 * it means, which it did not for a while.
 *
 * Nobody is *held* to it — the pool is shared, not divided, and one person may
 * film more than their share if they get there first. It is an estimate, and the
 * only thing separating one duration option from another on 05.1.
 *
 * Floored so the estimate never promises more than the pool can pay out, and held
 * at 1s so a large group reads as "~1s each" rather than "~0s each".
 */
export function perPersonCaptureSeconds(budgetSeconds: number, group: number): number {
  return Math.max(1, Math.floor(budgetSeconds / group));
}

/**
 * Check that this mirror still describes something the server will accept.
 *
 * There is no test runner in this project, so the invariant is asserted at module
 * load in development instead. It cannot catch drift from the SQL — only a real
 * call can do that — but it does catch the edit that makes the screen offer a
 * duration `create_event()` will refuse, which is the failure that would
 * otherwise surface as a dead Continue button.
 */
function assertPlanInvariant(): void {
  for (const size of GROUP_PRESETS) {
    const options = adjustOptionsFor(size);

    if (options.length === 0) {
      console.error(`pricing.ts: group ${size} has no durations to offer.`);
      continue;
    }

    // The default is the ceiling. create_event() refuses anything longer.
    const longest = Math.max(...options);
    if (longest !== budgetSecondsFor(size)) {
      console.error(
        `pricing.ts: group ${size} offers up to ${longest}s but defaults to ${budgetSecondsFor(size)}s.`
      );
    }

    // Ascending, because the Adjust row is drawn in array order.
    for (let i = 1; i < options.length; i++) {
      if (options[i] <= options[i - 1]) {
        console.error(`pricing.ts: group ${size}'s durations are not ascending.`);
        break;
      }
    }

    // ALL_DURATIONS is meant to be the union of every tier's options. A duration
    // offered by a tier but missing from it means the two have drifted apart.
    for (const seconds of options) {
      if (!ALL_DURATIONS.includes(seconds as (typeof ALL_DURATIONS)[number])) {
        console.error(`pricing.ts: group ${size} offers ${seconds}s, which ALL_DURATIONS omits.`);
      }
    }
  }

  // GROUP_PRESETS being non-empty is a compile-time fact (it is `as const`), so
  // there is nothing to assert about it that TypeScript has not already proved.
}

if (__DEV__) assertPlanInvariant();
