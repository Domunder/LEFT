/**
 * One event in the library — 16's list row.
 *
 * Note the two similarly-named components this is *not* built from:
 * `film-strip-card.tsx` is 03's format picker and `film-length-choices.tsx` is
 * 05.1's length picker. Neither has anything to do with the library.
 *
 * Purely presentational. The badge text and the tap destination are computed by
 * lib/film-status.ts and handed in, so a card cannot say one thing while its tap
 * does another.
 *
 * The cover is a gradient from lib/film-tint.ts, seeded by the event's id, which
 * is what every cover in this app has been. It was briefly the film's own poster
 * frame, captured a second into a render; nothing renders now, and pulling a
 * still out of the first clip would need a video decode per row on a screen
 * whose whole job is to load fast.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Display } from './typography';
import { Colors, Films, Radii } from '@/constants/theme';
import { Typography } from '@/constants/typography';

type FilmCardProps = {
  title: string;
  /** Left badge — "5 people". */
  members: string;
  /** Right badge — a countdown, "Completed", etc. */
  status: string;
  /** The card's cover, seeded from the event id by `tintFor`. */
  tint: readonly [string, string];
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function FilmCard({ title, members, status, tint, onPress, style }: FilmCardProps) {
  const [pressed, setPressed] = useState(false);

  const animated = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(pressed ? Films.card.pressScale : 1, Films.card.pressSpring) },
    ],
  }));

  return (
    <Animated.View style={[animated, style]}>
      <Pressable
        accessibilityRole="button"
        /*
          One spoken label for the whole card. Read as three separate nodes it
          comes out as "Summer Trip 2026, 5 people, 1d 23h left" with no sense of
          how they relate — the same call film-length-choices.tsx makes.
        */
        accessibilityLabel={`${title}. ${members}. ${status}.`}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={styles.card}>
        <View style={styles.titleBlock} accessibilityElementsHidden importantForAccessibility="no">
          <Display size="card">{title}</Display>
        </View>

        <View style={styles.cover} accessibilityElementsHidden importantForAccessibility="no">
          <LinearGradient colors={[tint[0], tint[1]]} style={StyleSheet.absoluteFill} />

          {/* Gives the badges something to sit against, as drawn. */}
          <LinearGradient
            colors={[Films.card.scrim[1], Films.card.scrim[0]]}
            locations={[1 - Films.card.scrimLocations[1], 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.badge, styles.badgeLeft]}>
            <Text style={styles.badgeText}>{members}</Text>
          </View>
          <View style={[styles.badge, styles.badgeRight]}>
            <Text style={styles.badgeText}>{status}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.cardLg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.hairline,
    backgroundColor: Colors.surfaceGhost,
  },
  titleBlock: {
    paddingHorizontal: Films.card.titlePaddingX,
    paddingTop: Films.card.titlePaddingTop,
  },
  cover: {
    height: Films.card.coverHeight,
    marginTop: Films.card.coverGap,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    bottom: Films.card.badgeInset,
    paddingVertical: Films.card.badgePaddingY,
    paddingHorizontal: Films.card.badgePaddingX,
    borderRadius: Radii.pill,
    backgroundColor: Colors.badgeScrim,
    overflow: 'hidden',
  },
  badgeLeft: {
    left: Films.card.badgeInset,
  },
  badgeRight: {
    right: Films.card.badgeInset,
  },
  badgeText: {
    ...Typography.durationPill,
    color: Colors.text,
  },
});
