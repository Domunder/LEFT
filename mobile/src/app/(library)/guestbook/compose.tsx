/**
 * A new guest book entry (1.3.0, step 9) — the last step of all three ways in:
 * after the square camera (`uri` + `look`), after a photo was picked (`uri`),
 * or with nothing, for words alone.
 *
 * The print comes out of a slot at the top, the way an instant camera hands
 * one over: slowly, on a timed curve (nothing here is touched), with a tap of
 * haptics as it lands. What is typed underneath is written on its bottom edge
 * as it is typed. Reduced motion: the print fades in.
 *
 * The picture is prepared once, on arrival (`preparePolaroid()`: square, and
 * in the moment's look for a camera shot), so the print shown is the print
 * saved.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { PillButton } from '@/components/ui/pill-button';
import { Polaroid } from '@/components/ui/polaroid';
import { em } from '@/components/ui/rich';
import { Screen } from '@/components/ui/screen';
import { Spinner } from '@/components/ui/spinner';
import { TextField } from '@/components/ui/text-field';
import { Caption, Display } from '@/components/ui/typography';
import { LOOK_RECIPES } from '@/constants/looks';
import { Guestbook, Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { messageFor } from '@/lib/auth-errors';
import type { FilmLook } from '@/lib/events';
import {
  addGuestbookEntry,
  GUESTBOOK_NOTE_MAX,
  preparePolaroid,
  type PreparedPolaroid,
} from '@/lib/guestbook';
import { haptic } from '@/lib/haptics';

const T = Guestbook.compose;

export default function GuestbookComposeScreen() {
  const router = useRouter();
  const { eventId, uri, look } = useLocalSearchParams<{
    eventId?: string;
    uri?: string;
    look?: string;
  }>();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const source = typeof uri === 'string' && uri.length > 0 ? uri : null;
  const withPhoto = source !== null;
  const [photo, setPhoto] = useState<PreparedPolaroid | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(library)/films'));

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    const film = look && look in LOOK_RECIPES ? (look as FilmLook) : null;
    preparePolaroid(source, film)
      .then((prepared) => {
        if (!cancelled) setPhoto(prepared);
      })
      .catch((e) => {
        if (!cancelled) setFailed(messageFor(e));
      });
    return () => {
      cancelled = true;
    };
  }, [source, look]);

  // --- the print coming out of the slot ---
  const ready = !withPhoto || photo !== null;
  const [height, setHeight] = useState(0);
  /** 0 = still inside the slot, 1 = out. */
  const out = useSharedValue(0);
  const measured = height > 0;

  useEffect(() => {
    if (!ready || !measured) return;
    out.value = withTiming(
      1,
      { duration: reduceMotion ? T.fadeMs : T.ejectMs, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) scheduleOnRN(haptic.tap);
      }
    );
  }, [ready, measured, out, reduceMotion]);

  const print = useAnimatedStyle(
    () => ({
      opacity: reduceMotion ? out.value : height === 0 ? 0 : 1,
      transform: [{ translateY: reduceMotion ? 0 : (out.value - 1) * (height + T.slotHeight) }],
    }),
    [reduceMotion, height]
  );

  const trimmed = note.trim();
  const canSave = ready && !failed && !saving && !!eventId && (withPhoto || trimmed.length > 0);

  async function save() {
    if (!canSave || !eventId) return;
    setSaving(true);
    try {
      await addGuestbookEntry({ eventId, note: trimmed, photo });
      haptic.success();
      close();
    } catch (e) {
      haptic.error();
      Alert.alert(t('album.guestbookSaveFailed'), messageFor(e));
      setSaving(false);
    }
  }

  const printWidth = width * T.width;
  const shownNote =
    trimmed.length > 0 ? trimmed : withPhoto ? null : t('album.guestbookNotePlaceholder');

  return (
    <Screen transparent>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <CircleIconButton icon="x" accessibilityLabel={t('common.close')} onPress={close} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Display size="md">
            {em(t(withPhoto ? 'album.guestbookComposeHeadline' : 'album.guestbookNoteHeadline'))}
          </Display>

          <View style={styles.printer}>
            <View style={[styles.slot, { width: printWidth + 2 * T.slotOverhang }]} />
            {/* The window the print slides into view through. */}
            <View style={[styles.window, { minHeight: printWidth }]}>
              {failed ? (
                <Caption>{failed}</Caption>
              ) : !ready ? (
                <Spinner />
              ) : (
                <Animated.View
                  style={print}
                  onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
                  <Polaroid width={printWidth} photoUri={photo?.uri ?? null} note={shownNote} />
                </Animated.View>
              )}
            </View>
          </View>

          <TextField
            label={t('album.guestbookNoteLabel')}
            value={note}
            onChangeText={setNote}
            placeholder={t('album.guestbookNotePlaceholder')}
            maxLength={GUESTBOOK_NOTE_MAX}
            multiline
            editable={!saving}
          />
          <Caption style={styles.count}>
            {note.length}/{GUESTBOOK_NOTE_MAX}
          </Caption>
        </ScrollView>

        <PillButton
          label={saving ? t('album.guestbookSaving') : t('album.guestbookSave')}
          disabled={!canSave}
          onPress={() => void save()}
          style={styles.cta}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Guestbook.headerGap,
  },
  content: {
    paddingBottom: T.gap,
  },
  printer: {
    alignItems: 'center',
    marginTop: T.gap,
    marginBottom: T.gap,
  },
  slot: {
    height: T.slotHeight,
    borderRadius: T.slotHeight / 2,
    backgroundColor: T.slotColor,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.slotBorder,
    zIndex: 1,
  },
  // Padded at the sides and below so the print's shadow is not cut.
  window: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: T.windowPad,
    paddingBottom: T.windowPad,
    marginTop: -T.slotHeight / 2,
    paddingTop: T.slotHeight / 2,
  },
  count: {
    alignSelf: 'flex-end',
    marginTop: T.countTop,
  },
  cta: {
    marginTop: T.countTop,
    marginBottom: Spacing.screenBottom,
  },
});
