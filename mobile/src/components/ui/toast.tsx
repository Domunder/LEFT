/**
 * 18 · In-App Notification — the banner that says somebody else just filmed.
 *
 * Not a route. An overlay mounted once in the root layout by `ToastProvider`
 * (toast-host.tsx), which owns when one appears and for how long; this file owns
 * only what one looks like and how it moves.
 *
 * Four departures from the artboard, all recorded in `Toast` in constants/theme.ts
 * and worth repeating where the code is:
 *
 *  - **the `-50%` in `toast-in` is a bug.** The keyframe reads
 *    `transform: translate(-50%, -14px)` → `translate(-50%, 0)`, left over from a
 *    draft that centred the card with `left: 50%`. The shipped card is pinned
 *    `left: 16 / right: 16` and has no base transform, so porting the keyframe
 *    literally would shove it half its width off screen for 320ms and snap it
 *    back. Only the translateY and the opacity survive.
 *  - **there is no exit.** The prototype has no `toast-out` keyframe; it drops
 *    the node. A banner that vanishes between frames reads as a glitch, so the
 *    entry is reversed over `Toast.motion.exitDuration`.
 *  - **the dismiss X is stroke 2.4 in the artboard.** Feather ships a fixed 2px
 *    path and exposes no stroke width, so the weight is approximate. The same
 *    limitation applies to the download chip on 17.
 *  - **the copy is English.** The prototype's toast is the only German text in
 *    the app ("Anna hat gefilmt · 8s" / "42s vom Budget übrig"); every other
 *    screen is English, and the strings are composed by the caller anyway.
 *
 * `GlassPanel` is deliberately not reused: it is fixed at `Radii.sheet` (28) with
 * 32/24/28 padding, where this is radius 18 at 14/16. Bending it to cover both
 * costs more than the sibling does — the same call `ShareButton` and `AuthButton`
 * already made against `PillButton`.
 */

import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Shadows, Toast as T } from '@/constants/theme';
import { Typography } from '@/constants/typography';

const ENTER = {
  duration: T.motion.duration,
  easing: Easing.bezier(...T.motion.bezier).factory(),
};

const EXIT = {
  duration: T.motion.exitDuration,
  easing: Easing.bezier(...T.motion.bezier).factory(),
};

/** What a toast says. Composed by whoever raises it. */
export type ToastContent = {
  /** Drives the avatar tile — `initialsFor(name)`, or '?' for an unknown author. */
  initials: string;
  title: string;
  message?: string;
};

type ToastProps = ToastContent & {
  /** Set false by the host to play the exit; `onExited` follows when it lands. */
  visible: boolean;
  /** The X. */
  onDismiss: () => void;
  /** Fired once the exit animation has finished, so the host can unmount. */
  onExited: () => void;
};

export function ToastCard({ initials, title, message, visible, onDismiss, onExited }: ToastProps) {
  /*
    Driven imperatively rather than with Reanimated's `entering`/`exiting` props:
    the host has to know when the exit has actually finished before it drops the
    node, and a layout animation gives no callback to hang that on.
  */
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, ENTER);
      return;
    }

    progress.value = withTiming(0, EXIT, (finished) => {
      if (finished) runOnJS(onExited)();
    });
  }, [visible, progress, onExited]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    // -14 -> 0 on entry. See the header for why the artboard's -50% is dropped.
    transform: [{ translateY: (1 - progress.value) * T.motion.travelY }],
  }));

  return (
    <Animated.View style={[styles.shadow, animated]}>
      <View style={styles.clip}>
        <BlurView intensity={T.blurIntensity} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.fill]} />

        <View style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials}</Text>
          </View>

          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {message ? (
              <Text style={styles.message} numberOfLines={1}>
                {message}
              </Text>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss notification"
            onPress={onDismiss}
            // 26pt is under the 44pt minimum; the slop carries it there.
            hitSlop={9}
            style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}>
            <Feather name="x" size={T.dismiss.iconSize} color={Colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /*
    Shadow and clipping are separate views on purpose: a BlurView with
    `overflow: hidden` clips its own shadow on iOS, which is the same split
    GlassPanel makes.
  */
  shadow: {
    borderRadius: T.radius,
    ...(Shadows.toast as object),
  },
  clip: {
    borderRadius: T.radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: T.border,
  },
  fill: {
    backgroundColor: T.bg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.gap,
    paddingVertical: T.paddingY,
    paddingHorizontal: T.paddingX,
  },
  /** A rounded rect, where every other avatar in the app is a circle. As drawn. */
  avatar: {
    width: T.avatar.size,
    height: T.avatar.size,
    borderRadius: T.avatar.radius,
    backgroundColor: T.avatar.bg,
    borderWidth: 1,
    borderColor: T.avatar.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  initials: {
    ...Typography.initialsSm,
    color: Colors.textStrong,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: T.sub.gap,
  },
  title: {
    ...Typography.toastTitle,
    color: Colors.text,
  },
  message: {
    ...Typography.metaSm,
    color: Colors.textDim,
  },
  dismiss: {
    width: T.dismiss.size,
    height: T.dismiss.size,
    borderRadius: T.dismiss.size / 2,
    backgroundColor: T.dismiss.bg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dismissPressed: {
    opacity: 0.6,
  },
});
