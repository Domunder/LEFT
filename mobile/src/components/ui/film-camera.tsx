/**
 * The viewfinder: the camera's live frames, drawn through the film's look.
 *
 * Replaces VisionCamera's `SkiaCamera`, which crashed the app after about
 * twenty seconds on the camera (2026-11-15). It shades every frame on the GPU
 * *on the camera's own queue*: Skia keeps one GPU context per thread, the queue
 * is served by whichever thread the system hands it, and the crash report ends
 * in Skia's GPU resource cache, on that queue.
 *
 * So the camera thread does no GPU work here at all:
 *
 *  1. The frame output delivers small BGRA frames, already upright
 *     (`enablePhysicalBufferRotation`) and, on the front camera, mirrored.
 *  2. The frame worklet copies the pixels (`SkData`, plain memory) and hands
 *     them to the JS thread. Nothing else happens on the camera's queue.
 *  3. The UI thread wraps them in an image, and a `<Canvas>` draws it through
 *     the look shader, on the thread Skia draws everything else on — the same
 *     tree as `LookPreview`.
 *
 * Memory: in this Skia version `dispose()` does nothing — a frame's 3 MB are
 * freed when the garbage collector drops its last JS wrapper, and a JS heap
 * only knows about those 3 MB if the image was *made* in it. So an image is
 * made in each runtime the pixels pass through (see `show`); handing one image
 * across would leave two heaps holding megabytes they cannot see.
 *
 * The session is driven by `useCamera` directly, so the screen gets
 * `onConfigured` (after every flip) as well as `onStarted`.
 *
 * `'use no memo'`: the React Compiler breaks worklets handed to the camera
 * (margelo/react-native-vision-camera#3748). With it off, everything passed to
 * the camera hooks needs a stable identity.
 */

'use no memo';

import {
  AlphaType,
  Canvas,
  ColorType,
  Group,
  ImageShader,
  Rect,
  Shader,
  Skia,
  type SkData,
  type SkImage,
} from '@shopify/react-native-skia';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import {
  CommonResolutions,
  useCamera,
  useFrameOutput,
  useOrientation,
  type CameraController,
  type CameraDevice,
  type CameraOrientation,
  type CameraPhotoOutput,
  type Constraint,
  type Frame,
} from 'react-native-vision-camera';
import { createSynchronizable, scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import type { FilmLook } from '@/lib/events';
import { liveLookUniforms, lookEffect } from '@/lib/look-shader';

/**
 * The frames the viewfinder is drawn from. 4:3 like the photo, so the preview
 * shows what the picture will contain, and no larger than the viewfinder needs:
 * every frame is copied once. The target is only a wish — next to a 12MP photo
 * output the session can settle on far larger frames — so the output is also
 * capped at screen size (`enablePreviewSizedOutputBuffers`).
 */
const PREVIEW_RESOLUTION = CommonResolutions.HD_4_3;
const PREVIEW_CONSTRAINTS: Constraint[] = [{ fps: 30 }];

/**
 * Frames handed over and not yet on the UI thread. When the JS thread is busy
 * (developing a photo takes a few hundred ms) or the UI thread is, the camera
 * skips frames instead of piling copies up behind them.
 */
const MAX_IN_FLIGHT = 2;
/** ...unless nothing has been shown for this long: then a hand-over was lost. */
const STALL_MS = 1000;

// Plain numbers: enums do not survive the trip into a worklet reliably.
const BGRA = ColorType.BGRA_8888;
const RGBA = ColorType.RGBA_8888;
const OPAQUE = AlphaType.Opaque;

const DEGREES: Record<CameraOrientation, number> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270,
};

export type FilmCameraRef = {
  /** The session's controller — torch, zoom. Undefined until configured. */
  readonly controller: CameraController | undefined;
};

type Props = {
  ref?: Ref<FilmCameraRef>;
  style?: StyleProp<ViewStyle>;
  device: CameraDevice;
  isActive: boolean;
  /** The film in the camera. */
  look: FilmLook;
  /** The output the shutter captures from. */
  photoOutput: CameraPhotoOutput;
  zoom: SharedValue<number>;
  /** The session has been set up for `device` — after mount and after every flip. */
  onConfigured?: () => void;
  onStarted?: () => void;
  onStopped?: () => void;
  /** The session could not be set up or broke. The shutter will not come back by itself. */
  onError?: (error: Error) => void;
};

