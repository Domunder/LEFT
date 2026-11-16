/**
 * Missions — the host's list of small photo challenges.
 *
 * Reached from 10's "Missions" row, with `eventId`. Not in the prototype: built
 * in the language of 20 (grouped hairline cards) and 02 (choice pills).
 *
 * What the server decides, and this screen only shows
 * (`supabase/migrations/20261117000000_missions.sql`):
 *
 *  - **On or off, and how many each guest gets** (`missions_per_guest`, 1–3).
 *    Switching on fills an empty list from the event type's library; switching
 *    off keeps the list.
 *  - **Everything is editable only in setup**, before the host taps "Start the
 *    Event" on 10 — the deal happens on that tap. After it (or once the event's
 *    end has passed) the same content is drawn read-only. A write that loses the
 *    race throws `MissionsLockedError`, and the re-read then shows the lock.
 *  - **Limits** (200 missions, 200 names, 3–140 characters, names unique per
 *    event) are the database's. The rows validate length before a round trip;
 *    everything else is shown as the server said it.
 *
 * Every write is followed by a re-read, so what is drawn is what the server
 * holds — nothing is added or removed locally as truth.
 *
 * "For specific people": a name the host types is picked by that guest when
 * joining; a guest who already joined can be linked directly
 * (`assignPerson`). A person's missions are dealt to whoever holds the name,
 * first, up to the per-guest count; the shared list fills the rest at random,
 * each mission to one guest only — hence the arithmetic line.
 *
 * The ambient glow lives in (host)/_layout.tsx, which is why this is `transparent`.
 */

import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

import { ChoicePillButton } from '@/components/ui/choice-pill';
import { MissionCard, MissionRow, TextButton } from '@/components/ui/mission-editor';
import { PillButton } from '@/components/ui/pill-button';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useToast } from '@/components/ui/toast-host';
import { Body, Caption, Display, Label } from '@/components/ui/typography';
import { Colors, MissionsEditor as T, Press, Springs } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { getSession } from '@/lib/auth';
import { messageFor } from '@/lib/auth-errors';
import {
  getEvent,
  isDeveloped,
  listMembers,
  listMyEvents,
  subscribeToMembers,
  type Event,
  type EventMember,
} from '@/lib/events';
import {
  addMission,
  addPerson,
  assignPerson,
  deleteMission,
  deletePerson,
  listHostMissions,
  MISSIONS_PER_GUEST_DEFAULT,
  MISSIONS_PER_GUEST_MAX,
  MISSIONS_PER_GUEST_MIN,
  MissionsLockedError,
  setMissionsPerGuest,
  updateMission,
  type HostMissions,
  type MissionPerson,
} from '@/lib/missions';

/** `mission_people.name`: `char_length(btrim(name)) between 1 and 60`. */
const NAME_MAX = 60;

const PER_GUEST_CHOICES = Array.from(
  { length: MISSIONS_PER_GUEST_MAX - MISSIONS_PER_GUEST_MIN + 1 },
  (_, index) => MISSIONS_PER_GUEST_MIN + index
);

/* Rows cross-fade in and out — no travel, so this stays on under reduced
   motion — and the list closes up behind them on the default spring, which
   reduced motion turns into a cut. */
const ROW_IN = FadeIn.duration(T.fadeMs).reduceMotion(ReduceMotion.Never);
const ROW_OUT = FadeOut.duration(T.fadeMs).reduceMotion(ReduceMotion.Never);
const ROW_LAYOUT = LinearTransition.springify()
  .dampingRatio(Springs.settle.dampingRatio)
  .duration(Springs.settle.duration);

type Person = HostMissions['people'][number];

