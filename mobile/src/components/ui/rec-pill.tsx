/**
 * 13's "REC 12s" pill — the one thing on screen that says the camera is live.
 *
 * Pinned inside the viewfinder's top-left corner rather than over the chrome
 * above it, so it travels with the image: whoever is being filmed can see the
 * dot in frame, which is the social contract the pill exists to honour.
 *
 * The dot blinks rather than pulsing in scale. A camera's tally light is the
 * reference, and it is the one convention on this screen everybody already
 * knows. It dims to 0.25 rather than to nothing — fully off for half a cycle
 * reads as a dropped frame, not a heartbeat.
 *
 * The first use of `withRepeat` in the codebase; everything else here animates
 * once and settles.
 *
 * It counts **down** when given a `limitSeconds`, which is the normal case now
 * that every take is capped — see the prop. The dot's blink is unaffected either
 * way; it says "live", not "how long".
 */

import { BlurView } from 'expo-blur';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Camera, Colors, Motion, Radii } from '@/constants/theme';
import { Typography } from '@/constants/typography';

/* Half a cycle each way, so one full blink takes Motion.pulseDuration. */
const HALF_CYCLE = {
  duration: Motion.pulseDuration / 2,
  easing: Easing.inOut(Easing.ease),
} as const;

type RecPillProps = {
  /** Seconds elapsed in the take so far. */
  seconds: number;
  /**
   * The cap on this take, if it has one — `reserve_budget`'s granted seconds.
   *
   * With it the pill counts **down**, because a ceiling you cannot see is not a
   * ceiling: the camera stops itself at the cap, and without warning that reads
   * as the app crashing mid-take rather than as the rule it is.
   *
   * Without it the pill counts up, which is what it did before takes were
   * capped and what it should still do if a grant is ever unbounded.
   */
  limitSeconds?: number;
};

export function RecPill({ seconds, limitSeconds }: RecPillProps) {
  const blink = useSharedValue(1);

  useEffect(() => {
    blink.value = withRepeat(
      withTiming(Camera.recPill.dotDimOpacity, HALF_CYCLE),
      -1,
      /* Reversing rather than restarting: a hard jump back to full brightness
         reads as two different animations, one of them broken. */
      true
    );
    return () => {
      blink.value = 1;
    };
  }, [blink]);

  const dot = useAnimatedStyle(() => ({ opacity: blink.value }));

  /*
    Floored at zero. `seconds` is sampled from a wall clock every 250ms while the
    camera stops itself on its own schedule, so the two can disagree by a tick at
    the very end — and "REC -1s" is a bug report.
  */
  const counting = limitSeconds !== undefined ? Math.max(0, limitSeconds - seconds) : seconds;

  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="text"
      accessibilityLabel={
        limitSeconds !== undefined
          ? `Recording, ${counting} seconds left in this take`
          : `Recording, ${counting} seconds`
      }>
      <BlurView intensity={Camera.recPill.blur} tint="dark" style={styles.blur}>
        <Animated.View style={[styles.dot, dot]} />
        <Text style={styles.label}>REC {counting}s</Text>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: Camera.recPill.inset,
    left: Camera.recPill.inset,
    borderRadius: Radii.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Camera.recPill.border,
  },
  blur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Camera.recPill.gap,
    paddingVertical: Camera.recPill.paddingY,
    paddingHorizontal: Camera.recPill.paddingX,
    backgroundColor: Camera.recPill.bg,
  },
  dot: {
    width: Camera.recPill.dotSize,
    height: Camera.recPill.dotSize,
    borderRadius: Camera.recPill.dotSize / 2,
    backgroundColor: Colors.rec,
  },
  label: {
    ...Typography.rec,
    /* Pure white, not Colors.text: this sits on the image itself, where the
       off-white the rest of the app uses reads as slightly dirty. As drawn. */
    color: '#fff',
  },
});
