/**
 * Missions — the host's list of small photo challenges.
 *
 * Reached from 10's "Missions" row, with `eventId` — only from there: creating
 * goes 05.1 → 09 (QR) → 10 whether missions are on or not, and the host plans
 * them from 10 while guests join (2026-11-19, the user; until then the screen
 * sat between 05.1 and 09). Not in the prototype: built
 * in the language of 20 (grouped hairline cards) and 02 (choice pills).
 *
 * **Laid out like Apple Reminders** (decided 2026-11-18 by the user, after
 * comparing how Reminders and Todoist assign an item to a person):
 *
 *  1. **How many each** — one quiet row, "1 mission per guest", with how far
 *     the list reaches against the group size from 05.1. Its sliders open the
 *     1 · 2 · 3 drawer and "Switch missions off". The count never adds or
 *     removes missions; when the list is short, "Generate N more" tops it up
 *     (`generate_missions()`).
 *  2. **Guests** — a row that opens the Guests sheet: everyone who joined,
 *     listed without the host doing anything, and names for people not there
 *     yet (+). `components/ui/mission-assign.tsx`.
 *  3. **The missions** — one list. Each row carries who it is for on the right:
 *     a name, or a quiet person button for "anyone". Tap the text to edit, tap
 *     the person to pick who gets it (Anyone · each guest · someone not here
 *     yet), swipe left to delete. Given missions sort first. "Select" in the
 *     header deletes several.
 *
 * What the server decides, and this screen only shows
 * (`supabase/migrations/20261117000000_missions.sql`, `…18000000_…`):
 *
 *  - **Everything is editable only in setup**, before the host taps "Start the
 *    Event" on 10 — the deal happens on that tap. After it (or once the event's
 *    end has passed) the same content is drawn read-only. A write that loses
 *    the race throws `MissionsLockedError`, and the re-read then shows the lock.
 *  - **A given mission is personal**: `person_id` points at a `mission_people`
 *    row, dealt to whoever holds that name first, up to the per-guest count. A
 *    joined guest gets their row the first time something is given to them
 *    (`ensurePersonFor`).
 *  - **Limits** (200 missions, 200 names, 3–140 characters, names unique per
 *    event) are the database's.
 *
 * Every write is followed by a re-read, so what is drawn is what the server
 * holds — nothing is added or removed locally as truth.
 *
 * The ambient glow lives in (host)/_layout.tsx, which is why this is `transparent`.
 */

import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { RefreshControl, ScrollView } from 'react-native-gesture-handler';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

import {
  AssignSheet,
  AssigneeChip,
  buildGuests,
  GuestsSheet,
  type AssignTarget,
  type Guest,
} from '@/components/ui/mission-assign';
import { MissionCard, MissionRow, TextButton } from '@/components/ui/mission-editor';
import { PillButton } from '@/components/ui/pill-button';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { useToast } from '@/components/ui/toast-host';
import { Body, Caption, Display, Label } from '@/components/ui/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollEdged } from '@/components/ui/scroll-edge';
import { Colors, MissionsEditor as T, Press, ScrollEdge as Edge, Springs } from '@/constants/theme';
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
  deleteMissions,
  deletePerson,
  generateMissions,
  listHostMissions,
  MAX_EVENT_MISSIONS,
  MISSIONS_PER_GUEST_DEFAULT,
  MissionsLockedError,
  moveMission,
  setMissionsPerGuest,
  updateMission,
  type EventMission,
  type HostMissions,
} from '@/lib/missions';
import { t } from '@/i18n';

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


const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Postgres' unique_violation — a name already on the list. */
function isDuplicate(e: unknown): boolean {
  return (e as { code?: unknown } | null)?.code === '23505';
}

