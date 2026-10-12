/**
 * Outermost wrapper for every route.
 *
 * Provides the near-black background and the standard 28px horizontal padding
 * from the design. Screens that are full-bleed (Landing, Camera, Clip detail)
 * pass `edges={[]}` and `padded={false}` and handle their own insets.
 */

import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

type ScreenProps = PropsWithChildren<{
  /** Apply the standard horizontal screen padding. Default true. */
  padded?: boolean;
  /** Safe-area edges to respect. Default top + bottom. */
  edges?: readonly Edge[];
  /**
   * Skip the opaque background. Onboarding screens use this so the layout's
   * ambient glow shows through while they slide over it.
   */
  transparent?: boolean;
  style?: ViewStyle;
}>;

export function Screen({
  children,
  padded = true,
  edges = ['top', 'bottom'],
  transparent = false,
  style,
}: ScreenProps) {
  return (
    <View style={[styles.root, transparent && styles.transparent]}>
      <SafeAreaView edges={edges} style={[styles.safe, padded && styles.padded, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  safe: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: Spacing.screenX,
  },
});
