/**
 * 15/16 · Your Films
 *
 * One screen, two states — the artboard's "empty" and "populated" library are not
 * separate routes, they are the same screen with and without events.
 *
 * This is the app's home screen for a returning user: the root layout replaces
 * onto it when a session already exists, a sign-in on Landing lands here whenever
 * the account already has an event, and 14 lands here when a film finishes. So a
 * card is the way back into whatever an event is currently doing, not just a link
 * to a finished film — see lib/film-status.ts for the routing table.
 *
 * It is also the only screen offering all three things a signed-in user can do
 * with a memory: watch a past one, start one (the plus), or join somebody else's
 * (the middle button). Landing offers the last of those too, but a signed-in user
 * never sees Landing again.
 *
 * Four deviations from the artboard, all flagged in CLAUDE.md:
 *  - a card carries the film's own poster frame once one has been rendered, and
 *    the gradient from lib/film-tint.ts until then — which for an event still
 *    running, or one whose render failed, is forever
 *  - 16's backdrop is built from the first card's tint rather than a blurred cover
 *  - the status badge reads five states where the artboard draws two
 *  - a guest sees the "Keep your films" prompt, which the artboard does not draw
 *
 * It sets its own horizontal padding: the header is 24 and the list 20, neither
 * of which is `Spacing.screenX` (28), so `<Screen>` cannot supply it.
 */

import type { Session } from '@supabase/supabase-js';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { FilmCard } from '@/components/ui/film-card';
import { FilmEmpty } from '@/components/ui/film-empty';
import { KeepYourFilm } from '@/components/ui/keep-your-film';
import { Screen } from '@/components/ui/screen';
import { Body, Display } from '@/components/ui/typography';
import { Colors, Films } from '@/constants/theme';
import { getSession, isAnonymous } from '@/lib/auth';
import { listMyEventSummaries, type EventSummary } from '@/lib/events';
import { destinationFor, memberLabel, statusLabel, tickIntervalMs } from '@/lib/film-status';
import { tintFor } from '@/lib/film-tint';
import { dismissPrompt, isPromptDismissed } from '@/lib/prompt-dismissal';

/** One shared identity for "no events", so a non-ready render is stable. */
const EMPTY: EventSummary[] = [];

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; events: EventSummary[] }
  | { kind: 'error' };