type Data = {
  event: Event;
  missions: HostMissions;
  /** The signed-in user — the host, or the screen says it is not theirs. */
  userId: string | null;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: Data };

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function nameProblem(text: string): string | null {
  const length = text.trim().length;
  if (length === 0) return 'Type a name first.';
  if (length > NAME_MAX) return `At most ${NAME_MAX} characters.`;
  return null;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Postgres' unique_violation — a name already on the list. */
function isDuplicate(e: unknown): boolean {
  return (e as { code?: unknown } | null)?.code === '23505';
}

/** A write's failure, as a sentence. */
function describeWriteError(e: unknown): string {
  if (e instanceof MissionsLockedError) {
    return 'The event has started, so the missions are locked.';
  }
  if (isDuplicate(e)) return 'That name is already on the list.';

  // The count limits ("an event can have at most 200 missions") are raised with
  // hint 'limit' and a message written to be read; capitalise it and show it.
  const hint = (e as { hint?: unknown } | null)?.hint;
  const message = (e as { message?: unknown } | null)?.message;
  if (hint === 'limit' && typeof message === 'string' && message) {
    return `${message[0].toUpperCase()}${message.slice(1)}.`;
  }

  return messageFor(e);
}

export default function MissionsScreen() {
  const toast = useToast();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [members, setMembers] = useState<EventMember[]>([]);
  /** A re-read failed after the screen had loaded: the list may be stale. */
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /** The per-guest count while its write is in flight; undefined otherwise. */
  const [pendingPerGuest, setPendingPerGuest] = useState<number | null | undefined>(undefined);
  /** The person whose card is showing "who is this?" chips. */
  const [linkingId, setLinkingId] = useState<string | null>(null);
  /** A guest whose chip was tapped and is being added. */
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  /*
    Only the newest read may land. Two quick writes each re-read, and their
    answers can arrive out of order; the older one must not paint over the newer.
  */
  const readSeq = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++readSeq.current;

    try {
      const event = eventId ? await getEvent(eventId) : (await listMyEvents())[0];
      if (!event) throw new Error('No event to show.');

      const [missions, roster, session] = await Promise.all([
        listHostMissions(event.id),
        listMembers(event.id),
        getSession(),
      ]);
      if (seq !== readSeq.current) return;

      setState({ kind: 'ready', data: { event, missions, userId: session?.user?.id ?? null } });
      setMembers(roster);
      setStale(false);
    } catch (e) {
      if (seq !== readSeq.current) return;
      // Keep a loaded list on screen and say it may be out of date; only a
      // first load that fails becomes the error state.
      setState((previous) =>
        previous.kind === 'ready' ? previous : { kind: 'error', message: messageFor(e) }
      );
      setStale(true);
    }
  }, [eventId]);

  // On focus, not just on mount: coming back from 10 after a start must show the lock.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const data = state.kind === 'ready' ? state.data : undefined;
  const event = data?.event;
  const liveEventId = event?.id;

  // The roster is live, as on 10: "18 people so far" moves while the host edits.
  useEffect(() => {
    if (!liveEventId) return;
    return subscribeToMembers(liveEventId, setMembers);
  }, [liveEventId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  /**
   * Run a write, then re-read whatever happened. Rethrows a sentence, so a row
   * can show it under its input; a lock is shown by the re-read itself.
   */
  const write = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action();
      } catch (e) {
        throw new Error(describeWriteError(e));
      } finally {
        await reload();
      }
    },
    [reload]
  );

  /** A write with no row to show its failure: the toast says it. */
  const writeOrToast = useCallback(
    async (action: () => Promise<unknown>, failure: string) => {
      try {
        await write(action);
        return true;
      } catch (e) {
        toast.show({ initials: '!', title: failure, message: messageFor(e) });
        return false;
      }
    },
    [toast, write]
  );

  // -------------------------------------------------------------------------
  // Loading, error, not the host
  // -------------------------------------------------------------------------

  if (state.kind !== 'ready' || !data || !event) {
    return (
      <Screen transparent>
        <ScreenHeader style={styles.header} />
        <Intro />
        <View style={styles.centerState}>
          {state.kind === 'error' ? (
            <>
              <Body small color={Colors.textDim} style={styles.centerText}>
                Couldn&rsquo;t load the missions.{'\n'}
                {state.message}
              </Body>
              <PillButton
                label="Try again"
                variant="secondary"
                onPress={() => {
                  setState({ kind: 'loading' });
                  void reload();
                }}
                style={styles.centerButton}
              />
            </>
          ) : (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.textMuted} />
              <Body small color={Colors.textDim}>
                Loading missions…
              </Body>
            </View>
          )}
        </View>
      </Screen>
    );
  }

  if (data.userId !== event.host_id) {
    return (
      <Screen transparent>
        <ScreenHeader style={styles.header} />
        <Intro />
        <View style={styles.centerState}>
          <Body small color={Colors.textDim} style={styles.centerText}>
            Only the host can change this event&rsquo;s missions.
          </Body>
        </View>
      </Screen>
    );
  }

  // -------------------------------------------------------------------------
  // The arithmetic
  // -------------------------------------------------------------------------

  const { pool, people } = data.missions;
  /** The server's count unless a change to it is still in flight. */
  const perGuest = pendingPerGuest !== undefined ? pendingPerGuest : event.missions_per_guest;
  const missionsOn = perGuest !== null;
  /** The server refuses every write once the event has started or its end has passed. */
  const locked = event.status !== 'setup' || isDeveloped(event);

  const personalCount = people.reduce((sum, person) => sum + person.missions.length, 0);
  const totalMissions = pool.length + personalCount;

  const memberName = (userId: string | null) =>
    members.find((member) => member.user_id === userId)?.display_name;

  /*
    Who goes short, computed the way the deal does it: each guest takes their
    own name's missions first (up to the count), then draws from the shared
    list, and every mission goes to one guest only.
  */
  const poolDemand = perGuest
    ? members.reduce((sum, member) => {
        const own = people.find((person) => person.claimed_by === member.user_id);
        return sum + perGuest - Math.min(own?.missions.length ?? 0, perGuest);
      }, 0)
    : 0;
  const short = missionsOn && pool.length < poolDemand;

  /** Joined guests who do not hold a name yet — offered as chips. */
  const unnamed = members.filter((member) => !people.some((p) => p.claimed_by === member.user_id));

  const chipLabel = (member: EventMember) =>
    member.user_id === data.userId ? `${member.display_name} (you)` : member.display_name;

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const changePerGuest = async (next: number | null) => {
    setPendingPerGuest(next);
    await writeOrToast(
      () => setMissionsPerGuest(event.id, next),
      next === null ? "Couldn't switch missions off." : "Couldn't change the missions."
    );
    setPendingPerGuest(undefined);
  };

  const confirmSwitchOff = () => {
    Alert.alert(
      'Switch missions off?',
      'Nobody will get a mission. Your list is kept, in case you switch them back on.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Switch off', style: 'destructive', onPress: () => void changePerGuest(null) },
      ]
    );
  };

  /** Link an existing name to a guest who joined. */
  const link = (person: MissionPerson, member: EventMember) =>
    writeOrToast(() => assignPerson(person.id, member.user_id), `Couldn't link ${person.name}.`);

  /**
   * A chip from the roster: the guest's own name goes on the list, linked to
   * them. If that name is already there, offer to link it instead.
   */
  const addFromRoster = async (member: EventMember) => {
    if (addingUserId) return;
    setAddingUserId(member.user_id);

    try {
      // Not through `write`: the clash below is answered with a question, not an error.
      const person = await addPerson(event.id, member.display_name);
      await assignPerson(person.id, member.user_id);
      await reload();
    } catch (e) {
      await reload();
      const existing = people.find((person) => sameName(person.name, member.display_name));

      if (isDuplicate(e) && existing) {
        const holder = memberName(existing.claimed_by);
        Alert.alert(
          `“${existing.name}” is already on the list`,
          holder
            ? `It is linked to ${holder}. Link it to ${member.display_name} instead?`
            : `Link it to ${member.display_name}? They get its missions.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Link', onPress: () => void link(existing, member) },
          ]
        );
      } else {
        toast.show({
          initials: '!',
          title: `Couldn't add ${member.display_name}.`,
          message: describeWriteError(e),
        });
      }
    } finally {
      setAddingUserId(null);
    }
  };

  const confirmRemove = (person: Person) => {
    const count = person.missions.length;
    Alert.alert(
      `Remove ${person.name}?`,
      count > 0
        ? `${count === 1 ? 'Their mission goes' : `Their ${count} missions go`} with them.`
        : 'They stay in the group; only the name leaves the list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void writeOrToast(() => deletePerson(person.id), `Couldn't remove ${person.name}.`),
        },
      ]
    );
  };

  const openPersonMenu = (person: Person) => {
    const holder = person.claimed_by ? (memberName(person.claimed_by) ?? 'their guest') : null;

    // Android shows three buttons at most; this never needs more.
    Alert.alert(person.name, undefined, [
      holder
        ? {
            text: `Unlink from ${holder}`,
            onPress: () =>
              void writeOrToast(() => assignPerson(person.id, null), `Couldn't unlink ${person.name}.`),
          }
        : {
            text: 'Link to someone who joined',
            onPress: () => setLinkingId(person.id),
          },
      { text: `Remove ${person.name}`, style: 'destructive', onPress: () => confirmRemove(person) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // -------------------------------------------------------------------------
  // The screen
  // -------------------------------------------------------------------------

  return (
    <Screen transparent edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        // iOS: the keyboard's height becomes inset, so an open row can scroll above it.
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={Colors.textMuted}
          />
        }>
        <ScreenHeader style={styles.header} />
        <Intro />

        {stale ? (
          <Caption color={Colors.textMuted} style={styles.stale}>
            Couldn&rsquo;t refresh — this may be out of date. Pull down to try again.
          </Caption>
        ) : null}

        {locked ? (
          <View style={styles.lockNote} accessibilityRole="text">
            <Feather name="lock" size={T.lockNote.iconSize} color={Colors.textMuted} />
            <Body small color={Colors.textMuted} style={styles.flexText}>
              {event.status === 'setup'
                ? 'Locked — this event has ended.'
                : 'Locked — the missions were dealt when the event started.'}
            </Body>
          </View>
        ) : null}

        {!missionsOn ? (
          // ---------------------------------------------------------------- off
          <View style={styles.empty}>
            <View style={styles.emptyTile}>
              <Feather name="target" size={T.empty.iconSize} color={Colors.textMuted} />
            </View>
            <Display size="xxs" style={styles.emptyHeadline}>
              Missions are off.
            </Display>
            <Body small color={Colors.textDim} style={styles.centerText}>
              {locked
                ? 'This event has no missions. They can only be switched on before it starts.'
                :'Give every guest a small photo challenge, like “A photo with someone you have never met”. You can rewrite the list before you start.'}
            </Body>
            {!locked ? (
              <PillButton
                label={pendingPerGuest !== undefined ? 'Switching on…' : 'Switch missions on'}
                icon="target"
                disabled={pendingPerGuest !== undefined}
                onPress={() => void changePerGuest(MISSIONS_PER_GUEST_DEFAULT)}
                style={styles.emptyButton}
              />
            ) : null}
          </View>
        ) : (
          // ----------------------------------------------------------------- on
          <LayoutAnimationConfig skipEntering>
            {/* Missions per guest */}
            <View style={styles.section}>
              <Label small style={styles.label}>
                Missions per guest
              </Label>
              {locked ? (
                <Body color={Colors.textStrong}>{plural(perGuest ?? 0, 'mission', 'missions')} each</Body>
              ) : (
                <View accessibilityRole="radiogroup" style={styles.perGuestRow}>
                  {PER_GUEST_CHOICES.map((count) => (
                    <ChoicePillButton
                      key={count}
                      label={String(count)}
                      selected={count === perGuest}
                      disabled={pendingPerGuest !== undefined}
                      onPress={() => {
                        if (count !== perGuest) void changePerGuest(count);
                      }}
                    />
                  ))}
                </View>
              )}

              <Body small color={Colors.textDim} style={styles.summary}>
                {plural(totalMissions, 'mission', 'missions')} ·{' '}
                {plural(members.length, 'person', 'people')}
                {locked ? '' : ' so far'}
              </Body>
              {short ? (
                <Caption color={Colors.textFaint} style={styles.summaryNote}>
                  {perGuest === 1
                    ? 'Some guests won’t get one.'
                    : `Some guests will get fewer than ${perGuest}.`}
                </Caption>
              ) : null}
            </View>

            {/* For specific people */}
            <View style={styles.section}>
              <Label small style={styles.label}>
                For specific people
              </Label>
              <Caption color={Colors.textFaint} style={styles.caption}>
                {locked
                  ? 'Written for someone by name. They got these first.'
                  : 'Write missions for someone by name. They get these first.'}
              </Caption>

              {people.map((person) => (
                <Animated.View
                  key={person.id}
                  entering={ROW_IN}
                  exiting={ROW_OUT}
                  layout={ROW_LAYOUT}
                  style={styles.personGap}>
                  <PersonCard
                    person={person}
                    perGuest={perGuest ?? 0}
                    locked={locked}
                    holderName={memberName(person.claimed_by)}
                    linking={linkingId === person.id}
                    unnamed={unnamed}
                    chipLabel={chipLabel}
                    onMenu={() => openPersonMenu(person)}
                    onLink={(member) => {
                      setLinkingId(null);
                      void link(person, member);
                    }}
                    onCancelLink={() => setLinkingId(null)}
                    onAddMission={(body) => write(() => addMission(event.id, body, person.id))}
                    onSaveMission={(id, body) => write(() => updateMission(id, body))}
                    onDeleteMission={(id) => write(() => deleteMission(id))}
                  />
                </Animated.View>
              ))}

              {locked ? (
                people.length === 0 ? (
                  <Body small color={Colors.textDim}>
                    Nobody was named.
                  </Body>
                ) : null
              ) : (
                <Animated.View layout={ROW_LAYOUT}>
                  <MissionCard>
                    <MissionRow
                      key="add-person"
                      addLabel="Add someone by name"
                      placeholder="Their name"
                      autoCapitalize="words"
                      maxLength={NAME_MAX}
                      validate={nameProblem}
                      onSave={(name) => write(() => addPerson(event.id, name))}
                    />
                    {unnamed.length > 0 ? (
                      <View key="roster" style={styles.rosterBlock}>
                        <Caption color={Colors.textFaint} style={styles.rosterLabel}>
                          Or pick someone who has joined
                        </Caption>
                        <View style={styles.chips}>
                          {unnamed.map((member) => (
                            <ChoicePillButton
                              key={member.user_id}
                              label={chipLabel(member)}
                              icon="user-plus"
                              disabled={addingUserId !== null}
                              onPress={() => void addFromRoster(member)}
                            />
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </MissionCard>
                </Animated.View>
              )}
            </View>

            {/* Everyone else */}
            <View style={styles.section}>
              <Label small style={styles.label}>
                Everyone else
              </Label>
              <Caption color={Colors.textFaint} style={styles.caption}>
                Dealt at random. Each mission goes to one guest only.
              </Caption>

              {locked && pool.length === 0 ? (
                <Body small color={Colors.textDim}>
                  The list was empty.
                </Body>
              ) : (
                <MissionCard>
                  {pool.map((mission) => (
                    <Animated.View
                      key={mission.id}
                      entering={ROW_IN}
                      exiting={ROW_OUT}
                      layout={ROW_LAYOUT}>
                      <MissionRow
                        body={mission.body}
                        locked={locked}
                        onSave={(body) => write(() => updateMission(mission.id, body))}
                        onDelete={() => write(() => deleteMission(mission.id))}
                      />
                    </Animated.View>
                  ))}
                  {!locked ? (
                    <Animated.View key="add-mission" layout={ROW_LAYOUT}>
                      <MissionRow onSave={(body) => write(() => addMission(event.id, body))} />
                    </Animated.View>
                  ) : null}
                </MissionCard>
              )}
            </View>

            {!locked ? (
              <View style={styles.footer}>
                <PressScale
                  accessibilityRole="button"
                  onPress={confirmSwitchOff}
                  disabled={pendingPerGuest !== undefined}
                  hitSlop={T.footer.hitSlop}
                  scale={Press.pillScale}>
                  <Text style={styles.footerLink}>Switch missions off</Text>
                </PressScale>
              </View>
            ) : null}
          </LayoutAnimationConfig>
        )}
      </ScrollView>
    </Screen>
  );
}

// ---------------------------------------------------------------------------

/** The headline and its one line, the same in every state. */
function Intro() {
  return (
    <>
      <Display size="md" style={styles.headline}>
        Missions
      </Display>
      <Body small color={Colors.textDim} style={styles.intro}>
        Each guest gets their own. Edit them before you start — after that they&rsquo;re locked.
      </Body>
    </>
  );
}

type PersonCardProps = {
  person: Person;
  perGuest: number;
  locked: boolean;
  /** The joined guest who holds this name, if any. */
  holderName: string | undefined;
  /** Showing the "who is this?" chips. */
  linking: boolean;
  unnamed: EventMember[];
  chipLabel: (member: EventMember) => string;
  onMenu: () => void;
  onLink: (member: EventMember) => void;
  onCancelLink: () => void;
  onAddMission: (body: string) => Promise<void>;
  onSaveMission: (missionId: string, body: string) => Promise<void>;
  onDeleteMission: (missionId: string) => Promise<void>;
};

/** One named person: who they are, whether they joined, and their missions. */
function PersonCard({
  person,
  perGuest,
  locked,
  holderName,
  linking,
  unnamed,
  chipLabel,
  onMenu,
  onLink,
  onCancelLink,
  onAddMission,
  onSaveMission,
  onDeleteMission,
}: PersonCardProps) {
  const joined = person.claimed_by !== null;
  const status = joined
    ? holderName && !sameName(holderName, person.name)
      ? `Joined as ${holderName}`
      : 'Joined'
    : locked
      ? 'Never joined'
      : 'Will pick their name when joining';

  const count = person.missions.length;
  /** They are dealt at most `perGuest`; say so when more were written. */
  const overflow = perGuest > 0 && count > perGuest;

  return (
    <MissionCard>
      <View key="header" style={styles.personHeader}>
        <View style={styles.personCopy}>
          <View style={styles.nameRow}>
            <View
              style={[styles.dot, { backgroundColor: joined ? Colors.green : T.person.waitingDot }]}
            />
            <Text style={styles.personName}>{person.name}</Text>
          </View>
          <Text style={styles.personStatus}>{status}</Text>
          {overflow ? (
            <Text style={styles.personStatus}>
              Gets {perGuest} of these {count}, at {perGuest} per guest.
            </Text>
          ) : null}
        </View>
        {!locked ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`Options for ${person.name}`}
            onPress={onMenu}
            scale={Press.iconScale}
            style={styles.personAction}>
            <Feather name="more-horizontal" size={T.row.iconSize} color={Colors.textMuted} />
          </PressScale>
        ) : null}
      </View>

      {linking && !locked ? (
        <View key="linking" style={styles.rosterBlock}>
          <Caption color={Colors.textFaint} style={styles.rosterLabel}>
            {unnamed.length > 0
              ? `Who is ${person.name}?`
              : 'Everyone who has joined already has a name.'}
          </Caption>
          <View style={styles.chips}>
            {unnamed.map((member) => (
              <ChoicePillButton
                key={member.user_id}
                label={chipLabel(member)}
                icon="link"
                onPress={() => onLink(member)}
              />
            ))}
          </View>
          <View style={styles.linkCancel}>
            <TextButton label="Cancel" onPress={onCancelLink} />
          </View>
        </View>
      ) : null}

      {person.missions.map((mission) => (
        <Animated.View key={mission.id} entering={ROW_IN} exiting={ROW_OUT} layout={ROW_LAYOUT}>
          <MissionRow
            body={mission.body}
            locked={locked}
            onSave={(body) => onSaveMission(mission.id, body)}
            onDelete={() => onDeleteMission(mission.id)}
          />
        </Animated.View>
      ))}

      {!locked ? (
        <Animated.View key="add" layout={ROW_LAYOUT}>
          <MissionRow addLabel={`Add a mission for ${person.name}`} onSave={onAddMission} />
        </Animated.View>
      ) : null}
    </MissionCard>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingBottom: T.paddingBottom,
  },
  header: {
    marginBottom: T.backGap,
  },
  headline: {
    marginBottom: T.headlineGap,
  },
  intro: {
    marginBottom: T.introGap,
  },
  stale: {
    marginBottom: T.introGap,
  },
  flexText: {
    flex: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: T.paddingBottom,
  },
  centerText: {
    textAlign: 'center',
  },
  centerButton: {
    marginTop: T.empty.buttonGap,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.row.gap,
  },
  lockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.lockNote.gap,
    paddingVertical: T.lockNote.paddingY,
    paddingHorizontal: T.lockNote.paddingX,
    borderRadius: T.lockNote.radius,
    borderWidth: 1,
    borderColor: T.lockNote.border,
    backgroundColor: T.lockNote.bg,
    marginBottom: T.sectionGap,
  },
  empty: {
    alignItems: 'center',
    paddingTop: T.empty.paddingTop,
  },
  emptyTile: {
    width: T.empty.iconTile,
    height: T.empty.iconTile,
    borderRadius: T.card.radius,
    borderWidth: 1,
    borderColor: T.card.border,
    backgroundColor: T.card.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.empty.iconGap,
  },
  emptyHeadline: {
    marginBottom: T.empty.copyGap,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: T.empty.buttonGap,
  },
  section: {
    marginBottom: T.sectionGap,
  },
  label: {
    marginBottom: T.labelGap,
  },
  caption: {
    marginBottom: T.captionGap,
  },
  perGuestRow: {
    flexDirection: 'row',
    gap: T.perGuest.gap,
  },
  summary: {
    marginTop: T.captionGap,
  },
  summaryNote: {
    marginTop: T.summaryNoteGap,
  },
  personGap: {
    marginBottom: T.cardGap,
  },
  personHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.person.headerGap,
    paddingVertical: T.row.paddingY,
    paddingHorizontal: T.row.paddingX,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.person.dotGap,
  },
  dot: {
    width: T.person.dotSize,
    height: T.person.dotSize,
    borderRadius: T.person.dotSize / 2,
  },
  personCopy: {
    flex: 1,
    minWidth: 0,
    gap: T.person.statusGap,
  },
  personName: {
    ...Typography.titleMd,
    color: Colors.text,
  },
  personStatus: {
    ...Typography.metaMd,
    color: Colors.textFaint,
  },
  personAction: {
    width: T.row.actionSize,
    height: T.row.actionSize,
    marginVertical: T.row.actionInset,
    marginRight: T.row.actionInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rosterBlock: {
    paddingVertical: T.row.paddingY,
    paddingHorizontal: T.row.paddingX,
  },
  rosterLabel: {
    marginBottom: T.roster.labelGap,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.roster.gap,
  },
  linkCancel: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: T.roster.bottomGap,
  },
  footer: {
    alignItems: 'center',
    paddingTop: T.footer.paddingTop - T.sectionGap,
  },
  footerLink: {
    ...Typography.titleSm,
    color: Colors.textMuted,
  },
});
