/**
 * 20's grouped rows — a section label over a bordered card of hairline-separated
 * rows.
 *
 * **Why this is not `SettingRow`.** That component looks like the same thing and
 * disagrees on every measurement that matters:
 *
 *  - it renders its label through `<Label small>`, which is the uppercase eyebrow
 *    preset. 20's row labels are sentence case ("Someone films a clip") — as an
 *    eyebrow, a row label reads as a heading for the row below it.
 *  - its padding is `EndRow` (20 vertical, 2 horizontal), against 16/18 here.
 *  - its divider is `Colors.hairline` (0.1); a divider inside an already-bordered
 *    card has to be lighter than the card's own edge, so this one is 0.06.
 *
 * A `sentenceCase` variant would leave 04's picker rows and 20's list rows in one
 * component that agrees on nothing except "label left, control right". Sibling
 * instead — the same call `ShareButton` and `AuthButton` made against `PillButton`.
 *
 * The last row in a group draws no divider. `SettingsGroup` works that out and
 * passes it down, rather than every caller counting its own children.
 */

import { Children, cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Label } from '@/components/ui/typography';
import { Colors, Settings } from '@/constants/theme';
import { Typography } from '@/constants/typography';

type SettingsGroupProps = {
  /** The uppercase section heading — "Notifications", "Account". */
  title: string;
  children: ReactNode;
};

export function SettingsGroup({ title, children }: SettingsGroupProps) {
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View style={styles.group}>
      {/*
        The artboard's label is 0.28 alpha against `textFaint`'s 0.32. Close
        enough to use the token rather than mint a colour for four points.
      */}
      <Label small color={Colors.textFaint} style={styles.sectionLabel}>
        {title}
      </Label>

      <View style={styles.card}>
        {rows.map((row, index) =>
          cloneElement(row as ReactElement<SettingsListRowProps>, {
            last: index === rows.length - 1,
          })
        )}
      </View>
    </View>
  );
}

type SettingsListRowProps = {
  label: string;
  /** The control on the right — a ToggleSwitch. Omit for a tappable row. */
  children?: ReactNode;
  /** Makes the whole row a button. Mutually exclusive with `children` in practice. */
  onPress?: () => void;
  /** Log Out. Colours the label, and tells assistive tech what it is in for. */
  destructive?: boolean;
  /**
   * Inert and dimmed — a row mid-action, or one this build cannot perform.
   *
   * Pair it with a spinner in `children`: the control slot sits exactly where a
   * toggle would, so a pressable row can report that it is working without a
   * second layout. This is the one case where `children` and `onPress` belong
   * together, the note above notwithstanding.
   */
  disabled?: boolean;
  /**
   * Set by `SettingsGroup`. A divider under the final row would draw a line
   * across the inside of the card's own bottom edge.
   */
  last?: boolean;
};

export function SettingsListRow({
  label,
  children,
  onPress,
  destructive,
  disabled = false,
  last,
}: SettingsListRowProps) {
  const content = (
    <>
      <Text style={[styles.label, destructive && styles.destructive]}>{label}</Text>
      {children}
    </>
  );

  const rowStyle = [styles.row, !last && styles.divider];

  /*
    A row carrying a spinner still has to be a button — that is what `disabled`
    is for. Only a row with a *control* and no handler is inert by construction.
  */

  /*
    A row with a control is not itself pressable: the switch owns the touch, and
    a row-wide target would put two overlapping handlers on the same pixels.
  */
  if (!onPress) return <View style={rowStyle}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        ...rowStyle,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: Settings.groupGap,
  },
  sectionLabel: {
    marginBottom: Settings.sectionGap,
  },
  card: {
    borderRadius: Settings.group.radius,
    borderWidth: 1,
    borderColor: Settings.group.border,
    backgroundColor: Settings.group.bg,
    // Clips the full-bleed dividers to the card's rounded corners.
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Settings.row.paddingY,
    paddingHorizontal: Settings.row.paddingX,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: Settings.group.divider,
  },
  label: {
    ...Typography.settingsRow,
    color: Colors.textStrong,
  },
  destructive: {
    color: Colors.destructive,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
