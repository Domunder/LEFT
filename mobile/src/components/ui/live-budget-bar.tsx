/**
 * 13's shared-budget readout — the real one.
 *
 * A sibling of `budget-bar.tsx` rather than a reuse of it. That one is a looping
 * worked example built for 10.1, where nobody has filmed yet and live numbers
 * would be an empty bar; this one has no script and no opinion, it just draws
 * what the group has actually spent. Its own docblock hands this case over.
 *
 * The numbers arrive from two directions — a seed read of the event and realtime
 * UPDATEs on `events.used_seconds` — and this component knows about neither. It
 * takes its numbers and renders them, so the screen owns the subscription and
 * the bar can never disagree with the header above it.
 *
 * `pendingSeconds` is the take currently being filmed. The server does not know
 * about it — a reservation is a hold, and `used_seconds` only moves on commit —
 * so without it the bar would sit perfectly still through the one action most
 * obviously spending the budget. It is counted locally and provisionally, and
 * replaced by the server's own number the moment the clip commits.
 *
 * It turns red near the end. The prototype hardcodes that threshold at 9 seconds
 * against its 60s demo; here it is a fraction of the real budget, because nine
 * seconds of warning on a ten-minute film is no warning at all. See
 * `Camera.bar.criticalFraction`.
 */

import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Camera, Motion, Radii } from '@/constants/theme';
import { Typography } from '@/constants/typography';

const TIMING = {
  duration: Motion.duration,
  easing: Easing.bezier(...Motion.bezier).factory(),
} as const;

/** One tick of a running take: linear, and over in well under a second. */
const PENDING_TIMING = {
  duration: Camera.bar.pendingDuration,
  easing: Easing.linear,
} as const;

type LiveBudgetBarProps = {
  /** Seconds the group has already spent — `events.used_seconds`. */
  usedSeconds: number;
  /** The whole pool — `events.budget_seconds`. */
  budgetSeconds: number;
  /**
   * Seconds elapsed in a take still being filmed on this device.
   *
   * Provisional: nothing on the server has moved yet. Folded into the fill and
   * the remaining count so the bar answers "how much is left *right now*", which
   * is the question someone holding down the record button is actually asking.
   */
  pendingSeconds?: number;
};

/**
 * Whether the group is close enough to the end to be warned.
 *
 * Exported because the screen needs the same answer for its remaining-seconds
 * label as the bar needs for its fill, and two thresholds that could drift apart
 * is one more thing to keep in step.
 */
export function isCritical(remainingSeconds: number, budgetSeconds: number): boolean {
  if (budgetSeconds <= 0) return true;
  const threshold = Math.max(
    Camera.bar.criticalFloorSeconds,
    budgetSeconds * Camera.bar.criticalFraction
  );
  return remainingSeconds <= threshold;
}

export function LiveBudgetBar({
  usedSeconds,
  budgetSeconds,
  pendingSeconds = 0,
}: LiveBudgetBarProps) {
  /*
    Clamped to the pool: a take can run right up to the last second, and a
    provisional count that overshot would show a bar past full and a negative
    remainder before the commit arrived to correct it.
  */
  const spent = Math.min(budgetSeconds, usedSeconds + pendingSeconds);
  const remaining = Math.max(0, budgetSeconds - spent);
  const critical = isCritical(remaining, budgetSeconds);

  /*
    Clamped at both ends. Above, because a commit landing against a stale
    `budget_seconds` can briefly read over 100%; below, because the opening
    seconds of a long film round to a bar that looks untouched.
  */
  const fraction = budgetSeconds > 0 ? Math.min(1, Math.max(0, spent / budgetSeconds)) : 0;
  const width = fraction === 0 ? 0 : Math.max(Camera.bar.minFill, fraction);

  /*
    A percentage width rather than a measured one — the same call budget-bar.tsx
    makes, and for the same reason: it avoids an onLayout pass and the frame of
    wrong geometry that comes with it.
  */
  /*
    While a take is running the fill tracks the counter in step — a one-second
    tick eased over Motion.duration would leave the bar visibly trailing the
    number beside it. Settling back after the commit keeps the standard easing,
    because that movement is the server correcting us, not the take advancing.
  */
  const fill = useAnimatedStyle(
    () => ({
      width: withTiming(`${width * 100}%`, pendingSeconds > 0 ? PENDING_TIMING : TIMING),
      backgroundColor: withTiming(critical ? Camera.bar.fillCritical : Camera.bar.fill, TIMING),
    }),
    [width, critical, pendingSeconds]
  );

  return (
    <View>
      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${Math.round(spent)} of ${budgetSeconds} seconds of the group's filming time used`}
        accessibilityValue={{ min: 0, max: budgetSeconds, now: Math.round(spent) }}>
        <Animated.View style={[styles.fill, fill]} />
      </View>

      <View style={styles.labels}>
        <Text style={styles.used}>{Math.round(spent)}s used</Text>
        <Text style={[styles.remaining, critical && styles.remainingCritical]}>
          {Math.round(remaining)}s remaining
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: Camera.bar.height,
    borderRadius: Radii.pill,
    backgroundColor: Camera.bar.track,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radii.pill,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Camera.bar.labelGap,
  },
  used: {
    ...Typography.caption,
    fontSize: Camera.bar.labelSize,
    color: Camera.bar.usedColor,
  },
  remaining: {
    ...Typography.caption,
    fontSize: Camera.bar.labelSize,
    color: Camera.bar.remainingColor,
  },
  remainingCritical: {
    color: Camera.bar.remainingColorCritical,
  },
});
