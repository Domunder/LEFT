/**
 * 09 · Invite / Share
 *
 * The only place an invite code is ever surfaced. Until the host gets a code out
 * of here, nobody else can reach the event, so both routes in have to work: with
 * an `eventId` param from 05.1, and with nothing at all on a warm start onto this route.
 *
 * The screen offers exactly two ways in, both resolving to the same URL:
 *  - show or save the QR
 *  - send the link through the native share sheet
 *
 * Deviations from the prototype, both in CLAUDE.md's known-conflicts list:
 *  - The artboard's subcopy promises "the code or the link", but its layout shows
 *    no code anywhere. The layout is right and the copy was wrong, so the copy is
 *    reworded to name the QR.
 *  - The back control sits on the right, not the left. The artboard draws a bare
 *    38px spacer in the header, and 05.1 arrives here via `router.replace` — there
 *    is nothing behind to go back to, so the button leaves the flow for 15 (Films)
 *    rather than popping a history that isn't there.
 *
 * The ambient glow lives in (host)/_layout.tsx, which is why this is `transparent`.
 */

import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { PillButton } from '@/components/ui/pill-button';
import { QrCode, QrCodePlaceholder } from '@/components/ui/qr-code';
import { Screen } from '@/components/ui/screen';
import { ShareButton } from '@/components/ui/share-button';
import { Body, Caption, Display, Em, Label } from '@/components/ui/typography';
import { Colors, Invite, Motion, Spacing } from '@/constants/theme';
import { getEvent, listMyEvents, type Event } from '@/lib/events';
import { inviteMessage, inviteUrl } from '@/lib/invite';

const EASING = Easing.bezier(...Motion.bezier).factory();

/** The QR block trails the headline in, as the dial does on 05.1. */
const ENTER_DELAY = { code: 120 } as const;

/**
 * Saving needs a real photo library and a native view to capture — neither exists
 * in a browser, and Expo Go has no view-shot module.
 */
const CAN_SAVE = Platform.OS !== 'web';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; event: Event }
  | { kind: 'error' };

/** What the last "Save QR" attempt did, shown under the buttons. */
type SaveState = { kind: 'idle' | 'saving' } | { kind: 'done' | 'failed'; message: string };

export default function InviteScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [sharing, setSharing] = useState(false);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });

  // Captured rather than the whole screen, so a saved QR is the code on its white
  // card — not a crop of a near-black page that no scanner will read.
  const cardRef = useRef<View>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // 06 passes the id it just created. The dev-skip path passes nothing, so
        // fall back to the newest event this user belongs to — which is also what
        // a warm start onto this route wants.
        const event = eventId ? await getEvent(eventId) : (await listMyEvents())[0];
        if (cancelled) return;
        setState(event ? { kind: 'ready', event } : { kind: 'error' });
      } catch {
        // No session, no network, no Supabase credentials — all land here, and all
        // mean the same thing to this screen: there is no code to show.
        if (!cancelled) setState({ kind: 'error' });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const event = state.kind === 'ready' ? state.event : undefined;
  const url = event ? inviteUrl(event.invite_code) : undefined;

  const handleShare = useCallback(async () => {
    if (!event) return;
    setSharing(true);
    try {
      // RN's own Share — no dependency, and it is the sheet people expect.
      await Share.share({ message: inviteMessage(event.name, event.invite_code) });
    } catch {
      // Dismissing the sheet rejects on some platforms. Nothing to report.
    } finally {
      setSharing(false);
    }
  }, [event]);

  const handleSave = useCallback(async () => {
    if (!event || !CAN_SAVE) return;
    setSave({ kind: 'saving' });

    try {
      // Write-only permission: LEFT adds a file, it never reads the library here.
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        setSave({
          kind: 'failed',
          message: 'Allow photo access in Settings to save the code.',
        });
        return;
      }

      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      setSave({ kind: 'done', message: 'Saved to your photos.' });
    } catch {
      setSave({ kind: 'failed', message: "Couldn't save the code." });
    }
  }, [event]);

  return (
    <Screen transparent style={styles.screen}>
      {/*
        The artboard's header is empty on both sides; the exit lives on the right
        because there is no history behind this screen to pop — see the note above.
        The left spacer keeps the headline at the height every other screen uses.
      */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <CircleIconButton
          icon="x"
          accessibilityLabel="Close, back to your films"
          onPress={() => router.replace('/(library)/films')}
        />
      </View>

      {/*
        Which event this invites to. The artboard has no eyebrow here, but the host
        named the film three screens ago and this is the first time they see it
        confirmed — and with two events in flight it is the only way to tell the
        codes apart. Hidden until it is known, rather than flashing a fallback.
      */}
      {event ? (
        <Label numberOfLines={1} style={styles.eyebrow}>
          {event.name}
        </Label>
      ) : (
        <View style={styles.eyebrowSpacer} />
      )}

      <Display style={styles.headline}>
        Invite your group.{'\n'}
        <Em>Let them in.</Em>
      </Display>

      <Body color={Invite.subcopy} style={styles.subcopy}>
        Show them the QR or send the link —{'\n'}
        once they&rsquo;re in, filming can begin.
      </Body>

      <Animated.View
        entering={FadeInDown.duration(Motion.duration).easing(EASING).delay(ENTER_DELAY.code)}
        style={styles.center}>
        {url ? (
          // The ref goes on a plain wrapper rather than the card: captureRef needs a
          // host view, and it keeps the capture free of the shadow's spill.
          <View ref={cardRef} collapsable={false} style={styles.capture}>
            <QrCode value={url} />
          </View>
        ) : (
          <QrCodePlaceholder style={styles.capture} />
        )}

        <View style={styles.buttonRow}>
          <ShareButton
            label="Share Link"
            icon="link"
            onPress={handleShare}
            disabled={!event}
            busy={sharing}
          />
          <ShareButton
            label="Save QR"
            icon="download"
            onPress={handleSave}
            disabled={!event || !CAN_SAVE}
            busy={save.kind === 'saving'}
          />
        </View>

        {/*
          Reserved whether or not there is anything to say, so the row of buttons
          does not jump when a save finishes. Screen 18's toast would be the better
          home for this, but it is still a static stub with no host or hook.
        */}
        <View style={styles.status}>
          {state.kind === 'error' ? (
            <Caption color={Colors.textFaint}>Sign in to see this event&rsquo;s invite.</Caption>
          ) : save.kind === 'done' || save.kind === 'failed' ? (
            <Caption color={save.kind === 'done' ? Colors.textMuted : Colors.textFaint}>
              {save.message}
            </Caption>
          ) : null}
        </View>
      </Animated.View>

      <PillButton
        label="See who's joined"
        icon="arrow-right"
        onPress={() => router.push('/(host)/group')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: Invite.paddingBottom,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Invite.headerGap,
  },
  headerSpacer: {
    height: Invite.headerHeight,
  },
  eyebrow: {
    marginBottom: Spacing.sm,
  },
  eyebrowSpacer: {
    // Matches the eyebrow's line box plus its gap, so the headline does not shift
    // downward the moment the event name arrives.
    height: Spacing.md,
    marginBottom: Spacing.sm,
  },
  headline: {
    marginBottom: Invite.headlineGap,
  },
  subcopy: {
    marginBottom: Invite.blockGap,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capture: {
    marginBottom: Invite.qrGap,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Invite.button.rowGap,
    alignSelf: 'stretch',
  },
  status: {
    minHeight: Spacing.lg,
    justifyContent: 'center',
  },
});
