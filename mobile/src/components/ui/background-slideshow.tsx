/**
 * The full-bleed ambient backdrop: photos that drift slowly and dissolve into
 * one another.
 *
 * Used by Landing (01), the join sheet (08) and the three auth screens. It
 * replaced the looping video (2026-11-16): the app is about photos, the loop
 * cost 8 MB and an audio session, and its file had a broken header.
 *
 * ## How it moves
 *
 * Each photo is shown for `Backdrop.holdMs` while it travels — a slow zoom
 * with a slight sideways drift, alternating direction from one photo to the
 * next — and the next one fades in *over* it for `Backdrop.fadeMs`. The
 * outgoing photo stays fully opaque underneath until it is covered, so the
 * dissolve never dips towards the dark background, and it keeps travelling
 * while it is being covered, so nothing visibly stops.
 *
 * Ambient motion nobody touches: timed, linear travel is right here. Springs
 * are for things under a finger.
 *
 * ## Reduced motion
 *
 * No travel at all — the photos only cross-fade.
 *
 * ## Focus
 *
 * Screens below the top of the stack stay mounted. The slideshow only advances
 * while its screen is focused; a backdrop nobody sees does not need a timer.
 *
 * Decoration: hidden from the accessibility tree, never takes a touch.
 */

import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Backdrop, VideoOverlay } from '@/constants/theme';

/**
 * 9:16 crops — credits in assets/images/backdrop/CREDITS.md. Four since
 * 2026-11-21 (the user): two wedding pictures, the road trip, the dinner; the
 * party pictures are gone.
 */
const PHOTOS = [
  require('@/assets/images/backdrop/backdrop-1.jpg'),
  require('@/assets/images/backdrop/backdrop-2.jpg'),
  require('@/assets/images/backdrop/backdrop-3.jpg'),
  require('@/assets/images/backdrop/backdrop-4.jpg'),
] as const;

type BackgroundSlideshowProps = {
  /** Design opacity for this screen. Landing 0.85, the auth screens 0.55. */
  opacity?: number;
  style?: StyleProp<ViewStyle>;
};

export function BackgroundSlideshow({
  opacity = VideoOverlay.videoOpacity,
  style,
}: BackgroundSlideshowProps) {
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  useEffect(() => {
    if (!focused) return;

    const timer = setInterval(
      () => setIndex((i) => (i + 1) % PHOTOS.length),
      Backdrop.holdMs + Backdrop.fadeMs
    );
    return () => clearInterval(timer);
  }, [focused]);

  const previous = (index + PHOTOS.length - 1) % PHOTOS.length;
  const next = (index + 1) % PHOTOS.length;

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.clip, { opacity }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {PHOTOS.map((source, i) =>
        // Only the photo on show, the one it covers and the one that comes
        // next (decoded ahead of its fade) are mounted.
        i === index || i === previous || i === next ? (
          <Slide key={i} source={source} active={i === index} reverse={i % 2 === 1} />
        ) : null
      )}
    </View>
  );
}

type SlideProps = {
  source: number;
  active: boolean;
  /** Alternates the travel: zoom in drifting one way, zoom out drifting the other. */
  reverse: boolean;
};

function Slide({ source, active, reverse }: SlideProps) {
  const reducedMotion = useReducedMotion();

  // The very first photo is simply there; everything after it fades in.
  const visibility = useSharedValue(active ? 1 : 0);
  /** 0 → 1 over one showing: where the photo is on its travel. */
  const travel = useSharedValue(0);

  useEffect(() => {
    if (active) {
      visibility.value = withTiming(1, {
        duration: Backdrop.fadeMs,
        easing: Easing.inOut(Easing.quad),
      });

      if (!reducedMotion) {
        travel.value = 0;
        travel.value = withTiming(1, {
          // Keeps going while the next photo fades in over it.
          duration: Backdrop.holdMs + Backdrop.fadeMs * 2,
          easing: Easing.linear,
        });
      }
    } else {
      // Stay opaque underneath until the next photo has covered this one.
      visibility.value = withDelay(Backdrop.fadeMs, withTiming(0, { duration: 0 }));
    }
  }, [active, reducedMotion, travel, visibility]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = reverse ? 1 - travel.value : travel.value;

    return {
      opacity: visibility.value,
      transform: [
        { translateX: (t - 0.5) * Backdrop.drift * (reverse ? -1 : 1) },
        // `zoomFrom` is above 1 by more than the drift, so an edge never shows.
        { scale: Backdrop.zoomFrom + (Backdrop.zoomTo - Backdrop.zoomFrom) * t },
      ],
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, active ? styles.front : styles.back, animatedStyle]}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  front: {
    zIndex: 1,
  },
  back: {
    zIndex: 0,
  },
});
