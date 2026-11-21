/**
 * Whether this phone has shown a moment's intro (`(guest)/intro`) — once per
 * moment and phone (2026-11-21, the user): the roll and the end differ per
 * moment, so a guest who joins a second one sees it again.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'left:intro-seen:';

export async function hasSeenIntro(eventId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREFIX + eventId)) === '1';
  } catch {
    // Showing it twice beats a guest who never learns the roll is limited.
    return false;
  }
}

export async function markIntroSeen(eventId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + eventId, '1');
  } catch {
    // It shows again next time.
  }
}