/** A write's failure, as a sentence. */
function describeWriteError(e: unknown): string {
  if (e instanceof MissionsLockedError) {
    return t('missions.lockedStartedError');
  }
  if (isDuplicate(e)) return t('missions.nameDuplicate');

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
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [members, setMembers] = useState<EventMember[]>([]);
  /** A re-read failed after the screen had loaded: the list may be stale. */
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /** The per-guest count while its write is in flight; undefined otherwise. */
  const [pendingPerGuest, setPendingPerGuest] = useState<number | null | undefined>(undefined);
  const [generating, setGenerating] = useState(false);
  /** Select mode, and the missions ticked in it. */
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);
  /** Rows with their editor open: a swipe must not delete them. */
  const [editingRows, setEditingRows] = useState<ReadonlySet<string>>(() => new Set());
  /** The sheets: the mission being given to someone, and the guest list. */
  const [assigning, setAssigning] = useState<EventMission | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);
  /** A name whose "who is this?" list is showing, in the Guests sheet's menu. */
  const [linkingName, setLinkingName] = useState<Person | null>(null);

  /*
    Only the newest read may land. Two quick writes each re-read, and their
    answers can arrive out of order; the older one must not paint over the newer.
  */
  const readSeq = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++readSeq.current;

    try {
      const event = eventId ? await getEvent(eventId) : (await listMyEvents())[0];
      if (!event) throw new Error(t('missions.noEvent'));

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

  // The roster is live, as on 10: a guest who joins appears in the Guests list.
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

  const setRowEditing = useCallback((missionId: string, editing: boolean) => {
    setEditingRows((previous) => {
      if (previous.has(missionId) === editing) return previous;
      const next = new Set(previous);
      if (editing) next.add(missionId);
      else next.delete(missionId);
      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // The way in and out
  // -------------------------------------------------------------------------

  // Select is offered wherever rows can be deleted: the host, in setup, missions on.
  const canSelect =
    !!event &&
    data?.userId === event.host_id &&
    event.missions_per_guest !== null &&
    event.status === 'setup' &&
    !isDeveloped(event) &&
    (data?.missions.pool.length ?? 0) +
      (data?.missions.people.reduce((sum, p) => sum + p.missions.length, 0) ?? 0) >
      0;

  const selectToggle = canSelect ? (
    <TextButton
      label={selecting ? t('common.done') : t('missions.select')}
      strong={selecting}
      onPress={() => {
        setSelecting((on) => !on);
        setSelected(new Set());
      }}
    />
  ) : null;

  // Pinned above the list, never scrolled with it: the list's top edge fades
  // out under the header, not over its buttons (2026-11-19, the user).
  const header = (
    <ScreenHeader
      right={selectToggle ? <View style={styles.headerRight}>{selectToggle}</View> : undefined}
    />
  );

  // -------------------------------------------------------------------------
  // Loading, error, not the host
  // -------------------------------------------------------------------------

  if (state.kind !== 'ready' || !data || !event) {
    return (
      <Screen transparent>
        <View style={styles.header}>{header}</View>
        <Intro />
        <View style={styles.centerState}>
          {state.kind === 'error' ? (
            <>
              <Body small color={Colors.textDim} style={styles.centerText}>
                {t('missions.loadFailed')}
                {'\n'}
                {state.message}
              </Body>
              <PillButton
                label={t('common.tryAgain')}
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
                {t('missions.loading')}
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
        <View style={styles.header}>{header}</View>
        <Intro />
        <View style={styles.centerState}>
          <Body small color={Colors.textDim} style={styles.centerText}>
            {t('missions.hostOnly')}
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

  const guests = buildGuests(people, members, data.userId);
  /** Newest first, whoever it is for: a mission just added stays at the top, under "Add". */
  const missions = [...pool, ...people.flatMap((person) => person.missions)].sort(
    (a, b) => b.seq - a.seq
  );
  const totalMissions = missions.length;
  const nameOf = (personId: string | null) =>
    personId ? people.find((person) => person.id === personId)?.name : undefined;

  /*
    How far the list reaches, against the group the host sized on 05.1 (not
    just who joined so far): every mission goes to one guest only, so N guests
    at K each need N x K. `generate_missions()` tops up to exactly that, within
    the 200-mission ceiling.
  */
  const group = event.max_members;
  const needed = perGuest
    ? Math.max(0, Math.min(group * perGuest, MAX_EVENT_MISSIONS) - totalMissions)
    : 0;

  const joinedCount = members.length;
  const waitingCount = people.filter((p) => !p.claimed_by).length;
  const guestsLine =
    joinedCount === 0 && waitingCount === 0
      ? t('missions.nobodyJoined')
      : waitingCount > 0
        ? t('missions.joinedAndWaiting', { joined: joinedCount, waiting: waitingCount })
        : t('missions.joined', { joined: joinedCount });

  const selectedIds = missions.map((m) => m.id).filter((id) => selected.has(id));
  const allSelected = missions.length > 0 && selectedIds.length === missions.length;

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const changePerGuest = async (next: number | null) => {
    setPendingPerGuest(next);
    await writeOrToast(
      () => setMissionsPerGuest(event.id, next),
      next === null ? t('missions.switchOffFailed') : t('missions.changeFailed')
    );
    setPendingPerGuest(undefined);
  };

  const confirmSwitchOff = () => {
    Alert.alert(
      t('missions.switchOffTitle'),
      t('missions.switchOffBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('missions.switchOff'),
          style: 'destructive',
          onPress: () => void changePerGuest(null),
        },
      ]
    );
  };

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    await writeOrToast(() => generateMissions(event.id), t('missions.generateFailed'));
    setGenerating(false);
  };

  /**
   * The name row a joined guest's missions hang on: theirs if they hold one,
   * else a new one in their display name, linked to them. A same-named row
   * nobody holds is linked instead of duplicated.
   */
  const ensurePersonFor = async (member: EventMember): Promise<string> => {
    const held = people.find((person) => person.claimed_by === member.user_id);
    if (held) return held.id;

    const free = people.find(
      (person) => !person.claimed_by && sameName(person.name, member.display_name)
    );
    const personId = free ? free.id : (await addPerson(event.id, member.display_name)).id;
    await assignPerson(personId, member.user_id);
    return personId;
  };

  const assignTo = async (mission: EventMission, target: AssignTarget) => {
    setAssignBusy(true);
    const done = await writeOrToast(async () => {
      const personId =
        target.kind === 'anyone'
          ? null
          : target.kind === 'person'
            ? target.personId
            : target.kind === 'member'
              ? await ensurePersonFor(target.member)
              : (await addPerson(event.id, target.name)).id;
      if (personId !== mission.person_id) await moveMission(mission.id, personId);
    }, t('missions.assignFailed'));
    setAssignBusy(false);
    if (done) setAssigning(null);
  };

  const confirmDelete = () => {
    const count = selectedIds.length;
    if (count === 0) return;
    Alert.alert(t('missions.deleteConfirm', { count }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          void (async () => {
            setDeleting(true);
            const ok = await writeOrToast(
              () => deleteMissions(selectedIds),
              t('missions.deleteManyFailed')
            );
            setDeleting(false);
            if (ok) {
              setSelected(new Set());
              setSelecting(false);
            }
          })(),
      },
    ]);
  };

  const confirmRemoveName = (person: Person) => {
    const count = person.missions.length;
    Alert.alert(
      t('missions.removeNameTitle', { name: person.name }),
      count > 0 ? t('missions.removeNameBody', { count }) : undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () =>
            void writeOrToast(async () => {
              // Their missions stay on the list, for anyone, rather than vanishing.
              for (const mission of person.missions) await moveMission(mission.id, null);
              await deletePerson(person.id);
            }, t('missions.removeNameFailed', { name: person.name })),
        },
      ]
    );
  };

  const openNameMenu = (guest: Extract<Guest, { kind: 'named' }>) => {
    const person = guest.person;
    const unnamed = members.filter((m) => !people.some((p) => p.claimed_by === m.user_id));

    // Android shows three buttons at most, and iOS allows one cancel: build it.
    const first = guest.member
      ? {
          text: t('missions.unlinkFrom', { name: guest.member.display_name }),
          onPress: () =>
            void writeOrToast(
              () => assignPerson(person.id, null),
              t('missions.unlinkFailed', { name: person.name })
            ),
        }
      : unnamed.length > 0
        ? { text: t('missions.linkToJoined'), onPress: () => setLinkingName(person) }
        : null;

    Alert.alert(person.name, undefined, [
      ...(first ? [first] : []),
      {
        text: t('missions.removeName', { name: person.name }),
        style: 'destructive',
        onPress: () => confirmRemoveName(person),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  // -------------------------------------------------------------------------
  // The screen
  // -------------------------------------------------------------------------

  // While selecting, the pinned area is the delete button; otherwise "Continue"
  // (only when creating).
  const bottom = selecting ? (
    <PillButton
      label={
        deleting
          ? t('missions.deleting')
          : selectedIds.length > 0
            ? t('missions.deleteCount', { count: selectedIds.length })
            : t('missions.tickToDelete')
      }
      icon="trash-2"
      variant="secondary"
      disabled={deleting || selectedIds.length === 0}
      onPress={confirmDelete}
      style={styles.continue}
    />
  ) : null;

  const unnamedMembers = members.filter((m) => !people.some((p) => p.claimed_by === m.user_id));

  return (
    <View style={styles.root}>
      {/* Something pinned at the bottom: then the bottom inset is the screen's. */}
      <Screen transparent edges={bottom ? ['top', 'bottom'] : ['top']}>
        {header}
        <ScrollEdged bottomInset={bottom ? 0 : insets.bottom}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(T.paddingBottom, Edge.bottom) }]}
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
          <Intro
            right={
              !locked ? (
                <ToggleSwitch
                  value={missionsOn}
                  disabled={pendingPerGuest !== undefined || selecting}
                  onValueChange={(on) =>
                    on ? void changePerGuest(MISSIONS_PER_GUEST_DEFAULT) : confirmSwitchOff()
                  }
                  accessibilityLabel={t('missions.title')}
                />
              ) : undefined
            }
          />

          {stale ? (
            <Caption color={Colors.textMuted} style={styles.stale}>
              {t('missions.staleNote')}
            </Caption>
          ) : null}

          {locked ? (
            <View style={styles.lockNote} accessibilityRole="text">
              <Feather name="lock" size={T.lockNote.iconSize} color={Colors.textMuted} />
              <Body small color={Colors.textMuted} style={styles.flexText}>
                {event.status === 'setup'
                  ? t('missions.lockedEnded')
                  : t('missions.lockedStarted')}
              </Body>
            </View>
          ) : null}

          {!missionsOn ? (
            // -------------------------------------------------------------- off
            <View style={styles.empty}>
              <View style={styles.emptyTile}>
                <Feather name="target" size={T.empty.iconSize} color={Colors.textMuted} />
              </View>
              <Display size="xxs" style={styles.emptyHeadline}>
                {t('missions.offHeadline')}
              </Display>
              <Body small color={Colors.textDim} style={styles.centerText}>
                {locked
                  ? t('missions.offBodyLocked')
                  : t('missions.offBody')}
              </Body>
              {!locked ? (
                <PillButton
                  label={
                    pendingPerGuest !== undefined
                      ? t('missions.switchingOn')
                      : t('missions.switchOn')
                  }
                  icon="target"
                  disabled={pendingPerGuest !== undefined}
                  onPress={() => void changePerGuest(MISSIONS_PER_GUEST_DEFAULT)}
                  style={styles.emptyButton}
                />
              ) : null}
            </View>
          ) : (
            // --------------------------------------------------------------- on
            <LayoutAnimationConfig skipEntering>
              {/* Who is in the group. */}
              <View style={styles.section}>
                <MissionCard>
                  <PressScale
                    key="guests"
                    accessibilityRole="button"
                    accessibilityLabel={t('missions.guestsA11y', { status: guestsLine })}
                    accessibilityHint={t('missions.guestsHint')}
                    disabled={selecting}
                    onPress={() => setGuestsOpen(true)}
                    scale={Press.cardScale}
                    style={styles.cardRow}>
                    <Feather name="users" size={T.row.iconSize} color={Colors.textMuted} />
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{t('missions.guests')}</Text>
                      <Text style={styles.rowDetail}>{guestsLine}</Text>
                    </View>
                    <Feather name="chevron-right" size={T.count.iconSize} color={Colors.textMuted} />
                  </PressScale>
                </MissionCard>
              </View>

              {/* The missions */}
              <View style={styles.section}>
                <View style={styles.labelRow}>
                  <Label small>{t('missions.title')}</Label>
                  {needed > 0 && !locked && !selecting ? (
                    generating ? (
                      <ActivityIndicator size="small" color={Colors.textMuted} />
                    ) : (
                      <TextButton
                        label={t('missions.addCount', { count: needed })}
                        strong
                        onPress={() => void generate()}
                      />
                    )
                  ) : null}
                  {selecting ? (
                    <TextButton
                      label={allSelected ? t('missions.deselectAll') : t('missions.selectAll')}
                      onPress={() =>
                        setSelected(allSelected ? new Set() : new Set(missions.map((m) => m.id)))
                      }
                    />
                  ) : null}
                </View>
                <Caption color={Colors.textFaint} style={styles.caption}>
                  {needed > 0 && !locked
                    ? t('missions.tooFew', { count: totalMissions, guests: group })
                    : locked
                    ? t('missions.captionLocked')
                    : t('missions.captionOpen')}
                </Caption>

                {locked && missions.length === 0 ? (
                  <Body small color={Colors.textDim}>
                    {t('missions.listWasEmpty')}
                  </Body>
                ) : (
                  // Opaque, like the rows that slide over Delete, so the card is one surface.
                  <MissionCard style={styles.swipeRow}>
                    {!locked && !selecting ? (
                      <MissionRow
                        key="add-mission"
                        onSave={(body) => write(() => addMission(event.id, body))}
                      />
                    ) : null}
                    {missions.map((mission) => (
                      <Animated.View
                        key={mission.id}
                        entering={ROW_IN}
                        exiting={ROW_OUT}
                        layout={ROW_LAYOUT}>
                        <SwipeToDelete
                          enabled={!locked && !selecting && !editingRows.has(mission.id)}
                          label={mission.body}
                          onDelete={() =>
                            void writeOrToast(
                              () => deleteMission(mission.id),
                              t('missions.deleteOneFailed')
                            )
                          }>
                          <MissionRow
                            body={mission.body}
                            locked={locked}
                            selecting={selecting}
                            selected={selected.has(mission.id)}
                            onToggle={() =>
                              setSelected((previous) => {
                                const next = new Set(previous);
                                if (next.has(mission.id)) next.delete(mission.id);
                                else next.add(mission.id);
                                return next;
                              })
                            }
                            onEditingChange={(editing) => setRowEditing(mission.id, editing)}
                            onSave={(body) => write(() => updateMission(mission.id, body))}
                            trailing={
                              <AssigneeChip
                                name={nameOf(mission.person_id)}
                                locked={locked}
                                onPress={() => setAssigning(mission)}
                              />
                            }
                          />
                        </SwipeToDelete>
                      </Animated.View>
                    ))}
                  </MissionCard>
                )}
              </View>
            </LayoutAnimationConfig>
          )}
        </ScrollView>
        </ScrollEdged>
        {bottom}
      </Screen>

      {assigning ? (
        <AssignSheet
          mission={assigning}
          guests={guests}
          selfId={data.userId}
          busy={assignBusy}
          onAssign={(target) => void assignTo(assigning, target)}
          onClose={() => setAssigning(null)}
        />
      ) : null}

      {guestsOpen ? (
        <GuestsSheet
          guests={guests}
          selfId={data.userId}
          perGuest={perGuest ?? 0}
          locked={locked}
          countFor={(guest) => (guest.kind === 'named' ? guest.person.missions.length : 0)}
          onAddName={(name) => write(() => addPerson(event.id, name))}
          onNameMenu={openNameMenu}
          onClose={() => {
            setGuestsOpen(false);
            setLinkingName(null);
          }}
          linking={
            linkingName
              ? {
                  name: linkingName.name,
                  members: unnamedMembers,
                  onPick: (member) => {
                    const person = linkingName;
                    setLinkingName(null);
                    void writeOrToast(
                      () => assignPerson(person.id, member.user_id),
                      t('missions.linkFailed', { name: person.name })
                    );
                  },
                  onCancel: () => setLinkingName(null),
                }
              : null
          }
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

/** The headline and its one line, the same in every state. */
function Intro({ right }: { right?: React.ReactNode }) {
  return (
    <>
      <View style={styles.titleRow}>
        <Display size="md" style={styles.title}>
          {t('missions.title')}
        </Display>
        {right}
      </View>
      <Body small color={Colors.textDim} style={styles.intro}>
        {t('missions.intro')}
      </Body>
    </>
  );
}

type SwipeProps = {
  enabled: boolean;
  label: string;
  onDelete: () => void;
  children: React.ReactNode;
};

/** Swipe a row left for Delete, as in Mail and Reminders. */
function SwipeToDelete({ enabled, label, onDelete, children }: SwipeProps) {
  const ref = useRef<SwipeableMethods>(null);

  return (
    <ReanimatedSwipeable
      ref={ref}
      enabled={enabled}
      friction={2}
      rightThreshold={T.swipe.actionWidth / 2}
      overshootRight={false}
      childrenContainerStyle={styles.swipeRow}
      renderRightActions={() => (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={t('missions.deleteMissionA11y', { body: label })}
          onPress={() => {
            ref.current?.close();
            onDelete();
          }}
          scale={Press.cardScale}
          style={styles.swipeAction}>
          <Feather name="trash-2" size={T.swipe.iconSize} color={Colors.text} />
          <Text style={styles.swipeLabel}>{t('common.delete')}</Text>
        </PressScale>
      )}>
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    // Clear of the top edge's fade at rest; the gap under the header as well.
    paddingTop: Math.max(T.backGap, Edge.top),
    paddingBottom: T.paddingBottom,
  },
  /** The loading and error states' header, which has no list under it. */
  header: {
    marginBottom: T.backGap,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.row.gap,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.row.gap,
    marginBottom: T.headlineGap,
  },
  title: {
    flex: 1,
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: T.labelGap,
  },
  caption: {
    marginBottom: T.captionGap,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.row.gap,
    paddingVertical: T.row.paddingY,
    paddingHorizontal: T.row.paddingX,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: T.person.statusGap,
  },
  rowTitle: {
    ...Typography.titleMd,
    color: Colors.text,
  },
  rowDetail: {
    ...Typography.metaMd,
    color: Colors.textFaint,
  },
  actionLabel: {
    ...Typography.titleSm,
    color: Colors.text,
    flex: 1,
  },
  actionBusy: {
    color: Colors.textMuted,
  },
  swipeRow: {
    backgroundColor: T.swipe.rowBg,
  },
  swipeAction: {
    width: T.swipe.actionWidth,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.swipe.gap,
    backgroundColor: T.swipe.bg,
  },
  swipeLabel: {
    ...Typography.metaMd,
    color: Colors.text,
  },
  continue: {
    marginTop: T.continueGap,
  },
});
