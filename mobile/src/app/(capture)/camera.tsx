/**
 * 13 · Camera — the disposable camera.
 *
 * One shutter and a roll that counts down. No preview of what was shot: the
 * pictures are seen when the film is developed, by everyone at once.
 *
 * **Not in the prototype** — frame 13 drew a video recorder. Designed in the
 * existing language; the decisions that are this screen's own:
 *
 *  - The viewfinder is 3:4, inset and rounded, and **shows the film**: every
 *    live frame is drawn through the same shader that bakes the JPEG
 *    (`components/ui/film-camera.tsx`). Mono's viewfinder is black and white.
 *  - Zoom stops are the phone's own lenses and nothing else (`lib/zoom.ts`); a
 *    phone with one lens has no stops, and pinch does the zooming.
 *  - The flash lights the LED before the exposure and asks the camera for its
 *    own flash on top (`fire`). On the front camera the viewfinder goes white.
 *  - **The chrome floats on the picture, as glass** (2026-11-15). Flash, the
 *    roll counter and flip sit along the viewfinder's top edge; "Your shots",
 *    zoom and invite along its bottom edge. All of it is `Glass` — there is a
 *    picture behind every piece. Outside the frame only the shutter is left,
 *    on the plain page, where glass would have nothing to show.
 *  - Bottom-left of the viewfinder shows the last photo taken and opens "Your
 *    shots" — a guest may look at their own frames.
 *  - Bottom-right opens the invite (09: QR and link), for every member — a
 *    party grows while it is running, and whoever stands next to a newcomer
 *    should be able to let them in. Frames still uploading count beside the
 *    shutter.
 *  - The counter is the largest type on the screen and shows only what
 *    `useCameraSession` gives it — the server's count minus frames still owed.
 *  - The shutter answers on touch-down and fires on release. The viewfinder
 *    blinks shut on the same frame. No sound: a party is loud enough.
 *  - Shooting works offline. The frame is on disk and in the queue before the
 *    shutter has finished opening (`lib/upload-queue.ts`).
 *
 * States the roll model requires, each a screen of its own rather than a
 * disabled camera: permission denied, roll empty, film developed, and no
 * connection on a phone that has never loaded this event.
 */

/*
  Opts this file out of the React Compiler: what is handed to the camera needs
  identities this file controls (margelo/react-native-vision-camera#3748).
*/
'use no memo';

import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useNetworkState } from 'expo-network';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  type CameraController,
  type CameraDevice,
  type DeviceFilter,
} from 'react-native-vision-camera';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { EventCountdown } from '@/components/ui/event-countdown';
import { FilmCamera, type FilmCameraRef } from '@/components/ui/film-camera';
import { Glass, GlassButton } from '@/components/ui/glass';
import { PillButton } from '@/components/ui/pill-button';
import { PressScale } from '@/components/ui/press-scale';
import { RollCounter } from '@/components/ui/roll-counter';
import { Screen } from '@/components/ui/screen';
import { ShutterButton } from '@/components/ui/shutter-button';
import { Spinner } from '@/components/ui/spinner';
import { Body, Display, Em, Label } from '@/components/ui/typography';
import { ZoomSelector } from '@/components/ui/zoom-selector';
import { Camera as T, Glass as GlassTokens, Radii } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { useCameraSession } from '@/hooks/use-camera-session';
import type { FilmLook } from '@/lib/events';
import { latestShotThumb } from '@/lib/my-shots';
import { at } from '@/lib/pair';
import { enqueueShot, subscribeToQueue } from '@/lib/upload-queue';
import { pinchZoom, stopAt, stopsForDevice, wideZoom } from '@/lib/zoom';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** JPEG quality of the capture. The look pass re-encodes; this only has to not lose detail. */
const CAPTURE_QUALITY = 0.92;

const DEV = __DEV__;

/** Every lens the phone has, behind one zoom range — see `lib/zoom.ts`. */
const BACK_LENSES: DeviceFilter = {
  physicalDevices: ['ultra-wide-angle', 'wide-angle', 'telephoto'],
};

