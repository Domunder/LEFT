/**
 * The running moment at the top of the library (16), full-bleed from the
 * screen's top edge (2026-11-21, the user, replacing the card it had in the
 * list): the viewer's latest photo, slowly drifting, with the roll, the
 * countdown and "Open camera" over it, fading into the page at its foot.
 *
 * The screen's own header ("Moments", the buttons) floats over its top, which
 * the shade darkens for it. There is no border and no card: where the photo
 * ends the page begins.
 *
 * Before the viewer has shot, a sample stands in, blurred past recognition —
 * atmosphere, never a picture to be taken for the group's own.
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

import { Glass } from './glass';
import { PillButton } from './pill-button';
import { PressScale } from './press-scale';
import { Display } from './typography';
import { Colors, Films, Press } from '@/constants/theme';
import { Typography } from '@/constants/typography';

const T = Films.hero;
const SHADE = [...T.shade.colors] as [string, string, ...string[]];
const LOCATIONS = [...T.shade.locations] as [number, number, ...number[]];

/** The hero's height on a window this tall — the screen needs it to know when the hero has scrolled away. */
export function heroHeight(windowHeight: number): number {
  return Math.max(T.minHeight, Math.round(windowHeight * T.heightRatio));
}

type MomentHeroProps = {
  title: string;
  /** The viewer's latest photo; without one, `sample` stands in, blurred. */
  photo?: string;
  sample?: ImageSource;
  /** Drawn under the photo while it loads. */
  tint: string;
  /** Frames left on the viewer's roll; null = unlimited, undefined = not known yet. */
  shotsLeft: number | null | undefined;
  /** "01d 23h" — the countdown's two largest units. */
  countdown: string;
  actionLabel: string;
  onAction: () => void;
  /** The countdown: the way to the developing state (and the host's "develop now"). */
  onPressCountdown: () => void;
  onLongPress: () => void;
};

export function MomentHero({
  title,
  photo,
  sample,
  tint,
  shotsLeft,
  countdown,
  actionLabel,
  onAction,
  onPressCountdown,
  onLongPress,
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
      accessibilityLabel={`${title}, live now`}
      accessibilityActions={[{ name: 'longpress', label: 'More' }]}
      onAccessibilityAction={onLongPress}
      onLongPress={onLongPress}
      style={[styles.hero, { height: heroHeight(height) }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
      {source ? (
        <Animated.View style={[StyleSheet.absoluteFill, drifting]}>
          <Image
            source={source}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={photo ? 0 : T.sampleBlur}
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
          <View style={styles.dot} />
          <Text style={styles.capsuleText}>Live now</Text>
        </Glass>

        <Display size="xs" numberOfLines={2} style={styles.title}>
          {title}
        </Display>

        <View style={styles.numbers}>
          <View>
            <Text style={styles.count}>
              {shotsLeft === undefined ? ' ' : shotsLeft === null ? '∞' : shotsLeft}
            </Text>
            <Text style={styles.meta}>{shotsLeft === null ? 'unlimited roll' : 'shots left'}</Text>
          </View>

          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`${countdown} until it develops. See how the film is doing`}
            scale={Press.iconScale}
            hitSlop={12}
            onPress={onPressCountdown}
            style={styles.countdown}>
            <Text style={styles.countdownText}>{countdown}</Text>
            <View style={styles.countdownLabel}>
              <Text style={styles.meta}>until it develops</Text>
              <Feather name="chevron-right" size={T.chevronSize} color={Colors.textMuted} />
            </View>
          </PressScale>
        </View>

        <PillButton label={actionLabel} onPress={onAction} style={styles.action} />
      </View>
    </Pressable>
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
  countdown: {
    alignItems: 'flex-end',
  },
  countdownText: {
    ...Typography.heroCountdown,
    color: Colors.text,
  },
  countdownLabel: {
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
