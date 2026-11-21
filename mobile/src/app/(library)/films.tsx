/**
 * 15/16 · Moments
 *
 * The app's home screen for a returning user: the root layout replaces onto it
 * when a session already exists, and a sign-in on Landing lands here whenever
 * the account already has an event. So a moment here is the way back into
 * whatever that event is currently doing, not just a link to a finished album —
 * see lib/film-status.ts for the routing table.
 *
 * **Two layouts** (redesigned 2026-11-16, the user's call, replacing the
 * full-screen carousel of 2026-11-15):
 *
 *  - No moments yet: one large stack of sample prints, "Start your moment",
 *    with the join capsule on it — and that stack blurred into the backdrop.
 *    This replaces the artboard's centred empty state.
 *  - Otherwise a vertical list of compact cards (`MomentCard`): name, photo
 *    and people counts, status, and a strip of four photos whose last tile is
 *    blurred and reads "+N" when there are more. A developed moment shows its
 *    album; one that is not shows the viewer's own frames so far. With
 *    nothing to show, the strip holds sample pictures tagged "Sample". Starting and joining are the header's plus and people buttons.
 *
 * Where a tap goes: a running moment opens its camera — unless the viewer's
 * roll is used up, then the album's "developing" state; a finished one opens
 * its album. On a running moment the status capsule opens the developing
 * state (the host's "develop now" lives there) and the strip "Your shots".
 *
 * Other deviations from the artboard, all flagged in CLAUDE.md:
 *  - the title is "Moments" (was "Your Films", then "Your Moments")
 *  - the list blurs and dissolves into the page at its top edge and at the
 *    very bottom of the screen (`ScrollEdge`) instead of being cut off there
 *  - the header carries a third control, Join, between the gear and the plus
 *  - a moment reads three phases (not started / live with a countdown /
 *    developed) where the artboard draws two
 *  - a guest sees the "Keep your films" prompt, which the artboard does not draw
 *
 * It sets its own horizontal padding, so `<Screen>` cannot supply it.
 */

import type { Session } from '@supabase/supabase-js';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { NewMomentCard } from '@/components/ui/film-poster';
import { GlassButton } from '@/components/ui/glass';
import { KeepYourFilm } from '@/components/ui/keep-your-film';
import { MomentCard } from '@/components/ui/moment-card';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { ScrollEdge } from '@/components/ui/scroll-edge';
import { Spinner } from '@/components/ui/spinner';
import { Body, Display } from '@/components/ui/typography';
import { samplesFor } from '@/constants/samples';
import { Colors, Films, Glass, ScrollEdge as Edge } from '@/constants/theme';
import { getSession, isAnonymous } from '@/lib/auth';
import { loadCovers, STRIP_SIZE, type FilmCover } from '@/lib/covers';
import { isDeveloped, listMyEventSummaries, type EventSummary } from '@/lib/events';
import { destinationFor, filmPhase, statusLabel, tickIntervalMs } from '@/lib/film-status';
import { tintFor } from '@/lib/film-tint';
import { hiddenMoments } from '@/lib/hidden-moments';
import { useMomentActions } from '@/hooks/use-moment-actions';
import { dismissPrompt, isPromptDismissed } from '@/lib/prompt-dismissal';

/** One shared identity for "no events", so a non-ready render is stable. */
const EMPTY: EventSummary[] = [];
const NO_COVERS = new Map<string, FilmCover>();
const NO_PHOTOS: readonly string[] = [];
const TOP_ONLY = ['top'] as const;

/** Seeds the new-moment stack's samples and tint, the way an event id does. */
const NEW_SEED = 'new-moment';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; events: EventSummary[] }
  | { kind: 'error' };

