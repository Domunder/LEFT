/**
 * A compact, selectable icon+label chip.
 *
 * Distinct from PillButton, which is the full-width CTA. This one sits in a wrapping
 * row — the event-type picker on 02.
 *
 * 05.1's length picker looks related but is `film-length-choices.tsx`: those are
 * two-line cards that flex to share a row, so they carry their own metrics rather
 * than bending this.
 *
 * Selected is a solid #f0ede8 fill with dark content; unselected is a hairline outline
 * over the page background.
 */

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { ChoicePill, Colors, Radii } from '@/constants/theme';
import { Typography } from '@/constants/typography';

type ChoicePillProps = {
  label: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  selected?: boolean;
  onPress?: () => void;
  /** Dim and block interaction. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ChoicePillButton({
  label,
  icon,
  selected = false,
  onPress,
  disabled = false,
  style,
}: ChoicePillProps) {
  const contentColor = selected ? Colors.onLight : Colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.unselected,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {/*
        The design fills the Wedding heart when selected. Feather is a stroke-only
        icon font with no fill variant, so the selected state reads through the solid
        pill behind it instead. Swapping in a filled icon set would be the exact fix.
      */}
      {icon ? <Feather name={icon} size={ChoicePill.iconSize} color={contentColor} /> : null}
      <Text style={[Typography.choice, { color: contentColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ChoicePill.gap,
    paddingVertical: ChoicePill.paddingY,
    paddingHorizontal: ChoicePill.paddingX,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  selected: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  unselected: {
    backgroundColor: 'transparent',
    borderColor: Colors.hairlineStrong,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.3,
  },
});
