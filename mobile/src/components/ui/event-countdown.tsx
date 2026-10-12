/**
 * 13's countdown to the end of the filming window — the `01 d 23 h` bottom-left.
 *
 * Two units, not a clock. It answers "roughly how long have we got" for someone
 * holding a phone at a party, and a running `01:23:44:07` would be both harder to
 * read at a glance and quietly stressful.
 *
 * Present in the artboard and absent from `design/README.md`. The prototype wins.
 *
 * Ticks once a minute rather than once a second, because minutes are the smallest
 * unit shown until the last hour — and a per-second timer on the app's most
 * performance-sensitive screen would re-render the tree 3,600 times an hour to
 * change nothing.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Camera } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { countdownParts } from '@/lib/event-end';

type EventCountdownProps = {
  /** `events.ends_at`. */
  endsAt: string;
};

export function EventCountdown({ endsAt }: EventCountdownProps) {
  const end = new Date(endsAt);
  const [parts, setParts] = useState(() => countdownParts(end));

  /*
    Keyed on the timestamp string rather than the Date: a re-render that rebuilt
    an equal-but-new Date would otherwise restart the interval on every frame of
    a recording.
  */
  useEffect(() => {
    const target = new Date(endsAt);
    setParts(countdownParts(target));

    const tick = setInterval(
      () => setParts(countdownParts(target)),
      Camera.countdown.tickMs
    );
    return () => clearInterval(tick);
  }, [endsAt]);

  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${parts[0].value} ${parts[0].unit}, ${parts[1].value} ${parts[1].unit} left to film`}>
      {parts.map((part, index) => (
        <View key={part.unit} style={styles.unit}>
          <Text style={[styles.value, { color: Camera.countdown.valueColor[index] }]}>
            {part.value}
          </Text>
          <Text style={[styles.suffix, { color: Camera.countdown.unitColor[index] }]}>
            {part.unit}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Camera.countdown.gap,
  },
  unit: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Camera.countdown.unitGap,
  },
  value: {
    ...Typography.countdown,
  },
  suffix: {
    ...Typography.countdownUnit,
    fontSize: Camera.countdown.unitSize,
  },
});
