/**
 * The viewfinder: the camera's live frames, drawn through the film's look —
 * natively, at the size it has on screen (2026-11-19, the user: "the viewfinder
 * should be full resolution, the colour applied live").
 *
 * VisionCamera's own `FrameRenderer` draws the frames, and LEFT patches it
 * (`patches/react-native-vision-camera+5.2.4.patch`) to draw each one through
 * the look with Metal — the App Clip's shader. Nothing passes through
 * JavaScript but the frame's handle: the worklet hands it to the renderer and
 * disposes it, and the camera's buffer becomes a texture without a copy.
 *
 * Replaces the 2026-11-15 viewfinder that copied every 1024x768 frame into
 * JavaScript and drew it with Skia — soft on a full-screen viewfinder, and
 * heavy on memory. Before that, `SkiaCamera` crashed: Skia keeps one GPU
 * context per thread and the camera's queue changes threads. Metal has no
 * such rule, so drawing on the camera's thread is safe here.
 *
 * The look reaches the native renderer through the App Group's UserDefaults
 * (`left.viewfinder.look`, written with `ExtensionStorage`): the renderer's
 * spec has no other door, and adding one means regenerating Nitro's bindings.
 *
 * The session is driven by `useCamera` directly, so the screen gets
 * `onConfigured` (after every flip) as well as `onStarted`.
 *
 * `'use no memo'`: the React Compiler breaks worklets handed to the camera
 * (margelo/react-native-vision-camera#3748). With it off, everything passed to
 * the camera hooks needs a stable identity.
 */

'use no memo';

import { ExtensionStorage } from '@bacons/apple-targets';
import { useCallback, useEffect, useImperativeHandle, useMemo, type Ref } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { type SharedValue } from 'react-native-reanimated';
import {
  CommonResolutions,
  NativeFrameRendererView,
  useCamera,
  useFrameOutput,
  useFrameRenderer,
  useOrientation,
  type CameraController,
  type CameraDevice,
  type CameraPhotoOutput,
  type Constraint,
  type Frame,
} from 'react-native-vision-camera';
import { createSynchronizable } from 'react-native-worklets';

import type { FilmLook } from '@/lib/events';
import { liveLookUniforms } from '@/lib/look-shader';

/**
 * The frames the viewfinder is drawn from: 4:3 like the photo, about the
 * screen's own pixels, and capped at the preview's size
 * (`enablePreviewSizedOutputBuffers`) — next to a 12 MP photo output the
 * session could otherwise settle on far larger frames than the screen shows.
 */
const PREVIEW_RESOLUTION = CommonResolutions.FHD_4_3;
const PREVIEW_CONSTRAINTS: Constraint[] = [{ fps: 30 }];

/** Shared with the App Clip's targets; the patched renderer reads it there. */
const APP_GROUP = 'group.com.leftmoment.app';
const LOOK_KEY = 'left.viewfinder.look';

/** Hands the look to the native renderer. A build without the module draws neutral colour. */
function publishLook(look: FilmLook) {
  if (Platform.OS !== 'ios') return;
  try {
    // Size is the renderer's own business; only the colour travels.
    const { size: _size, grainCells: _cells, ...colour } = liveLookUniforms(look, 1, 1);
    new ExtensionStorage(APP_GROUP).set(LOOK_KEY, JSON.stringify(colour));
  } catch (e) {
    console.warn(`[camera] look not handed to the viewfinder: ${e}`);
  }
}

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

  // Before the first frame, and again on every change of film.
  useEffect(() => publishLook(look), [look]);

  const renderer = useFrameRenderer();
  /** Dev only: the first frame's size, logged once. */
  const reported = useMemo(() => createSynchronizable(false), []);

  const handleFrame = useCallback(
    (frame: Frame) => {
      'worklet';
      /*
        Nothing may throw out of here: an exception crossing back into the
        camera's native frame callback aborts the whole app
        (margelo/react-native-vision-camera#4219).
      */
      try {
        if (__DEV__ && !reported.getBlocking()) {
          reported.setBlocking(true);
          console.log('[camera] frame', {
            width: frame.width,
            height: frame.height,
            format: frame.pixelFormat,
          });
        }
        renderer.renderFrame(frame);
      } catch (e) {
        console.warn(`[camera] frame not drawn: ${e}`);
      } finally {
        frame.dispose();
      }
    },
    [renderer, reported]
  );

  const frameOutput = useFrameOutput({
    targetResolution: PREVIEW_RESOLUTION,
    // BGRA: one plane the Metal shader reads as a texture. The conversion is the camera's own.
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

  // The renderer fills the view, aspect-fill, at the view's own pixel size.
  return (
    <View style={style}>
      <NativeFrameRendererView renderer={renderer} style={StyleSheet.absoluteFill} />
    </View>
  );
}
