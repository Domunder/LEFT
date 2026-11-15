/**
 * One film in the library's carousel — a full-height poster.
 *
 * Replaces 16's list card (`film-card.tsx`). The cover is a real photo: your
 * own latest shot while the film is live, the album's first photo once it is
 * developed, and the event's tint (lib/film-tint.ts) until there is one.
 *
 * The title sits on the photo; status and group size are glass capsules over
 * it — glass on imagery, never on glass. The whole poster reacts on touch-down
 * and opens on release.
 *
 * Purely presentational: what the capsule says and where a tap goes are
 * computed by lib/film-status.ts and handed in.
 */

import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Glass } from './glass';
import { Display } from './typography';
import { Colors, Films, Glass as GlassTokens, Springs } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import type { FilmPhase } from '@/lib/film-status';

const T = Films.poster;

type FilmPosterProps = {
  title: string;
  /** "1d 23h left", "Developed · 124 photos", "Not started". */
  status: string;
  phase: FilmPhase;
  /** The roster size — "5". */
  members: number;
  coverUri?: string;
  /** The fallback cover, seeded from the event id by `tintFor`. */
  tint: readonly [string, string];
  onPress: () => void;
  /** Tapping the status capsule — a live film's way to its developing state. */
  onPressStatus?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function FilmPoster({
  title,
  status,
  phase,
  members,
  coverUri,
  tint,
  onPress,
  onPressStatus,
  style,
}: FilmPosterProps) {
  const pressed = useSharedValue(0);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - T.pressScale) }],
  }));

  const capsule = (
    <Glass radius={GlassTokens.capsuleHeight / 2} style={styles.capsule}>
      {phase === 'live' ? <View style={styles.liveDot} /> : null}
      <Text style={styles.capsuleText}>{status}</Text>
      {onPressStatus ? <Feather name="chevron-right" size={13} color={Colors.textMuted} /> : null}
    </Glass>
  );

  return (
    <Animated.View style={[styles.root, animated, style]}>
      <Pressable
        accessibilityRole="button"
        // One spoken label for the whole poster rather than three loose nodes.
        accessibilityLabel={`${title}. ${status}. ${members} ${members === 1 ? 'person' : 'people'}.`}
        onPressIn={() => {
          pressed.value = withSpring(1, Springs.press);
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, Springs.press);
        }}
        onPress={onPress}
        style={styles.fill}>
        <LinearGradient colors={[tint[0], tint[1]]} style={StyleSheet.absoluteFill} />

        {coverUri ? (
          <Image
            source={{ uri: coverUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={T.coverTransitionMs}
            accessibilityIgnoresInvertColors
          />
        ) : null}

        <LinearGradient
          colors={[...T.scrim]}
          locations={[...T.scrimLocations]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.content}>
          <Display size="poster" numberOfLines={3}>
            {title}
          </Display>

          <View style={styles.capsules}>
            {onPressStatus ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${status}. See how the film is doing`}
                hitSlop={8}
                onPress={onPressStatus}>
                {capsule}
              </Pressable>
            ) : (
              capsule
            )}

            <Glass radius={GlassTokens.capsuleHeight / 2} style={styles.capsule}>
              <Feather name="users" size={13} color={Colors.text} />
              <Text style={styles.capsuleText}>{members}</Text>
            </Glass>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: T.radius,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hairlineStrong,
    backgroundColor: Colors.card,
  },
  fill: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  content: {
    padding: T.padding,
    gap: T.titleGap,
  },
  capsules: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.capsuleGap,
  },
  capsule: {
    height: GlassTokens.capsuleHeight,
    paddingHorizontal: GlassTokens.capsulePaddingX,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GlassTokens.capsuleGap,
  },
  capsuleText: {
    ...Typography.durationPill,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  liveDot: {
    width: T.liveDot,
    height: T.liveDot,
    borderRadius: T.liveDot / 2,
    backgroundColor: Colors.green,
  },
});
