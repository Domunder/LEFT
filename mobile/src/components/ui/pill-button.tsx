/**
 * The app's primary CTA — a full-width rounded pill.
 *
 * primary   #f0ede8 fill, #0b0b0c text, inset top highlight + drop shadow
 * secondary transparent fill, hairline border, off-white text
 * glass     flat rgba(255,255,255,0.11) fill, hairline border — the quiet
 *           button inside a glass panel ("Join a Group" on Landing) or a sheet.
 *           It had a blur of its own until 2026-11-15; inside a `Glass` panel
 *           that was glass on glass, and on a solid sheet it blurred nothing.
 *
 * It gives under the finger on touch-down (`PressScale`) and commits on release.
 *
 * React Native has no inset box-shadow, so the design's
 * `inset 0 1px 0 rgba(255,255,255,0.8)` is drawn as a 1px overlay view.
 */

import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, PillPaddingY, Radii, Shadows } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { haptic } from '@/lib/haptics';
import { PressScale } from './press-scale';

type PillButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'glass';
  /** Leading icon, drawn at 16px in the button's text color. */
  icon?: React.ComponentProps<typeof Feather>['name'];
  disabled?: boolean;
  /**
   * Overrides the label and icon colour.
   *
   * One caller: the delete-account sheet's destructive button, which is a glass
   * pill with a red label rather than a red fill — a filled red button beside a
   * filled light one competes for the eye, and the light one there is Cancel.
   */
  labelColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function PillButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  labelColor,
  style,
}: PillButtonProps) {
  const isPrimary = variant === 'primary';
  const isGlass = variant === 'glass';
  const contentColor = labelColor ?? (isPrimary ? Colors.onLight : Colors.text);

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        // The filled pill is a screen's one committing action; the quiet variants stay silent.
        if (isPrimary) haptic.tap();
        onPress?.();
      }}
      style={[
        styles.base,
        isPrimary && styles.primary,
        variant === 'secondary' && styles.secondary,
        isGlass && styles.glass,
        isPrimary && Shadows.pill,
        disabled && styles.disabled,
        style,
      ]}>
      {isPrimary && <View style={styles.insetHighlight} pointerEvents="none" />}
      {icon ? <Feather name={icon} size={16} color={contentColor} /> : null}
      <Text style={[Typography.button, { color: contentColor }]}>{label}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: PillPaddingY,
    paddingHorizontal: 28,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  primary: {
    backgroundColor: Colors.text,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.hairlineStrong,
  },
  glass: {
    backgroundColor: Colors.glassButton,
    borderWidth: 1,
    borderColor: Colors.hairlineStrong,
  },
  insetHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  disabled: {
    opacity: 0.4,
  },
});
