/**
 * The guest book (1.3.0, step 9) — reached from the book button in an album's
 * top bar, before and after the film is developed.
 *
 * Polaroids and notes, two to a row and slightly askew, newest first. Everyone
 * in the moment sees every entry at once: the guest book is not part of the
 * reveal. The plus offers three ways in — the square camera, a photo from the
 * phone, or just words — until the viewer's three entries are used
 * (`add_guestbook_entry()` is the judge). A tap opens an entry large; its
 * author or the host can delete it there, anyone else can report it.
 *
 * Re-read on focus and every `Guestbook.pollMs` while open: no realtime.
 *
 * **Flagged:** the plan said "a tab in the album". The album is one route with
 * two quite different states, so the book is its own screen behind a button in
 * the album's bar instead.
 */

import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { GlassButton } from '@/components/ui/glass';
import { PillButton } from '@/components/ui/pill-button';
import { Polaroid } from '@/components/ui/polaroid';
import { PressScale } from '@/components/ui/press-scale';
import { em } from '@/components/ui/rich';
import { Screen } from '@/components/ui/screen';
import { Spinner } from '@/components/ui/spinner';
import { Body, Caption, Display } from '@/components/ui/typography';
import { Colors, Guestbook as T, Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { messageFor } from '@/lib/auth-errors';
import {
  deleteGuestbookEntry,
  GUESTBOOK_LIMIT,
  loadGuestbook,
  reportGuestbookEntry,
  type Guestbook,
  type GuestbookEntry,
} from '@/lib/guestbook';
import { haptic } from '@/lib/haptics';
import { pickOnePhoto } from '@/lib/import-photos';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; book: Guestbook };

