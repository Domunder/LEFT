/**
 * 08's QR scanner — a full-screen viewfinder that reads a host's invite code.
 *
 * The user asked for "the phone's camera" here. No app can launch the system
 * Camera app, and a scan there would open the link in a browser rather than
 * handing anything back, so this is the in-app equivalent: the same full-bleed
 * viewfinder, returning the code directly to the join flow.
 *
 * Only accepts LEFT invite URLs. A QR pointing anywhere else is ignored rather
 * than rejected loudly — pointing a viewfinder around a room hits plenty of
 * codes that were never meant for this, and an error toast for each would be
 * noise.
 *
 * **08 opens straight into it** (2026-11-21, the user: on the old sheet it was
 * not clear the QR card could be tapped). A line at the top says what to point
 * at; a glass note at the bottom says the other way in — a link, tapped
 * wherever it arrived. The note is an explanation, not a control.
 *
 * **No black second while the camera starts** (2026-11-21, the user). The
 * screen is a transparent modal: until the camera reports ready, the screen
 * underneath shows through a dark scrim, and the camera fades in over it.
 * While the permission is still being read, nothing asks for it yet.
 */

import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useRef } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Display, Em } from '@/components/ui/typography';
import { Glass, GlassButton } from '@/components/ui/glass';
import { PillButton } from '@/components/ui/pill-button';
import { Colors, JoinSheet, Radii, Spacing } from '@/constants/theme';
import { parseInviteUrl } from '@/lib/invite';

const T = JoinSheet.scanner;

type QrScannerProps = {
  /** Handed the invite code from a scanned LEFT link. */
  onScan: (code: string) => void;
  onClose: () => void;
};

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();

  /*
    The camera fires this continuously while a code is in frame — several times a
    second, all with the same value. Without the latch the first scan navigates
    and the next dozen fire against an unmounting screen.
  */
  const handled = useRef(false);

  const ready = useSharedValue(0);
  const cameraStyle = useAnimatedStyle(() => ({ opacity: ready.value }));

  const handleScan = useCallback(
    ({ data }: { data: string }) => {
      if (handled.current) return;

      const code = parseInviteUrl(data);
      if (!code) return; // Not one of ours. Keep looking.

      handled.current = true;
      onScan(code);
    },
    [onScan]
  );

  return (
    <View style={styles.root}>
      <View style={styles.scrim} pointerEvents="none" />

      {permission === null ? null : permission.granted ? (
        <Animated.View style={[StyleSheet.absoluteFill, cameraStyle]}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleScan}
            onCameraReady={() => {
              ready.value = withTiming(1, { duration: T.cameraFadeMs });
            }}
          />
        </Animated.View>
      ) : (
        <View style={styles.prompt}>
          <Display size="xs">
            Let LEFT <Em>see the code.</Em>
          </Display>
          <Body small>
            {permission?.canAskAgain === false
              ? 'Camera is off. Turn it on in Settings.'
              : 'Only used to read the invite code.'}
          </Body>
          {permission?.canAskAgain !== false ? (
            <PillButton label="Allow camera" onPress={() => void requestPermission()} />
          ) : null}
        </View>
      )}

      {/* The aiming frame. Decoration — the scanner reads the whole viewfinder. */}
      {permission?.granted ? (
        <View style={styles.reticleLayer} pointerEvents="none">
          <View style={styles.reticle} />
        </View>
      ) : null}

      {permission?.granted ? (
        <View style={[styles.title, { top: insets.top + T.titleTop }]} pointerEvents="none">
          <Display size="xs" style={styles.centered}>
            Scan the host&rsquo;s <Em>QR code.</Em>
          </Display>
        </View>
      ) : null}

      <View style={[styles.hintWrap, { bottom: insets.bottom + T.hintBottom }]}>
        <Glass radius={T.hintRadius} weight="bar" style={styles.hint}>
          <Feather name="link" size={T.hintIcon} color={Colors.text} />
          <Body small color={Colors.text} style={styles.hintText}>
            Got a link instead? Just tap it in your messages &mdash; it opens LEFT.
          </Body>
        </Glass>
      </View>

      <View style={[styles.close, { top: insets.top + Spacing.sm }]}>
        <GlassButton icon="x" accessibilityLabel="Close the scanner" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent: the screen below shows through until the camera is ready.
  root: {
    ...StyleSheet.absoluteFill,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: T.scrim,
  },
  prompt: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.screenX,
    gap: Spacing.md,
  },
  reticleLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {
    width: '62%',
    aspectRatio: 1,
    borderRadius: Radii.sheet,
    borderWidth: 1,
    borderColor: Colors.hairlineStrong,
  },
  close: {
    position: 'absolute',
    right: Spacing.screenX,
  },
  title: {
    position: 'absolute',
    left: Spacing.screenX,
    right: Spacing.screenX,
  },
  centered: {
    textAlign: 'center',
  },
  hintWrap: {
    position: 'absolute',
    left: Spacing.screenX,
    right: Spacing.screenX,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.hintGap,
    paddingHorizontal: T.hintPaddingX,
    paddingVertical: T.hintPaddingY,
  },
  hintText: {
    flex: 1,
  },
});
