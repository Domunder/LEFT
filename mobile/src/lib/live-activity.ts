/**
 * 19 · Lockscreen Live Activity — the JavaScript seam.
 *
 * Every function here is a **no-op that resolves** rather than a call that might
 * throw. That is the whole design of this file: the caller is the camera screen,
 * which is on the app's live path, and a lock-screen widget is decoration. If it
 * cannot run — wrong platform, wrong iOS version, Expo Go, the user turned Live
 * Activities off — filming must be entirely unaffected.
 *
 * **The module is loaded with `require()` inside each call, never a static
 * import.** This is the pattern lib/auth.ts documents at length for
 * `@react-native-google-signin`: a native module resolved at module scope throws
 * on import in Expo Go, and since this file would be imported by the camera
 * screen, a static import turns "no widget" into "the camera screen will not
 * load". Required inside the call, the module stays importable everywhere.
 *
 * ## What this cannot do
 *
 * **Updates only land while the app is in the foreground.** Reaching a
 * backgrounded app's activity needs an ActivityKit push token and an APNs
 * `liveactivity` push, and neither exists in this stack. So a phone in a pocket
 * shows the budget as of the last time its owner looked at the app. Worth
 * knowing before this is called finished — it is the difference between the
 * scaffold and the feature the artboard implies.
 *
 * **None of it can be verified from Windows**, and it needs a *new* dev build:
 * the current one predates the config plugin that creates the widget target.
 *
 *     eas build -p ios --profile development
 */

import { Platform } from 'react-native';

import type { Event } from './events';

/** The shape the Swift module exposes. Mirrors LeftLiveActivityModule.swift. */
type LiveActivityModule = {
  areActivitiesEnabled: () => boolean;
  startActivity: (
    eventId: string,
    eventName: string,
    usedSeconds: number,
    budgetSeconds: number
  ) => Promise<string | null>;
  updateActivity: (
    usedSeconds: number,
    budgetSeconds: number,
    lastFilmedBy: string | null,
    lastClipSeconds: number | null
  ) => Promise<void>;
  endActivity: () => Promise<void>;
};

/**
 * The native module, or null everywhere it does not exist.
 *
 * Null on Android and web by platform, and null on iOS in Expo Go or any build
 * made before the config plugin landed — which is why the require is wrapped
 * rather than merely platform-gated.
 */
function load(): LiveActivityModule | null {
  if (Platform.OS !== 'ios') return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require('expo-modules-core') as {
      requireOptionalNativeModule: (name: string) => LiveActivityModule | null;
    };
    return requireOptionalNativeModule('LeftLiveActivity');
  } catch {
    return null;
  }
}

/**
 * Whether a Live Activity could be shown at all.
 *
 * False on iOS below 16.2, and false when the user has switched Live Activities
 * off for LEFT — which they can do at any time, including mid-event.
 */
export function isLiveActivitySupported(): boolean {
  try {
    return load()?.areActivitiesEnabled() ?? false;
  } catch {
    return false;
  }
}

/**
 * Put the shared budget on the lock screen.
 *
 * Returns the activity's id, or null when nothing was started — which is the
 * ordinary case on most devices and is not an error.
 */
export async function startBudgetActivity(event: Event): Promise<string | null> {
  try {
    const native = load();
    if (!native) return null;

    return await native.startActivity(
      event.id,
      event.name,
      event.used_seconds,
      event.budget_seconds
    );
  } catch {
    return null;
  }
}

/**
 * Push new numbers to it.
 *
 * Called from the camera's existing budget subscription, so the bar on the lock
 * screen and the bar in the app move from the same source. `lastFilmedBy` is what
 * turns the card from a gauge into a sentence, and is null before anyone films.
 */
export async function updateBudgetActivity(args: {
  usedSeconds: number;
  budgetSeconds: number;
  lastFilmedBy?: string;
  lastClipSeconds?: number;
}): Promise<void> {
  try {
    await load()?.updateActivity(
      args.usedSeconds,
      args.budgetSeconds,
      args.lastFilmedBy ?? null,
      args.lastClipSeconds ?? null
    );
  } catch {
    // The lock screen keeps its last state. Nothing a user could act on.
  }
}

/**
 * Take it down.
 *
 * On the event ending, and on leaving the camera. An activity that outlived its
 * event would sit on the lock screen reporting a budget nobody can spend.
 */
export async function endBudgetActivity(): Promise<void> {
  try {
    await load()?.endActivity();
  } catch {
    // Nothing to salvage; the system reaps activities on its own schedule.
  }
}