export default function CameraScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const session = useCameraSession(eventId);
  const permission = useCameraPermission();
  const { requestPermission } = permission;

  const leave = useCallback(() => router.replace('/(library)/films'), [router]);

  // Ask once, as soon as there is a camera to show. A second ask is the user's to make.
  const asked = useRef(false);
  const canAsk = !permission.hasPermission && permission.canRequestPermission;
  useEffect(() => {
    if (canAsk && session.status === 'ready' && !asked.current) {
      asked.current = true;
      void requestPermission();
    }
  }, [canAsk, session.status, requestPermission]);

  // A guest who opened the link before the host started belongs on 12.
  const notStarted = session.status === 'ready' && session.event.status === 'setup';
  useEffect(() => {
    if (notStarted && eventId) {
      router.replace({ pathname: '/(guest)/waiting', params: { eventId } });
    }
  }, [notStarted, eventId, router]);

  if (session.status === 'loading' || notStarted) {
    return (
      <StateScreen onClose={leave}>
        <Spinner />
      </StateScreen>
    );
  }

  if (session.status === 'error') {
    return (
      <StateScreen onClose={leave} eyebrow="No connection">
        <Display size="md">
          Can&apos;t reach <Em>your film.</Em>
        </Display>
        <Body small>
          This phone hasn&apos;t opened the event yet, so it needs a connection once. After that the
          camera works offline.
        </Body>
        <View style={styles.stateActions}>
          <PillButton label="Try again" onPress={session.reload} />
        </View>
      </StateScreen>
    );
  }

  const { event } = session;

  if (session.developed) {
    return (
      <StateScreen onClose={leave} eyebrow={event.name}>
        <Display size="md">
          The film is <Em>developed.</Em>
        </Display>
        <Body small>
          The cameras are closed.
          {session.pending > 0 ? ` ${uploadingLine(session.pending)} Keep the app open.` : ''}
        </Body>
        <View style={styles.stateActions}>
          <PillButton
            label="Open the album"
            icon="arrow-right"
            onPress={() =>
              router.replace({
                pathname: '/(library)/album/[id]',
                params: { id: event.id },
              })
            }
          />
        </View>
      </StateScreen>
    );
  }

  if (session.shotsLeft === 0) {
    return (
      <StateScreen onClose={leave} eyebrow={event.name}>
        <Display size="md">
          That was your <Em>last shot.</Em>
        </Display>
        <Body small>
          Your roll is used up. Everyone&apos;s photos appear together when the film is developed.
          {session.pending > 0 ? ` ${uploadingLine(session.pending)}` : ''}
        </Body>
        <View style={styles.stateCountdown}>
          <Label small>Developed in</Label>
          <EventCountdown endsAt={event.ends_at} />
        </View>
        <View style={styles.stateActions}>
          {/* The album's "developing" state: the count so far, and the host's "develop now". */}
          <PillButton
            label="See how the film is doing"
            icon="arrow-right"
            onPress={() =>
              router.replace({
                pathname: '/(library)/album/[id]',
                params: { id: event.id },
              })
            }
          />
          <PillButton label="Back to your moments" variant="secondary" onPress={leave} />
        </View>
      </StateScreen>
    );
  }

  if (!permission.hasPermission) {
    return (
      <StateScreen onClose={leave} eyebrow={event.name}>
        <Display size="md">
          LEFT needs <Em>your camera.</Em>
        </Display>
        <Body small>
          It is only used to take photos for this event. Nothing is recorded, and there is no
          microphone.
        </Body>
        <View style={styles.stateActions}>
          <PillButton
            label={permission.canRequestPermission ? 'Allow camera' : 'Open Settings'}
            onPress={() =>
              permission.canRequestPermission
                ? void requestPermission()
                : void Linking.openSettings()
            }
          />
        </View>
      </StateScreen>
    );
  }

  return (
    <Viewfinder
      eventId={event.id}
      eventName={event.name}
      endsAt={event.ends_at}
      look={event.look}
      userId={session.userId}
      shotsLeft={session.shotsLeft}
      pending={session.pending}
      onClose={leave}
      onOpenShots={() =>
        router.push({
          pathname: '/(capture)/roll',
          params: { eventId: event.id },
        })
      }
      onOpenInvite={() =>
        router.push({
          pathname: '/(host)/invite',
          params: { eventId: event.id, from: 'camera' },
        })
      }
    />
  );
}

/**
 * Light the LED and say whether it is really on.
 *
 * `enableTorchWithStrength` first: it is the only torch call that fails out
 * loud when the system refuses the LED (a hot phone, say). `setTorchMode` is
 * the fallback for phones without a strength setting.
 */
