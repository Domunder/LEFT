/**
 * A small icon+value chip that opens a picker — the Ending Date / Ending Time
 * values on 04.
 *
 * Distinct from ChoicePillButton, which is a *selection* among visible options and
 * has a selected state. This one always shows a current value and is a button to
 * change it, so it has no selected styling and carries the prototype's own
 * metrics (see EndRow.pill in constants/theme.ts).
 */

import { Feather } from '@expo/vector-icons';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, EndRow, Radii } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import type { AnchorRect } from './popover';

type ValuePillProps = {
  /** The current value, already formatted for display. */
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  /**
   * Receives the pill's own on-screen rectangle, so a popover can hang from it.
   *
   * Measured at press time rather than on layout: the pill sits in a screen that
   * animates in, so a rect captured at mount can be stale by the time it is used.
   */
  onPress?: (anchor: AnchorRect) => void;
  /**
   * Spoken label. The visible text is just a bare value ("Sat, 22 Aug"), which
   * gives no clue what it sets, so callers pass e.g. "Ending date, Sat 22 Aug".
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function ValuePill({ label, icon, onPress, accessibilityLabel, style }: ValuePillProps) {
  const ref = useRef<View>(null);

  function handlePress() {
    // Window coordinates, which is what the popover positions against.
    ref.current?.measureInWindow((x, y, width, height) =>
      onPress?.({ x, y, width, height })
    );
  }

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      style={({ pressed }) => [styles.base, pressed && styles.pressed, style]}>
      <Feather name={icon} size={EndRow.pill.iconSize} color={Colors.text} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EndRow.pill.gap,
    paddingVertical: EndRow.pill.paddingY,
    paddingHorizontal: EndRow.pill.paddingX,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: EndRow.pill.border,
    backgroundColor: EndRow.pill.bg,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    ...Typography.choice,
    color: Colors.text,
  },
});
