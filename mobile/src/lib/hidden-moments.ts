/**
 * Moments a guest removed from their list (2026-11-21, the user).
 *
 * Only the host can delete a moment. A guest cannot leave one either — their
 * roster row holds `shots_taken`, and deleting it would hand out a fresh roll
 * (CLAUDE.md, security review). So "Remove from Moments" only hides the card
 * on this phone, per user. Joining the same moment again (its invite link)
 * brings it back: `joinEvent()` calls `unhideMoment()`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSession } from './auth';

const KEY_PREFIX = 'left:hidden-moments:';

async function keyFor(): Promise<string | null> {
  const session = await getSession().catch(() => null);
  return session?.user ? KEY_PREFIX + session.user.id : null;
}

async function read(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function hiddenMoments(): Promise<Set<string>> {
  const key = await keyFor();
  return new Set(key ? await read(key) : []);
}

export async function hideMoment(eventId: string): Promise<void> {
  const key = await keyFor();
  if (!key) return;
  const ids = await read(key);
  if (!ids.includes(eventId)) await AsyncStorage.setItem(key, JSON.stringify([...ids, eventId]));
}

export async function unhideMoment(eventId: string): Promise<void> {
  const key = await keyFor();
  if (!key) return;
  const ids = await read(key);
  if (ids.includes(eventId)) {
    await AsyncStorage.setItem(key, JSON.stringify(ids.filter((id) => id !== eventId)));
  }
}
