/**
 * Which notifications someone wants — 20's two switches.
 *
 * Structured like lib/prompt-dismissal.ts, for the same reasons: keyed by user
 * id so a shared device does not carry one person's choice into the next
 * person's session, and in AsyncStorage rather than the database because an
 * anonymous user's row is exactly the thing that can vanish.
 *
 * Both default to on, because the artboard draws both switches on and never
 * draws one off. A read that fails returns the defaults rather than silence:
 * the cost of a lost preference is a notification someone did not want, and the
 * cost of guessing the other way is never being told your film is ready.
 *
 * **`clipFilmed` is live** — it gates 18's toast, raised app-wide by
 * `ClipArrivalsProvider` rather than by any one screen, which is
 * what makes this screen's switch do something rather than merely remember
 * something. **`filmReady` gates nothing yet.** There is no push infrastructure
 * in the app at all, so the preference is recorded and honoured by nobody. It is
 * drawn because the artboard draws it, and it will be read the moment there is a
 * notification to suppress.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'left:notifications:';

export type NotificationPrefs = {
  /** Someone in the group filmed a clip. Gates 18's in-app toast. */
  clipFilmed: boolean;
  /** The film finished compiling. Nothing raises this yet — see the header. */
  filmReady: boolean;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  clipFilmed: true,
  filmReady: true,
};

function keyFor(userId: string, pref: keyof NotificationPrefs): string {
  return `${KEY_PREFIX}${pref}:${userId}`;
}

/**
 * Read both switches.
 *
 * One key per preference rather than a serialised object: a half-written blob
 * would take both switches with it, and there is no migration story here worth
 * the coupling. Read together so the screen renders in one pass.
 */
export async function readPrefs(userId: string): Promise<NotificationPrefs> {
  try {
    const [clipFilmed, filmReady] = await Promise.all([
      AsyncStorage.getItem(keyFor(userId, 'clipFilmed')),
      AsyncStorage.getItem(keyFor(userId, 'filmReady')),
    ]);

    return {
      // Absent means never set, which is the default — only an explicit '0' is off.
      clipFilmed: clipFilmed === null ? DEFAULT_PREFS.clipFilmed : clipFilmed === '1',
      filmReady: filmReady === null ? DEFAULT_PREFS.filmReady : filmReady === '1',
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * Persist one switch.
 *
 * Swallows its own failure, as prompt-dismissal does: the screen already holds
 * the new value in state, so the switch is visibly flipped either way, and there
 * is nothing a user could do with the error.
 */
export async function writePref(
  userId: string,
  pref: keyof NotificationPrefs,
  value: boolean
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId, pref), value ? '1' : '0');
  } catch {
    // Nothing actionable. The preference holds for this session regardless.
  }
}