async function lightTorch(controller: CameraController, device: CameraDevice): Promise<boolean> {
  try {
    if (device.supportsTorchStrength) {
      await controller.enableTorchWithStrength(device.maxTorchStrength);
    } else {
      await controller.setTorchMode('on');
    }
  } catch (e) {
    console.warn(`[camera] torch did not light: ${e}`);
    try {
      await controller.setTorchMode('on');
    } catch (again) {
      console.warn(`[camera] torch did not light: ${again}`);
    }
  }
  const on = controller.torchMode === 'on';
  if (DEV) {
    console.log('[camera] torch', {
      mode: controller.torchMode,
      strength: controller.torchStrength,
    });
  }
  return on;
}

function uploadingLine(pending: number): string {
  return pending === 1
    ? '1 photo is still on its way.'
    : `${pending} photos are still on their way.`;
}

/** The frame every non-camera state shares: a way out, and a block of copy. */
function StateScreen({
  onClose,
  eyebrow,
  children,
}: {
  onClose: () => void;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <Screen>
      <View style={styles.stateHeader}>
        <CircleIconButton glass icon="x" accessibilityLabel="Back to your moments" onPress={onClose} />
      </View>
      <View style={styles.stateBody}>
        {eyebrow ? <Label>{eyebrow}</Label> : null}
        {children}
      </View>
    </Screen>
  );
}

type ViewfinderProps = {
  eventId: string;
  eventName: string;
  endsAt: string;
  look: FilmLook;
  userId: string;
  shotsLeft: number | null;
  pending: number;
  onClose: () => void;
  onOpenShots: () => void;
  onOpenInvite: () => void;
};

