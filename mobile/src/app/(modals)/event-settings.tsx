/**
 * Event settings (1.3.0, the plan's step 7) — one sheet for the host, in place
 * of the menu's "Rename" and "Change image". Opened from a moment's menu.
 *
 *  - **Name** — saved when the field is left.
 *  - **Ends** — an hour earlier or later, or a day later, while the event is
 *    not over (`set_event_end()`: in the future, at most `max_event_days()`
 *    ahead). Each tap is saved at once.
 *  - **Invitation** — on to the designer (`(host)/cover`).
 *  - **Photos show** — the reveal mode, only before the start
 *    (`set_event_reveal()`); after it the choice is shown, not offered.
 *  - **Guest book** — on or off, at any time (`set_event_guestbook()`).
 *
 * The look is not here: it is baked into every JPEG at capture. Deleting stays
 * in the menu, behind its own alert. Everything is enforced by the server; a
 * guest who reached this route would be refused by every call.
 */

import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { ChoicePillButton } from '@/components/ui/choice-pill';
import { PressScale } from '@/components/ui/press-scale';
import { Sheet } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { TextField } from '@/components/ui/text-field';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Body, Caption, Display, Label } from '@/components/ui/typography';
import { Colors, EventSettings as T } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { t, type TKey } from '@/i18n';
import { messageFor } from '@/lib/auth-errors';
import { formatEndDate, formatEndTime, formatTimeUntil } from '@/lib/event-end';
import {
  getEvent,
  isDeveloped,
  renameEvent,
  REVEAL_DELAYS,
  revealModeOf,
  setEventEnd,
  setEventReveal,
  type Event,
  type RevealChoice,
  type RevealMode,
} from '@/lib/events';
import { setEventGuestbook } from '@/lib/guestbook';
import { haptic } from '@/lib/haptics';

const HOUR = 3_600_000;

/** The end moves by these, in hours. */
const END_STEPS: readonly { hours: number; labelKey: TKey }[] = [
  { hours: -1, labelKey: 'host.settingsEndMinusHour' },
  { hours: 1, labelKey: 'host.settingsEndPlusHour' },
  { hours: 24, labelKey: 'host.settingsEndPlusDay' },
];

const MODES: readonly { mode: RevealMode; labelKey: TKey }[] = [
  { mode: 'end', labelKey: 'onboarding.revealEnd' },
  { mode: 'delayed', labelKey: 'onboarding.revealDelayed' },
  { mode: 'live', labelKey: 'onboarding.revealLive' },
];

const DELAY_KEYS: Record<(typeof REVEAL_DELAYS)[number], TKey> = {
  12: 'onboarding.revealDelay12',
  24: 'onboarding.revealDelay24',
  72: 'onboarding.revealDelay72',
  168: 'onboarding.revealDelay168',
};

/** The earliest end "an hour earlier" may produce: not within minutes of now. */
const MIN_AHEAD_MS = 10 * 60_000;

