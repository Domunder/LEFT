/**
 * Bottom sheet chrome for the modal routes: a dismissable scrim with a rounded
 * card pinned to the bottom, drag handle on top.
 *
 * The card can be dragged (`SheetDrag`): it follows the finger, and a flick or
 * a pull past the threshold closes it with the hand's velocity. Tapping the
 * scrim still closes it too. The card is a solid surface, not glass — what is
 * behind it is a blurred scrim, and controls inside it stay flat.
 */

import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlurIntensity, Colors, Radii, SheetMotion, Spacing } from '@/constants/theme';
import { SheetDrag } from './sheet-drag';

type SheetProps = PropsWithChildren<{
  /** Called when the scrim is tapped or the sheet is dragged away. Defaults to router.back(). */
  onDismiss?: () => void;
  /** Neither the scrim nor a drag closes it — while its action is running. */
  locked?: boolean;
  /** Caps the card (overdraw included); its children shrink to fit. */
  maxHeight?: number;
  /**
   * The last child is a scrolling list that runs to the card's bottom edge and
   * keeps the home-indicator inset inside itself, so rows are never cut off
   * above an empty strip.
   */
  flushBottom?: boolean;
}>;

export function Sheet({
  children,
  onDismiss,
  locked = false,
  maxHeight,
  flushBottom = false,
}: SheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dismiss = onDismiss ?? (() => router.back());

  return (
    <View style={styles.root}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={locked ? undefined : dismiss}
        accessibilityLabel="Dismiss"
      />
      <BlurView intensity={BlurIntensity.scrim} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.scrim} pointerEvents="none" />

      <SheetDrag
        onDismiss={dismiss}
        locked={locked}
        style={[
          styles.sheet,
          {
            paddingBottom: (flushBottom ? 0 : insets.bottom + Spacing.lg) + SheetMotion.overdraw,
            maxHeight,
          },
        ]}>
        <View style={styles.handle} />
        {children}
      </SheetDrag>
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
    // Drawn past the screen edge, so pulling the sheet up shows no gap under it.
    marginBottom: -SheetMotion.overdraw,
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
