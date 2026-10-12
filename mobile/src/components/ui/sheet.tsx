/**
 * Bottom sheet chrome for the modal routes: a dismissable scrim with a rounded
 * card pinned to the bottom, drag handle on top.
 *
 * Deliberately dependency-free for now. @gorhom/bottom-sheet is installed and
 * should replace this once the sheets need real drag gestures, snap points, or
 * keyboard avoidance.
 */

import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlurIntensity, Colors, Radii, Spacing } from '@/constants/theme';

type SheetProps = PropsWithChildren<{
  /** Called when the scrim is tapped. Defaults to router.back(). */
  onDismiss?: () => void;
}>;

export function Sheet({ children, onDismiss }: SheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dismiss = onDismiss ?? (() => router.back());

  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Dismiss" />
      <BlurView intensity={BlurIntensity.scrim} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.scrim} pointerEvents="none" />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.handle} />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.scrim,
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radii.sheetSm,
    borderTopRightRadius: Radii.sheetSm,
    borderTopWidth: 1,
    borderColor: Colors.hairline,
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: Radii.pill,
    backgroundColor: Colors.hairlineStrong,
    marginBottom: Spacing.sm,
  },
});
