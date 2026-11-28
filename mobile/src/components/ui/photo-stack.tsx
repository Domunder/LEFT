/**
 * A stack of prints: one photo in front, and up to two more fanned out behind
 * it so an edge of each shows left and right.
 *
 * The library draws every moment as one of these (`FilmPoster`), and the
 * "start a moment" card too (`NewMomentCard`). Whatever is passed as `children`
 * is laid over the front photo.
 *
 * `spread` opens and closes the fan — 1 is fully fanned, 0 is a squared-up
 * pile. The carousel drives it from the scroll position, so a stack fans out
 * as it arrives in front, in step with the finger.
 *
 * `sample` marks stock pictures standing in for photos that cannot be shown
 * yet: they are dimmed and tagged, so they never read as the group's own.
 */

import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { Colors, Films } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { t } from '@/i18n';

const T = Films.stack;
const P = Films.poster;

type PhotoStackProps = PropsWithChildren<{
  /** Front photo first. Anything past the third is ignored. */
  photos: readonly ImageSource[];
  /** Drawn under the front photo, and instead of it when there is none. */
  tint: readonly [string, string];
  sample?: boolean;
  /** 0 squared up … 1 fanned out. Omitted: fanned out, and still. */
  spread?: SharedValue<number>;
}>;

export function PhotoStack({ photos, tint, sample = false, spread, children }: PhotoStackProps) {
  const [front, ...rest] = photos;
  const behind = rest.slice(0, T.behind.length);

  return (
    <View style={styles.root}>
      {/* Furthest back first, so the nearer print overlaps it. */}
      {behind
        .map((source, index) => (
          <Behind key={index} index={index} source={source} sample={sample} spread={spread} />
        ))
        .reverse()}

      <View style={styles.front}>
        <LinearGradient colors={[tint[0], tint[1]]} style={StyleSheet.absoluteFill} />

        {front ? (
          <Image
            source={front}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={P.coverTransitionMs}
            accessibilityIgnoresInvertColors
          />
        ) : null}

        {sample ? <View style={[StyleSheet.absoluteFill, styles.sampleDim]} /> : null}

        {children}

        {sample ? (
          <View style={styles.sampleTag} pointerEvents="none">
            <Text style={styles.sampleText}>{t('library.sample')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

type BehindProps = {
  index: number;
  source: ImageSource;
  sample: boolean;
  spread?: SharedValue<number>;
};

function Behind({ index, source, sample, spread }: BehindProps) {
  const place = T.behind[index];

  const animated = useAnimatedStyle(() => {
    const amount = spread ? spread.value : 1;
    return {
      transform: [
        { translateX: place.shiftX * amount },
        { translateY: place.lift * amount },
        { rotate: `${place.rotate * amount}deg` },
        { scale: place.scale },
      ],
    };
  });

  return (
    <Animated.View style={[styles.behind, animated]} pointerEvents="none">
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={P.coverTransitionMs}
        accessibilityIgnoresInvertColors
      />
      <View style={[StyleSheet.absoluteFill, styles.behindDim]} />
      {sample ? <View style={[StyleSheet.absoluteFill, styles.sampleDim]} /> : null}
    </Animated.View>
  );
}

const print = {
  borderRadius: P.radius,
  overflow: 'hidden',
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: Colors.hairlineStrong,
  backgroundColor: Colors.card,
} as const;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  behind: {
    ...StyleSheet.absoluteFill,
    ...print,
  },
  front: {
    flex: 1,
    ...print,
  },
  behindDim: {
    backgroundColor: T.behindDim,
  },
  sampleDim: {
    backgroundColor: T.sampleDim,
  },
  sampleTag: {
    position: 'absolute',
    top: T.sampleTag.inset,
    right: T.sampleTag.inset,
    height: T.sampleTag.height,
    paddingHorizontal: T.sampleTag.paddingX,
    borderRadius: T.sampleTag.height / 2,
    backgroundColor: T.sampleTag.bg,
    justifyContent: 'center',
  },
  sampleText: {
    ...Typography.labelSm,
    color: Colors.textMuted,
  },
});
