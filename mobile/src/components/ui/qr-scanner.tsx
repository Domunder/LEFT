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
 */

import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Display, Em } from '@/components/ui/typography';
import { PillButton } from '@/components/ui/pill-button';
import { Colors, JoinSheet, Radii, Spacing } from '@/constants/theme';
import { parseInviteUrl } from '@/lib/invite';

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
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleScan}
        />
      ) : (
        <View style={styles.prompt}>
          <Display size="xs">
            Let LEFT <Em>see the code.</Em>
          </Display>
          <Body small>
            {permission?.canAskAgain === false
              ? 'Camera access is off for LEFT. Turn it on in Settings to scan an invite.'
              : 'The camera is only used to read the invite code — nothing is recorded here.'}
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close the scanner"
        onPress={onClose}
        style={({ pressed }) => [
          styles.close,
          { top: insets.top + Spacing.sm },
          pressed && styles.pressed,
        ]}>
        <Feather name="x" size={16} color={Colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bg,
  },
  prompt: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.screenX,
    gap: Spacing.md,
  },
  reticleLayer: {
    ...StyleSheet.absoluteFillObject,
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
    width: JoinSheet.closeSize,
    height: JoinSheet.closeSize,
    borderRadius: JoinSheet.closeSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.hairline,
    backgroundColor: Colors.glassButton,
  },
  pressed: {
    opacity: 0.6,
  },
});
