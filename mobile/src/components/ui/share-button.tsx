/**
 * 09's two side-by-side glass pills — "Share Link" and "Save QR".
 *
 * Not a PillButton variant, for the reasons AuthButton already documents: these
 * size by `flex: 1` where PillButton hardcodes `width: '100%'`, and their label is
 * 14px where Typography.button is 16. Bending the component every screen's CTA
 * depends on, to fit one screen, costs more than a small sibling — the call made
 * for EndRow.pill, LengthChoice and AuthButton before it.
 *
 * The fill is `Colors.glassButton` flat, without PillButton's BlurView: there is no
 * video behind this screen, only the near-black page and the ambient glow, so a
 * blur would cost a native view per button and blur nothing.
 *
 * 17 reuses this for its Download/Share row and needs the *light* half of that
 * artboard pair — an off-white fill with dark text — hence `variant`. It also
 * draws the two buttons at slightly different icon sizes (17 and 16) and one less
 * point of vertical padding than 09, so both are overridable. Defaults keep 09
 * byte-identical to what it rendered before.
 */

import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Colors, Invite, PillPaddingY, Radii } from '@/constants/theme';
import { Typography } from '@/constants/typography';

type ShareButtonProps = {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress?: () => void;
  disabled?: boolean;
  /** Swap the icon for a spinner while the share sheet or the save is running. */
  busy?: boolean;
  /**
   * `glass` is 09's pair and the default. `light` is 17's Download — an
   * off-white fill with dark text and no border, the artboard's primary of the two.
   */
  variant?: 'glass' | 'light';
  /** 17 draws Download at 17 and Share at 16. Defaults to 09's shared 15. */
  iconSize?: number;
  /** 17's row is 16 where 09's is `PillPaddingY` (17). */
  paddingY?: number;
  style?: StyleProp<ViewStyle>;
};

export function ShareButton({
  label,
  icon,
  onPress,
  disabled = false,
  busy = false,
  variant = 'glass',
  iconSize = Invite.button.iconSize,
  paddingY = PillPaddingY,
  style,
}: ShareButtonProps) {
  const light = variant === 'light';
  // Everything on the light fill has to invert, including the spinner.
  const foreground = light ? Colors.onLightDeep : Colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { paddingVertical: paddingY },
        light ? styles.light : styles.glass,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {/*
        Fixed-size slot, as on AuthButton: swapping the icon for the spinner must
        not reflow the label, or the pair of buttons twitches on every tap.
      */}
      <View style={[styles.iconSlot, { width: iconSize, height: iconSize }]}>
        {busy ? (
          <ActivityIndicator size="small" color={foreground} />
        ) : (
          <Feather name={icon} size={iconSize} color={foreground} />
        )}
      </View>
      <Text style={[styles.label, light && styles.lightLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Invite.button.gap,
    borderRadius: Radii.pill,
  },
  glass: {
    backgroundColor: Colors.glassButton,
    borderWidth: 1,
    borderColor: Colors.hairlineStrong,
  },
  /*
    No border, and weight 600 against the glass button's 500 — the artboard draws
    the light button heavier, which is what makes it read as the primary of the
    pair rather than merely the brighter one.
  */
  light: {
    backgroundColor: Colors.text,
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Typography.choice,
    color: Colors.text,
  },
  lightLabel: {
    ...Typography.authButton,
    fontSize: Typography.choice.fontSize,
    color: Colors.onLightDeep,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
});
