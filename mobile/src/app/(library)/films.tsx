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
 *  - Otherwise (redesigned 2026-11-21, the user, replacing the cards of
 *    2026-11-16): one moment full-bleed from the top edge (`MomentHero`),
 *    with "Moments" and the buttons floating over it — the first running
 *    one (its latest photo, the roll, the countdown, "Open camera"), or else
 *    the last developed one until the next starts (its album's first photo,
 *    the counts, "Open album"); a mock picture where there is none. Then every
 *    other moment as a row on the page (`MomentRow` — name, counts, when, and
 *    a small stack of prints with a glass "+N"), a hairline between rows, the
 *    developed ones under "Developed". No cards, no borders. A developed
 *    moment's prints are its album's; one that is not shows the viewer's own
 *    frames so far, or samples tagged "Sample". Starting and joining are the
 *    header's plus and people buttons.
 *
 * Where a tap goes: a running moment opens its camera — unless the viewer's
 * roll is used up, then the album's "developing" state; a finished one opens
 * its album. The hero's countdown opens the developing state (the host's
 * "develop now" lives there). A held moment opens its menu.
 *
 * Other deviations from the artboard, all flagged in CLAUDE.md:
 *  - the title is "Moments" (was "Your Films", then "Your Moments")
 *  - the list dissolves into the page under the header and at the very
 *    bottom of the screen (`ScrollEdge`) instead of being cut off there; over
 *    the hero the top edge stays clear until the hero has scrolled away
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
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { NewMomentCard } from '@/components/ui/film-poster';
import { GlassButton } from '@/components/ui/glass';
import { KeepYourFilm } from '@/components/ui/keep-your-film';
import { heroHeight, MomentHero } from '@/components/ui/moment-hero';
import { MomentRow } from '@/components/ui/moment-row';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { ScrollEdge } from '@/components/ui/scroll-edge';
import { Spinner } from '@/components/ui/spinner';
import { Body, Display, Label } from '@/components/ui/typography';
import { samplesFor } from '@/constants/samples';
import { Colors, Films, Glass, ScrollEdge as Edge } from '@/constants/theme';
import { getSession, isAnonymous } from '@/lib/auth';
import { loadCovers, STACK_SIZE, type FilmCover } from '@/lib/covers';
import { countdownParts } from '@/lib/event-end';
import { isDeveloped, listMyEventSummaries, type EventSummary } from '@/lib/events';
import {
  destinationFor,
  filmPhase,
  statusLabel,
  tickIntervalMs,
  type FilmPhase,
} from '@/lib/film-status';
import { tintFor } from '@/lib/film-tint';
import { hiddenMoments } from '@/lib/hidden-moments';
import { useMomentActions } from '@/hooks/use-moment-actions';
import { dismissPrompt, isPromptDismissed } from '@/lib/prompt-dismissal';

/** One shared identity for "no events", so a non-ready render is stable. */
const EMPTY: EventSummary[] = [];
const NO_COVERS = new Map<string, FilmCover>();
const NO_PHOTOS: readonly string[] = [];
/** The screen runs to the top edge itself: the hero is full-bleed, the header pads the inset. */
const NO_EDGES = [] as const;

/** What the list draws, in order: the hero, the guest's prompt, a section label, rows. */
type ListItem =
  | { kind: 'hero'; event: EventSummary }
  | { kind: 'prompt' }
  /** Room between the spotlight and the rest, which belong to the page below it. */
  | { kind: 'space' }
  | { kind: 'label'; text: string }
  | { kind: 'row'; event: EventSummary; divided: boolean };

/** "October", or "October 2025" for another year — when a developed moment was. */
function monthOf(iso: string, now: Date): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

/** The countdown's two largest units, "01d 23h". */
function countdownOf(event: EventSummary, now: Date): string {
  const [first, second] = countdownParts(new Date(event.ends_at), now);
  return `${first.value}${first.unit} ${second.value}${second.unit}`;
}

/** Seeds the new-moment stack's samples and tint, the way an event id does. */
const NEW_SEED = 'new-moment';

