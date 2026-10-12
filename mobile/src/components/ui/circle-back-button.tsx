/**
 * The 38x38 circular icon button — back, info, settings, and 15/16's new-event plus.
 *
 * Three fills in the design:
 *   flat   rgba(255,255,255,0.08), on solid screens (onboarding back button)
 *   glass  blurred rgba(255,255,255,0.11), on screens over video (Landing, Sign Up)
 *          and over 16's ambient backdrop
 *   light  #f0ede8 fill with a dark icon — 15's plus button, the one circular
 *          button in the app drawn as a primary action rather than a chrome control
 *   outline a fainter rgba(255,255,255,0.04) fill behind a hairline — 15's gear,
 *          which sits over the ambient glow rather than over a solid screen
 *
 * `glass` stays a boolean prop because three screens already pass it that way;
 * `variant` is the fuller control and wins when both are given.
 */

import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BlurIntensity, Colors } from '@/constants/theme';

const SIZE = 38;
const ICON_SIZE = 16;

export type CircleButtonVariant = 'flat' | 'glass' | 'light' | 'outline';

type CircleIconButtonProps = {
  icon?: React.ComponentProps<typeof Feather>['name'];
  onPress?: () => void;
  /** Blurred glass fill, for use over video. Shorthand for variant="glass". */
  glass?: boolean;
  variant?: CircleButtonVariant;
  accessibilityLabel?: string;
  size?: number;
  /** Dim and block interaction — 04's month arrows at either end of their range. */
  disabled?: boolean;
  /** The artboard draws these at 16, 17 and 18 depending on the screen. */
  iconSize?: number;
  /** Overrides the variant's default — 16's gear is brighter than 15's. */
  iconColor?: string;
};

/** Generic circular icon button — the base for back, info, settings and plus. */
export function CircleIconButton({
  icon = 'chevron-left',
  onPress,
  glass = false,
  variant,
  accessibilityLabel,
  size = SIZE,
  disabled = false,
  iconSize = ICON_SIZE,
  iconColor,
}: CircleIconButtonProps) {
  const resolved: CircleButtonVariant = variant ?? (glass ? 'glass' : 'flat');
  const dimensions = { width: size, height: size, borderRadius: size / 2 };

  const content = (
    <Feather
      name={icon}
      size={iconSize}
      color={iconColor ?? (resolved === 'light' ? Colors.onLight : Colors.textMuted)}
    />
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        dimensions,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {resolved === 'glass' ? (
        <BlurView
          intensity={BlurIntensity.button}
          tint="dark"
          style={[styles.fill, dimensions, styles.glass]}>
          {content}
        </BlurView>
      ) : (
        <View style={[styles.fill, dimensions, fills[resolved]]}>{content}</View>
      )}
    </Pressable>
  );
}

/**
 * Back button wired to router.back().
 *
 * `fallback` is for a screen that can be arrived at by `router.replace`, which
 * leaves nothing behind it — 02 is the case: a user who has just signed in is
 * replaced onto it, so `router.back()` there is a no-op and the button reads as
 * broken. Given one, the button goes there instead when there is no history.
 */
export function CircleBackButton({ glass = false, fallback }: { glass?: boolean; fallback?: Href }) {
  const router = useRouter();
  return (
    <CircleIconButton
      icon="chevron-left"
      glass={glass}
      accessibilityLabel="Go back"
      onPress={() => {
        if (router.canGoBack()) router.back();
        else if (fallback) router.replace(fallback);
      }}
    />
  );
}

const styles = StyleSheet.create({
  pressable: {
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.3,
  },
  fill: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  flat: {
    backgroundColor: Colors.surfaceSubtle,
  },
  outline: {
    backgroundColor: Colors.surfaceFaint,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  light: {
    backgroundColor: Colors.text,
  },
  glass: {
    backgroundColor: Colors.glassButton,
    borderWidth: 1,
    borderColor: Colors.hairlineStrong,
  },
});

/** Non-blurred fills, by variant. Declared after `styles` so it can read it. */
const fills = {
  flat: styles.flat,
  outline: styles.outline,
  light: styles.light,
  // Never reached — a glass button renders the BlurView branch instead.
  glass: styles.glass,
};
