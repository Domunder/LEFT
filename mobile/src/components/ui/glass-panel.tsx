/**
 * Frosted glass surface — the Landing bottom panel, join/invite sheets, and any
 * translucent card over video.
 *
 * Design: background rgba(20,18,16,0.4), backdrop-filter blur(40px) saturate(160%),
 * 1px hairline border, 28px radius, 0 32px 64px rgba(0,0,0,0.5) shadow.
 *
 * BlurView cannot itself carry the shadow (it clips), so the shadow lives on an
 * outer wrapper and the blur is clipped inside it.
 */

import { BlurView } from 'expo-blur';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { BlurIntensity, Colors, Radii, Shadows } from '@/constants/theme';

type GlassPanelProps = PropsWithChildren<{
  intensity?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Inner padding. Default matches the Landing panel (32/24/28). */
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function GlassPanel({
  children,
  intensity = BlurIntensity.panel,
  radius = Radii.sheet,
  style,
  contentStyle,
}: GlassPanelProps) {
  return (
    <View style={[styles.shadow, { borderRadius: radius }, style]}>
      <BlurView
        intensity={intensity}
        tint="dark"
        style={[styles.blur, { borderRadius: radius }]}>
        <View style={[styles.content, contentStyle]}>{children}</View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    ...(Shadows.panel as object),
  },
  blur: {
    overflow: 'hidden',
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  content: {
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
});
