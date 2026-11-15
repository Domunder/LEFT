/**
 * 10's roster chip — an initials avatar and a name, in a rounded outline.
 *
 * The artboard's padding is asymmetric (9px left, 14px right): the avatar
 * already carries visual weight on its side, so an even inset would look
 * lopsided the other way.
 *
 * `arriving` is for someone who joins while the host is watching: the chip
 * springs up to size as it appears (`Springs.settle` — nobody flicked it, so it
 * does not bounce). The roster that was already there when the screen opened
 * is simply there. Reduced motion: a fade, no growth.
 */

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Group, Radii, Springs } from '@/constants/theme';
import { FontFamily, Typography } from '@/constants/typography';
import { initialsFor } from '@/lib/events';

type MemberChipProps = {
  name: string;
  /** Joined after the roster was first shown — the chip springs in. */
  arriving?: boolean;
};

export function MemberChip({ name, arriving = false }: MemberChipProps) {
  const reducedMotion = useReducedMotion();
  // Only read on mount: a chip arrives once.
  const progress = useSharedValue(arriving ? 0 : 1);

  useEffect(() => {
    if (!arriving) return;
    progress.value = reducedMotion
      ? withTiming(1, { duration: Group.chip.fadeMs, reduceMotion: ReduceMotion.Never })
      : withSpring(1, Springs.settle);
  }, [arriving, progress, reducedMotion]);

  const animated = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 2),
    transform: [
      {
        scale: reducedMotion ? 1 : Group.chip.enterScale + (1 - Group.chip.enterScale) * progress.value,
      },
    ],
  }));

  return (
    <Animated.View style={[styles.chip, animated]}>
      <View style={styles.avatar}>
        <Text style={styles.initials}>{initialsFor(name)}</Text>
      </View>
      {/*
        `numberOfLines` rather than the artboard's `white-space: nowrap`: a chip
        that refuses to wrap can still be wider than the screen, and a name long
        enough to do that should be truncated, not pushed off the edge.
      */}
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Group.chip.gap,
    paddingVertical: Group.chip.paddingY,
    paddingLeft: Group.chip.paddingLeft,
    paddingRight: Group.chip.paddingRight,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Group.chip.border,
    backgroundColor: Group.chip.bg,
    // Keeps one very long name from stretching a chip past the screen.
    maxWidth: '100%',
  },
  avatar: {
    width: Group.chip.avatarSize,
    height: Group.chip.avatarSize,
    borderRadius: Group.chip.avatarSize / 2,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Group.chip.avatarBg,
  },
  initials: {
    fontFamily: FontFamily.semibold,
    fontSize: 10,
    color: Colors.textMuted,
  },
  name: {
    ...Typography.choice,
    color: Colors.textMuted,
    flexShrink: 1,
  },
});
