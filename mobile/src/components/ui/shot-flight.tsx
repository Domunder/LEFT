/**
 * The photo just taken, flying into the "Your shots" tile (1.3.0, step 8).
 *
 * A square print appears in the middle of the viewfinder, rests a moment and
 * settles into the tile left of the shutter — so it is plain where the picture
 * went and where to find it. Drawn once per shot, over everything, and it never
 * takes a touch. Not mounted under reduced motion: there the tile cross-fades.
 *
 * `from` and `to` are in the coordinates of the parent this is absolutely
 * placed in (the camera's screen, which is the window).
 */

import { Image } from 'expo-image';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Camera } from '@/constants/theme';

const T = Camera.flight;

export type FlightRect = { x: number; y: number; width: number; height: number };

export function ShotFlight({
  uri,
  from,
  to,
  radius,
  onLanded,
}: {
  uri: string;
  from: FlightRect;
  to: FlightRect;
  /** The tile's corner radius, which the print arrives with. */
  radius: number;
  onLanded: () => void;
}) {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  const landed = useRef(onLanded);
  landed.current = onLanded;
  const done = useCallback(() => landed.current(), []);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: T.appearMs });
    progress.value = withDelay(
      T.holdMs,
      withSpring(1, T.spring, (finished) => {
        if (finished) scheduleOnRN(done);
      })
    );
  }, [opacity, progress, done]);

  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  const endScale = to.width / from.width;
  const startRadius = T.startRadius;

  const style = useAnimatedStyle(() => {
    const scale = 1 + progress.value * (endScale - 1);
    // The radius is scaled with the view, so it is divided back out.
    const shown = startRadius + progress.value * (radius - startRadius);
    return {
      opacity: opacity.value,
      borderRadius: shown / scale,
      transform: [
        { translateX: progress.value * dx },
        { translateY: progress.value * dy },
        { scale },
      ],
    };
  }, [dx, dy, endScale, radius, startRadius]);

  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.print,
        { left: from.x, top: from.y, width: from.width, height: from.height },
        style,
      ]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  print: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
    backgroundColor: T.bg,
  },
});