export default function FilmsScreen() {
  const router = useRouter();
  // The list runs to the screen's physical bottom edge and dissolves there, so
  // the bottom inset is this screen's to hand out, not `<Screen>`'s.
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [covers, setCovers] = useState(NO_COVERS);
  const [session, setSession] = useState<Session | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(true);
  const [now, setNow] = useState(() => new Date());
  /**
   * The header's height. The list runs up under it (2026-11-18, the user):
   * cards slide behind "Moments" and fade out there, still faintly visible,
   * instead of being cut off at the header's lower edge.
   */
  const [headerHeight, setHeaderHeight] = useState(0);

  const load = useCallback(async (isCancelled: () => boolean) => {
    try {
      const [all, current, hidden] = await Promise.all([
        listMyEventSummaries(),
        getSession(),
        hiddenMoments(),
      ]);
      if (isCancelled()) return;

      // Moments a guest removed stay off the list (lib/hidden-moments.ts).
      const events = all.filter((event) => !hidden.has(event.id));
      setState({ kind: 'ready', events });
      setSession(current);
      setNow(new Date());

      // Photos arrive after the cards: the library should never wait on them.
      void loadCovers(events).then((next) => {
        if (!isCancelled()) setCovers(next);
      });

      // Only a guest can be offered the upgrade, and only until they decline it.
      const anonymous = current?.user ? isAnonymous(current.user) : false;
      const dismissed =
        anonymous && current?.user ? await isPromptDismissed(current.user.id) : true;
      if (!isCancelled()) setPromptDismissed(dismissed);
    } catch {
      // A failed refresh keeps the films already on screen.
      if (!isCancelled()) {
        setState((previous) => (previous.kind === 'ready' ? previous : { kind: 'error' }));
      }
    }
  }, []);

  /*
    Re-read on focus, not just on mount. Every route that creates or advances an
    event lands back here, so a library that only loaded once would show a stale
    status — and a stale strip — the moment someone took a photo.
  */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void load(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const events = useMemo(() => (state.kind === 'ready' ? state.events : EMPTY), [state]);

  /*
    Only tick while something is actually counting down, and at the rate the
    capsules are actually changing — a film in its final hour shows seconds.
    `tickIntervalMs` owns both questions; null means no timer runs at all.
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
    Hosting needs a full account; joining, shooting and looking do not.

    An anonymous session is sent to `(auth)/create` to link a provider, and that
    screen continues into onboarding once it has one. `create_event()` refuses
    an anonymous caller outright; this is only the half that gives them
    somewhere to go instead of a failure four screens later.

    The session is re-read rather than read off state because the plus is drawn
    during the initial load as well.
  */
  const startNewEvent = useCallback(() => {
    void (async () => {
      const current = session ?? (await getSession().catch(() => null));
      const anonymous = current?.user ? isAnonymous(current.user) : false;
      router.push(anonymous ? '/(auth)/create' : '/(onboarding)/event');
    })();
  }, [router, session]);
  const joinEvent = useCallback(() => router.push('/(modals)/join'), [router]);

  // --- rename / delete / remove (2026-11-21) -------------------------------

  /** Which card's menu is open — the handlers below act on it. */
  const acting = useRef<string | null>(null);
  const openMenu = useMomentActions({
    onRenamed: (name) => {
      const id = acting.current;
      setState((previous) =>
        previous.kind === 'ready'
          ? {
              kind: 'ready',
              events: previous.events.map((event) => (event.id === id ? { ...event, name } : event)),
            }
          : previous
      );
    },
    onGone: () => {
      const id = acting.current;
      setState((previous) =>
        previous.kind === 'ready'
          ? { kind: 'ready', events: previous.events.filter((event) => event.id !== id) }
          : previous
      );
    },
  });

  // --- one moment's card ---------------------------------------------------

  const renderMoment = useCallback(
    ({ item: event }: { item: EventSummary }) => {
      const cover = covers.get(event.id);
      const developed = isDeveloped(event, now);
      const phase = filmPhase(event, now);

      // Before the reveal `photoCount` is the viewer's own frames (RLS), which
      // is exactly what a used-up roll is measured in.
      const own = developed ? 0 : (cover?.photoCount ?? 0);
      const rollEmpty = phase === 'live' && event.roll_size !== null && own >= event.roll_size;

      const album = { pathname: '/(library)/album/[id]', params: { id: event.id } } as const;

      return (
        <MomentCard
          title={event.name}
          status={statusLabel(event, now)}
          phase={phase}
          members={event.memberCount}
          // Everyone's photos once they can be counted; until then the roster's
          // counters, which is what the album's "developing" state shows too.
          photoCount={developed ? (cover?.photoCount ?? event.shotsTaken) : event.shotsTaken}
          photos={cover?.uris ?? NO_PHOTOS}
          stripCount={cover?.photoCount ?? 0}
          // Nothing to show yet — nobody has shot, or only others have, and
          // theirs are hidden until the reveal: stand-ins, tagged as such.
          // Only once the covers are known, so real photos never follow samples.
          samples={cover && cover.uris.length === 0 ? samplesFor(event.id, STRIP_SIZE) : undefined}
          // Nothing left to shoot: the camera would only say so. Go and wait.
          onPress={() => router.push(rollEmpty ? album : destinationFor(event, user?.id))}
          onLongPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            acting.current = event.id;
            openMenu({
              event,
              isHost: event.host_id === user?.id,
              photoCount: event.shotsTaken,
              memberCount: event.memberCount,
            });
          }}
          // A running moment opens its camera; the capsule is the way to its
          // count, its countdown and the host's "develop now".
          onPressStatus={phase === 'live' && !rollEmpty ? () => router.push(album) : undefined}
          // On a running moment the strip is the viewer's own roll so far.
          onPressPhotos={
            phase === 'live' && own > 0
              ? () => router.push({ pathname: '/(capture)/roll', params: { eventId: event.id } })
              : undefined
          }
          photosLabel="Your photos"
        />
      );
    },
    [covers, now, openMenu, router, user?.id]
  );

  const ready = state.kind === 'ready';
  const empty = ready && events.length === 0;

  const prompt = showsPrompt ? (
    <View style={empty ? styles.promptEmpty : styles.promptList}>
      <KeepYourFilm onLinked={handleLinked} onDismiss={handleDismiss} />
    </View>
  ) : null;

  return (
    <Screen transparent padded={false} edges={TOP_ONLY}>
      {/* Only the empty state has a picture to be lit by; the list sits on the page's glow. */}
      {empty ? (
        <View style={styles.backdrop} pointerEvents="none">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tintFor(NEW_SEED)[0] }]} />
          <Image
            source={samplesFor(NEW_SEED)[0]}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={Films.backdrop.blurRadius}
            transition={Films.backdrop.transitionMs}
          />
          <View style={[StyleSheet.absoluteFill, styles.backdropScrim]} />
        </View>
      ) : null}

      <View
        style={styles.header}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
        <Display size="md">Moments</Display>

        <View style={styles.headerButtons}>
          <GlassButton
            icon="settings"
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
          />
          <GlassButton icon="users" accessibilityLabel="Join a group" onPress={joinEvent} />
          {/* Creating is the primary action here: the one light control. */}
          <CircleIconButton
            icon="plus"
            variant="light"
            size={Glass.buttonSize}
            iconSize={Films.header.plusIconSize}
            iconColor={Colors.onLight}
            accessibilityLabel="Start a moment"
            onPress={startNewEvent}
          />
        </View>
      </View>

      {/*
        Loading, load-failed and genuinely-empty are three different sentences:
        showing only the "start a moment" stack to someone who has ten reads as
        data loss.
      */}
      {state.kind === 'loading' ? (
        <View style={styles.centered}>
          <Spinner />
        </View>
      ) : state.kind === 'error' ? (
        <View style={styles.centered}>
          <Body small color={Colors.textDim} style={styles.errorCopy}>
            Couldn&rsquo;t load your moments.{'\n'}Check your connection and try again.
          </Body>
          <PillButton
            label="Try again"
            variant="secondary"
            onPress={() => {
              setState({ kind: 'loading' });
              void load(() => false);
            }}
            style={styles.retry}
          />
        </View>
      ) : empty ? (
        <>
          {prompt}
          <View style={[styles.emptyStack, { paddingBottom: Films.empty.paddingBottom + insets.bottom }]}>
            <NewMomentCard
              photos={samplesFor(NEW_SEED)}
              tint={tintFor(NEW_SEED)}
              onStart={startNewEvent}
              onJoin={joinEvent}
              style={styles.fill}
            />
          </View>
        </>
      ) : (
        <View style={[styles.listArea, { marginTop: -headerHeight }]}>
          <FlatList
            data={events}
            keyExtractor={(event) => event.id}
            renderItem={renderMoment}
            ListHeaderComponent={prompt ?? undefined}
            ItemSeparatorComponent={Separator}
            contentContainerStyle={[
              styles.list,
              {
                paddingTop: headerHeight + Edge.top - Films.header.gap,
                paddingBottom: Math.max(Films.list.paddingBottom, Edge.bottom) + insets.bottom,
              },
            ]}
            showsVerticalScrollIndicator={false}
          />
          <ScrollEdge edge="top" inset={headerHeight} />
          <ScrollEdge edge="bottom" inset={insets.bottom} />
        </View>
      )}
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    opacity: Films.backdrop.opacity,
  },
  backdropScrim: {
    backgroundColor: Colors.backdropScrim,
  },
  // Above the list, which scrolls up under it.
  header: {
    zIndex: 1,
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
  // The guest's "Keep your films" panel: above the stack, or as the list's first row.
  promptEmpty: {
    paddingHorizontal: Films.prompt.paddingX,
    paddingTop: Films.prompt.paddingTop,
    paddingBottom: Films.prompt.paddingBottom,
  },
  promptList: {
    paddingTop: Films.prompt.paddingTop,
    paddingBottom: Films.prompt.paddingBottom,
  },
  emptyStack: {
    flex: 1,
    paddingHorizontal: Films.empty.sideInset,
    paddingTop: Films.empty.paddingTop,
  },
  fill: {
    flex: 1,
  },
  // Starts right under the header, so the top edge has room to dissolve in;
  // the list's own padding keeps the first card clear of it at rest.
  listArea: {
    flex: 1,
  },
  list: {
    paddingHorizontal: Films.list.paddingX,
  },
  separator: {
    height: Films.list.gap,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Films.header.paddingX,
  },
  errorCopy: {
    textAlign: 'center',
  },
  retry: {
    marginTop: Films.header.gap,
  },
});