export default function GuestbookScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { width } = useWindowDimensions();

  const [state, setState] = useState<State>({ kind: 'loading' });
  const [open, setOpen] = useState<GuestbookEntry | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const book = await loadGuestbook(id);
      setState({ kind: 'ready', book });
    } catch (e) {
      // A failed refresh keeps what is on screen.
      setState((current) =>
        current.kind === 'ready' ? current : { kind: 'error', message: messageFor(e) }
      );
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), T.pollMs);
      return () => clearInterval(timer);
    }, [load])
  );

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(library)/films'));
  const book = state.kind === 'ready' ? state.book : null;
  const canAdd = book !== null && book.event.guestbook && book.left > 0;

  function add() {
    if (!book) return;
    const eventId = book.event.id;
    const items = [
      {
        label: t('album.guestbookTake'),
        run: () =>
          router.push({
            pathname: '/(capture)/polaroid',
            params: { eventId, look: book.event.look },
          }),
      },
      {
        label: t('album.guestbookPick'),
        run: () =>
          void pickOnePhoto().then((uri) => {
            if (uri) {
              router.push({ pathname: '/(library)/guestbook/compose', params: { eventId, uri } });
            }
          }),
      },
      {
        label: t('album.guestbookWrite'),
        run: () => router.push({ pathname: '/(library)/guestbook/compose', params: { eventId } }),
      },
    ];

    if (Platform.OS === 'ios') {
      const labels = [...items.map((item) => item.label), t('common.cancel')];
      ActionSheetIOS.showActionSheetWithOptions(
        { options: labels, cancelButtonIndex: labels.length - 1, userInterfaceStyle: 'dark' },
        (index) => items[index]?.run()
      );
      return;
    }
    Alert.alert(t('album.guestbookAdd'), undefined, [
      ...items.map((item) => ({ text: item.label, onPress: item.run })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  }

  function confirmDelete(entry: GuestbookEntry) {
    if (!book) return;
    Alert.alert(t('album.guestbookDeleteTitle'), t('album.guestbookDeleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteGuestbookEntry(book.event.id, entry)
            .then(() => {
              setOpen(null);
              return load();
            })
            .catch((e) => Alert.alert(t('album.guestbookDeleteFailed'), messageFor(e)));
        },
      },
    ]);
  }

  function confirmReport(entry: GuestbookEntry) {
    Alert.alert(t('album.guestbookReportTitle'), t('album.reportBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('album.report'),
        style: 'destructive',
        onPress: () => {
          reportGuestbookEntry(entry.id)
            .then(() => {
              setOpen(null);
              Alert.alert(t('album.reported'));
            })
            .catch((e) => Alert.alert(t('album.guestbookReportTitle'), messageFor(e)));
        },
      },
    ]);
  }

  const column = (width - 2 * Spacing.screenX - T.grid.gap) / 2;
  const someone = t('album.guestbookSomeone');

  return (
    <Screen transparent edges={['top']}>
      <Stack.Screen options={{ gestureEnabled: open === null }} />

      <View style={styles.header}>
        <CircleIconButton icon="chevron-left" accessibilityLabel={t('common.back')} onPress={close} />
        {canAdd ? (
          <CircleIconButton icon="plus" accessibilityLabel={t('album.guestbookAdd')} onPress={add} />
        ) : null}
      </View>

      {!book ? (
        <View style={styles.center}>
          {state.kind === 'error' ? (
            <>
              <Body small color={Colors.textDim}>
                {t('album.guestbookLoadFailed')}
              </Body>
              <Caption>{state.message}</Caption>
            </>
          ) : (
            <Spinner />
          )}
        </View>
      ) : (
        <FlatList
          data={book.entries}
          keyExtractor={(entry) => entry.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.intro}>
              <Display size="md">{em(t('album.guestbookHeadline'))}</Display>
              <Body small color={Colors.textDim}>
                {!book.event.guestbook
                  ? t('album.guestbookOff')
                  : book.left > 0
                    ? `${t('album.guestbookBody')} ${t('album.guestbookLeft', { count: book.left })}`
                    : t('album.guestbookFull', { count: GUESTBOOK_LIMIT })}
              </Body>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Body small color={Colors.textDim}>
                {t('album.guestbookEmpty')}
              </Body>
              {canAdd ? (
                <PillButton label={t('album.guestbookAdd')} icon="plus" onPress={add} />
              ) : null}
            </View>
          }
          renderItem={({ item, index }) => (
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={`${item.author ?? someone}${item.note ? `: ${item.note}` : ''}`}
              onPress={() => {
                haptic.select();
                setOpen(item);
              }}>
              <Polaroid
                width={column}
                photoUri={item.photoUri}
                note={item.note}
                author={item.author ?? someone}
                tilt={T.tilt[index % T.tilt.length]}
                noteLines={T.grid.noteLines}
              />
            </PressScale>
          )}
        />
      )}

      {/* An entry, large. A Modal so it covers the header too. */}
      <Modal
        visible={open !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(null)}>
        <Pressable
          style={styles.scrim}
          accessibilityLabel={t('common.close')}
          onPress={() => setOpen(null)}>
          {open ? (
            <ScrollView
              style={styles.detailScroll}
              contentContainerStyle={styles.detail}
              showsVerticalScrollIndicator={false}>
              {/* Taps on the print itself do not close it. */}
              <Pressable>
                <Polaroid
                  width={width - 2 * T.detail.inset}
                  photoUri={open.photoUri}
                  note={open.note}
                  author={open.author ?? someone}
                />
              </Pressable>
              <View style={styles.detailActions}>
                {open.mine || book?.isHost ? (
                  <GlassButton
                    icon="trash-2"
                    accessibilityLabel={t('album.guestbookDeleteA11y')}
                    onPress={() => confirmDelete(open)}
                  />
                ) : (
                  <GlassButton
                    icon="flag"
                    accessibilityLabel={t('album.guestbookReportA11y')}
                    onPress={() => confirmReport(open)}
                  />
                )}
                <GlassButton
                  icon="x"
                  accessibilityLabel={t('common.close')}
                  onPress={() => setOpen(null)}
                />
              </View>
            </ScrollView>
          ) : null}
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: T.headerGap,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.introGap,
  },
  list: {
    paddingBottom: T.grid.paddingBottom,
  },
  row: {
    gap: T.grid.gap,
    marginBottom: T.grid.gap,
    alignItems: 'flex-start',
  },
  intro: {
    gap: T.introGap,
    marginBottom: T.introBottom,
  },
  empty: {
    gap: T.introBottom,
    marginTop: T.introBottom,
  },
  scrim: {
    flex: 1,
    backgroundColor: T.detail.scrim,
  },
  detailScroll: {
    flex: 1,
  },
  detail: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: T.detail.inset * 2,
    gap: T.detail.gap,
  },
  detailActions: {
    flexDirection: 'row',
    gap: T.detail.actionGap,
  },
});
