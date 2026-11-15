/**
 * Which notifications someone wants — 20's two switches.
 *
 * Kept in AsyncStorage, keyed by user id so a shared device does not carry one
 * person's choice into the next person's session — and copied to the server
 * with the push token (`lib/push.ts` -> `register_push_token`), because the
 * server is what sends. The local copy is the source: it exists before there is
 * a token (permission not asked yet, or refused) and survives the token
 * changing.
 *
 * Both default to on. A read that fails returns the defaults rather than
 * silence: the cost of a lost preference is a notification someone did not
 * want, and the cost of guessing the other way is never being told the photos
 * are ready.
 *
 * Both are honoured by the server: `notification_recipients()` leaves out a
 * device whose owner switched that kind off.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'left:notifications:';

export type NotificationPrefs = {
  /** "Your photos are developed" — when an event ends. */
  developed: boolean;
  /** The reminder about an hour before an event ends, while there are shots left. */
  reminder: boolean;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  developed: true,
  reminder: true,
};

function keyFor(userId: string, pref: keyof NotificationPrefs): string {
  return `${KEY_PREFIX}${pref}:${userId}`;
}

/**
 * Read both switches.
 *
 * One key per preference rather than a serialised object: a half-written blob
 * would take both switches with it. Read together so the screen renders in one
 * pass.
 */
export async function readPrefs(userId: string): Promise<NotificationPrefs> {
  try {
    const [developed, reminder] = await Promise.all([
      AsyncStorage.getItem(keyFor(userId, 'developed')),
      AsyncStorage.getItem(keyFor(userId, 'reminder')),
    ]);

    return {
      // Absent means never set, which is the default — only an explicit '0' is off.
      developed: developed === null ? DEFAULT_PREFS.developed : developed === '1',
      reminder: reminder === null ? DEFAULT_PREFS.reminder : reminder === '1',
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