type Facing = { orientation: CameraOrientation; mirrored: boolean };

function reportError(error: Error) {
  console.warn(`[camera] ${error.message}`);
}

function ignoreDroppedFrame() {
  // Dropping a late frame is the right thing to do; the default handler warns on each one.
}

export function FilmCamera({
  ref,
  style,
  device,
  isActive,
  look,
  photoOutput,
  zoom,
  onConfigured,
  onStarted,
  onStopped,
  onError,
}: Props) {
  const handleError = useCallback(
    (error: Error) => {
      reportError(error);
      onError?.(error);
    },
    [onError]
  );

  // --- what is on screen ----------------------------------------------------

  const picture = useSharedValue<SkImage | null>(null);
  const [live, setLive] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  /** How the frames are turned. Upright and unmirrored, unless the camera says otherwise. */
  const [facing, setFacing] = useState<Facing>({
    orientation: 'up',
    mirrored: false,
  });

  /** Frames handed over (written by the camera thread) and shown (by the JS thread). */
  const sent = useMemo(() => createSynchronizable(0), []);
  const sentAt = useMemo(() => createSynchronizable(0), []);
  const shown = useMemo(() => createSynchronizable(0), []);
  const complained = useMemo(() => createSynchronizable(false), []);

  const facingRef = useRef(facing);
  const liveRef = useRef(false);
  const mounted = useRef(true);

  /** On the UI thread: make the image the canvas draws, in the heap that will hold it. */
  const present = useCallback(
    (
      data: SkData,
      width: number,
      height: number,
      rowBytes: number,
      colorType: number,
      count: number
    ) => {
      'worklet';
      // Only now has the frame arrived: the camera waits for this thread, not just the JS one.
      shown.setBlocking(count);
      const image = Skia.Image.MakeImage(
        { width, height, colorType, alphaType: OPAQUE },
        data,
        rowBytes
      );
      if (image) picture.value = image;
    },
    [picture, shown]
  );

  const show = useCallback(
    (
      data: SkData,
      width: number,
      height: number,
      rowBytes: number,
      colorType: number,
      count: number,
      orientation: CameraOrientation,
      mirrored: boolean
    ) => {
      // A frame that stops here must still be counted, or the camera waits for it.
      if (!mounted.current) {
        shown.setBlocking(count);
        return;
      }

      /*
        Never drawn. It shares the pixels (no copy) and exists so that this
        heap is charged for the frame it is holding on to, and collects it.
      */
      const charged = Skia.Image.MakeImage(
        { width, height, colorType, alphaType: OPAQUE },
        data,
        rowBytes
      );
      if (!charged) {
        shown.setBlocking(count);
        if (__DEV__) console.warn('[camera] a frame could not be read');
        return;
      }
      scheduleOnUI(present, data, width, height, rowBytes, colorType, count);

      const was = facingRef.current;
      if (was.orientation !== orientation || was.mirrored !== mirrored) {
        facingRef.current = { orientation, mirrored };
        setFacing(facingRef.current);
      }
      if (!liveRef.current) {
        liveRef.current = true;
        setLive(true);
        if (__DEV__)
          console.log('[camera] frame', {
            width,
            height,
            orientation,
            mirrored,
          });
      }
    },
    [present, shown]
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Drops the UI thread's hold on the last frame.
      picture.value = null;
    };
  }, [picture]);

  // --- the camera -----------------------------------------------------------

  const handleFrame = useCallback(
    (frame: Frame) => {
      'worklet';
      /*
        Nothing may throw out of here: an exception crossing back into the
        camera's native frame callback aborts the whole app
        (margelo/react-native-vision-camera#4219). And no Skia GPU call may be
        made here — see the top of the file.
      */
      try {
        const count = sent.getBlocking();
        const now = performance.now();
        const waiting = count - shown.getBlocking();
        if (waiting >= MAX_IN_FLIGHT && now - sentAt.getBlocking() < STALL_MS) return;

        const format = frame.pixelFormat;
        const colorType =
          format === 'rgb-bgra-8-bit' ? BGRA : format === 'rgb-rgba-8-bit' ? RGBA : null;
        if (colorType === null) {
          if (!complained.getBlocking()) {
            complained.setBlocking(true);
            console.warn(`[camera] cannot draw ${format} frames`);
          }
          return;
        }

        // The frame's memory is only valid until it is disposed: copy it out.
        const data = Skia.Data.fromBytes(new Uint8Array(frame.getPixelBuffer()));

        sent.setBlocking(count + 1);
        sentAt.setBlocking(now);
        scheduleOnRN(
          show,
          data,
          frame.width,
          frame.height,
          frame.bytesPerRow,
          colorType,
          count + 1,
          frame.orientation,
          frame.isMirrored
        );
      } catch (e) {
        console.warn(`[camera] frame not drawn: ${e}`);
      } finally {
        frame.dispose();
      }
    },
    [sent, sentAt, shown, complained, show]
  );

  const frameOutput = useFrameOutput({
    targetResolution: PREVIEW_RESOLUTION,
    // BGRA: one plane of bytes the CPU can copy. The conversion is the camera's own.
    pixelFormat: 'rgb',
    // Upright, and mirrored on the front camera, before the frame gets here.
    enablePhysicalBufferRotation: true,
    enablePreviewSizedOutputBuffers: true,
    dropFramesWhileBusy: true,
    allowDeferredStart: false,
    onFrame: handleFrame,
    onFrameDropped: ignoreDroppedFrame,
  });

  const outputs = useMemo(() => [photoOutput, frameOutput], [photoOutput, frameOutput]);

  const controller = useCamera({
    device,
    isActive,
    outputs,
    constraints: PREVIEW_CONSTRAINTS,
    // Set by hand below: the preview and the photo want different things.
    orientationSource: 'custom',
    // A selfie is seen, and kept, the way a mirror shows it.
    mirrorMode: device.position === 'front' ? 'on' : 'auto',
    zoom,
    onConfigured,
    onStarted,
    onStopped,
    onError: handleError,
  });

  /*
    The app is locked to portrait, so the preview is always drawn upright. The
    photo follows the phone: held sideways, it is a landscape picture.
  */
  const deviceOrientation = useOrientation('device') ?? 'up';
  useEffect(() => {
    frameOutput.outputOrientation = 'up';
    photoOutput.outputOrientation = deviceOrientation;
  }, [frameOutput, photoOutput, deviceOrientation]);

  useImperativeHandle(
    ref,
    () => ({
      get controller() {
        return controller;
      },
    }),
    [controller]
  );

  // --- drawing --------------------------------------------------------------

  const effect = useMemo(() => lookEffect(), []);

  /*
    Frames arrive upright, so this is normally the identity. Should the camera
    ever deliver them turned or mirrored after all, they are drawn into a box of
    their own shape and that box is turned back — the preview stays right.
  */
  const sideways = facing.orientation === 'left' || facing.orientation === 'right';
  const box = sideways ? { width: size.height, height: size.width } : size;
  const transform = useMemo(() => {
    if (facing.orientation === 'up' && !facing.mirrored) return [];
    return [
      { translateX: size.width / 2 },
      { translateY: size.height / 2 },
      ...(facing.mirrored ? [{ scaleX: -1 }] : []),
      { rotate: (-DEGREES[facing.orientation] * Math.PI) / 180 },
      { translateX: -box.width / 2 },
      { translateY: -box.height / 2 },
    ];
  }, [facing, size.width, size.height, box.width, box.height]);

  const uniforms = useMemo(
    () => liveLookUniforms(look, box.width, box.height),
    [look, box.width, box.height]
  );
  const rect = useMemo(
    () => ({ x: 0, y: 0, width: box.width, height: box.height }),
    [box.width, box.height]
  );

  /*
    One stable tree: Skia re-records the scene whenever its children change
    identity, and with the compiler off that would be every render.
  */
  const scene = useMemo(
    () => (
      <Group transform={transform}>
        <Rect rect={rect}>
          <Shader source={effect} uniforms={uniforms}>
            {/* Clamp, like the print: the lens fringe samples just past the edge. */}
            <ImageShader image={picture} fit="cover" rect={rect} tx="clamp" ty="clamp" />
          </Shader>
        </Rect>
      </Group>
    ),
    [transform, rect, effect, uniforms, picture]
  );

  return (
    <View
      style={style}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
      }}>
      {live && size.width > 0 && size.height > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>{scene}</Canvas>
      ) : null}
    </View>
  );
}
