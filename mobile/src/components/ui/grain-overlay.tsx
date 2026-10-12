/**
 * The film-grain texture over the background video.
 *
 * The prototype draws this with an inline SVG feTurbulence filter, which React
 * Native has no equivalent for, so it ships as a pre-generated 160x160 noise
 * tile repeated across the frame at 3.5% opacity.
 *
 * Deliberately React Native's own <Image> rather than expo-image: `resizeMode`
 * "repeat" is the only way to tile a source, and expo-image does not support it.
 *
 * The design also sets `mix-blend-mode: overlay`. RN has no blend modes on
 * Android, so this is a plain alpha composite — at 0.035 over a dark video the
 * difference is not perceptible.
 */

import { Image, StyleSheet, View, type StyleProp, type ImageStyle } from 'react-native';

import { VideoOverlay } from '@/constants/theme';

const GRAIN = require('@/assets/images/grain.png');

export function GrainOverlay({
  opacity = VideoOverlay.grainOpacity,
  style,
}: {
  opacity?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    // Image takes neither a pointerEvents prop nor one in style, so the wrapper
    // carries it — the overlay must never intercept taps on the CTAs beneath.
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={GRAIN}
        style={[StyleSheet.absoluteFill, { opacity }, style]}
        resizeMode="repeat"
        accessible={false}
      />
    </View>
  );
}
