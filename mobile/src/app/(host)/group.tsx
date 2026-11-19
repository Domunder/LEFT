/**
 * 10 · Your Group
 *
 * The host watching their group fill up, and the button that starts filming.
 *
 * The roster is **live**: `subscribeToMembers` re-reads it on every change to
 * `event_members`, so a guest tapping an invite on the other side of the room
 * appears here without the host touching anything. That is the whole point of
 * the screen — a static list would leave the host refreshing a page to find out
 * whether their party had arrived.
 *
 * "Start the Event" is the one thing that moves `events.status` off 'setup'.
 * Screen 12 waits on exactly that transition. It also deals the missions, which
 * is why their row ("Missions · On · 1 per guest", to `(host)/missions`) sits
 * just above it: the list is locked from that tap on. So the tap asks first
 * (2026-11-19, the user): a system alert saying what can no longer change.
 *
 * The ambient glow lives in (host)/_layout.tsx, which is why this is `transparent`.
 */

import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { MemberChip } from '@/components/ui/member-chip';
import { PillButton } from '@/components/ui/pill-button';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StatusPill } from '@/components/ui/status-pill';
import { Body, Display, Em, Label } from '@/components/ui/typography';
import { Colors, Group, MissionsEditor, Press, Spacing } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import {
  getEvent,
  listMembers,
  listMyEvents,
  startEvent,
  subscribeToMembers,
  type Event,
  type EventMember,
} from '@/lib/events';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; event: Event }
  | { kind: 'error' };

/** The Missions row's status — "On · 1 per guest" or "Off". */
function missionsStatus(perGuest: number | null): string {
  return perGuest === null ? 'Off' : `On · ${perGuest} per guest`;
}

