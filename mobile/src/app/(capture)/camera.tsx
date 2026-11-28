/**
 * 13 · Camera — the disposable camera.
 *
 * One shutter and a roll that counts down. No preview of what was shot: the
 * pictures are seen when the film is developed, by everyone at once.
 *
 * **Not in the prototype** — frame 13 drew a video recorder. Designed in the
 * existing language; the decisions that are this screen's own:
 *
 *  - **Full-screen viewfinder (2026-11-18, supersedes the "controls outside the
 *    frame" bullet below):** the frame runs under the status bar down to the
 *    shutter bar; header and flash · zoom · flip are glass laid over it, in
 *    their old places. The developed photo is centre-cropped to the frame's
 *    shape (`cropAspect`, `developPhoto`), so the print still holds exactly
 *    what the frame showed.
 *  - The viewfinder (formerly 3:4, inset) **shows the film**: every
 *    live frame is drawn through the same shader that bakes the JPEG
 *    (`components/ui/film-camera.tsx`). Mono's viewfinder is black and white.
 *  - Zoom stops are the phone's own lenses and nothing else (`lib/zoom.ts`); a
 *    phone with one lens has no stops, and pinch does the zooming.
 *  - The flash lights the LED before the exposure and asks the camera for its
 *    own flash on top (`fire`). On the front camera the viewfinder goes white.
 *  - **The picture is left alone: every control sits outside the viewfinder**
 *    (2026-11-16, the user's call after seeing the chrome floating inside it
 *    on a device). The counter is in the header under the event's name; flash,
 *    zoom and flip are a row under the frame; "Your shots", the shutter and
 *    invite are the bottom row. The controls keep the glass look
 *    (`GlassButton`, `Glass` tiles) — over the dark page it reads as a quiet
 *    tinted surface rather than as glass over a picture.
 *  - Left of the shutter is the last photo taken; it opens "Your shots" — a
 *    guest may look at their own frames.
 *  - Right of the shutter opens the invite (09: QR and link), for every
 *    member — a party grows while it is running, and whoever stands next to a
 *    newcomer should be able to let them in. Frames still uploading count
 *    beside it.
 *  - The counter is the largest type in the header and shows only what
 *    `useCameraSession` gives it — the server's count minus frames still owed.
 *  - The shutter answers on touch-down and fires on release. The viewfinder
 *    blinks shut on the same frame. No sound: a party is loud enough.
 *  - Shooting works offline. The frame is on disk and in the queue before the
 *    shutter has finished opening (`lib/upload-queue.ts`).
 *  - **Missions** (2026-11-17), for a guest who was dealt some: a "Missions
 *    1/3" glass capsule under the roll counter opens the list
 *    (`MissionListSheet`); tapping an open one arms the next shot, shown as
 *    "Next photo: …" at the viewfinder's top edge with an × to let it go. The
 *    next press of the shutter queues the frame with that mission and
 *    disarms. The first visit per event opens the list with an explanation
 *    (`left:missions-intro:{eventId}`). No new haptics.
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haptic } from '@/lib/haptics';
import { Image } from 'expo-image';
import { useNetworkState } from 'expo-network';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Linking, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
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
import { MissionArmedNote, MissionCapsule } from '@/components/ui/mission-chrome';
import { MissionListSheet } from '@/components/ui/mission-sheet';
import { PillButton } from '@/components/ui/pill-button';
import { PressScale } from '@/components/ui/press-scale';
import { RollCounter } from '@/components/ui/roll-counter';
import { Screen } from '@/components/ui/screen';
import { ShotFlight, type FlightRect } from '@/components/ui/shot-flight';
import { ShutterButton } from '@/components/ui/shutter-button';
import { Spinner } from '@/components/ui/spinner';
import { em } from '@/components/ui/rich';
import { Body, Display, Label } from '@/components/ui/typography';
import { ZoomSelector } from '@/components/ui/zoom-selector';
import { Camera as T, Colors, Glass as GlassTokens } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { useCameraSession } from '@/hooks/use-camera-session';
import { t } from '@/i18n';
import type { FilmLook } from '@/lib/events';
import type { Mission } from '@/lib/missions';
import { latestShotThumb } from '@/lib/my-shots';
import { at } from '@/lib/pair';
import { askForPushOnce } from '@/lib/push';
import { enqueueShot, subscribeToQueue } from '@/lib/upload-queue';
import { pinchZoom, stopAt, stopsForDevice, wideZoom, zoomLabel } from '@/lib/zoom';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** JPEG quality of the capture. The look pass re-encodes; this only has to not lose detail. */
const CAPTURE_QUALITY = 0.92;

