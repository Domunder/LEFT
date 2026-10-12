/**
 * 13's clip counter — the tile bottom-right, opposite the countdown.
 *
 * The artboard draws a film-strip thumbnail here. A real thumbnail would mean
 * extracting a frame from the last take, which nothing in the app does yet and
 * which is its own piece of work; and it would show *your* last clip on a screen
 * whose every other number is the group's. So it shows the group's clip count
 * instead, live over realtime on `public.clips`.
 *
 * Hidden at zero, as drawn (`sc-if camClipCount`) — an empty frame beside a
 * record button reads as a broken image, and before the first take there is
 * nothing in the library to tap through to anyway.
 */

import { Pressable, StyleSheet, Text } from 'react-native';

import { Camera, Colors } from '@/constants/theme';
import { Typography } from '@/constants/typography';

type ClipBadgeProps = {
  /** Clips the whole group has filmed. Renders nothing at zero. */
  count: number;
  onPress: () => void;
};

export function ClipBadge({ count, onPress }: ClipBadgeProps) {
  if (count <= 0) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${count} ${count === 1 ? 'clip' : 'clips'} filmed. View the film.`}
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}>
      <Text style={styles.count}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    width: Camera.badge.size,
    height: Camera.badge.size,
    borderRadius: Camera.badge.radius,
    borderWidth: Camera.badge.borderWidth,
    borderColor: Camera.badge.border,
    backgroundColor: Camera.badge.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  count: {
    ...Typography.countdown,
    color: Colors.text,
  },
});