export default function EventSettingsScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(library)/films'));

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    getEvent(eventId)
      .then((found) => {
        if (cancelled) return;
        setEvent(found);
        setName(found.name);
      })
      .catch((e) => {
        if (!cancelled) setError(messageFor(e));
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  /** One change at a time; a failure says why and leaves what was. */
  async function change(run: (current: Event) => Promise<Event>) {
    if (!event || busy) return;
    setBusy(true);
    setError(null);
    try {
      setEvent(await run(event));
      haptic.select();
    } catch (e) {
      haptic.error();
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  function saveName() {
    const trimmed = name.trim();
    if (!event || trimmed === event.name) return;
    if (trimmed.length === 0) {
      setName(event.name);
      return;
    }
    void change(async (current) => {
      await renameEvent(current.id, trimmed);
      return { ...current, name: trimmed };
    });
  }

  function moveEnd(hours: number) {
    void change((current) =>
      setEventEnd(current.id, new Date(new Date(current.ends_at).getTime() + hours * HOUR)),
    );
  }

  function setReveal(choice: RevealChoice) {
    void change(async (current) => {
      await setEventReveal(current.id, choice);
      return { ...current, reveal_mode: choice.mode, reveal_delay_hours: choice.delayHours };
    });
  }

  // Read per render, as 04 does: the steps go invalid on their own.
  const earliest = new Date().getTime() + MIN_AHEAD_MS;
  const over = event ? isDeveloped(event) : false;
  const ends = event ? new Date(event.ends_at) : null;
  const until = ends ? formatTimeUntil(ends) : null;
  const mode = event ? revealModeOf(event) : 'end';
  const canSetReveal = event?.status === 'setup';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Sheet onDismiss={close} locked={busy}>
        <Display size="xs">{t('host.settingsTitle')}</Display>

        {!event ? (
          <View style={styles.loading}>
            {error ? (
              <Body small color={Colors.textDim}>
                {error}
              </Body>
            ) : (
              <Spinner />
            )}
          </View>
        ) : (
          <>
            <TextField
              label={t('host.settingsName')}
              value={name}
              onChangeText={setName}
              onBlur={saveName}
              onSubmitEditing={saveName}
              returnKeyType="done"
              maxLength={120}
              editable={!busy}
            />

            <View style={styles.section}>
              <Label small>{t('host.settingsEnds')}</Label>
              <Text style={styles.value}>
                {ends ? `${formatEndDate(ends)} · ${formatEndTime(ends)}` : ''}
              </Text>
              {over || until === null ? (
                <Caption>{t('host.settingsEndOver')}</Caption>
              ) : (
                <>
                  <Caption>{until}</Caption>
                  <View style={styles.pills}>
                    {END_STEPS.map(({ hours, labelKey }) => (
                      <ChoicePillButton
                        key={hours}
                        label={t(labelKey)}
                        disabled={
                          busy ||
                          (ends !== null && ends.getTime() + hours * HOUR < earliest)
                        }
                        onPress={() => moveEnd(hours)}
                      />
                    ))}
                  </View>
                </>
              )}
            </View>

            <View style={styles.section}>
              <Label small>{t('host.settingsReveal')}</Label>
              {canSetReveal ? (
                <>
                  <View style={styles.pills}>
                    {MODES.map((option) => (
                      <ChoicePillButton
                        key={option.mode}
                        label={t(option.labelKey)}
                        selected={mode === option.mode}
                        disabled={busy}
                        onPress={() => {
                          if (mode === option.mode) return;
                          setReveal({
                            mode: option.mode,
                            delayHours: option.mode === 'delayed' ? REVEAL_DELAYS[0] : null,
                          });
                        }}
                      />
                    ))}
                  </View>
                  {mode === 'delayed' ? (
                    <View style={styles.pills}>
                      {REVEAL_DELAYS.map((hours) => (
                        <ChoicePillButton
                          key={hours}
                          label={t(DELAY_KEYS[hours])}
                          selected={event.reveal_delay_hours === hours}
                          disabled={busy}
                          onPress={() => setReveal({ mode: 'delayed', delayHours: hours })}
                        />
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.value}>
                    {t(MODES.find((option) => option.mode === mode)!.labelKey)}
                  </Text>
                  <Caption>{t('host.settingsRevealFixed')}</Caption>
                </>
              )}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.rowLabel}>{t('host.settingsGuestbook')}</Text>
              <ToggleSwitch
                value={event.guestbook}
                disabled={busy}
                accessibilityLabel={t('host.settingsGuestbook')}
                onValueChange={(next) =>
                  void change((current) => setEventGuestbook(current.id, next))
                }
              />
            </View>

            <PressScale
              accessibilityRole="button"
              onPress={() => {
                router.replace({ pathname: '/(host)/cover', params: { eventId: event.id } });
              }}
              style={styles.row}>
              <Feather name="image" size={T.rowIcon} color={Colors.textMuted} />
              <Text style={styles.rowLabel}>{t('host.settingsInvitation')}</Text>
              <Feather name="chevron-right" size={T.rowIcon} color={Colors.textFaint} />
            </PressScale>

            {/* Reserved, so the sheet does not change height when a call fails. */}
            <View style={styles.error}>
              {error ? <Caption color={Colors.gold}>{error}</Caption> : null}
            </View>
          </>
        )}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loading: {
    minHeight: T.loadingHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: T.sectionGap,
    marginTop: T.sectionTop,
  },
  value: {
    ...Typography.groupHeading,
    color: Colors.text,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.pillGap,
    marginTop: T.pillTop,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.rowGap,
    paddingVertical: T.rowPaddingY,
    marginTop: T.sectionTop,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.hairlineStrong,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: T.switchTop,
  },
  rowLabel: {
    ...Typography.settingsRow,
    color: Colors.text,
    flex: 1,
  },
  error: {
    minHeight: T.errorHeight,
  },
});