export default function GroupScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  /*
    The roster, and who was on it when it first arrived (`seed`). Null until
    then. Anyone not in the seed joined while the host was watching, and their
    chip springs in; the people already there are simply there.
  */
  const [roster, setRoster] = useState<{
    members: EventMember[];
    seed: ReadonlySet<string>;
  } | null>(null);
  const setMembers = useCallback(
    (members: EventMember[]) =>
      setRoster((previous) => ({
        members,
        seed: previous?.seed ?? new Set(members.map((member) => member.user_id)),
      })),
    []
  );
  const members = roster?.members ?? [];
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    Resolve the event the same way 09 does: the param when 09 passed one, else
    the newest event this user belongs to. That second path is what makes a warm
    start onto this route work, and what the dev-skip button relies on.
  */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const event = eventId ? await getEvent(eventId) : (await listMyEvents())[0];
        if (cancelled) return;

        if (!event) {
          setState({ kind: 'error' });
          return;
        }

        setState({ kind: 'ready', event });
        setMembers(await listMembers(event.id));
      } catch {
        if (!cancelled) setState({ kind: 'error' });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId, setMembers]);

  // Held live only once there is an event to subscribe to.
  const event = state.kind === 'ready' ? state.event : undefined;

  /*
    Keyed on the id rather than the event object: a re-read that returns an
    equal-but-new row would otherwise tear the channel down and rebuild it,
    dropping any change that landed in between.
  */
  const liveEventId = event?.id;

  useEffect(() => {
    if (!liveEventId) return;
    return subscribeToMembers(liveEventId, setMembers);
  }, [liveEventId, setMembers]);

  /*
    Coming back from the Missions screen: re-read the event so the row's
    "On · 2 per guest" is what the host just set. A failed re-read keeps the
    row as it was.
  */
  useFocusEffect(
    useCallback(() => {
      if (!liveEventId) return;
      let cancelled = false;
      getEvent(liveEventId)
        .then((fresh) => {
          if (!cancelled) setState({ kind: 'ready', event: fresh });
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [liveEventId])
  );

  const handleStart = useCallback(async () => {
    if (!event || starting) return;

    setStarting(true);
    setError(null);

    try {
      await startEvent(event.id);
      router.replace({ pathname: '/(capture)/camera', params: { eventId: event.id } });
    } catch (e) {
      setError(
        e instanceof Error && e.message.toLowerCase().includes('already ended')
          ? 'This event has already ended.'
          : "Couldn't start the event. Check your connection and try again."
      );
      setStarting(false);
    }
  }, [event, starting, router]);

  /** The start cannot be undone, and it locks the missions: ask first. */
  const confirmStart = useCallback(() => {
    if (!event || starting) return;
    const missions = event.missions_per_guest != null;
    Alert.alert(
      'Start the event?',
      missions
        ? "Everyone can take photos from now on. The missions are handed out and can't be changed after this, and guests can no longer change their name."
        : "Everyone can take photos from now on. This can't be undone.",
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Start', onPress: () => void handleStart() },
      ]
    );
  }, [event, starting, handleStart]);

  const count = members.length;
  /** `max_members` is a hard cap: `join_event()` refuses the next guest. */
  const capacity = event?.max_members ?? 0;
  const spotsLeft = Math.max(capacity - count, 0);

  return (
    <Screen transparent style={styles.screen}>
      <ScreenHeader
        style={styles.header}
        right={
          event ? (
            // 09 opened on top of this screen (`from=group`): its "See who's
            // joined" and its close button come back here instead of stacking
            // another 10 — the loop of QR, group, QR, group the user hit.
            <CircleIconButton
              materialIcon="qrcode"
              accessibilityLabel="Show the invite QR code"
              onPress={() =>
                router.push({
                  pathname: '/(host)/invite',
                  params: { eventId: event.id, from: 'group' },
                })
              }
            />
          ) : undefined
        }
      />

      <Label style={styles.eyebrow}>Your Group</Label>

      {/*
        Held back until the roster is real. Flashing "0 people have joined." and
        correcting it a moment later reads as a bug — the same "hidden until
        known" call 09 made for its eyebrow.
      */}
      {event ? (
        <Display size="lg" style={styles.headline}>
          <Em>{count}</Em>/{capacity} people
          {'\n'}
          {count === 1 ? 'has joined.' : 'have joined.'}
        </Display>
      ) : (
        <View style={styles.headlineSpacer} />
      )}

      <View style={styles.chips}>
        {/*
          Three states, and they have to look different from each other. The load
          failing and the group being empty are not the same situation, and while
          the event is still arriving neither claim is safe to make yet.
        */}
        {state.kind === 'loading' ? (
          <View style={styles.waiting}>
            <ActivityIndicator size="small" color={Colors.textMuted} />
            <Body small color={Colors.textDim}>
              Loading your group…
            </Body>
          </View>
        ) : state.kind === 'error' ? (
          <View style={styles.waiting}>
            <Body small color={Colors.textDim} style={styles.centered}>
              Couldn&rsquo;t load your group.{'\n'}Check your connection and try again.
            </Body>
          </View>
        ) : (
          <>
            <View style={styles.chipRow}>
              {members.map((member) => (
                <MemberChip
                  key={member.user_id}
                  name={member.display_name}
                  arriving={roster !== null && !roster.seed.has(member.user_id)}
                />
              ))}
            </View>

            {/*
              Nobody but the host yet. The artboard has no such state — it draws
              five people already assembled — but this is what the host sees
              *first*, having arrived straight from sharing the invite, and a lone
              chip under a live "Start the Event" button reads as broken rather
              than as waiting.

              Shown *below* the roster rather than instead of it: the host is a
              real member and belongs on their own list, so replacing it would
              hide them from a screen about who has joined.
            */}
            {count <= 1 ? (
              <View style={styles.waiting}>
                <ActivityIndicator size="small" color={Colors.textMuted} />
                <Body small color={Colors.textDim}>
                  Waiting for members…
                </Body>
              </View>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.status}>
        {event ? (
          <>
            {/*
              The headline counts against the group's size ("3/50 people",
              2026-11-16, the user's call); this says what is left of it. The
              size is a real limit again — it is what the host paid for, and
              `join_event()` refuses whoever comes after the last spot.
            */}
            <StatusPill
              label={
                spotsLeft === 0
                  ? 'Group is full'
                  : spotsLeft === 1
                    ? '1 spot left'
                    : `${spotsLeft} spots left`
              }
              dotColor={spotsLeft === 0 ? Colors.gold : Colors.green}
            />
          </>
        ) : null}
      </View>

      {/*
        Missions (2026-11-17). Here, just above the start, because the start is
        what deals them and locks the list: the last thing to check before the
        tap. Opens read-only once the event is running.
      */}
      {event ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`Missions, ${missionsStatus(event.missions_per_guest)}`}
          onPress={() =>
            router.push({ pathname: '/(host)/missions', params: { eventId: event.id } })
          }
          scale={Press.cardScale}
          style={styles.missions}>
          <Feather name="target" size={MissionsEditor.entry.iconSize} color={Colors.textMuted} />
          <Text style={styles.missionsLabel}>Missions</Text>
          <Text style={styles.missionsStatus} numberOfLines={1}>
            {missionsStatus(event.missions_per_guest)}
          </Text>
          <Feather
            name="chevron-right"
            size={MissionsEditor.entry.chevronSize}
            color={Colors.textFaint}
          />
        </PressScale>
      ) : null}

      {error ? (
        <Body small color={Colors.textMuted} style={styles.error}>
          {error}
        </Body>
      ) : null}

      <PillButton
        label={starting ? 'Starting…' : 'Start the Event'}
        icon="camera"
        disabled={!event || starting}
        onPress={confirmStart}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: Group.paddingBottom,
  },
  header: {
    marginBottom: Group.headerGap,
  },
  eyebrow: {
    marginBottom: Group.eyebrowGap,
  },
  headline: {
    marginBottom: Group.headlineGap,
  },
  headlineSpacer: {
    // Two headline lines, so nothing below shifts when the real one arrives.
    height: Group.headlineHeight,
    marginBottom: Group.headlineGap,
  },
  chips: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: Group.chipsGap,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Group.chip.gap,
    justifyContent: 'center',
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Group.waiting.gap,
    marginTop: Group.waiting.rosterGap,
  },
  status: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Group.status.rowGap,
    marginBottom: Group.statusGap,
  },
  centered: {
    textAlign: 'center',
  },
  missions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MissionsEditor.entry.gap,
    paddingVertical: MissionsEditor.entry.paddingY,
    paddingHorizontal: MissionsEditor.entry.paddingX,
    borderRadius: MissionsEditor.entry.radius,
    borderWidth: 1,
    borderColor: MissionsEditor.card.border,
    backgroundColor: MissionsEditor.card.bg,
    marginBottom: MissionsEditor.entry.marginBottom,
  },
  missionsLabel: {
    ...Typography.settingsRow,
    color: Colors.textStrong,
    flex: 1,
  },
  missionsStatus: {
    ...Typography.metaMd,
    color: Colors.textFaint,
    flexShrink: 1,
  },
  error: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
});
