/**
 * The app's primary CTA — a full-width rounded pill.
 *
 * primary   #f0ede8 fill, #0b0b0c text, inset top highlight + drop shadow
 * secondary transparent fill, hairline border, off-white text
 * glass     blurred rgba(255,255,255,0.11) fill, hairline border — for use over
 *           video, e.g. "Join a Group" on Landing (01)
 *
 * React Native has no inset box-shadow, so the design's
 * `inset 0 1px 0 rgba(255,255,255,0.8)` is drawn as a 1px overlay view.
 */

import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { BlurIntensity, Colors, PillPaddingY, Radii, Shadows } from '@/constants/theme';
import { Typography } from '@/constants/typography';

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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        variant === 'secondary' && styles.secondary,
        isGlass && styles.glass,
        isPrimary && Shadows.pill,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {/*
        Sits behind the label — absolutely positioned so it does not join the content
        row. It carries its own pill radius rather than relying on the parent's
        `overflow: hidden`, which does not reliably clip a native view to rounded
        corners on Android; without this the blur's square corners show at both ends.
      */}
      {isGlass && (
        <BlurView
          intensity={BlurIntensity.button}
          tint="dark"
          style={[StyleSheet.absoluteFill, styles.blurFill]}
          pointerEvents="none"
        />
      )}
      {isPrimary && <View style={styles.insetHighlight} pointerEvents="none" />}
      {icon ? <Feather name={icon} size={16} color={contentColor} /> : null}
      <Text style={[Typography.button, { color: contentColor }]}>{label}</Text>
    </Pressable>
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
  blurFill: {
    borderRadius: Radii.pill,
    // absoluteFill sits at the border's outer edge; without this the blur would
    // overlap the 1px hairline and lighten it.
    overflow: 'hidden',
  },
  insetHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
});
