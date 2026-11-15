/**
 * One thumbnail in a photo grid — "Your shots" and the album.
 *
 * Reacts on touch-down, opens on release, and reports where it is on screen so
 * the viewer can open from it and return to it. `useTileRegistry` is the other
 * half: the grid's map from photo id to mounted tile.
 */

import { Image } from 'expo-image';
import { useCallback, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewInstance, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import type { Rect } from './photo-viewer';
import { PhotoTile as T, Springs } from '@/constants/theme';

function measure(view: ViewInstance | null | undefined): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!view) {
      resolve(null);
      return;
    }
    view.measureInWindow((x, y, width, height) => {
      // An unmounted or clipped-away view reports an empty rect.
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

/** The mounted tiles of one grid, by photo id. */
export function useTileRegistry() {
  const tiles = useRef(new Map<string, ViewInstance>());

  const register = useCallback((id: string, view: ViewInstance | null) => {
    if (view) tiles.current.set(id, view);
    else tiles.current.delete(id);
  }, []);

  const rectOf = useCallback((id: string) => measure(tiles.current.get(id)), []);

  return { register, rectOf };
}

type PhotoTileProps = {
  id: string;
  uri: string;
  accessibilityLabel: string;
  register: (id: string, view: ViewInstance | null) => void;
  /** Handed the tile's window rect, measured at the moment of the press. */
  onPress: (rect: Rect | null) => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Drawn over the picture — the reveal's developing veil. */
  children?: ReactNode;
};

export function PhotoTile({
  id,
  uri,
  accessibilityLabel,
  register,
  onPress,
  onLongPress,
  style,
  children,
}: PhotoTileProps) {
  const view = useRef<ViewInstance | null>(null);
  const pressed = useSharedValue(0);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - T.pressScale) }],
  }));

  return (
    <Animated.View style={[styles.tile, style, animated]}>
      <Pressable
        ref={(node) => {
          view.current = node;
          register(id, node);
        }}
        accessibilityRole="imagebutton"
        accessibilityLabel={accessibilityLabel}
        onPressIn={() => {
          pressed.value = withSpring(1, Springs.press);
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, Springs.press);
        }}
        onPress={() => void measure(view.current).then(onPress)}
        onLongPress={onLongPress}
        style={StyleSheet.absoluteFill}>
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={id}
          transition={T.fadeMs}
        />
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    aspectRatio: T.aspectRatio,
    borderRadius: T.radius,
    overflow: 'hidden',
    backgroundColor: T.placeholder,
  },
});
