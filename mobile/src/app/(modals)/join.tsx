/**
 * 08 · Join Group Sheet
 *
 * How a guest without an invite link gets in. There are two ways into an event,
 * and this screen is the one for people who arrived with nothing:
 *
 *  - **scan the host's QR** — opens a viewfinder, reads the code, straight to 11
 *  - **a shared link** — explained here, but it does not pass through this
 *    screen at all: +native-intent.ts sends a tapped link directly to 11, which
 *    already has the code
 *
 * **There is no manual code entry.** CLAUDE.md left that explicitly open
 * ("whether 08 offers typing it is 08's call") and this is the call: the
 * artboard draws no field, and both real paths carry the code themselves. The
 * six-character code still exists and still travels in the share message — it is
 * what a host reads aloud — but nothing in the app asks anyone to type it.
 *
 * The "Shared Link" row is deliberately inert, as drawn. It is an explanation of
 * how the other path works, not a control.
 *
 * This screen never calls joinEvent(): `join_event(code, name)` needs a name,
 * and the name is screen 11's job. 08 only obtains a code and forwards it —
 * to `/(guest)/name`, group and all, because `(auth)/name` claims the bare
 * `/name` and would try to save the name with no session behind it.
 */

import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackgroundVideo } from '@/components/ui/background-video';
import { GlassPanel } from '@/components/ui/glass-panel';
import { QrScanner } from '@/components/ui/qr-scanner';
import { Body, Caption, Display, Em, Label } from '@/components/ui/typography';
import { Colors, JoinSheet, Radii, VideoOverlay } from '@/constants/theme';

/**
 * Scanning needs a real camera. There is none in a browser — same guard 09 uses
 * for "Save QR", and the same treatment: the affordance stays visible, but it
 * says why rather than being a dead tap.
 */
const CAN_SCAN = Platform.OS !== 'web';

export default function JoinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { code } = useLocalSearchParams<{ code?: string }>();

  const [scanning, setScanning] = useState(false);

  /*
    A code in the params means the guest tapped a link and expo-router happened
    to route them here rather than to 11. Nothing on this screen has anything
    left to ask, so pass it straight on. `replace` so Back does not land them on
    a sheet they never chose to open.
  */
  useEffect(() => {
    if (code) router.replace({ pathname: '/(guest)/name', params: { code } });
  }, [code, router]);

  const handleScan = useCallback(
    (scanned: string) => {
      setScanning(false);
      router.replace({ pathname: '/(guest)/name', params: { code: scanned } });
    },
    [router]
  );

  if (scanning) {
    return <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />;
  }

  return (
    <View style={styles.root}>
      <BackgroundVideo opacity={VideoOverlay.videoOpacity} />
      <View style={styles.scrim} pointerEvents="none" />

      <GlassPanel
        style={styles.panel}
        contentStyle={[
          styles.panelContent,
          { paddingBottom: insets.bottom + JoinSheet.paddingBottom },
        ]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Display size="xs">
              <Em>Join</Em> a group.
            </Display>
            <Body small style={styles.subcopy}>
              Get access from whoever created the film.
            </Body>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Feather name="x" size={16} color={Colors.textMuted} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan a QR code"
          accessibilityState={{ disabled: !CAN_SCAN }}
          disabled={!CAN_SCAN}
          onPress={() => setScanning(true)}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          <View style={styles.ring}>
            <Feather name="grid" size={JoinSheet.card.glyphSize} color={Colors.iconGlass} />
          </View>
          <Body color={Colors.text} style={styles.cardTitle}>
            Scan QR Code
          </Body>
          <Body small color={Colors.textDim} style={styles.centered}>
            {CAN_SCAN
              ? 'Ask the creator to show their QR code\nand scan it with your camera.'
              : 'Scanning needs the LEFT app on a phone.\nTap the invite link instead.'}
          </Body>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.rule} />
          <Label small color={Colors.textGhost}>
            or
          </Label>
          <View style={styles.rule} />
        </View>

        {/*
          Inert by design — the guest cannot act on this here. It explains the
          other way in, which happens outside the app entirely: the link arrives
          in a message and +native-intent.ts routes the tap.
        */}
        <View style={styles.linkRow}>
          <View style={styles.tile}>
            <Feather name="link" size={JoinSheet.linkRow.iconSize} color={Colors.iconGlass} />
          </View>
          <View style={styles.linkText}>
            <Body color={Colors.textMuted} style={styles.linkTitle}>
              Shared Link
            </Body>
            <Caption color={Colors.textGhost}>
              The creator can share a direct link from inside their app. Tap it to join instantly.
            </Caption>
          </View>
        </View>
      </GlassPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.bg,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: JoinSheet.scrim,
  },
  panel: {
    // Pinned flush to the bottom, so only the top corners are rounded.
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  panelContent: {
    paddingTop: JoinSheet.paddingTop,
    paddingHorizontal: JoinSheet.paddingX,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: Radii.pill,
    backgroundColor: Colors.hairlineStrong,
    marginBottom: JoinSheet.handleGap,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: JoinSheet.headerGap,
  },
  headerText: {
    flex: 1,
  },
  subcopy: {
    marginTop: JoinSheet.headlineGap,
  },
  close: {
    width: JoinSheet.closeSize,
    height: JoinSheet.closeSize,
    borderRadius: JoinSheet.closeSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: JoinSheet.closeGap,
    borderWidth: 1,
    borderColor: Colors.hairline,
    backgroundColor: JoinSheet.closeBg,
  },
  card: {
    alignItems: 'center',
    paddingVertical: JoinSheet.card.paddingY,
    paddingHorizontal: JoinSheet.card.paddingX,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: JoinSheet.card.border,
    backgroundColor: JoinSheet.card.bg,
  },
  ring: {
    width: JoinSheet.card.ringSize,
    height: JoinSheet.card.ringSize,
    borderRadius: JoinSheet.card.ringSize / 2,
    borderWidth: 1,
    borderColor: JoinSheet.card.ringBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: JoinSheet.card.ringGap,
  },
  cardTitle: {
    marginBottom: JoinSheet.card.titleGap,
  },
  centered: {
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: JoinSheet.dividerTextGap,
    marginVertical: JoinSheet.dividerGap,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: JoinSheet.dividerColor,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: JoinSheet.linkRow.gap,
    paddingVertical: JoinSheet.linkRow.paddingY,
    paddingHorizontal: JoinSheet.linkRow.paddingX,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: JoinSheet.linkRow.border,
    backgroundColor: JoinSheet.linkRow.bg,
  },
  tile: {
    width: JoinSheet.linkRow.tileSize,
    height: JoinSheet.linkRow.tileSize,
    borderRadius: JoinSheet.linkRow.tileRadius,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: JoinSheet.linkRow.border,
    backgroundColor: JoinSheet.linkRow.tileBg,
  },
  linkText: {
    flex: 1,
  },
  linkTitle: {
    marginBottom: JoinSheet.linkRow.titleGap,
  },
  pressed: {
    opacity: 0.7,
  },
});