export default function FilmsScreen() {
  const router = useRouter();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [session, setSession] = useState<Session | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(true);
  const [now, setNow] = useState(() => new Date());

  /*
    Re-read on focus, not just on mount. Every route that creates or advances an
    event lands back here, so a library that only loaded once would show a stale
    status the moment someone filmed.
  */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        try {
          const [events, current] = await Promise.all([listMyEventSummaries(), getSession()]);
          if (cancelled) return;

          setState({ kind: 'ready', events });
          setSession(current);
          setNow(new Date());

          // Only a guest can be offered the upgrade, and only until they decline it.
          const anonymous = current?.user ? isAnonymous(current.user) : false;
          const dismissed =
            anonymous && current?.user ? await isPromptDismissed(current.user.id) : true;
          if (!cancelled) setPromptDismissed(dismissed);
        } catch {
          if (!cancelled) setState({ kind: 'error' });
        }
      }

      void load();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  /*
    Memoised so the empty-state array is not a new identity on every render —
    otherwise `backdrop` below recomputes each pass and the list re-renders with it.
  */
  const events = useMemo(() => (state.kind === 'ready' ? state.events : EMPTY), [state]);

  /*
    Only tick while something is actually counting down, and at the rate the
    badges are actually changing — a card in its final hour shows seconds, so a
    once-a-minute tick would leave it visibly stale. `tickIntervalMs` owns both
    questions; null means nothing is counting down and no timer runs at all.
  */
  const interval = tickIntervalMs(events, now);

  useEffect(() => {
    if (interval === null) return;
    const id = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(id);
  }, [interval]);

  const user = session?.user;
  const showsPrompt = Boolean(user && isAnonymous(user)) && !promptDismissed;

  const handleDismiss = useCallback(() => {
    setPromptDismissed(true);
    if (user) void dismissPrompt(user.id);
  }, [user]);

  /*
    Linking keeps the same user id, so the events already on screen stay correct —
    only the session's anonymity changes, and re-reading it is what hides the panel.
  */
  const handleLinked = useCallback(() => {
    void getSession()
      .then(setSession)
      .catch(() => setPromptDismissed(true));
  }, []);

  /*
    The wash behind the list, derived from the first card so the screen reads as
    lit by its own content — the artboard's blurred cover photo, without a cover.
    Null on the empty state, where the ambient glow shows through instead.
  */
  const backdrop = useMemo(() => (events.length > 0 ? tintFor(events[0].id) : null), [events]);

  /*
    Hosting needs a full account; joining, filming and watching do not.

    A guest's identity is an anonymous `auth.users` row living in this device's
    storage alone — fine to appear in someone else's memory with, wrong to be the
    owner of one other people join and pay into. So an anonymous session is sent
    to `(auth)/create` to link a provider, and that screen continues into
    onboarding once it has one. `create_event()` refuses an anonymous caller
    outright (20260823180000_hosts_are_not_anonymous.sql); this is only the half
    that gives them somewhere to go instead of a failure four screens later.

    The session is re-read rather than read off state because the plus is drawn
    during the initial load as well, and letting a fast tap through on a
    not-yet-known session would walk a guest into a flow that dead-ends at the
    database.
  */
  const startNewEvent = useCallback(() => {
    void (async () => {
      const current = session ?? (await getSession().catch(() => null));
      const anonymous = current?.user ? isAnonymous(current.user) : false;
      router.push(anonymous ? '/(auth)/create' : '/(onboarding)/event');
    })();
  }, [router, session]);
  const joinEvent = useCallback(() => router.push('/(modals)/join'), [router]);

  return (
    <Screen transparent padded={false}>
      {backdrop ? (
        <View style={styles.backdrop} pointerEvents="none">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: backdrop[0] }]} />
          <View style={[StyleSheet.absoluteFill, styles.backdropScrim]} />
        </View>
      ) : null}

      <View style={styles.header}>
        <Display size="md">Your Films</Display>

        <View style={styles.headerButtons}>
          <CircleIconButton
            icon="settings"
            variant={backdrop ? 'flat' : 'outline'}
            iconSize={Films.header.gearIconSize}
            iconColor={backdrop ? Colors.textSoft : Colors.textMuted}
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
          />
          {/*
            Join sits between the two the artboard draws, styled as the gear
            rather than as the plus: creating is the primary action here and two
            competing light circles would say otherwise. Not in the artboard,
            which has no join affordance on this screen at all — but a user who
            is sent an invite while already signed in has nowhere else to go.
          */}
          <CircleIconButton
            icon="users"
            variant={backdrop ? 'flat' : 'outline'}
            iconSize={Films.header.gearIconSize}
            iconColor={backdrop ? Colors.textSoft : Colors.textMuted}
            accessibilityLabel="Join a group"
            onPress={joinEvent}
          />
          {/*
            The plus is drawn light on the empty state and glass on the populated
            one — a primary action against a bare screen, a chrome control once
            there is content to sit over. design/README.md never mentions this
            button at all; the artboard draws it, and the prototype wins.
          */}
          <CircleIconButton
            icon="plus"
            variant={backdrop ? 'glass' : 'light'}
            iconSize={Films.header.plusIconSize}
            iconColor={backdrop ? Colors.text : Colors.onLight}
            accessibilityLabel="Start a memory"
            onPress={startNewEvent}
          />
        </View>
      </View>

      {/*
        Three states that have to look different from each other. Loading,
        load-failed and genuinely-empty are three different sentences, and
        flashing "No films yet." at someone who has ten reads as data loss — the
        same conflation screen 10 made once and had to have fixed.
      */}
      {state.kind === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={Colors.textMuted} />
          <Body small color={Colors.textDim}>
            Loading your films…
          </Body>
        </View>
      ) : state.kind === 'error' ? (
        <View style={styles.centered}>
          <Body small color={Colors.textDim} style={styles.errorCopy}>
            Couldn&rsquo;t load your films.{'\n'}Check your connection and try again.
          </Body>
        </View>
      ) : events.length === 0 ? (
        <>
          {showsPrompt ? (
            <View style={styles.promptEmpty}>
              <KeepYourFilm onLinked={handleLinked} onDismiss={handleDismiss} />
            </View>
          ) : null}
          <FilmEmpty onStart={startNewEvent} onJoin={joinEvent} />
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {showsPrompt ? <KeepYourFilm onLinked={handleLinked} onDismiss={handleDismiss} /> : null}

          {events.map((event) => (
            <FilmCard
              key={event.id}
              title={event.name}
              members={memberLabel(event.memberCount)}
              status={statusLabel(event, now)}
              tint={tintFor(event.id)}
              onPress={() => router.push(destinationFor(event, user?.id))}
            />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: Films.backdrop.opacity,
  },
  backdropScrim: {
    backgroundColor: Colors.backdropScrim,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Films.header.paddingX,
    paddingBottom: Films.header.gap,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Films.header.buttonGap,
  },
  list: {
    paddingHorizontal: Films.list.paddingX,
    paddingTop: Films.list.paddingTop,
    paddingBottom: Films.list.paddingBottom,
    gap: Films.list.gap,
  },
  promptEmpty: {
    paddingHorizontal: Films.list.paddingX,
    paddingTop: Films.list.paddingTop,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Films.header.buttonGap,
  },
  errorCopy: {
    textAlign: 'center',
  },
});
