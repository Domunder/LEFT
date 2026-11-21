/**
 * The moment in the spotlight at the top of the library (16), full-bleed from
 * the screen's top edge (2026-11-21, the user, replacing the card it had in
 * the list). A running moment: the viewer's latest photo, slowly drifting,
 * with the roll, the countdown and "Open camera" over it. Else one waiting to
 * be started (2026-11-21): the roll, who joined, "Invite & start". Only when
 * every moment is developed, the last one developed: its album's first photo,
 * the counts and "Open album". It fades into the page at its foot.
 *
 * The screen's own header ("Moments", the buttons) floats over its top, which
 * the shade darkens for it. There is no border and no card: where the photo
 * ends the page begins.
 *
 * Without a photo of its own a sample stands in, unblurred (the user,
 * 2026-11-21: "a mock picture for now").
 *
 * Purely presentational: the numbers and where a tap goes are the caller's.
 */

import { Feather } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { EventCoverImage } from './event-cover-image';
import { Glass, GlassButton } from './glass';
import { PillButton } from './pill-button';
import { PressScale } from './press-scale';
import { Display } from './typography';
import { Colors, Films, Press } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import type { Event } from '@/lib/events';

const T = Films.hero;
const SHADE = [...T.shade.colors] as [string, string, ...string[]];
const LOCATIONS = [...T.shade.locations] as [number, number, ...number[]];

/** The hero's height on a window this tall — the screen needs it to know when the hero has scrolled away. */
export function heroHeight(windowHeight: number): number {
  return Math.max(T.minHeight, Math.round(windowHeight * T.heightRatio));
}

/** One of the two numbers over the photo: "17" over "shots left". */
export type HeroStat = {
  /** Undefined while it is not known yet: the line keeps its height. */
  value: string | undefined;
  label: string;
  /** Makes the number a target of its own, with a chevron after its label. */
  onPress?: () => void;
  accessibilityLabel?: string;
};

type MomentHeroProps = {
  title: string;
  /** "Live now" with a green dot, or "Developed". */
  status: string;
  live: boolean;
  /** The moment's photo; without one, `sample` stands in. */
  photo?: string;
  sample?: ImageSource;
  /** Drawn under the photo while it loads. */
  tint: string;
  /** Large, bottom left. */
  primary: HeroStat;
  /** Smaller, bottom right. */
  secondary: HeroStat;
  actionLabel: string;
  onAction: () => void;
  /**
   * A small glass capsule beside the numbers instead of the full-width pill,
   * and the whole photo opens it too (the developed moment: the user,
   * 2026-11-21 — "Open album" stuck out too much).
   */
  quiet?: boolean;
  onLongPress: () => void;
  /**
   * The event image, in the look (2026-11-21, the user: "always this event
   * image"). When set it is the picture, and `photo`/`sample` are ignored.
   */
  cover?: Pick<Event, 'id' | 'cover' | 'look'>;
};

export function MomentHero({
  title,
  photo,
  sample,
  tint,
  status,
  live,
  primary,
  secondary,
  actionLabel,
  onAction,
  quiet = false,
  onLongPress,
  cover,
}: MomentHeroProps) {
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  // The photo drifts in and out, slowly; under reduced motion it stands still.
  const drift = useSharedValue<number>(T.drift.from);
  useEffect(() => {
    if (reducedMotion) {
      drift.value = T.drift.from;
      return;
    }
    drift.value = withRepeat(
      withTiming(T.drift.to, {
        duration: T.drift.ms,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [drift, reducedMotion]);
  const drifting = useAnimatedStyle(() => ({
    transform: [{ scale: drift.value }],
  }));

  const source: ImageSource | undefined = photo ? { uri: photo } : sample;

  return (
    <Pressable
      accessibilityRole="summary"
      accessibilityLabel={`${title}, ${status}`}
      accessibilityActions={[{ name: 'longpress', label: 'More' }]}
      onAccessibilityAction={onLongPress}
      onPress={quiet ? onAction : undefined}
      onLongPress={onLongPress}
      style={[styles.hero, { height: heroHeight(height) }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
      {cover ? (
        <Animated.View style={[StyleSheet.absoluteFill, drifting]}>
          <EventCoverImage event={cover} />
        </Animated.View>
      ) : source ? (
        <Animated.View style={[StyleSheet.absoluteFill, drifting]}>
          <Image
            source={source}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={T.fadeMs}
          />
        </Animated.View>
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={SHADE}
        locations={LOCATIONS}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.body}>
        <Glass radius={T.capsuleHeight / 2} style={styles.capsule}>
          {live ? <View style={styles.dot} /> : null}
          <Text style={styles.capsuleText}>{status}</Text>
        </Glass>

        <Display size="xs" numberOfLines={2} style={styles.title}>
          {title}
        </Display>

        {quiet ? (
          <View style={styles.numbers}>
            <View style={styles.stats}>
              <Stat stat={primary} />
              <Stat stat={secondary} />
            </View>
            <GlassButton
              label={actionLabel}
              icon="image"
              accessibilityLabel={actionLabel}
              onPress={onAction}
            />
          </View>
        ) : (
          <>
            <View style={styles.numbers}>
              <View>
                <Text style={styles.count}>{primary.value ?? ' '}</Text>
                <Text style={styles.meta}>{primary.label}</Text>
              </View>

              {secondary.onPress ? (
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={secondary.accessibilityLabel}
                  scale={Press.iconScale}
                  hitSlop={12}
                  onPress={secondary.onPress}
                  style={styles.secondary}>
                  <Text style={styles.secondaryText}>{secondary.value ?? ' '}</Text>
                  <View style={styles.secondaryLabel}>
                    <Text style={styles.meta}>{secondary.label}</Text>
                    <Feather name="chevron-right" size={T.chevronSize} color={Colors.textMuted} />
                  </View>
                </PressScale>
              ) : (
                <View style={styles.secondary}>
                  <Text style={styles.secondaryText}>{secondary.value ?? ' '}</Text>
                  <Text style={styles.meta}>{secondary.label}</Text>
                </View>
              )}
            </View>

            <PillButton label={actionLabel} onPress={onAction} style={styles.action} />
          </>
        )}
      </View>
    </Pressable>
  );
}

/** A number over its label, at the countdown's size — the quiet hero's counts. */
function Stat({ stat }: { stat: HeroStat }) {
  return (
    <View>
      <Text style={styles.secondaryText}>{stat.value ?? ' '}</Text>
      <Text style={styles.meta}>{stat.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  body: {
    paddingHorizontal: T.paddingX,
    paddingBottom: T.paddingBottom,
  },
  capsule: {
    alignSelf: 'flex-start',
    height: T.capsuleHeight,
    paddingHorizontal: T.capsulePaddingX,
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.capsuleDot,
  },
  dot: {
    width: T.capsuleDot,
    height: T.capsuleDot,
    borderRadius: T.capsuleDot / 2,
    backgroundColor: Colors.green,
  },
  capsuleText: {
    ...Typography.durationPill,
    color: Colors.text,
  },
  title: {
    marginTop: T.capsuleGap,
  },
  numbers: {
    marginTop: T.titleGap,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  count: {
    ...Typography.heroCount,
    color: Colors.text,
  },
  secondary: {
    alignItems: 'flex-end',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: T.statsGap,
  },
  secondaryText: {
    ...Typography.heroCountdown,
    color: Colors.text,
  },
  secondaryLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.chevronGap,
  },
  meta: {
    ...Typography.metaMd,
    color: Colors.textMuted,
  },
  action: {
    marginTop: T.actionGap,
  },
});
