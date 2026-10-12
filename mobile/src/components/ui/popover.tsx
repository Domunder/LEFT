/**
 * A panel anchored directly under the control that opened it.
 *
 * Rendered inside a `Modal`, which is the only way to reliably sit above
 * everything else: the onboarding layout draws its ambient glow and step dots
 * outside the Stack, so a plain absolutely-positioned view inside a screen would
 * be composited *under* them no matter what zIndex it claimed.
 *
 * The anchor rectangle comes from the caller measuring itself in window
 * coordinates — see `measureInWindow` in value-pill.tsx.
 */

import type { PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Colors, Popover, Radii, Shadows } from '@/constants/theme';

/** Where the anchor sits on screen, in window coordinates. */
export type AnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PopoverPanelProps = PropsWithChildren<{
  /** The control this panel hangs from. */
  anchor: AnchorRect;
  /**
   * Height the content wants. Used to decide whether the panel still fits below
   * the anchor or has to flip above it.
   */
  contentHeight: number;
  /** Backdrop tap. */
  onDismiss: () => void;
}>;

export function PopoverPanel({
  anchor,
  contentHeight,
  onDismiss,
  children,
}: PopoverPanelProps) {
  const { width, height } = useWindowDimensions();

  // Never wider than the screen allows, and never wider than maxWidth.
  const panelWidth = Math.min(Popover.maxWidth, width - Popover.margin * 2);

  // Centre on the anchor, then push back inside if that would overhang an edge.
  const centred = anchor.x + anchor.width / 2 - panelWidth / 2;
  const left = Math.min(Math.max(centred, Popover.margin), width - Popover.margin - panelWidth);

  // Below the anchor by default. A pill low on the screen leaves no room there,
  // so the panel flips above it rather than being squeezed into a few pixels.
  const panelHeight = contentHeight + Popover.paddingY * 2;
  const below = anchor.y + anchor.height + Popover.offset;
  const roomBelow = height - Popover.margin - below;
  const roomAbove = anchor.y - Popover.offset - Popover.margin;

  // Since the panels became grids rather than a 216px spinner, a short phone can
  // have room on neither side. Clamping to whichever is bigger would then clip a
  // week off the calendar with nothing to scroll, so the panel detaches from its
  // pill and centres instead — it stays horizontally anchored, and this is the
  // only placement that shows all of it.
  const detached = roomBelow < panelHeight && roomAbove < panelHeight;
  const flip = !detached && roomBelow < panelHeight && roomAbove > roomBelow;

  const top = detached
    ? Math.max(Popover.margin, (height - panelHeight) / 2)
    : flip
      ? Math.max(Popover.margin, anchor.y - Popover.offset - panelHeight)
      : below;

  const maxHeight = detached
    ? height - Popover.margin * 2
    : flip
      ? anchor.y - Popover.offset - top
      : roomBelow;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      {/*
        The backdrop is deliberately invisible rather than a scrim: the panel is a
        small popover attached to its control, and dimming the whole screen behind
        it would read as a modal sheet, which is the pattern we moved away from.
      */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Dismiss" />

      <View style={[styles.panel, { top, left, width: panelWidth, maxHeight }]}>
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    borderRadius: Radii.sheetSm,
    borderWidth: 1,
    borderColor: Colors.hairline,
    backgroundColor: Popover.bg,
    paddingHorizontal: Popover.paddingX,
    paddingVertical: Popover.paddingY,
    ...(Shadows.panel as object),
  },
});
