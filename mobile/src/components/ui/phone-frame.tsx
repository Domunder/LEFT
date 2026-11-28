/**
 * An iPhone around a preview (1.3.0) — the website's own frame
 * (`web/src/components/Phone.astro`), so the app and leftmoment.com show the
 * same device.
 *
 * The children are laid out on a canvas `PhoneFrame.canvasWidth` points wide,
 * as tall as the display's shape makes it, and scaled down into the frame:
 * what is inside is the real layout, small — not a second, hand-shrunk one.
 * The frame's picture lies on top; its display is transparent.
 */

import { Image } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors, PhoneFrame as T } from '@/constants/theme';

const FRAME = require('@/assets/images/device/iphone-frame.png');

/** The canvas the children are laid out on, in points. */
export const PHONE_CANVAS = {
  width: T.canvasWidth,
  height: Math.round(
    (T.canvasWidth * (T.frameHeight * T.screenHeight)) / (T.frameWidth * T.screenWidth),
  ),
} as const;

/** How tall a frame of this width is. */
export function phoneHeightFor(width: number): number {
  return (width * T.frameHeight) / T.frameWidth;
}

/** How wide a frame of this height is. */
export function phoneWidthFor(height: number): number {
  return (height * T.frameWidth) / T.frameHeight;
}

type PhoneFrameProps = PropsWithChildren<{
  /** The whole device's width; its height follows from the frame. */
  width: number;
}>;

export function PhoneFrame({ width, children }: PhoneFrameProps) {
  const height = phoneHeightFor(width);
  const screenWidth = width * T.screenWidth;

  return (
    <View style={{ width, height }}>
      <View
        style={[
          styles.screen,
          {
            left: width * T.screenLeft,
            top: height * T.screenTop,
            width: screenWidth,
            height: height * T.screenHeight,
            borderRadius: width * T.screenRadius,
          },
        ]}>
        <View
          style={[
            styles.canvas,
            { transform: [{ scale: screenWidth / PHONE_CANVAS.width }] },
          ]}>
          {children}
        </View>
      </View>

      <Image source={FRAME} contentFit="fill" style={StyleSheet.absoluteFill} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: Colors.bg,
  },
  canvas: {
    width: PHONE_CANVAS.width,
    height: PHONE_CANVAS.height,
    transformOrigin: 'top left',
  },
});
