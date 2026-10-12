/**
 * The host onboarding draft — everything screens 02 → 05.1 collect before an event
 * can be created.
 *
 * `createEvent()` needs all of it at once (see ./events.ts), so the values have to
 * outlive each individual screen. Context rather than a store library: there is one
 * writer per field and one reader at the end.
 *
 * The provider is mounted by the *root* layout rather than by (onboarding)/_layout.
 * It had to be, back when screen 06 in the (auth) group was what called
 * `createEvent()`; 05.1 spends the draft now, so it could move — but moving it would
 * also change *when* the draft is discarded, from "on a successful create" to "on
 * leaving the group", which is a behaviour change and not one this asked for.
 * It survives until `reset()` runs after a successful create, or the app restarts.
 * Skipping that reset would leave stale values to prefill the next event.
 *
 * This provider also owns the ambient glow's position and the onboarding step.
 * Both are rendered by the layout rather than by each screen, so they can travel
 * across the flow as the user advances — a screen that rendered its own would
 * slide in with it already in place and the movement would be invisible.
 */

import { useFocusEffect } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { GlowPresetName } from '@/constants/theme';
import type { CreateEventInput, EventType, FilmFormat } from './events';

/** Mirrors CreateEventInput, but every field is optional until its screen fills it. */
export type OnboardingDraft = {
  /** 02 · Event */
  eventType?: EventType;
  /** 02 · Event */
  filmName?: string;
  /** 03 · Format */
  format?: FilmFormat;
  /** 04 · Event End */
  endsAt?: Date;
  /**
   * 05.1 · The group, as the host estimates it — 4, 10, 25, 50, 100, 150 or 200.
   *
   * Not a capacity limit: it sizes the shared budget and prices the event, and
   * `join_event` admits anyone holding the code regardless of it.
   */
  maxMembers?: number;
  /**
   * 05.1 · A shorter pool than this group's default, if the host picked one.
   *
   * Undefined is the ordinary case and means "use the default". Only ever
   * shorter — `create_event()` refuses anything longer than the group's plan,
   * which is what makes offering the choice safe.
   *
   * Briefly called `filmSeconds`, back when the pool and the finished film were
   * two different numbers. They are one again: this is what the group may film,
   * and therefore how long what they watch runs.
   */
  budgetSeconds?: number;
};

/** Why a draft cannot be turned into an event yet. */
export type DraftProblem = 'incomplete' | 'ended';

export type DraftNarrowing =
  | { ok: true; input: CreateEventInput }
  | { ok: false; problem: DraftProblem };

/**
 * Narrow a draft to a complete `CreateEventInput`.
 *
 * Lives here rather than at the call site so the one field-name difference between
 * the two shapes — the draft's `filmName` is the event's `name` — stays next to the
 * type it belongs to.
 *
 * Two distinct failures, because they need different handling:
 *
 * - `incomplete` should no longer be reachable: 02, 03 and 04 each gate their own
 *   Continue, and 05.1 is the only caller. It is still distinguished from `ended`
 *   because the two need different sentences if one ever does turn up.
 * - `ended` is a real one. Screen 04 clamps its picker to `minimumDate={now}`, but
 *   the draft outlives the (onboarding) group — background the app on 04 and finish
 *   an hour later and the chosen moment can be in the past by the time it is spent.
 *   The insert would survive (there is no CHECK on ends_at) and the event would be
 *   born already over, so it is caught here instead.
 */
export function draftToCreateEventInput(
  draft: OnboardingDraft,
  now: Date = new Date()
): DraftNarrowing {
  const { eventType, filmName, format, endsAt, maxMembers, budgetSeconds } = draft;

  /*
    `budgetSeconds` is deliberately not required. Undefined means "use the group's
    default", which is what almost every event does and what 05.1 sends unless the
    host picked a shorter one — the server derives it from `max_members`.
  */
  if (!eventType || !filmName?.trim() || !format || !endsAt || !maxMembers) {
    return { ok: false, problem: 'incomplete' };
  }

  if (endsAt.getTime() <= now.getTime()) {
    return { ok: false, problem: 'ended' };
  }

  return {
    ok: true,
    input: { name: filmName.trim(), eventType, format, endsAt, maxMembers, budgetSeconds },
  };
}

type OnboardingContextValue = {
  draft: OnboardingDraft;
  /** Merge a partial update into the draft. */
  patch: (partial: Partial<OnboardingDraft>) => void;
  /** Discard everything — used when the flow completes or is abandoned. */
  reset: () => void;
  glow: GlowPresetName;
  setGlow: (preset: GlowPresetName) => void;
  /** 1-based index of the step the flow is showing. */
  step: number;
  setStep: (step: number) => void;
};

/**
 * Steps in the host onboarding flow — the `total` on every indicator.
 *
 * Four, not five: sign-in used to be step 5 and is now the app's entry screen, so
 * 05.1 is the last step and the one that spends the draft.
 */
export const ONBOARDING_STEPS = 4;

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState<OnboardingDraft>({});
  const [glow, setGlow] = useState<GlowPresetName>('event');
  const [step, setStep] = useState(1);

  const patch = useCallback((partial: Partial<OnboardingDraft>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => setDraft({}), []);

  const value = useMemo(
    () => ({ draft, patch, reset, glow, setGlow, step, setStep }),
    [draft, patch, reset, glow, step]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used inside <OnboardingProvider> — see (onboarding)/_layout.tsx');
  }
  return ctx;
}

/**
 * Claim the glow position for the screen that calls this.
 *
 * On focus rather than on mount, so navigating *back* restores the previous screen's
 * position too and the light appears to travel in both directions.
 */
export function useGlow(preset: GlowPresetName): void {
  const { setGlow } = useOnboarding();
  useFocusEffect(
    useCallback(() => {
      setGlow(preset);
    }, [preset, setGlow])
  );
}

/**
 * Claim the step indicator for the screen that calls this.
 *
 * Same reasoning as `useGlow`: the dots are rendered once by the layout so the
 * active pill can slide from one step to the next instead of snapping, and on
 * focus so going *back* walks it backwards too.
 */
export function useStep(step: number): void {
  const { setStep } = useOnboarding();
  useFocusEffect(
    useCallback(() => {
      setStep(step);
    }, [step, setStep])
  );
}
