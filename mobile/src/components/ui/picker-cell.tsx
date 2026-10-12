/**
 * One cell of 04's month grid or time grid.
 *
 * Selected is the app's established selected state — a solid #f0ede8 circle with
 * dark content, the same call `ChoicePillButton` and `GroupSizeRow` make. `ringed`
 * marks today with a hairline instead, and a day that is both is drawn as selected
 * only: two markers on one cell would read as two selections.
 *
 * The circle is a fixed `Picker.cellSize` inside a `flex: 1` cell rather than being
 * sized by it. RN has no CSS Grid, so a row divides the panel's width by its column
 * count and the cells stretch with it; only the circle inside has to stay round.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Picker, Radii } from '@/constants/theme';
import { Typography } from '@/constants/typography';

type PickerCellProps = {
  label: string;
  selected?: boolean;
  /** Hairline ring — today's day, when it is not the selection. */
  ringed?: boolean;
  /** Dim and refuse the press: outside the allowed range. */
  disabled?: boolean;
  /** Dim but stay pressable: a day belonging to a neighbouring month. */
  muted?: boolean;
  onPress?: () => void;
  /** The visible label is a bare number, so callers pass the whole date or time. */
  accessibilityLabel?: string;
};

export function PickerCell({
  label,
  selected = false,
  ringed = false,
  disabled = false,
  muted = false,
  onPress,
  accessibilityLabel,
}: PickerCellProps) {
  const color = selected
    ? Colors.onLight
    : disabled
      ? Colors.textGhost
      : muted
        ? Colors.textFaint
        : Colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.cell, pressed && !disabled && styles.pressed]}>
      <View style={[styles.circle, selected ? styles.selected : ringed ? styles.ringed : null]}>
        <Text style={[styles.label, { color }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    height: Picker.cellSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  circle: {
    width: Picker.cellSize,
    height: Picker.cellSize,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: Colors.text,
  },
  ringed: {
    borderWidth: Picker.todayRing,
    borderColor: Colors.hairlineStrong,
  },
  label: {
    ...Typography.choice,
  },
});