const DEV = __DEV__;

/** How long after a shot the notification prompt waits, so it never lands on the shutter animation. */
const PUSH_PROMPT_DELAY_MS = 1200;

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
      <StateScreen onClose={leave} eyebrow={t('camera.noConnection')}>
        <Display size="md">{em(t('camera.cantReachHeadline'))}</Display>
        <Body small>{t('camera.cantReachBody')}</Body>
        <View style={styles.stateActions}>
          <PillButton label={t('common.tryAgain')} onPress={session.reload} />
        </View>
      </StateScreen>
    );
  }

  const { event } = session;

  if (session.developed) {
    return (
      <StateScreen onClose={leave} eyebrow={event.name}>
        <Display size="md">{em(t('camera.developedHeadline'))}</Display>
        <Body small>
          {session.pending > 0
            ? t('camera.developedBodyUploading', { count: session.pending })
            : t('camera.developedBody')}
        </Body>
        <View style={styles.stateActions}>
          <PillButton
            label={t('camera.openAlbum')}
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
        <Display size="md">{em(t('camera.lastPhotoHeadline'))}</Display>
        <Body small>
          {session.pending > 0
            ? t('camera.rollEmptyBodyUploading', { count: session.pending })
            : t('camera.rollEmptyBody')}
        </Body>
        <View style={styles.stateCountdown}>
          <Label small>{t('camera.developedIn')}</Label>
          <EventCountdown endsAt={event.ends_at} />
        </View>
        <View style={styles.stateActions}>
          {/* The album's "developing" state: the count so far, and the host's "develop now". */}
          <PillButton
            label={t('camera.seeFilm')}
            icon="arrow-right"
            onPress={() =>
              router.replace({
                pathname: '/(library)/album/[id]',
                params: { id: event.id },
              })
            }
          />
          <PillButton label={t('camera.backToMoments')} variant="secondary" onPress={leave} />
        </View>
      </StateScreen>
    );
  }

  if (!permission.hasPermission) {
    return (
      <StateScreen onClose={leave} eyebrow={event.name}>
        <Display size="md">{em(t('camera.permissionHeadline'))}</Display>
        <Body small>{t('camera.permissionBody')}</Body>
        <View style={styles.stateActions}>
          <PillButton
            label={permission.canRequestPermission ? t('camera.allowCamera') : t('common.openSettings')}
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
      missions={session.missions}
      onClose={leave}
      onOpenFilm={() =>
        router.push({
          pathname: '/(library)/album/[id]',
          params: { id: event.id },
        })
      }
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
  return t('camera.uploading', { count: pending });
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
        <CircleIconButton glass icon="x" accessibilityLabel={t('camera.backToMoments')} onPress={onClose} />
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
  /** The guest's missions, queued tags applied. Empty: no capsule, no intro. */
  missions: Mission[];
  onClose: () => void;
  /** The album's "developing" state: the count so far, and the host's "develop now". */
  onOpenFilm: () => void;
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
  missions,
  onClose,
  onOpenFilm,
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
    // iOS's full processing (Deep Fusion, Smart HDR): the detail the phone's
    // own camera shows. 'balanced' gave up some of it for a quicker shutter.
    qualityPrioritization: 'quality',
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
    The viewfinder fills the screen down to the shutter bar. Its shape is
    measured, and the developed photo is cropped to it (`cropAspect`), so the
    print holds exactly what the frame showed.
  */
  const insets = useSafeAreaInsets();
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const cropAspect = frame.width > 0 && frame.height > 0 ? frame.width / frame.height : undefined;

  /*
    The last photo, for the tile bottom-left. Re-read whenever the queue moves:
    a new shot arrives as a local file, and an uploaded one changes address.
    The old picture stays up until the new one has resolved.
  */
  const [lastShot, setLastShot] = useState<string | null>(null);
  /*
    1.3.0: a new shot flies into the tile (`ShotFlight`). While it is on its
    way the tile keeps its old picture — `holdTile` — and takes the new one
    when the print lands. Not under reduced motion: the tile cross-fades.
  */
  const tile = useRef<ViewInstance>(null);
  const holdTile = useRef(false);
  const flightKey = useRef(0);
  const [flight, setFlight] = useState<{ key: number; uri: string; to: FlightRect } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const read = () =>
      void latestShotThumb(eventId).then((uri) => {
        if (!cancelled && uri && !holdTile.current) setLastShot(uri);
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

  // --- missions -----------------------------------------------------------

  /** The mission the next shot is for. Only an open one counts. */
  const [armedId, setArmedId] = useState<string | null>(null);
  const armed = missions.find((mission) => mission.id === armedId && mission.photoId === null);
  const armedFor = armed?.id ?? null;
  const missionsDone = missions.filter((mission) => mission.photoId !== null).length;
  const [missionSheet, setMissionSheet] = useState<'closed' | 'list' | 'intro'>('closed');

  // The first visit with missions dealt explains them, once per event and phone.
  const introKey = `left:missions-intro:${eventId}`;
  const dealt = missions.length > 0;
  useEffect(() => {
    if (!dealt) return;
    let cancelled = false;
    AsyncStorage.getItem(introKey)
      .then((seen) => {
        if (!cancelled && !seen) setMissionSheet((current) => (current === 'closed' ? 'intro' : current));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dealt, introKey]);

  // Seen once it is closed — by "Got it", a drag, the scrim, or arming a mission from it.
  const closeMissionSheet = useCallback(() => {
    if (missionSheet === 'intro') void AsyncStorage.setItem(introKey, '1').catch(() => {});
    setMissionSheet('closed');
  }, [introKey, missionSheet]);

  const arm = useCallback(
    (mission: Mission) => {
      setArmedId(mission.id);
      closeMissionSheet();
    },
    [closeMissionSheet]
  );

  /** A capture is in flight. A ref: two taps in one frame must not both pass. */
  const busy = useRef(false);

  // --- zoom ---------------------------------------------------------------

  const stops = useMemo(() => (device ? stopsForDevice(device) : []), [device]);
  const zoom = useSharedValue(1);
  /** The stop the zoom sits on; '' while a pinch has it between two. */
  const [selected, setSelected] = useState('');
  /** The pinched zoom, "1.2×" — what the selector shows instead of its stops. */
  const [liveLabel, setLiveLabel] = useState('');

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
    setLiveLabel('');
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
      const next = pinchZoom(pinchFrom.current, e.scale, device);
      zoom.value = next;
      const text = zoomLabel(next, device);
      setLiveLabel((current) => (current === text ? current : text));
      setSelected('');
    });

  // --- shutter ------------------------------------------------------------

  const fire = useCallback(async () => {
    if (busy.current || !ready || !device) return;
    busy.current = true;
    setMissed(false);

    // The last frame of a roll is the one moment that earns more than a tick.
    if (shotsLeft === 1) {
      haptic.success();
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
    /** Read at the press: the mission the guest was looking at when they fired. */
    const missionId = armedFor;
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

      holdTile.current = !reducedMotion && frame.width > 0;
      await enqueueShot({
        eventId,
        userId,
        look,
        // A plain path; the file API wants a URL.
        capturedUri: `file://${picture.filePath}`,
        width: picture.width,
        height: picture.height,
        missionId,
        cropAspect,
      });
      if (holdTile.current) {
        const uri = await latestShotThumb(eventId).catch(() => null);
        const land = (to: FlightRect | null) => {
          if (uri && to && to.width > 0) {
            flightKey.current += 1;
            setFlight({ key: flightKey.current, uri, to });
          } else {
            holdTile.current = false;
            if (uri) setLastShot(uri);
          }
        };
        if (tile.current) {
          tile.current.measureInWindow((x, y, width, height) => land({ x, y, width, height }));
        } else {
          land(null);
        }
      }
      // Shot for it: the mission reads as done (the queue owes its tag) and lets go.
      if (missionId) setArmedId((current) => (current === missionId ? null : current));

      // A frame now exists that will be developed later — the moment to ask
      // whether to say when. Once per run, after the shutter has settled.
      setTimeout(askForPushOnce, PUSH_PROMPT_DELAY_MS);
    } catch (e) {
      // Nothing was queued, so nothing was spent. Say so; the next press is a new frame.
      if (DEV) console.warn(`[camera] shot not taken: ${e}`);
      holdTile.current = false;
      setMissed(true);
      haptic.error();
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
    armedFor,
    cropAspect,
    frame,
  ]);

  /** The print reached the tile: the tile takes the picture, then the print goes. */
  const flightLanded = useCallback((key: number, uri: string) => {
    if (key !== flightKey.current) return;
    holdTile.current = false;
    setLastShot(uri);
    setTimeout(() => {
      setFlight((current) => (current?.key === key ? null : current));
    }, T.flight.lingerMs);
  }, []);

  // --- status -------------------------------------------------------------

  const note = failed
    ? {
        icon: 'alert-circle' as const,
        text: t('camera.noteFailed'),
      }
    : missed
      ? {
          icon: 'alert-circle' as const,
          text: t('camera.noteMissed'),
        }
      : offline
        ? { icon: 'wifi-off' as const, text: t('camera.noteOffline') }
        : null;

  return (
    <Screen padded={false} edges={['bottom']}>
      {/*
        The viewfinder is the screen: it runs under the status bar and down to
        the shutter bar. The header and the controls are laid over it
        (2026-11-18, the user), in the places they had around the old frame.
      */}
      <GestureDetector gesture={pinch}>
        <View
          style={styles.viewfinder}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setFrame({ width, height });
          }}>
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

          {/* Keeps the header's and the controls' text readable over a bright picture. */}
          <LinearGradient
            colors={T.scrim.top}
            style={[styles.scrimTop, { height: insets.top + T.scrim.topHeight }]}
            pointerEvents="none"
          />
          <LinearGradient colors={T.scrim.bottom} style={styles.scrimBottom} pointerEvents="none" />

          <View style={[styles.header, { paddingTop: insets.top + T.header.paddingTop }]}>
            <View style={styles.headerSide}>
              <CircleIconButton
                glass
                icon="x"
                accessibilityLabel={t('camera.backToMoments')}
                onPress={onClose}
              />
            </View>

            <View style={styles.headerCenter}>
              <Label small numberOfLines={1}>
                {eventName}
              </Label>
              <RollCounter shotsLeft={shotsLeft} />
              {dealt ? (
                <MissionCapsule
                  done={missionsDone}
                  total={missions.length}
                  onPress={() => setMissionSheet('list')}
                />
              ) : null}
            </View>

            {/*
              The countdown is the way to the film's "developing" state, as the
              status capsule is on a moment's card. On an unlimited roll the
              roll-empty screen never comes, and this is the only way from here to
              the host's "develop now" (2026-11-16).
            */}
            <View style={[styles.headerSide, styles.headerRight]}>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={t('camera.seeFilm')}
                hitSlop={T.header.countdownHitSlop}
                onPress={onOpenFilm}
                style={styles.headerCountdown}>
                <EventCountdown endsAt={endsAt} />
                <Feather name="chevron-right" size={T.header.chevronSize} color={Colors.textMuted} />
              </PressScale>
            </View>
          </View>

          {armed ? (
            <View
              style={[styles.armedSlot, { top: insets.top + T.header.armedOffset }]}
              pointerEvents="box-none">
              <MissionArmedNote body={armed.body} onDisarm={() => setArmedId(null)} />
            </View>
          ) : null}

          {note ? (
            <View
              style={[styles.note, { bottom: T.controls.height + T.note.inset }]}
              accessibilityLiveRegion="polite">
              <Feather name={note.icon} size={T.note.iconSize} color={T.note.color} />
              <Text style={styles.noteText}>{note.text}</Text>
            </View>
          ) : null}

          {/* Flash · zoom · flip, along the frame's bottom edge. */}
          <View style={styles.controls}>
            <GlassButton
              icon={flash ? 'zap' : 'zap-off'}
              color={at(T.controls.flashColor, flash)}
              accessibilityLabel={flash ? t('camera.flashOn') : t('camera.flashOff')}
              onPress={() => setFlash((on) => !on)}
            />
            {stops.length > 0 || (selected === '' && liveLabel !== '') ? (
              <ZoomSelector
                stops={stops}
                selected={selected}
                live={liveLabel}
                onSelect={(stop) => {
                  zoom.value = stop.zoom;
                  setSelected(stop.label);
                }}
                onReset={() => {
                  if (!device) return;
                  const wide = wideZoom(device);
                  zoom.value = wide;
                  setLiveLabel('');
                  setSelected(stopAt(stops, wide)?.label ?? '');
                }}
              />
            ) : null}
            <GlassButton icon="refresh-cw" accessibilityLabel={t('camera.switchCamera')} onPress={flip} />
          </View>
        </View>
      </GestureDetector>

      <View style={styles.bottom}>
        <View style={styles.bottomSide}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={t('camera.yourPhotos')}
            accessibilityHint={t('camera.yourPhotosHint')}
            hitSlop={8}
            scale={GlassTokens.pressScale}
            onPress={onOpenShots}>
            <View ref={tile} collapsable={false}>
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
            </View>
          </PressScale>
        </View>

        <ShutterButton onFire={fire} disabled={!ready} />

        <View style={[styles.bottomSide, styles.bottomRight]}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={t('camera.invite')}
            accessibilityHint={t('camera.inviteHint')}
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

        {/* 1.3.0: said in words, where it was a cloud and a number beside the invite tile. */}
        {pending > 0 ? (
          <Animated.View
            entering={FadeIn.duration(T.queue.fadeMs)}
            exiting={FadeOut.duration(T.queue.fadeMs)}
            style={styles.queue}
            pointerEvents="none"
            accessible
            accessibilityRole="text"
            accessibilityLabel={uploadingLine(pending)}>
            <Feather name="upload-cloud" size={T.queue.iconSize} color={T.queue.color} />
            <Text style={styles.queueText} numberOfLines={1}>
              {t('camera.uploadingHint', { count: pending })}
            </Text>
          </Animated.View>
        ) : null}
      </View>

      {flight ? (
        <ShotFlight
          key={flight.key}
          uri={flight.uri}
          from={{
            x: (frame.width * (1 - T.flight.size)) / 2,
            y: (frame.height - frame.width * T.flight.size) / 2,
            width: frame.width * T.flight.size,
            height: frame.width * T.flight.size,
          }}
          to={flight.to}
          radius={T.shots.radius}
          onLanded={() => flightLanded(flight.key, flight.uri)}
        />
      ) : null}

      {/* Over the whole screen: an absolute child ignores the safe area's padding. */}
      {missionSheet !== 'closed' && dealt ? (
        <MissionListSheet
          missions={missions}
          armedId={armedFor}
          intro={missionSheet === 'intro'}
          onArm={arm}
          onClose={closeMissionSheet}
        />
      ) : null}
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
  // The frame: the whole screen above the shutter bar, its bottom corners rounded.
  viewfinder: {
    flex: 1,
    borderBottomLeftRadius: T.viewfinder.radius,
    borderBottomRightRadius: T.viewfinder.radius,
    overflow: 'hidden',
    backgroundColor: T.viewfinder.bg,
  },
  scrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  scrimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: T.scrim.bottomHeight,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: T.header.paddingX,
    paddingBottom: T.header.paddingBottom,
  },
  headerSide: {
    width: T.header.sideWidth,
  },
  headerRight: {
    alignItems: 'flex-end',
    // Level with the close button's centre.
    paddingTop: T.header.countdownTop,
  },
  headerCountdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.header.chevronGap,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: T.header.nameGap,
  },
  armedSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: T.header.armedSlotHeight,
  },
  screenFlash: {
    backgroundColor: T.flash.screenColor,
  },
  // Flash · zoom · flip, over the frame's bottom edge.
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: T.controls.height,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: T.controls.paddingX,
    paddingBottom: T.controls.paddingBottom,
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
    gap: T.invite.queueGap,
  },
  // In the bar's bottom padding, so the viewfinder never changes size with it.
  queue: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: T.queue.hintBottom,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.queue.gap,
  },
  queueText: {
    ...Typography.durationPill,
    color: T.queue.color,
  },
});
