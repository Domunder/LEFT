/**
 * A provider sign-in button — "Google" or "Apple", side by side. Used by Landing
 * (01), the guest's keep screen and the library's fallback panel.
 *
 * Not a PillButton variant: every metric differs. These size by `flex: 1` where
 * PillButton hardcodes `width: '100%'`, pad 16/12 against its 17/28, and set
 * their label at 15px weight 600 against Typography.button's 16/500. Bending the
 * component every other screen's CTA depends on, to fit one screen, costs more
 * than a small sibling — the same call already made for EndRow.pill and
 * DurationPill.
 *
 * The artboard draws both marks flat in the button's text color rather than in
 * Google's brand palette, so @expo/vector-icons covers them and react-native-svg
 * is not needed.
 */

import { AntDesign } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { AuthButton as Token, Colors, Radii } from '@/constants/theme';
import { Typography } from '@/constants/typography';

type AuthButtonProps = {
  label: string;
  icon: 'google' | 'apple';
  onPress?: () => void;
  disabled?: boolean;
  /** Swap the icon for a spinner while this provider's sheet is open. */
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AuthButton({
  label,
  icon,
  onPress,
  disabled = false,
  busy = false,
  style,
}: AuthButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {/*
        Fixed-size slot so swapping the icon for the spinner does not reflow the
        label — the row would otherwise twitch the moment the sheet opens.
      */}
      <View style={styles.iconSlot}>
        {busy ? (
          <ActivityIndicator size="small" color={Colors.onLight} />
        ) : (
          <AntDesign name={icon} size={Token.iconSize} color={Colors.onLight} />
        )}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Token.gap,
    paddingVertical: Token.paddingY,
    paddingHorizontal: Token.paddingX,
    borderRadius: Radii.pill,
    backgroundColor: Colors.text,
  },
  iconSlot: {
    width: Token.iconSize,
    height: Token.iconSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Typography.authButton,
    color: Colors.onLight,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
});
