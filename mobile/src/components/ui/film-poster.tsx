/**
 * One moment in the library's carousel — a stack of its photos — and the
 * "start a moment" stack that ends the carousel.
 *
 * Replaces 16's list card. A developed moment shows the album's first photos;
 * one that is not developed shows dimmed sample pictures, tagged as such
 * (decided 2026-11-15) — `PhotoStack` draws both.
 *
 * The title sits on the front photo; status and group size are glass capsules
 * over it — glass on imagery, never on glass. The whole stack reacts on
 * touch-down and opens on release.
 *
 * Purely presentational: what the capsule says and where a tap goes are
 * computed by lib/film-status.ts and handed in.
 */

import { Feather } from '@expo/vector-icons';
import type { ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { Glass, GlassButton } from './glass';
import { PhotoStack } from './photo-stack';
import { Body, Display, Em } from './typography';
import { Colors, Films, Glass as GlassTokens, Springs } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import type { FilmPhase } from '@/lib/film-status';

const T = Films.poster;
const F = Films.fresh;

type StackProps = {
  photos: readonly ImageSource[];
  /** The fallback under the front photo, seeded from the event id by `tintFor`. */
  tint: readonly [string, string];
  sample?: boolean;
  spread?: SharedValue<number>;
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** The pressable stack both cards are built on: down on touch, open on release. */
function PressableStack({
  photos,
  tint,
  sample,
  spread,
  onPress,
  accessibilityLabel,
  style,
  children,
}: StackProps) {
  const pressed = useSharedValue(0);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - T.pressScale) }],
  }));

  return (
    <Animated.View style={[animated, style]}>
      <Pressable
        accessibilityRole="button"
        // One spoken label for the whole stack rather than its loose parts.
        accessibilityLabel={accessibilityLabel}
        onPressIn={() => {
          pressed.value = withSpring(1, Springs.press);
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, Springs.press);
        }}
        onPress={onPress}
        style={styles.fill}>
        <PhotoStack photos={photos} tint={tint} sample={sample} spread={spread}>
          {children}
        </PhotoStack>
      </Pressable>
    </Animated.View>
  );
}

type FilmPosterProps = {
  title: string;
  /** "1d 23h left", "Developed · 124 photos", "Not started". */
  status: string;
  phase: FilmPhase;
  /** The roster size — "5". */
  members: number;
  /** Front photo first: the album's, or samples while it is not developed. */
  photos: readonly ImageSource[];
  /** Whether `photos` are stand-ins rather than the moment's own. */
  sample: boolean;
  tint: readonly [string, string];
  spread?: SharedValue<number>;
  onPress: () => void;
  /** Tapping the status capsule — a live moment's way to its developing state. */
  onPressStatus?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function FilmPoster({
  title,
  status,
  phase,
  members,
  photos,
  sample,
  tint,
  spread,
  onPress,
  onPressStatus,
  style,
}: FilmPosterProps) {
  const capsule = (
    <Glass radius={GlassTokens.capsuleHeight / 2} style={styles.capsule}>
      {phase === 'live' ? <View style={styles.liveDot} /> : null}
      <Text style={styles.capsuleText}>{status}</Text>
      {onPressStatus ? <Feather name="chevron-right" size={13} color={Colors.textMuted} /> : null}
    </Glass>
  );

  return (
    <PressableStack
      photos={photos}
      tint={tint}
      sample={sample}
      spread={spread}
      onPress={onPress}
      accessibilityLabel={`${title}. ${status}. ${members} ${members === 1 ? 'person' : 'people'}.`}
      style={style}>
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
    </PressableStack>
  );
}

type NewMomentCardProps = {
  /** Sample pictures, front first. */
  photos: readonly ImageSource[];
  tint: readonly [string, string];
  spread?: SharedValue<number>;
  onStart: () => void;
  onJoin: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * The stack that starts a new moment: the last one in the carousel, and the
 * only one while there are no moments. Tapping anywhere starts one; the capsule
 * is the other way in, for someone who was invited.
 */
export function NewMomentCard({ photos, tint, spread, onStart, onJoin, style }: NewMomentCardProps) {
  return (
    <PressableStack
      photos={photos}
      tint={tint}
      sample
      spread={spread}
      onPress={onStart}
      accessibilityLabel="Start a moment"
      style={style}>
      <View style={styles.fresh}>
        {/* The one light control: creating is the primary action here. */}
        <View style={styles.plus}>
          <Feather name="plus" size={F.plusIconSize} color={Colors.onLight} />
        </View>

        <Display size="poster" style={styles.freshHeadline}>
          Start your{'\n'}
          <Em>moment</Em>
        </Display>

        <Body small color={Colors.textMuted} style={styles.freshCopy}>
          One roll each. Nothing shows until{'\n'}the film is developed.
        </Body>

        <GlassButton
          icon="users"
          label="Join a group"
          accessibilityLabel="Join a group"
          onPress={onJoin}
          style={styles.join}
        />
      </View>
    </PressableStack>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
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
  fresh: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: F.padding,
  },
  plus: {
    width: F.plusSize,
    height: F.plusSize,
    borderRadius: F.plusSize / 2,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: F.plusGap,
  },
  freshHeadline: {
    textAlign: 'center',
    marginBottom: F.headlineGap,
  },
  freshCopy: {
    textAlign: 'center',
  },
  join: {
    marginTop: F.joinGap,
  },
});
