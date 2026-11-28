'use no memo';

/**
 * The guest book's camera (1.3.0, step 9) — a square viewfinder that opens on
 * the front camera, for a polaroid of yourself. One shot, then on to the
 * composer, which shows the print and takes the note.
 *
 * It is the roll camera's viewfinder (`FilmCamera`, in the moment's look) with
 * almost everything taken away: no roll, no queue, no flash, no zoom. The
 * capture is a file handed to `(library)/guestbook/compose`; nothing here
 * touches the roll.
 *
 * `'use no memo'` and stable callbacks, for the reasons `camera.tsx` gives:
 * the React Compiler breaks what is handed to the camera hooks. Readiness is
 * the same rule as there — running *and* configured for the selected camera.
 */

import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { FilmCamera } from '@/components/ui/film-camera';
import { PillButton } from '@/components/ui/pill-button';
import { em } from '@/components/ui/rich';
import { Screen } from '@/components/ui/screen';
import { ShutterButton } from '@/components/ui/shutter-button';
import { Spinner } from '@/components/ui/spinner';
import { Body, Display } from '@/components/ui/typography';
import { DEFAULT_LOOK, LOOK_RECIPES } from '@/constants/looks';
import { Guestbook, Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import type { FilmLook } from '@/lib/events';
import { haptic } from '@/lib/haptics';

const T = Guestbook.camera;

export default function PolaroidCameraScreen() {
  const router = useRouter();
  const { eventId, look } = useLocalSearchParams<{ eventId?: string; look?: string }>();
  const permission = useCameraPermission();
  const { requestPermission } = permission;
  const canAsk = !permission.hasPermission && permission.canRequestPermission;

  useEffect(() => {
    if (canAsk) void requestPermission();
  }, [canAsk, requestPermission]);

  const close = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/(library)/films')),
    [router]
  );
  const film: FilmLook = look && look in LOOK_RECIPES ? (look as FilmLook) : DEFAULT_LOOK;

  return (
    <Screen>
      <View style={styles.header}>
        <CircleIconButton icon="x" accessibilityLabel={t('common.close')} onPress={close} />
      </View>

      {!permission.hasPermission ? (
        <View style={styles.state}>
          <Display size="md">{em(t('camera.permissionHeadline'))}</Display>
          <Body small>{t('camera.permissionBody')}</Body>
          <PillButton
            label={
              permission.canRequestPermission ? t('camera.allowCamera') : t('common.openSettings')
            }
            onPress={() =>
              permission.canRequestPermission
                ? void requestPermission()
                : void Linking.openSettings()
            }
          />
        </View>
      ) : eventId ? (
        <SquareCamera eventId={eventId} look={film} />
      ) : null}
    </Screen>
  );
}

function SquareCamera({ eventId, look }: { eventId: string; look: FilmLook }) {
  const router = useRouter();
  const focused = useIsFocused();
  const { width } = useWindowDimensions();

  const [position, setPosition] = useState<'front' | 'back'>('front');
  const [running, setRunning] = useState(false);
  const [configuredFor, setConfiguredFor] = useState<string | null>(null);
  const [missed, setMissed] = useState(false);
  const busy = useRef(false);

  const device = useCameraDevice(position);
  const photoOutput = usePhotoOutput({
    containerFormat: 'jpeg',
    quality: T.quality,
    qualityPrioritization: 'quality',
  });
  const zoom = useSharedValue(1);

  const deviceId = device?.id;
  const selected = useRef(deviceId);
  selected.current = deviceId;
  const handleConfigured = useCallback(() => setConfiguredFor(selected.current ?? null), []);
  const handleStarted = useCallback(() => setRunning(true), []);
  const handleStopped = useCallback(() => setRunning(false), []);
  const ready = running && deviceId !== undefined && configuredFor === deviceId;

  // A change of camera is unconfigured until `onConfigured` says otherwise.
  useEffect(() => {
    setConfiguredFor(null);
  }, [device]);

  const flip = useCallback(() => {
    haptic.select();
    setPosition((current) => (current === 'front' ? 'back' : 'front'));
  }, []);

  const fire = useCallback(async () => {
    if (!ready || busy.current) return;
    busy.current = true;
    setMissed(false);
    try {
      const picture = await photoOutput.capturePhotoToFile(
        { flashMode: 'off', enableShutterSound: false },
        {}
      );
      // Replaced, not pushed: closing the composer returns to the guest book.
      router.replace({
        pathname: '/(library)/guestbook/compose',
        params: { eventId, look, uri: `file://${picture.filePath}` },
      });
    } catch (e) {
      if (__DEV__) console.warn(`[polaroid] shot not taken: ${e}`);
      setMissed(true);
      haptic.error();
      busy.current = false;
    }
  }, [ready, photoOutput, router, eventId, look]);

  const onFire = useCallback(() => void fire(), [fire]);
  const side = width - 2 * Spacing.screenX;

  return (
    <View style={styles.body}>
      <View style={[styles.frame, { width: side, height: side }]}>
        {device ? (
          <FilmCamera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={focused}
            look={look}
            photoOutput={photoOutput}
            zoom={zoom}
            onConfigured={handleConfigured}
            onStarted={handleStarted}
            onStopped={handleStopped}
          />
        ) : (
          <Spinner />
        )}
      </View>

      <Body small style={styles.note}>
        {missed ? t('camera.noteMissed') : t('album.guestbookCameraNote')}
      </Body>

      <View style={styles.controls}>
        <View style={styles.side} />
        <ShutterButton onFire={onFire} disabled={!ready} />
        <View style={[styles.side, styles.sideRight]}>
          <CircleIconButton
            icon="refresh-cw"
            accessibilityLabel={t('camera.switchCamera')}
            onPress={flip}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Guestbook.headerGap,
  },
  state: {
    flex: 1,
    justifyContent: 'center',
    gap: T.gap,
  },
  body: {
    flex: 1,
    justifyContent: 'space-between',
  },
  frame: {
    borderRadius: T.radius,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.frameBg,
  },
  note: {
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.screenBottom,
  },
  side: {
    width: T.sideWidth,
  },
  sideRight: {
    alignItems: 'flex-end',
  },
});
