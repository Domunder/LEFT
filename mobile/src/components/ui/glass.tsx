/**
 * Glass — the one material for chrome that floats over imagery.
 *
 * On iOS 26+ this is the system's Liquid Glass (`expo-glass-effect`). Anywhere
 * else — older iOS, Android — it is a blur with a tinted fill and a hairline,
 * and with "Reduce Transparency" on it is a solid surface.
 *
 * **Never put glass on glass**, and never animate a glass view's opacity: the
 * system stops drawing the effect at low alpha. Fade a wrapper instead, or
 * cross-fade the content inside.
 *
 * `GlassButton` is the round or capsule control built on it: it reacts on
 * touch-down and commits on release.
 */

import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState, type PropsWithChildren } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Colors, Glass as T, Springs } from '@/constants/theme';
import { Typography } from '@/constants/typography';

let liquid: boolean | null = null;

/** Whether the system's Liquid Glass can be drawn. Asked once, lazily. */
export function hasLiquidGlass(): boolean {
  if (liquid === null) {
    try {
      liquid = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
    } catch {
      liquid = false;
    }
  }
  return liquid;
}

function useReduceTransparency(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((value) => {
      if (!cancelled) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduced);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduced;
}

type GlassProps = PropsWithChildren<{
  radius: number;
  /** `bar` for wide surfaces, `chip` for buttons and badges. */
  weight?: 'chip' | 'bar';
  /** Liquid Glass only: the surface reacts to touch. */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function Glass({ children, radius, weight = 'chip', interactive = false, style }: GlassProps) {
  const reduceTransparency = useReduceTransparency();
  const shape = { borderRadius: radius };

  if (reduceTransparency) {
    return <View style={[styles.clip, styles.solid, shape, style]}>{children}</View>;
  }

  if (hasLiquidGlass()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="dark"
        isInteractive={interactive}
        style={[styles.clip, shape, style]}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView intensity={T.blur[weight]} tint="dark" style={[styles.clip, styles.blur, shape, style]}>
      {children}
    </BlurView>
  );
}

type GlassButtonProps = {
  icon?: React.ComponentProps<typeof Feather>['name'];
  /** With a label the button is a capsule; without, a circle. */
  label?: string;
  onPress?: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  /** Tints icon and label — the destructive action in the viewer. */
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function GlassButton({
  icon,
  label,
  onPress,
  accessibilityLabel,
  disabled = false,
  color = Colors.text,
  style,
}: GlassButtonProps) {
  const pressed = useSharedValue(0);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - T.pressScale) }],
  }));

  const capsule = label !== undefined;
  const radius = (capsule ? T.capsuleHeight : T.buttonSize) / 2;

  return (
    <Animated.View style={[animated, disabled && styles.disabled, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        hitSlop={capsule ? (T.buttonSize - T.capsuleHeight) / 2 : 0}
        onPressIn={() => {
          pressed.value = withSpring(1, Springs.press);
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, Springs.press);
        }}
        onPress={onPress}>
        <Glass radius={radius} interactive style={capsule ? styles.capsule : styles.circle}>
          {icon ? <Feather name={icon} size={T.iconSize} color={color} /> : null}
          {capsule ? <Text style={[styles.label, { color }]}>{label}</Text> : null}
        </Glass>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  blur: {
    backgroundColor: T.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  solid: {
    backgroundColor: T.solid,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  circle: {
    width: T.buttonSize,
    height: T.buttonSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsule: {
    height: T.capsuleHeight,
    paddingHorizontal: T.capsulePaddingX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.capsuleGap,
  },
  label: {
    ...Typography.durationPill,
  },
  disabled: {
    opacity: 0.4,
  },
});
