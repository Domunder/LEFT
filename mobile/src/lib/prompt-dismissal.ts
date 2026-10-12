/**
 * Remembers that someone dismissed the "Keep your films" prompt.
 *
 * Without this the panel returns on every launch, which is nagging rather than
 * offering — and the guest model's whole premise is that nobody is forced to
 * sign up. Keyed by user id so a shared device does not silence the prompt for
 * the next person to use it.
 *
 * AsyncStorage rather than the database: an anonymous user's row is exactly what
 * this is trying to make durable, so storing the flag there would lose it in the
 * same accident. A dismissal is cheap to lose — the prompt reappearing after a
 * reinstall is the correct behaviour anyway.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'left:keep-your-film:dismissed:';

export async function isPromptDismissed(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY_PREFIX + userId)) === '1';
  } catch {
    // A storage failure should show the prompt, not hide it — the worst case is
    // an offer someone has already declined, not a lost identity.
    return false;
  }
}

export async function dismissPrompt(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_PREFIX + userId, '1');
  } catch {
    // Nothing actionable. The panel is dismissed for this session regardless,
    // because the screen holds that in state.
  }
}
