/**
 * Change image (2026-11-21, the user) — the host replaces the event image at
 * any time: before, during or after the moment. Reached from the moment's menu
 * (a long press on Moments, or the album's •••).
 *
 * The same picker as creation (03.1, `CoverPicker`), started on the current
 * image. Save applies only a real change: a new own photo is uploaded over
 * `photos/{event}/cover.jpg`, a stock picture only renames `events.cover`.
 * The server lets only the host write either.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { CoverPicker } from '@/components/ui/cover-picker';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Spinner } from '@/components/ui/spinner';
import { em } from '@/components/ui/rich';
import { Body, Display, Label } from '@/components/ui/typography';
import { coverFor } from '@/constants/samples';
import { Colors, CoverStep as T, Spacing } from '@/constants/theme';
import { messageFor } from '@/lib/auth-errors';
import { applyCover, useEventCover, type CoverChoice } from '@/lib/event-cover';
import { getEvent, type Event } from '@/lib/events';
import { t } from '@/i18n';

/** The stock picture an event without a choice shows (the seeded fallback). */
function seededKey(eventId: string): string {
  return coverFor(eventId).key;
}

export default function ChangeCoverScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [failed, setFailed] = useState(false);
  const current = useEventCover(event);

  /** What the event shows now — Save compares against it. */
  const [initial, setInitial] = useState<CoverChoice | null>(null);
  const [choice, setChoice] = useState<CoverChoice | null>(null);
  const [own, setOwn] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(library)/films'));

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    getEvent(eventId)
      .then((found) => {
        if (!cancelled) setEvent(found);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // The starting choice, once the event (and an uploaded cover's URL) is known.
  useEffect(() => {
    if (!event || initial) return;
    let start: CoverChoice | null = null;
    if (event.cover === 'upload') {
      if (typeof current === 'string') {
        start = { kind: 'upload', uri: current };
        setOwn(current);
      }
    } else {
      start = { kind: 'sample', key: event.cover ?? seededKey(event.id) };
    }
    if (start) {
      setInitial(start);
      setChoice(start);
    }
  }, [event, current, initial]);

  const changed =
    choice !== null &&
    initial !== null &&
    (choice.kind !== initial.kind ||
      (choice.kind === 'sample' && initial.kind === 'sample' && choice.key !== initial.key) ||
      (choice.kind === 'upload' && initial.kind === 'upload' && choice.uri !== initial.uri));

  async function save() {
    if (!event || !choice || saving) return;
    if (!changed) {
      close();
      return;
    }
    setSaving(true);
    try {
      await applyCover(event.id, choice);
      close();
    } catch (e) {
      Alert.alert(t('host.coverFailed'), messageFor(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen transparent>
      <View style={styles.header}>
        <CircleIconButton icon="x" accessibilityLabel={t('common.close')} onPress={close} />
      </View>

      <Label numberOfLines={1} style={styles.eyebrow}>
        {event?.name ?? ' '}
      </Label>
      <Display size="xl" style={styles.headline}>
        {em(t('host.coverHeadline'))}
      </Display>
      <Body small color={Colors.textDim}>
        {t('host.coverBody')}
      </Body>

      {event && choice ? (
        <CoverPicker
          look={event.look}
          choice={choice}
          onChange={setChoice}
          own={own}
          onOwnPicked={setOwn}
        />
      ) : (
        <View style={styles.center}>
          {failed ? (
            <Body small color={Colors.textDim}>
              {t('host.momentLoadFailed')}
            </Body>
          ) : (
            <Spinner />
          )}
        </View>
      )}

      <PillButton
        label={saving ? t('host.saving') : t('common.save')}
        disabled={!choice || saving}
        onPress={() => void save()}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: T.headerGap,
  },
  eyebrow: {
    marginBottom: T.eyebrowGap,
  },
  headline: {
    marginBottom: T.headlineGap,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.screenBottom,
  },
});
