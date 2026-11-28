/**
 * The full-screen photo viewer — one component for a guest's own shots and for
 * the developed album.
 *
 * Not in the prototype. Designed with the apple-design rules:
 *
 *  - **It opens from its tile and returns to it.** The caller passes the tile's
 *    window rect; the photo springs from there to the screen and, on close,
 *    back to wherever the *current* photo's tile is (`originFor`).
 *  - **Everything is 1:1 and interruptible.** One pan decides its axis after a
 *    few points of travel: sideways pages, downwards drags the photo away,
 *    and on a zoomed photo it pans. A spring in flight is caught by the next
 *    touch and continues from where it is.
 *  - **Release hands the finger's velocity to the spring**, and the landing
 *    point is chosen from where the flick was *going* (`project`), not from
 *    where it was let go.
 *  - **Edges rubber-band** — first and last page, zoom limits, a zoomed photo's
 *    borders.
 *  - **Reduced motion** swaps the travel for a cross-fade.
 *  - A photo taken for a mission carries it as a glass caption above the
 *    actions ("Mission · …"), fading with the rest of the chrome.
 *
 * Rendered as an overlay inside the screen that owns the grid, not as a route
 * or a `Modal`: the tile's rect and the viewer then share one coordinate space.
 *
 * Uses Gesture Handler's builder API (`Gesture.Pan()`), which v3 deprecates in
 * favour of hooks — as does the camera's pinch. Migrate both together.
 */

import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Glass, GlassButton } from './glass';
import {
  Colors,
  Glass as GlassTokens,
  MissionsCamera as MissionTokens,
  Springs,
  Viewer as T,
} from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { t } from '@/i18n';
import { clamp, clampWithRubber, project } from '@/lib/motion';

export type Rect = { x: number; y: number; width: number; height: number };

export type ViewerPhoto = {
  id: string;
  thumbUri: string;
  /** The original: a URI, or a function that fetches one when the page is shown. */
  full: string | (() => Promise<string | undefined>);
  /** Pixel size, when known. A frame without one is assumed to be 3:4. */
  width?: number | null;
  height?: number | null;
  /** Who took it — shown under the counter in the album. */
  caption?: string;
  /** The mission it was for — "Mission · …" above the actions. */
  mission?: string;
};

type PhotoViewerProps = {
  photos: ViewerPhoto[];
  initialIndex: number;
  /** The tile the viewer opens from, in window coordinates. */
  origin: Rect | null;
  /** Where photo `index`'s tile is now, or null when it is off screen. */
  originFor?: (index: number) => Promise<Rect | null>;
  onIndexChange?: (index: number) => void;
  /** Called once the closing motion has finished. */
  onClose: () => void;
  /** Glass controls for the bottom bar — save, share, delete. */
  renderActions?: (photo: ViewerPhoto, index: number) => ReactNode;
};

const DEFAULT_ASPECT = 3 / 4;

/** The photo's rect when it fills the screen (`contain`). */
function fitted(photo: ViewerPhoto | undefined, width: number, height: number) {
  const aspect =
    photo?.width && photo?.height ? photo.width / photo.height : DEFAULT_ASPECT;
  const w = Math.min(width, height * aspect);
  return { width: w, height: w / aspect };
}

/** The transform that puts a full-screen photo onto its tile (`cover`). */
function toOrigin(
  origin: Rect,
  fit: { width: number; height: number },
  width: number,
  height: number
) {
  return {
    x: origin.x + origin.width / 2 - width / 2,
    y: origin.y + origin.height / 2 - height / 2,
    scale: Math.max(origin.width / fit.width, origin.height / fit.height),
  };
}

