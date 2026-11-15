/**
 * A large glass surface with a shadow — the Landing bottom panel, the join
 * sheet, the "Keep your films" card.
 *
 * The material is `Glass` (glass.tsx): Liquid Glass on iOS 26+, a blur
 * elsewhere, solid under "Reduce Transparency". It was a `BlurView` of its own
 * until 2026-11-15. Controls inside it keep flat fills — never glass on glass.
 *
 * The material clips, so the shadow lives on an outer wrapper.
 */

import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radii, Shadows } from '@/constants/theme';
import { Glass } from './glass';

type GlassPanelProps = PropsWithChildren<{
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Inner padding. Default matches the Landing panel (32/24/28). */
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function GlassPanel({
  children,
  radius = Radii.sheet,
  style,
  contentStyle,
}: GlassPanelProps) {
  return (
    <View style={[styles.shadow, { borderRadius: radius }, style]}>
      <Glass radius={radius} weight="bar">
        <View style={[styles.content, contentStyle]}>{children}</View>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    ...(Shadows.panel as object),
  },
  content: {
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
});
