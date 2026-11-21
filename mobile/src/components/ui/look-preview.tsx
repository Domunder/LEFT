/**
 * A sample photo developed with one look — the artwork of 03's cards. With
 * `source` it draws any picture through the look instead: the event image
 * (2026-11-21) on 12, 09, the Moments card and the creation step.
 *
 * Draws `assets/images/look-sample.jpg` through the same shader and the same
 * uniforms the camera bakes into a JPEG (`lib/look-shader.ts`), so what a host
 * picks here is what their guests' pictures get.
 *
 * Fills its parent. Until the image has decoded and the view has been measured
 * it draws nothing, and the card's own background shows.
 */

import { Canvas, Fill, ImageShader, Shader, useImage } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { FilmLook } from '@/lib/events';
import { lookEffect, lookUniforms } from '@/lib/look-shader';

const SAMPLE = require('@/assets/images/look-sample.jpg');

type LookPreviewProps = {
  look: FilmLook;
  /** A bundled picture (`require`) or a URL. Defaults to the look sample. */
  source?: number | string;
};

export function LookPreview({ look, source = SAMPLE }: LookPreviewProps) {
  const image = useImage(source);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ready = image && size.width > 0 && size.height > 0;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
      }}>
      {ready ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill>
            <Shader source={lookEffect()} uniforms={lookUniforms(look, size.width, size.height)}>
              <ImageShader
                image={image}
                fit="cover"
                tx="clamp"
                ty="clamp"
                rect={{ x: 0, y: 0, width: size.width, height: size.height }}
              />
            </Shader>
          </Fill>
        </Canvas>
      ) : null}
    </View>
  );
}
