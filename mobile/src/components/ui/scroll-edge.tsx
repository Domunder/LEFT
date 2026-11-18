/**
 * ScrollEdge — a scrolling list dissolves into the page at its edge instead of
 * being cut off by it.
 *
 * Laid over the list, not part of it: one gradient from the page colour to
 * clear, on a smoothstep curve in many stops (`ScrollEdge.colors`).
 *
 * It used to stack thin blurs under the gradient to fake a progressive blur.
 * On a device those showed as steps, like a stair (2026-11-18): each blur has
 * a hard edge, and RN cannot mask one into a ramp. A real progressive blur
 * needs a masked view (a native module, so a new build); until then the fade
 * alone is the clean version.
 *
 * Pad the list by the same height (`ScrollEdge.top` / `.bottom`), so nothing
 * sits under it at rest. It never takes a touch.
 */

import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScrollEdge as T, Spacing } from '@/constants/theme';

type ScrollEdgeProps = {
  edge: 'top' | 'bottom';
  /**
   * Extra height past the token's — the screen's safe-area inset, for a list
   * that runs to the physical edge of the screen.
   */
  inset?: number;
  /** Run past the screen's horizontal padding, to the physical sides. */
  bleed?: boolean;
};

const DOWN = [...T.colors] as [string, string, ...string[]];
const UP = [...T.colors].reverse() as [string, string, ...string[]];

export function ScrollEdge({ edge, inset = 0, bleed = false }: ScrollEdgeProps) {
  const top = edge === 'top';
  return (
    <LinearGradient
      pointerEvents="none"
      colors={top ? DOWN : UP}
      style={[
        styles.edge,
        top ? styles.top : styles.bottom,
        { height: T[edge] + inset },
        bleed && { left: -Spacing.screenX, right: -Spacing.screenX },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
  },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
});

/**
 * A scrolling area with both edges dissolving. Put the list (or ScrollView) in
 * it and pad the list's content by `ScrollEdge.top` / `.bottom` at least.
 * `bottomInset`: the safe-area inset, when the screen does not pad it itself.
 */
export function ScrollEdged({
  children,
  bottomInset = 0,
  bleed = true,
}: PropsWithChildren<{ bottomInset?: number; bleed?: boolean }>) {
  return (
    <View style={styles.area}>
      {children}
      <ScrollEdge edge="top" bleed={bleed} />
      <ScrollEdge edge="bottom" inset={bottomInset} bleed={bleed} />
    </View>
  );
}
