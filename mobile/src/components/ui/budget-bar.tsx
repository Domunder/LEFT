/**
 * 10.1's shared-budget demonstration.
 *
 * Not a readout — a small worked example. Two imaginary people film, the bar
 * advances by what each of them spent, and their clips stack up beneath it:
 *
 *     Maya added 10 seconds
 *     Felix added 14 seconds
 *
 * It is a demo rather than the group's own numbers because of *when* this sheet
 * is opened. It hangs off the info button on screen 10, before anyone has
 * filmed a frame — so real data is an empty bar and a zero, which demonstrates
 * nothing. Watching the bar move twice, driven by two named people, is the
 * whole explanation: one pool, everyone draws from it.
 *
 * The live version of this bar belongs on the camera screen, where the numbers
 * are the host's own and moving for real.
 *
 * It loops, resting on the finished state — both entries listed, the bar showing
 * what the two of them jointly spent — for the longest beat in the cycle, since
 * that frame is the thing being taught. A host who looks up mid-cycle gets to see
 * the whole example rather than a fragment of it.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { Caption } from '@/components/ui/typography';
import { Colors, GroupInfo, Motion, Radii } from '@/constants/theme';
import { formatDuration } from '@/lib/pricing';

const EASING = Easing.bezier(...Motion.bezier).factory();

const FILL_TIMING = { duration: GroupInfo.demo.fillDuration, easing: EASING } as const;

/** Faster than a fill — the reset is bookkeeping, not part of the lesson. */
const RESET_TIMING = { duration: GroupInfo.demo.resetDuration, easing: EASING } as const;

/**
 * The script.
 *
 * Two people, because two is the smallest number that shows the pool being
 * *shared* rather than merely spent. The budget they draw from is a real one —
 * 60s is the free tier's shorter film — so the arithmetic a host does in their
 * head (24 of 60 gone, well under half) matches what the bar shows them.
 */
const DEMO_BUDGET_SECONDS = 60;

const DEMO_CLIPS = [
  { name: 'Maya', seconds: 10 },
  { name: 'Felix', seconds: 14 },
] as const;

/**
 * When each step of one cycle fires, measured from the cycle's start.
 *
 * Built once rather than per render: the schedule is fixed, and having it as a
 * list keeps the loop below to a single `setTimeout` per step with one shared
 * cleanup — no nested chains that can outlive the component.
 */
const SCHEDULE = DEMO_CLIPS.map(
  (_, index) => GroupInfo.demo.startDelay + index * GroupInfo.demo.stepInterval
);

/** Fills, holds on the finished state, then resets and starts over. */
const CYCLE_LENGTH =
  SCHEDULE[SCHEDULE.length - 1] + GroupInfo.demo.fillDuration + GroupInfo.demo.holdDuration;

export function BudgetBar() {
  /*
    How many of the demo clips have landed. Drives both the bar's width and how
    many entries are listed, so the two can never disagree.
  */
  const [played, setPlayed] = useState(0);

  useEffect(() => {
    /*
      Timers are collected so one cleanup cancels the whole cycle *and* the
      interval driving it. Without that, dismissing the sheet mid-demo leaves a
      timer to fire against an unmounted component.
    */
    let timers: ReturnType<typeof setTimeout>[] = [];

    function runCycle() {
      timers.forEach(clearTimeout);
      setPlayed(0);
      timers = SCHEDULE.map((at, index) => setTimeout(() => setPlayed(index + 1), at));
    }

    runCycle();
    const loop = setInterval(runCycle, CYCLE_LENGTH);

    return () => {
      clearInterval(loop);
      timers.forEach(clearTimeout);
    };
  }, []);

  const usedSeconds = DEMO_CLIPS.slice(0, played).reduce((sum, clip) => sum + clip.seconds, 0);
  const fraction = usedSeconds / DEMO_BUDGET_SECONDS;

  /*
    A percentage width rather than a measured one: the track is fluid, and this
    avoids an onLayout pass and the frame of wrong geometry it brings with it.

    Back to zero is the loop resetting, and takes the quicker timing — a reset
    that eases out over the same 700ms as a fill looks like the group being
    refunded their footage.
  */
  const fill = useAnimatedStyle(
    () => ({
      width: withTiming(`${fraction * 100}%`, played === 0 ? RESET_TIMING : FILL_TIMING),
    }),
    [fraction, played]
  );

  return (
    <View>
      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Example: ${formatDuration(usedSeconds)} of ${formatDuration(
          DEMO_BUDGET_SECONDS
        )} used`}>
        <Animated.View style={[styles.fill, fill]}>
          {/*
            The gradient is laid out at the *track's* full width and clipped by
            the animated view, so its ramp stays fixed to the bar rather than
            being squashed into whatever width the fill currently has. Painting
            it at the fill's own width would re-run the ramp on every frame and
            change the colour under a clip that had already landed.
          */}
          <LinearGradient
            colors={GroupInfo.bar.fill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradient}
          />
        </Animated.View>
      </View>

      {/*
        Fixed height for the full script, so the sheet does not grow as each
        entry arrives and shove the "Got it" button down the screen mid-read.
      */}
      <View style={styles.entries}>
        {DEMO_CLIPS.map((clip, index) => (
          <DemoEntry key={clip.name} clip={clip} visible={index < played} />
        ))}
      </View>
    </View>
  );
}

/**
 * One line of the example.
 *
 * Always mounted, its opacity animated — mounting and unmounting these would
 * make them blink on every loop, and a row appearing instantly next to a bar
 * that eases looks like two different animations.
 */
function DemoEntry({
  clip,
  visible,
}: {
  clip: (typeof DEMO_CLIPS)[number];
  visible: boolean;
}) {
  const style = useAnimatedStyle(
    () => ({ opacity: withTiming(visible ? 1 : 0, visible ? FILL_TIMING : RESET_TIMING) }),
    [visible]
  );

  return (
    <Animated.View style={[styles.entry, style]}>
      <View style={styles.dot} />
      <Caption color={Colors.textDim}>
        {clip.name} added {clip.seconds} seconds
      </Caption>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: GroupInfo.bar.height,
    borderRadius: Radii.pill,
    backgroundColor: GroupInfo.bar.track,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  gradient: {
    // Wider than any fill it sits in, so the clip always has gradient to show.
    ...StyleSheet.absoluteFillObject,
    width: GroupInfo.demo.gradientWidth,
  },
  entries: {
    marginTop: GroupInfo.demo.entriesGap,
    gap: GroupInfo.demo.entryGap,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GroupInfo.demo.dotGap,
    // Fixed, so the sheet is the same height on every frame of the loop and the
    // "Got it" button never moves under the reader's thumb.
    height: GroupInfo.demo.entryHeight,
  },
  dot: {
    width: GroupInfo.demo.dotSize,
    height: GroupInfo.demo.dotSize,
    borderRadius: GroupInfo.demo.dotSize / 2,
    backgroundColor: Colors.textGhost,
  },
});
