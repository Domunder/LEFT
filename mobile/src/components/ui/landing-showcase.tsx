/**
 * Landing's showcase (1.3.0, the user: "a better login screen that shows the
 * app") — LEFT running inside the website's iPhone, tilted and afloat,
 * replacing the photo slideshow on 01.
 *
 * One loop tells the whole product in about ten seconds:
 *   1. the camera — the shutter fires and the roll counts down, 24 → 20
 *   2. the film develops — everyone's prints are smudges, a countdown runs out
 *   3. the reveal — the prints clear, one after another
 *
 * It is the real `CameraMock` and the real `RollCounter`, so the digits roll
 * as they do on 13. A JS timer steps the story; every change between steps is
 * a timed cross-fade on the UI thread. It runs only while its screen is
 * focused. Reduced motion: no tilt, no float, no loop — the developed album.
 *
 * A drawing: nothing in it is touchable, and VoiceOver reads it as one image.
 */

import { Image, type ImageSource } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CameraMock } from './camera-mock';
import { PhoneFrame } from './phone-frame';
import { Label } from './typography';
import { DEFAULT_LOOK } from '@/constants/looks';
import { COVER_SAMPLES, SAMPLE_PHOTOS } from '@/constants/samples';
import { Colors, LandingShowcase as T, Motion } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { t } from '@/i18n';

/** People first, places between them: the album a group would actually get. */
const PRINTS: readonly (ImageSource | number)[] = SAMPLE_PHOTOS.flatMap((photo, i) => [
  photo,
  COVER_SAMPLES[(i + 1) % COVER_SAMPLES.length].source,
]).slice(0, T.columns * T.rows);

const SHOTS = T.shots;
/** Steps: the camera (0…SHOTS), the countdown (3, 2, 1), then the reveal held. */
const COUNTDOWN_FROM = 3;
const REVEAL_AT = SHOTS + 1 + COUNTDOWN_FROM;
const STEPS = REVEAL_AT + T.holdSteps;

const FADE = { duration: Motion.duration, easing: Easing.out(Easing.cubic) } as const;

export function LandingShowcase({ width }: { width: number }) {
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!focused || reduceMotion) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % STEPS), T.stepMs);
    return () => clearInterval(timer);
  }, [focused, reduceMotion]);

  const shown = reduceMotion ? REVEAL_AT : step;
  const inCamera = shown <= SHOTS;
  const revealed = shown >= REVEAL_AT;
  const shotsLeft = T.roll - Math.min(shown, SHOTS);
  const countdown = Math.max(1, COUNTDOWN_FROM - (shown - SHOTS - 1));

  // The phone drifts up and down, slowly, for as long as it is on screen.
  const float = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || !focused) return;
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: T.floatMs, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: T.floatMs, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [float, focused, reduceMotion]);
  const afloat = useAnimatedStyle(() => ({
    transform: [
      { translateY: (float.value - 0.5) * T.floatTravel },
      { rotateZ: reduceMotion ? '0deg' : `${T.tiltDeg}deg` },
    ],
  }));

  // The shutter: a white blink over the viewfinder with every frame taken.
  const flash = useSharedValue(0);
  useEffect(() => {
    if (shown === 0 || shown > SHOTS) return;
    flash.value = withSequence(
      withTiming(T.flashOpacity, { duration: T.flashInMs }),
      withTiming(0, { duration: T.flashOutMs }),
    );
  }, [flash, shown]);
  const blink = useAnimatedStyle(() => ({ opacity: flash.value }));

  // The dependency arrays are required: plain values read inside worklets.
  const camera = useAnimatedStyle(() => ({ opacity: withTiming(inCamera ? 1 : 0, FADE) }), [inCamera]);
  const waiting = useAnimatedStyle(() => ({ opacity: withTiming(revealed ? 0 : 1, FADE) }), [revealed]);
  const done = useAnimatedStyle(() => ({ opacity: withTiming(revealed ? 1 : 0, FADE) }), [revealed]);

  return (
    <Animated.View
      style={afloat}
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('landing.showcaseA11y')}>
      <PhoneFrame width={width}>
        {/* Under the camera: the film developing, then developed. */}
        <View style={styles.album}>
          <View style={styles.albumHeader}>
            <Label small color={Colors.textDim}>
              {t('landing.showcaseName')}
            </Label>
            <View style={styles.status}>
              <Animated.View style={[styles.statusLine, waiting]}>
                <Text style={styles.statusText}>{t('landing.showcaseDeveloping')}</Text>
                <Text style={styles.statusCount}>{countdown}</Text>
              </Animated.View>
              <Animated.View style={[styles.statusLine, styles.statusOver, done]}>
                <Text style={styles.statusText}>{t('landing.showcaseDeveloped')}</Text>
              </Animated.View>
            </View>
          </View>

          <View style={styles.grid}>
            {PRINTS.map((source, i) => (
              <Print key={i} source={source} index={i} revealed={revealed} />
            ))}
          </View>
        </View>

        <Animated.View style={[StyleSheet.absoluteFill, camera]}>
          <CameraMock
            look={DEFAULT_LOOK}
            source={COVER_SAMPLES[0].source}
            name={t('landing.showcaseName')}
            rollSize={shotsLeft}
          />
          <Animated.View style={[StyleSheet.absoluteFill, styles.flash, blink]} />
        </Animated.View>
      </PhoneFrame>
    </Animated.View>
  );
}

/** One print: a smudge until the reveal, then clear — each a beat after the last. */
function Print({
  source,
  index,
  revealed,
}: {
  source: ImageSource | number;
  index: number;
  revealed: boolean;
}) {
  const veil = useAnimatedStyle(
    () => ({
      opacity: revealed
        ? withDelay(index * T.revealStaggerMs, withTiming(0, { duration: T.revealMs }))
        : withTiming(1, { duration: 0 }),
    }),
    [revealed, index]
  );
  return (
    <View style={styles.print}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
      <Animated.View style={[StyleSheet.absoluteFill, veil]}>
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={T.blur} />
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  album: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  albumHeader: {
    paddingTop: T.header.top,
    paddingHorizontal: T.header.paddingX,
    paddingBottom: T.header.bottom,
    gap: T.header.gap,
  },
  status: {
    justifyContent: 'center',
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: T.header.countGap,
  },
  statusOver: {
    position: 'absolute',
    left: 0,
  },
  statusText: {
    ...Typography.groupHeading,
    fontSize: T.header.titleSize,
    color: Colors.text,
  },
  statusCount: {
    ...Typography.numeric,
    fontSize: T.header.titleSize,
    color: Colors.gold,
    fontVariant: ['tabular-nums'],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.gap,
    paddingHorizontal: T.gap,
  },
  print: {
    width: T.print,
    aspectRatio: 3 / 4,
    borderRadius: T.printRadius,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceFaint,
  },
  dim: {
    backgroundColor: T.dim,
  },
  flash: {
    backgroundColor: '#fff',
  },
});