function Viewfinder({
  eventId,
  eventName,
  endsAt,
  look,
  userId,
  shotsLeft,
  pending,
  onClose,
  onOpenShots,
  onOpenInvite,
}: ViewfinderProps) {
  const focused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;

  const [position, setPosition] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState(false);
  /** The session is running — from `onStarted` until `onStopped`. */
  const [running, setRunning] = useState(false);
  /** The camera the session was last set up for. A flip changes the device first. */
  const [configuredFor, setConfiguredFor] = useState<string | null>(null);
  const [missed, setMissed] = useState(false);
  /** The camera could not be set up. Cleared by the next camera that can. */
  const [failed, setFailed] = useState(false);
  /** The viewfinder lit white for a selfie. */
  const [screenFlash, setScreenFlash] = useState(false);
  const camera = useRef<FilmCameraRef>(null);

  const device = useCameraDevice(position, position === 'back' ? BACK_LENSES : undefined);
  const photoOutput = usePhotoOutput({
    containerFormat: 'jpeg',
    quality: CAPTURE_QUALITY,
    qualityPrioritization: 'balanced',
  });
  /*
    When the shutter may fire: the session is running *and* has been set up for
    the camera now selected. `onStarted` alone is not enough — a flip
    reconfigures the running session without restarting it, so it never fires
    again, and a shutter waiting for it stayed dead. `onConfigured` fires after
    every set-up, the flip included.

    Stable identities: with the compiler off, a fresh callback each render
    would be handed to the camera again.
  */
  const deviceId = device?.id;
  const selectedDevice = useRef(deviceId);
  selectedDevice.current = deviceId;
  const handleConfigured = useCallback(() => {
    setFailed(false);
    setConfiguredFor(selectedDevice.current ?? null);
  }, []);
  const handleStarted = useCallback(() => setRunning(true), []);
  const handleStopped = useCallback(() => setRunning(false), []);
  const ready = running && deviceId !== undefined && configuredFor === deviceId;
  /*
    Any change of camera is unconfigured until `onConfigured` says otherwise —
    also a quick flip there and back, where the id is the old one again but the
    session is still being rebuilt. The set-up it waits for always answers
    later than this effect.
  */
  useEffect(() => {
    setConfiguredFor(null);
  }, [device]);

  /*
    The largest 3:4 frame the space between header and controls can hold,
    computed rather than left to flexbox: `aspectRatio` with a max on both axes
    gives up the ratio on tall phones, and the preview would then show more than
    the photo contains.
  */
  const [area, setArea] = useState({ width: 0, height: 0 });
  const frameWidth = Math.min(area.width, area.height * T.viewfinder.aspectRatio);
  const frame = {
    width: frameWidth,
    height: frameWidth / T.viewfinder.aspectRatio,
  };

  /*
    The last photo, for the tile bottom-left. Re-read whenever the queue moves:
    a new shot arrives as a local file, and an uploaded one changes address.
    The old picture stays up until the new one has resolved.
  */
  const [lastShot, setLastShot] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const read = () =>
      void latestShotThumb(eventId).then((uri) => {
        if (!cancelled && uri) setLastShot(uri);
      });
    read();
    const unsubscribe = subscribeToQueue((change) => {
      if (change.type === 'changed') read();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [eventId]);

  /** A capture is in flight. A ref: two taps in one frame must not both pass. */
  const busy = useRef(false);

  // --- zoom ---------------------------------------------------------------

  const stops = useMemo(() => (device ? stopsForDevice(device) : []), [device]);
  const zoom = useSharedValue(1);
  /** The stop the zoom sits on; '' while a pinch has it between two. */
  const [selected, setSelected] = useState('');

  /*
    A new device (first mount, or the flip) starts on its wide lens. Keyed on
    the id: the same camera is handed out again as a new object when its
    capabilities are re-read, and that must not throw the zoom back.
  */
  useEffect(() => {
    if (!device) return;
    const wide = wideZoom(device);
    zoom.value = wide;
    setSelected(stopAt(stopsForDevice(device), wide)?.label ?? '');
    if (__DEV__) {
      console.log('[camera] device', {
        name: device.localizedName,
        type: device.type,
        lenses: device.physicalDevices.map((lens) => lens.type),
        minZoom: device.minZoom,
        maxZoom: device.maxZoom,
        switches: device.zoomLensSwitchFactors,
        hasFlash: device.hasFlash,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `device` changes identity without changing camera; see above.
  }, [deviceId, zoom]);

  /** The viewfinder's shutter: closed for a blink on a shot, and while the cameras change. */
  const blackout = useSharedValue(0);
  const blackoutStyle = useAnimatedStyle(() => ({ opacity: blackout.value }));
  // Opens once the camera can shoot again — after a flip, that is the new camera, zoomed.
  useEffect(() => {
    if (ready) {
      blackout.value = withDelay(T.blackout.holdMs, withTiming(0, { duration: T.blackout.openMs }));
    }
  }, [ready, blackout]);

  // The shutter closes by itself: `ready` is false until the new camera is set up.
  // A camera that cannot be set up: open the shutter again and say so, rather than stay black.
  const handleError = useCallback(() => {
    blackout.value = 0;
    setFailed(true);
  }, [blackout]);

  const flip = useCallback(() => {
    // Not under an exposure: the flip swaps the camera the photo is being read from.
    if (busy.current) return;
    // Closed while the cameras change: the new one starts on the old one's zoom for a moment.
    blackout.value = 1;
    setPosition((current) => (current === 'back' ? 'front' : 'back'));
  }, [blackout]);

  /*
    Pinch scales the factor it started from, 1:1 with the fingers, inside the
    device's range. On the JS thread: it also has to clear the selected stop.
  */
  const pinchFrom = useRef(1);
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      pinchFrom.current = zoom.value;
    })
    .onUpdate((e) => {
      if (!device) return;
      zoom.value = pinchZoom(pinchFrom.current, e.scale, device);
      setSelected('');
    });

  // --- shutter ------------------------------------------------------------

  const fire = useCallback(async () => {
    if (busy.current || !ready || !device) return;
    busy.current = true;
    setMissed(false);

    // The last frame of a roll is the one moment that earns more than a tick.
    if (shotsLeft === 1) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    /*
      The flash. The light is put there by hand, with a beat for the camera to
      meter for it: the LED as a torch, or — on the front camera — the
      viewfinder turned white. The camera's own flash is only asked for when
      the torch could not be confirmed lit: the library drops that request
      silently when the photo output does not list the mode, and it never
      fired on the first test phone.

      Every step says what happened in dev (`[camera] fire`, `[camera] torch`):
      nothing in the library reports an LED the system refuses to light.
    */
    const lit = flash;
    const controller = camera.current?.controller;
    if (DEV) {
      console.log('[camera] fire', {
        flash: lit,
        position,
        controller: controller != null,
        hasTorch: device.hasTorch,
        hasFlash: device.hasFlash,
      });
    }
    let torchLit = false;
    // Whether or not the torch reported itself lit: never leave the LED on.
    const lightsOut = () => {
      if (controller && position === 'back' && device.hasTorch) {
        void controller.setTorchMode('off').catch((e: unknown) => {
          console.warn(`[camera] torch did not go out: ${e}`);
        });
      }
      setScreenFlash(false);
    };
    try {
      if (lit && position === 'back' && device.hasTorch && controller) {
        torchLit = await lightTorch(controller, device);
      } else if (lit && position === 'front') {
        setScreenFlash(true);
      }
      if (lit) {
        await wait(T.flash.leadMs);
      } else {
        // The shutter closes on the frame the finger lifts, whatever the camera is doing.
        // `Never`: with reduced motion the system would skip the dip altogether.
        blackout.value = reducedMotion ? T.blackout.reducedOpacity : 1;
        blackout.value = withDelay(
          T.blackout.holdMs,
          withTiming(0, {
            duration: T.blackout.openMs,
            reduceMotion: ReduceMotion.Never,
          }),
          ReduceMotion.Never
        );
      }

      let picture;
      try {
        picture = await photoOutput.capturePhotoToFile(
          {
            flashMode: lit && !torchLit && device.hasFlash ? 'on' : 'off',
            enableShutterSound: false,
          },
          {}
        );
      } finally {
        // The light goes out with the exposure, not after the file work that follows.
        if (lit) lightsOut();
      }

      await enqueueShot({
        eventId,
        userId,
        look,
        // A plain path; the file API wants a URL.
        capturedUri: `file://${picture.filePath}`,
        width: picture.width,
        height: picture.height,
      });
    } catch (e) {
      // Nothing was queued, so nothing was spent. Say so; the next press is a new frame.
      if (DEV) console.warn(`[camera] shot not taken: ${e}`);
      setMissed(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      // Again, for a shot that failed before its exposure.
      if (lit) lightsOut();
      busy.current = false;
    }
  }, [
    ready,
    device,
    position,
    photoOutput,
    blackout,
    reducedMotion,
    shotsLeft,
    eventId,
    userId,
    look,
    flash,
  ]);

  // --- status -------------------------------------------------------------

  const note = failed
    ? {
        icon: 'alert-circle' as const,
        text: "The camera didn't start. Switch cameras to retry.",
      }
    : missed
      ? {
          icon: 'alert-circle' as const,
          text: "That one didn't save. Try again.",
        }
      : offline
        ? { icon: 'wifi-off' as const, text: 'Offline. Your shots are saved.' }
        : null;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <CircleIconButton glass icon="x" accessibilityLabel="Back to your moments" onPress={onClose} />
        </View>

        <View style={styles.headerCenter}>
          <Label small numberOfLines={1}>
            {eventName}
          </Label>
        </View>

        <View style={[styles.headerSide, styles.headerRight]}>
          <EventCountdown endsAt={endsAt} />
        </View>
      </View>

      <View
        style={styles.viewfinderArea}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setArea({ width: width - T.viewfinder.paddingX * 2, height });
        }}>
        <GestureDetector gesture={pinch}>
          <View style={[styles.viewfinder, frame]}>
            {device ? (
              <FilmCamera
                ref={camera}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={focused}
                look={look}
                photoOutput={photoOutput}
                zoom={zoom}
                onConfigured={handleConfigured}
                onStarted={handleStarted}
                onStopped={handleStopped}
                onError={handleError}
              />
            ) : null}

            {screenFlash ? (
              <View style={[StyleSheet.absoluteFill, styles.screenFlash]} pointerEvents="none" />
            ) : null}
            <Animated.View
              style={[StyleSheet.absoluteFill, styles.blackout, blackoutStyle]}
              pointerEvents="none"
            />

            {/*
              The chrome, over the picture and over the shutter's blackout: plain
              views above the canvas, each on `Glass`. No blend modes here — on
              iOS they paint over the preview. `box-none`, so the gaps between
              the controls still belong to the pinch.
            */}
            <View style={[styles.overlayRow, styles.overlayTop]} pointerEvents="box-none">
              <GlassButton
                icon={flash ? 'zap' : 'zap-off'}
                color={at(T.controls.flashColor, flash)}
                accessibilityLabel={flash ? 'Flash on' : 'Flash off'}
                onPress={() => setFlash((on) => !on)}
              />
              <Glass radius={Radii.pill} style={styles.counter}>
                <RollCounter shotsLeft={shotsLeft} />
              </Glass>
              <GlassButton icon="refresh-cw" accessibilityLabel="Switch camera" onPress={flip} />
            </View>

            {note ? (
              <View style={styles.note} accessibilityLiveRegion="polite">
                <Feather name={note.icon} size={T.note.iconSize} color={T.note.color} />
                <Text style={styles.noteText}>{note.text}</Text>
              </View>
            ) : null}

            <View style={[styles.overlayRow, styles.overlayBottom]} pointerEvents="box-none">
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Your shots"
                accessibilityHint="Shows the photos you have taken"
                hitSlop={8}
                scale={GlassTokens.pressScale}
                onPress={onOpenShots}>
                <Glass radius={T.shots.radius} interactive style={styles.tile}>
                  {lastShot ? (
                    <Image
                      source={{ uri: lastShot }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={T.shots.fadeMs}
                    />
                  ) : (
                    <Feather name="image" size={T.shots.iconSize} color={T.shots.iconColor} />
                  )}
                </Glass>
              </PressScale>

              {stops.length > 0 ? (
                <ZoomSelector
                  stops={stops}
                  selected={selected}
                  onSelect={(stop) => {
                    zoom.value = stop.zoom;
                    setSelected(stop.label);
                  }}
                />
              ) : null}

              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Invite"
                accessibilityHint="Shows the QR code and the link to this event"
                hitSlop={8}
                scale={GlassTokens.pressScale}
                onPress={onOpenInvite}>
                <Glass radius={T.shots.radius} interactive style={styles.tile}>
                  <MaterialCommunityIcons
                    name="qrcode"
                    size={T.invite.iconSize}
                    color={T.shots.iconColor}
                  />
                </Glass>
              </PressScale>
            </View>
          </View>
        </GestureDetector>
      </View>

      <View style={styles.bottom}>
        <View style={styles.bottomSide} />

        <ShutterButton onFire={fire} disabled={!ready} />

        <View style={[styles.bottomSide, styles.bottomRight]}>
          {pending > 0 ? (
            <View
              style={styles.queue}
              accessible
              accessibilityRole="text"
              accessibilityLabel={uploadingLine(pending)}>
              <Feather name="upload-cloud" size={T.queue.iconSize} color={T.queue.color} />
              <Text style={styles.queueText}>{pending}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // --- states ---
  stateHeader: {
    paddingTop: T.header.paddingTop,
  },
  stateBody: {
    flex: 1,
    justifyContent: 'center',
    gap: T.state.gap,
  },
  stateCountdown: {
    marginTop: T.state.blockGap - T.state.gap,
    gap: T.state.buttonGap,
  },
  stateActions: {
    marginTop: T.state.blockGap - T.state.gap,
    gap: T.state.buttonGap,
  },

  // --- camera ---
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: T.header.paddingX,
    paddingTop: T.header.paddingTop,
    paddingBottom: T.header.paddingBottom,
  },
  headerSide: {
    width: T.header.sideWidth,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  // Centres the 3:4 frame in whatever height the header and controls leave.
  viewfinderArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: T.viewfinder.paddingX,
  },
  viewfinder: {
    borderRadius: T.viewfinder.radius,
    overflow: 'hidden',
    backgroundColor: T.viewfinder.bg,
  },
  screenFlash: {
    backgroundColor: T.flash.screenColor,
  },
  // Flash · counter · flip along the top edge, shots · zoom · invite along the bottom.
  overlayRow: {
    position: 'absolute',
    left: T.overlay.inset,
    right: T.overlay.inset,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overlayTop: {
    top: T.overlay.inset,
  },
  overlayBottom: {
    bottom: T.overlay.inset,
  },
  counter: {
    paddingHorizontal: T.overlay.counterPaddingX,
    paddingVertical: T.overlay.counterPaddingY,
  },
  // "Your shots" and invite. The glass draws the edge; a photo covers it.
  tile: {
    width: T.shots.size,
    height: T.shots.size,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blackout: {
    backgroundColor: T.blackout.color,
  },
  note: {
    position: 'absolute',
    // Clear of the bottom row of chrome.
    bottom: T.overlay.inset + T.shots.size + T.overlay.noteGap,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.note.gap,
    paddingVertical: T.note.paddingY,
    paddingHorizontal: T.note.paddingX,
    borderRadius: T.viewfinder.radius,
    borderWidth: 1,
    borderColor: T.note.border,
    backgroundColor: T.note.bg,
  },
  noteText: {
    ...Typography.metaMd,
    color: T.note.color,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: T.bottom.paddingX,
    paddingTop: T.bottom.paddingTop,
    paddingBottom: T.bottom.paddingBottom,
  },
  bottomSide: {
    width: T.bottom.sideWidth,
  },
  bottomRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  queue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.queue.gap,
  },
  queueText: {
    ...Typography.durationPill,
    color: T.queue.color,
  },
});