export function PhotoViewer({
  photos,
  initialIndex,
  origin,
  originFor,
  onIndexChange,
  onClose,
  renderActions,
}: PhotoViewerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const count = photos.length;
  const page = width + T.pageGap;

  const [index, setIndex] = useState(() => clamp(initialIndex, 0, Math.max(0, count - 1)));

  // Where the photo starts: on its tile, or in place and transparent.
  const [start] = useState(() => {
    if (!origin || reducedMotion) return null;
    return toOrigin(origin, fitted(photos[index], width, height), width, height);
  });

  // --- shared state -------------------------------------------------------

  /** The pager's translation; `-index * page` at rest. */
  const offset = useSharedValue(-index * page);
  const active = useSharedValue(index);

  /** The open / close / drag-away transform of the active photo. */
  const moveX = useSharedValue(start?.x ?? 0);
  const moveY = useSharedValue(start?.y ?? 0);
  const moveScale = useSharedValue(start?.scale ?? 1);
  const backdrop = useSharedValue(0);
  /** Only used when there is no tile to travel from or to. */
  const fade = useSharedValue(start ? 1 : 0);

  /** Zoom of the active photo. */
  const zoom = useSharedValue(1);
  const zoomX = useSharedValue(0);
  const zoomY = useSharedValue(0);

  const chrome = useSharedValue(1);
  const closing = useSharedValue(false);

  /** The current photo's fitted size, for zoom bounds. */
  const fit = fitted(photos[index], width, height);
  const fitW = useSharedValue(fit.width);
  const fitH = useSharedValue(fit.height);

  /** Where to return to. `hasTarget` false means: fade out instead. */
  const targetX = useSharedValue(start?.x ?? 0);
  const targetY = useSharedValue(start?.y ?? 0);
  const targetScale = useSharedValue(start?.scale ?? 1);
  const hasTarget = useSharedValue(start !== null);

  // --- open ---------------------------------------------------------------

  useEffect(() => {
    backdrop.value = withTiming(1, { duration: T.fadeMs });
    if (start) {
      moveX.value = withSpring(0, Springs.settle);
      moveY.value = withSpring(0, Springs.settle);
      moveScale.value = withSpring(1, Springs.settle);
    } else {
      fade.value = withTiming(1, { duration: T.fadeMs });
    }
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- the current photo --------------------------------------------------

  useEffect(() => {
    const next = fitted(photos[index], width, height);
    fitW.value = next.width;
    fitH.value = next.height;

    onIndexChange?.(index);

    if (!originFor || reducedMotion) {
      hasTarget.value = false;
      return;
    }
    let cancelled = false;
    // A beat later: the grid may be scrolling the new tile into view.
    const timer = setTimeout(() => {
      void originFor(index).then((rect) => {
        if (cancelled) return;
        if (!rect) {
          hasTarget.value = false;
          return;
        }
        const target = toOrigin(rect, next, width, height);
        targetX.value = target.x;
        targetY.value = target.y;
        targetScale.value = target.scale;
        hasTarget.value = true;
      });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // The photo list's identity changes on every reload; its length is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count, width, height, reducedMotion]);

  // A photo was removed under the viewer (moderation): stay in range, or leave.
  useEffect(() => {
    if (count === 0) {
      onClose();
      return;
    }
    if (index > count - 1) {
      const last = count - 1;
      setIndex(last);
      active.value = last;
      offset.value = -last * page;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // --- close --------------------------------------------------------------

  const finish = useCallback(() => onClose(), [onClose]);

  const close = useCallback(
    (velocityX = 0, velocityY = 0) => {
      'worklet';
      if (closing.value) return;
      closing.value = true;

      chrome.value = withTiming(0, { duration: T.fadeMs });
      backdrop.value = withTiming(0, { duration: T.fadeMs });
      zoom.value = withSpring(1, Springs.settle);
      zoomX.value = withSpring(0, Springs.settle);
      zoomY.value = withSpring(0, Springs.settle);

      if (hasTarget.value) {
        moveX.value = withSpring(targetX.value, { ...Springs.settle, velocity: velocityX });
        moveScale.value = withSpring(targetScale.value, Springs.settle);
        moveY.value = withSpring(
          targetY.value,
          { ...Springs.settle, velocity: velocityY },
          (finished) => {
            if (finished) scheduleOnRN(finish);
          }
        );
      } else {
        fade.value = withTiming(0, { duration: T.fadeMs }, (finished) => {
          if (finished) scheduleOnRN(finish);
        });
      }
    },
    // Shared values are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finish]
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [close]);

  // --- gestures -----------------------------------------------------------

  /**
   * 0 undecided · 1 paging · 2 dragging away · 3 panning a zoomed photo ·
   * 4 dragged in from the left edge — the system's "back", which closes
   * (2026-11-19, the user).
   */
  const mode = useSharedValue(0);
  const fromEdge = useSharedValue(false);
  // Where the gesture in progress started. Shared values, because each gesture
  // callback is its own worklet and a captured object would be a private copy.
  const startOffset = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const slopX = useSharedValue(0);
  const slopY = useSharedValue(0);
  const startZoom = useSharedValue(1);

  const gesture = useMemo(() => {
    const boundX = (scale: number) => {
      'worklet';
      return Math.max(0, (fitW.value * scale - width) / 2);
    };
    const boundY = (scale: number) => {
      'worklet';
      return Math.max(0, (fitH.value * scale - height) / 2);
    };

    const pan = Gesture.Pan()
      .maxPointers(1)
      .onBegin((e) => {
        'worklet';
        if (closing.value) return;
        fromEdge.value = e.absoluteX <= T.edgeWidth;
        // Catch whatever is still moving and carry on from there.
        cancelAnimation(offset);
        cancelAnimation(zoomX);
        cancelAnimation(zoomY);
        cancelAnimation(moveX);
        cancelAnimation(moveY);
        cancelAnimation(moveScale);
        mode.value = 0;
        startOffset.value = offset.value;
      })
      .onUpdate((e) => {
        'worklet';
        if (closing.value) return;

        if (mode.value === 0) {
          if (zoom.value > 1.01) {
            mode.value = 3;
            startX.value = zoomX.value - e.translationX;
            startY.value = zoomY.value - e.translationY;
          } else if (Math.abs(e.translationX) > T.slop || Math.abs(e.translationY) > T.slop) {
            const sideways = Math.abs(e.translationX) > Math.abs(e.translationY);
            mode.value =
              fromEdge.value && sideways && e.translationX > 0
                ? 4
                : sideways || e.translationY < 0
                  ? 1
                  : 2;
            // Start from here, so the photo does not jump by the slop.
            slopX.value = e.translationX;
            slopY.value = e.translationY;
            startX.value = moveX.value;
            startY.value = moveY.value;
          } else {
            return;
          }
        }

        if (mode.value === 1) {
          offset.value = clampWithRubber(
            startOffset.value + e.translationX - slopX.value,
            -(count - 1) * page,
            0,
            width,
            T.rubber
          );
        } else if (mode.value === 2) {
          const dy = e.translationY - slopY.value;
          const travel = Math.max(0, dy) / height;
          moveX.value = startX.value + e.translationX - slopX.value;
          moveY.value = startY.value + (dy > 0 ? dy : clampWithRubber(dy, 0, 0, height, T.rubber));
          moveScale.value = 1 - travel * (1 - T.dismissMinScale);
          backdrop.value = 1 - Math.min(1, travel * 2);
        } else if (mode.value === 4) {
          const dx = Math.max(0, e.translationX - slopX.value);
          const travel = dx / width;
          moveX.value = startX.value + dx;
          moveScale.value = 1 - travel * (1 - T.dismissMinScale);
          backdrop.value = 1 - Math.min(1, travel * 2);
        } else {
          const bx = boundX(zoom.value);
          const by = boundY(zoom.value);
          zoomX.value = clampWithRubber(startX.value + e.translationX, -bx, bx, width, T.rubber);
          zoomY.value = clampWithRubber(startY.value + e.translationY, -by, by, height, T.rubber);
        }
      })
      .onEnd((e) => {
        'worklet';
        if (closing.value) return;

        if (mode.value === 1) {
          const base = clamp(Math.round(-startOffset.value / page), 0, count - 1);
          const landing = offset.value + project(e.velocityX, T.deceleration);
          const next = clamp(
            Math.round(-landing / page),
            Math.max(0, base - 1),
            Math.min(count - 1, base + 1)
          );
          offset.value = withSpring(-next * page, { ...Springs.settle, velocity: e.velocityX });
          if (next !== active.value) {
            active.value = next;
            zoom.value = 1;
            zoomX.value = 0;
            zoomY.value = 0;
            scheduleOnRN(setIndex, next);
          }
        } else if (mode.value === 2) {
          const landing = moveY.value + project(e.velocityY, T.deceleration);
          if (landing > T.dismissDistance) {
            close(e.velocityX, e.velocityY);
          } else {
            // Thrown back: this one may overshoot, the finger gave it momentum.
            moveX.value = withSpring(0, { ...Springs.momentum, velocity: e.velocityX });
            moveY.value = withSpring(0, { ...Springs.momentum, velocity: e.velocityY });
            moveScale.value = withSpring(1, Springs.settle);
            backdrop.value = withTiming(1, { duration: T.fadeMs });
          }
        } else if (mode.value === 4) {
          const landing = moveX.value + project(e.velocityX, T.deceleration);
          if (landing > T.dismissDistance) {
            close(e.velocityX, e.velocityY);
          } else {
            moveX.value = withSpring(0, { ...Springs.momentum, velocity: e.velocityX });
            moveScale.value = withSpring(1, Springs.settle);
            backdrop.value = withTiming(1, { duration: T.fadeMs });
          }
        } else if (mode.value === 3) {
          const bx = boundX(zoom.value);
          const by = boundY(zoom.value);
          zoomX.value = withSpring(
            clamp(zoomX.value + project(e.velocityX, T.deceleration), -bx, bx),
            { ...Springs.settle, velocity: e.velocityX }
          );
          zoomY.value = withSpring(
            clamp(zoomY.value + project(e.velocityY, T.deceleration), -by, by),
            { ...Springs.settle, velocity: e.velocityY }
          );
        }
        mode.value = 0;
      });

    const pinch = Gesture.Pinch()
      .onStart(() => {
        'worklet';
        cancelAnimation(zoom);
        cancelAnimation(zoomX);
        cancelAnimation(zoomY);
        startZoom.value = zoom.value;
        startX.value = zoomX.value;
        startY.value = zoomY.value;
      })
      .onUpdate((e) => {
        'worklet';
        if (closing.value) return;
        const next = clampWithRubber(startZoom.value * e.scale, 1, T.maxZoom, 1, T.rubber);
        // Keep the point under the fingers where it is.
        const fx = e.focalX - width / 2;
        const fy = e.focalY - height / 2;
        const ratio = next / startZoom.value;
        zoom.value = next;
        zoomX.value = fx - (fx - startX.value) * ratio;
        zoomY.value = fy - (fy - startY.value) * ratio;
      })
      .onEnd(() => {
        'worklet';
        const settled = clamp(zoom.value, 1, T.maxZoom);
        const bx = boundX(settled);
        const by = boundY(settled);
        zoom.value = withSpring(settled, Springs.settle);
        zoomX.value = withSpring(clamp(zoomX.value, -bx, bx), Springs.settle);
        zoomY.value = withSpring(clamp(zoomY.value, -by, by), Springs.settle);
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((e) => {
        'worklet';
        if (closing.value) return;
        if (zoom.value > 1.01) {
          zoom.value = withSpring(1, Springs.settle);
          zoomX.value = withSpring(0, Springs.settle);
          zoomY.value = withSpring(0, Springs.settle);
          return;
        }
        const scale = T.doubleTapZoom;
        const bx = boundX(scale);
        const by = boundY(scale);
        zoom.value = withSpring(scale, Springs.settle);
        zoomX.value = withSpring(clamp(-(e.x - width / 2) * (scale - 1), -bx, bx), Springs.settle);
        zoomY.value = withSpring(clamp(-(e.y - height / 2) * (scale - 1), -by, by), Springs.settle);
      });

    const singleTap = Gesture.Tap().onEnd(() => {
      'worklet';
      if (closing.value) return;
      chrome.value = withTiming(chrome.value > 0.5 ? 0 : 1, { duration: T.fadeMs });
    });

    return Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));
    // Shared values are stable; the gesture depends on the layout and the count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, page, width, height, close]);

  // --- styles -------------------------------------------------------------

  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const pagerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value * backdrop.value }));

  const photo = photos[index];
  const indices = [index - 1, index, index + 1].filter((i) => i >= 0 && i < count);

  // Chrome that cannot be seen must not be pressed either.
  const [chromeShown, setChromeShown] = useState(true);
  useAnimatedReaction(
    () => chrome.value > 0.5,
    (shown, previous) => {
      if (shown !== previous) scheduleOnRN(setChromeShown, shown);
    }
  );

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, rootStyle]}
      accessibilityViewIsModal
      onAccessibilityEscape={() => close()}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />

      <GestureDetector gesture={gesture}>
        <Animated.View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.pager, pagerStyle]}>
            {indices.map((i) => (
              <Page
                key={photos[i].id}
                photo={photos[i]}
                index={i}
                left={i * page}
                width={width}
                height={height}
                active={active}
                moveX={moveX}
                moveY={moveY}
                moveScale={moveScale}
                zoom={zoom}
                zoomX={zoomX}
                zoomY={zoomY}
              />
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <Animated.View
        style={[styles.top, { top: insets.top + T.chromeInset }, chromeStyle]}
        pointerEvents={chromeShown ? 'box-none' : 'none'}>
        <GlassButton icon="x" accessibilityLabel={t('album.closePhoto')} onPress={() => close()} />

        <Glass radius={GlassTokens.capsuleHeight / 2} style={styles.counter}>
          <Text style={styles.counterText} accessibilityLabel={t('album.photoOf', { index: index + 1, count })}>
            {index + 1} / {count}
          </Text>
          {photo?.caption ? (
            <Text style={styles.captionText} numberOfLines={1}>
              {photo.caption}
            </Text>
          ) : null}
        </Glass>

        {/* Balances the close button so the counter stays centred. */}
        <View style={styles.spacer} />
      </Animated.View>

      {photo && (renderActions || photo.mission) ? (
        <Animated.View
          style={[styles.bottom, { bottom: insets.bottom + T.chromeInset }, chromeStyle]}
          pointerEvents={chromeShown ? 'box-none' : 'none'}>
          {photo.mission ? (
            <Glass radius={MissionTokens.caption.radius} style={styles.mission}>
              <Feather
                name="target"
                size={MissionTokens.caption.iconSize}
                color={Colors.textMuted}
              />
              <Text
                style={styles.missionText}
                numberOfLines={MissionTokens.caption.lines}
                accessibilityLabel={t('album.missionA11y', { mission: photo.mission })}>
                <Text style={styles.missionLabel}>{t('album.missionLabel')}</Text>
                {photo.mission}
              </Text>
            </Glass>
          ) : null}
          {renderActions ? (
            <View style={styles.actions}>{renderActions(photo, index)}</View>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

type PageProps = {
  photo: ViewerPhoto;
  index: number;
  left: number;
  width: number;
  height: number;
  active: SharedValue<number>;
  moveX: SharedValue<number>;
  moveY: SharedValue<number>;
  moveScale: SharedValue<number>;
  zoom: SharedValue<number>;
  zoomX: SharedValue<number>;
  zoomY: SharedValue<number>;
};

function Page({
  photo,
  index,
  left,
  width,
  height,
  active,
  moveX,
  moveY,
  moveScale,
  zoom,
  zoomX,
  zoomY,
}: PageProps) {
  const [fullUri, setFullUri] = useState<string | undefined>(
    typeof photo.full === 'string' ? photo.full : undefined
  );

  useEffect(() => {
    if (typeof photo.full === 'string') {
      setFullUri(photo.full);
      return;
    }
    let cancelled = false;
    void photo
      .full()
      .then((uri) => {
        if (!cancelled && uri) setFullUri(uri);
      })
      .catch(() => {
        // The thumbnail stays up.
      });
    return () => {
      cancelled = true;
    };
    // Keyed by id: `full` is a new closure on every render of the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.id]);

  // Only the active page moves; its neighbours wait at rest.
  const style = useAnimatedStyle(() => {
    if (active.value !== index) return { transform: [] };
    return {
      transform: [
        { translateX: moveX.value + zoomX.value },
        { translateY: moveY.value + zoomY.value },
        { scale: moveScale.value * zoom.value },
      ],
    };
  });

  return (
    <Animated.View style={[styles.page, { left, width, height }, style]}>
      <Image
        source={{ uri: fullUri ?? photo.thumbUri }}
        placeholder={{ uri: photo.thumbUri }}
        placeholderContentFit="contain"
        contentFit="contain"
        transition={fullUri ? 120 : 0}
        style={StyleSheet.absoluteFill}
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: T.backdrop,
  },
  pager: {
    ...StyleSheet.absoluteFill,
  },
  page: {
    position: 'absolute',
    top: 0,
  },
  top: {
    position: 'absolute',
    left: T.chromeInset,
    right: T.chromeInset,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spacer: {
    width: GlassTokens.buttonSize,
  },
  counter: {
    minHeight: GlassTokens.capsuleHeight,
    paddingHorizontal: GlassTokens.capsulePaddingX,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    ...Typography.durationPill,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  captionText: {
    ...Typography.durationPill,
    color: Colors.textMuted,
    maxWidth: 180,
  },
  bottom: {
    position: 'absolute',
    left: T.chromeInset,
    right: T.chromeInset,
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.chromeGap,
  },
  // Its own piece of glass above the actions: glass next to glass, never on it.
  mission: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: MissionTokens.caption.gap,
    paddingVertical: MissionTokens.caption.paddingY,
    paddingHorizontal: MissionTokens.caption.paddingX,
    marginBottom: MissionTokens.caption.marginBottom,
  },
  missionText: {
    ...Typography.bodySm,
    flexShrink: 1,
    color: Colors.text,
  },
  missionLabel: {
    color: Colors.textMuted,
  },
});
