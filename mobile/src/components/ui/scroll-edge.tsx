/**
 * ScrollEdge — a scrolling list dissolves into the page at its edge instead of
 * being cut off by it.
 *
 * Laid over the list, not part of it. Two layers:
 *
 *  - a few stacked blurs, each reaching less far from the edge than the one
 *    under it, so the blur grows towards the edge — RN has no progressive blur,
 *    this is the approximation;
 *  - a gradient from the page colour to clear over them, which hides the steps
 *    and takes the content out entirely at the edge itself.
 *
 * Pad the list by the same height (`ScrollEdge.top` / `.bottom`), so nothing
 * sits under it at rest. It never takes a touch.
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { ScrollEdge as T } from '@/constants/theme';

type ScrollEdgeProps = {
  edge: 'top' | 'bottom';
};

const STEPS = Array.from({ length: T.blurSteps }, (_, index) => index);

export function ScrollEdge({ edge }: ScrollEdgeProps) {
  const top = edge === 'top';
  const height = T[edge];

  return (
    <View pointerEvents="none" style={[styles.edge, top ? styles.top : styles.bottom, { height }]}>
      {STEPS.map((step) => (
        <BlurView
          key={step}
          intensity={T.blurIntensity}
          tint="dark"
          style={[
            styles.layer,
            top ? styles.top : styles.bottom,
            { height: (height * (T.blurSteps - step)) / T.blurSteps },
          ]}
        />
      ))}
      <LinearGradient
        colors={top ? T.colors : [T.colors[1], T.colors[0]]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  layer: {
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
