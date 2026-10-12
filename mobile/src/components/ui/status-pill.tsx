/**
 * A small dot-and-label status pill — 10's "1 spot left".
 *
 * Not a ChoicePill: it is never selectable, it carries a status dot instead of
 * an icon, and its metrics are smaller (6/13 against 11/16). The same call made
 * for EndRow.pill and LengthChoice.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Colors, Group, Radii } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';

type StatusPillProps = {
  label: string;
  /** The dot's colour. Defaults to the amber the artboard uses. */
  dotColor?: string;
};

export function StatusPill({ label, dotColor = Colors.gold }: StatusPillProps) {
  return (
    <View style={styles.pill}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Group.status.gap,
    paddingVertical: Group.status.paddingY,
    paddingHorizontal: Group.status.paddingX,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.hairline,
    backgroundColor: Group.status.bg,
  },
  dot: {
    width: Group.status.dotSize,
    height: Group.status.dotSize,
    borderRadius: Group.status.dotSize / 2,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    letterSpacing: 11 * 0.02,
    color: Colors.textMuted,
  },
});
