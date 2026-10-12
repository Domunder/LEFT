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
 * Screen 12 waits on exactly that transition.
 *
 * The ambient glow lives in (host)/_layout.tsx, which is why this is `transparent`.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { MemberChip } from '@/components/ui/member-chip';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StatusPill } from '@/components/ui/status-pill';
import { Body, Display, Em, Label } from '@/components/ui/typography';
import { Colors, Group, Spacing } from '@/constants/theme';
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

export default function GroupScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [members, setMembers] = useState<EventMember[]>([]);
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
  }, [eventId]);

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
  }, [liveEventId]);

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

  const count = members.length;

  return (
    <Screen transparent style={styles.screen}>
      <ScreenHeader
        style={styles.header}
        right={
          <CircleIconButton
            icon="info"
            accessibilityLabel="How the shared budget works"
            onPress={() => router.push('/(modals)/group-info')}
          />
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
          <Em>{count}</Em> {count === 1 ? 'person' : 'people'}
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
                <MemberChip key={member.user_id} name={member.display_name} />
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
              A plain count, not a count against a cap.

              This used to read "34/50 joined" beside a "16 spots left" pill, and
              both were wrong the moment the group stopped being a limit:
              `max_members` is the host's estimate now — it sizes the budget and
              prices the unlock, and `join_event` admits anyone with the code. A
              readout against it would invite the question "what happens at 51?",
              whose answer is "nothing".

              The artboard has no readout here at all; it relies on the host
              counting chips, which stops working somewhere around a dozen people.
            */}
            <StatusPill
              label={count === 1 ? '1 joined' : `${count} joined`}
              dotColor={Colors.green}
            />
          </>
        ) : null}
      </View>

      {error ? (
        <Body small color={Colors.textMuted} style={styles.error}>
          {error}
        </Body>
      ) : null}

      <PillButton
        label={starting ? 'Starting…' : 'Start the Event'}
        icon="video"
        disabled={!event || starting}
        onPress={() => void handleStart()}
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
  error: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
});