type LoadState =
  { kind: 'loading' } | { kind: 'ready'; events: EventSummary[] } | { kind: 'error' };

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
    }, [load]),
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
              events: previous.events.map((event) =>
                event.id === id ? { ...event, name } : event,
              ),
            }
          : previous,
      );
    },
    onGone: () => {
      const id = acting.current;
      setState((previous) =>
        previous.kind === 'ready'
          ? {
              kind: 'ready',
              events: previous.events.filter((event) => event.id !== id),
            }
          : previous,
      );
    },
  });

  // --- the list: the running moment's hero, then rows ---------------------

  const ready = state.kind === 'ready';
  const empty = ready && events.length === 0;

  const items = useMemo((): ListItem[] => {
    const phases = new Map<string, FilmPhase>(
      events.map((event) => [event.id, filmPhase(event, now)]),
    );
    // The spotlight (the user, 2026-11-21): a running moment; else one waiting to
    // be started — the soonest to end; only when every moment is developed, the
    // last one developed. A developed moment never takes it from an open one.
    const live = events.find((event) => phases.get(event.id) === 'live');
    const waiting = events
      .filter((event) => phases.get(event.id) === 'setup')
      .reduce<EventSummary | undefined>(
        (soonest, event) => (!soonest || event.ends_at < soonest.ends_at ? event : soonest),
        undefined,
      );
    const lastDeveloped = events
      .filter((event) => phases.get(event.id) === 'developed')
      .reduce<EventSummary | undefined>(
        (latest, event) => (!latest || event.ends_at > latest.ends_at ? event : latest),
        undefined,
      );
    const hero = live ?? waiting ?? lastDeveloped;
    const rest = events.filter((event) => event !== hero);
    // Whatever is still coming or running first, then the developed ones under their label.
    const open = rest.filter((event) => phases.get(event.id) !== 'developed');
    const developed = rest.filter((event) => phases.get(event.id) === 'developed');

    const list: ListItem[] = [];
    if (hero) list.push({ kind: 'hero', event: hero }, { kind: 'space' });
    if (showsPrompt) list.push({ kind: 'prompt' });
    open.forEach((event, i) => list.push({ kind: 'row', event, divided: i > 0 }));
    if (developed.length > 0) {
      list.push({ kind: 'label', text: 'Developed' });
      developed.forEach((event, i) => list.push({ kind: 'row', event, divided: i > 0 }));
    }
    return list;
  }, [events, now, showsPrompt]);

  const hasHero = items[0]?.kind === 'hero';

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === 'space') return <View style={styles.afterHero} />;
      if (item.kind === 'prompt') {
        return (
          <View style={styles.promptList}>
            <KeepYourFilm onLinked={handleLinked} onDismiss={handleDismiss} />
          </View>
        );
      }
      if (item.kind === 'label') {
        return (
          <Label small style={styles.section}>
            {item.text}
          </Label>
        );
      }

      const event = item.event;
      const cover = covers.get(event.id);
      const developed = isDeveloped(event, now);
      const phase = filmPhase(event, now);

      // Before the reveal `photoCount` is the viewer's own frames (RLS), which
      // is exactly what a used-up roll is measured in.
      const own = developed ? 0 : (cover?.photoCount ?? 0);
      const rollEmpty = phase === 'live' && event.roll_size !== null && own >= event.roll_size;

      const album = {
        pathname: '/(library)/album/[id]',
        params: { id: event.id },
      } as const;
      // Nothing left to shoot: the camera would only say so. Go and wait.
      const open = () => router.push(rollEmpty ? album : destinationFor(event, user?.id));
      const menu = () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        acting.current = event.id;
        openMenu({
          event,
          isHost: event.host_id === user?.id,
          photoCount: event.shotsTaken,
          memberCount: event.memberCount,
        });
      };

      if (item.kind === 'hero') {
        const photo = cover?.uris[0];
        const common = {
          title: event.name,
          photo,
          // Only once the covers are known, so a real photo never follows a mock.
          sample: cover && !photo ? samplesFor(event.id, 1)[0] : undefined,
          tint: tintFor(event.id)[0],
          onLongPress: menu,
          // The event image heads every moment (the user, 2026-11-21).
          cover: event,
        };

        // Not started yet: the roll, who has joined, and the way to start it
        // (the host's 10) or to wait (a guest's 12) — `destinationFor` decides.
        if (phase === 'setup') {
          return (
            <MomentHero
              {...common}
              status="Not started"
              live={false}
              primary={{
                value: event.roll_size === null ? '∞' : String(event.roll_size),
                label: event.roll_size === null ? 'unlimited roll' : 'photos each',
              }}
              secondary={{
                value: String(event.memberCount),
                label: 'joined',
              }}
              actionLabel={event.host_id === user?.id ? 'Invite & start' : 'Open'}
              onAction={open}
            />
          );
        }

        if (developed) {
          const photos = cover?.photoCount ?? event.shotsTaken;
          return (
            <MomentHero
              {...common}
              status="Developed"
              live={false}
              primary={{ value: String(photos), label: photos === 1 ? 'photo' : 'photos' }}
              secondary={{
                value: String(event.memberCount),
                label: event.memberCount === 1 ? 'person' : 'people',
              }}
              actionLabel="Open album"
              onAction={() => router.push(album)}
              quiet
            />
          );
        }

        return (
          <MomentHero
            {...common}
            status="Live now"
            live
            primary={{
              // Frames left on the viewer's roll, once their own count is known.
              value:
                cover === undefined
                  ? undefined
                  : event.roll_size === null
                    ? '∞'
                    : String(Math.max(0, event.roll_size - own)),
              label: event.roll_size === null ? 'unlimited roll' : 'shots left',
            }}
            secondary={{
              value: countdownOf(event, now),
              label: 'until it develops',
              // The way to the developing state and the host's "develop now".
              onPress: () => router.push(album),
              accessibilityLabel: `${countdownOf(event, now)} until it develops. See how the film is doing`,
            }}
            actionLabel={rollEmpty ? 'See your film' : 'Open camera'}
            onAction={open}
          />
        );
      }

      return (
        <>
          {item.divided ? <View style={styles.hairline} /> : null}
          <MomentRow
            title={event.name}
            phase={phase}
            when={developed ? monthOf(event.ends_at, now) : statusLabel(event, now)}
            members={event.memberCount}
            // Everyone's photos once they can be counted; until then the roster's
            // counters, which is what the album's "developing" state shows too.
            photoCount={developed ? (cover?.photoCount ?? event.shotsTaken) : event.shotsTaken}
            photos={cover?.uris ?? NO_PHOTOS}
            stackCount={cover?.photoCount ?? 0}
            // Nothing to show yet — nobody has shot, or only others have, and
            // theirs are hidden until the reveal: stand-ins, tagged as such.
            // Only once the covers are known, so real photos never follow samples.
            samples={
              cover && cover.uris.length === 0 ? samplesFor(event.id, STACK_SIZE) : undefined
            }
            onPress={open}
            onLongPress={menu}
          />
        </>
      );
    },
    [covers, handleDismiss, handleLinked, now, openMenu, router, user?.id],
  );

  /*
    The top edge's fade is for rows passing under the header. Over the hero it
    would only darken the photo, so it comes in as the hero leaves.
  */
  const { height: windowHeight } = useWindowDimensions();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const fadeFrom = hasHero ? heroHeight(windowHeight) - headerHeight - Edge.top : -1;
  const topEdge = useAnimatedStyle(() => ({
    opacity:
      fadeFrom < 0
        ? 1
        : interpolate(scrollY.value, [fadeFrom - Edge.top, fadeFrom], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Screen transparent padded={false} edges={NO_EDGES}>
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
        style={[styles.header, { paddingTop: insets.top }]}
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
          {showsPrompt ? (
            <View style={styles.promptEmpty}>
              <KeepYourFilm onLinked={handleLinked} onDismiss={handleDismiss} />
            </View>
          ) : null}
          <View
            style={[
              styles.emptyStack,
              { paddingBottom: Films.empty.paddingBottom + insets.bottom },
            ]}>
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
        // From the screen's top edge: the hero starts there, under the header;
        // without one, the list's padding keeps the first row clear of it.
        <View style={[styles.listArea, { marginTop: -headerHeight }]}>
          <Animated.FlatList
            data={items}
            keyExtractor={(item) =>
              item.kind === 'hero' || item.kind === 'row'
                ? item.event.id
                : `${item.kind}:${item.kind === 'label' ? item.text : ''}`
            }
            renderItem={renderItem}
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{
              paddingTop: hasHero ? 0 : headerHeight + Edge.top - Films.header.gap,
              paddingBottom: Math.max(Films.list.paddingBottom, Edge.bottom) + insets.bottom,
            }}
            showsVerticalScrollIndicator={false}
          />
          <Animated.View style={[StyleSheet.absoluteFill, topEdge]} pointerEvents="none">
            <ScrollEdge edge="top" inset={headerHeight} />
          </Animated.View>
          <ScrollEdge edge="bottom" inset={insets.bottom} />
        </View>
      )}
    </Screen>
  );
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
    paddingHorizontal: Films.prompt.paddingX,
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
  listArea: {
    flex: 1,
  },
  afterHero: {
    height: Films.list.afterHero,
  },
  section: {
    paddingHorizontal: Films.row.paddingX,
    paddingTop: Films.list.sectionPaddingTop,
    paddingBottom: Films.list.sectionPaddingBottom,
  },
  // Between two rows, inset to the text: the only line on the screen.
  hairline: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Films.row.paddingX,
    backgroundColor: Colors.hairline,
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
