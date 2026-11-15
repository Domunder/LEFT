/**
 * 15/16 · Your Moments
 *
 * The app's home screen for a returning user: the root layout replaces onto it
 * when a session already exists, and a sign-in on Landing lands here whenever
 * the account already has an event. So a moment here is the way back into
 * whatever that event is currently doing, not just a link to a finished album —
 * see lib/film-status.ts for the routing table.
 *
 * **It is a carousel of photo stacks, not the artboard's list** (redesigned
 * 2026-11-15, the user's call): each moment is a stack of prints, the front
 * one carrying its title, two more fanned out behind it. A developed moment
 * shows its album; one that is not shows dimmed sample pictures, tagged
 * "Sample". The carousel always ends in one more stack that starts a new
 * moment — with no moments yet it is the only one, which replaces the
 * artboard's centred empty state.
 *
 * It is a native horizontal scroll, so tracking, momentum, rubber-banding and
 * interruption are the system's. Behind it the stack in front is blurred into
 * the backdrop, so the screen is lit by its own content.
 *
 * Other deviations from the artboard, all flagged in CLAUDE.md:
 *  - the title is "Your Moments" (was "Your Films")
 *  - the header carries a third control, Join, between the gear and the plus
 *  - a moment reads three phases (not started / live with a countdown /
 *    developed) where the artboard draws two
 *  - a guest sees the "Keep your films" prompt, which the artboard does not draw
 *
 * It sets its own horizontal padding, so `<Screen>` cannot supply it.
 */

import type { Session } from '@supabase/supabase-js';
import { Image, type ImageSource } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { FilmPoster, NewMomentCard } from '@/components/ui/film-poster';
import { GlassButton } from '@/components/ui/glass';
import { KeepYourFilm } from '@/components/ui/keep-your-film';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Spinner } from '@/components/ui/spinner';
import { Body, Display } from '@/components/ui/typography';
import { samplesFor } from '@/constants/samples';
import { Colors, Films, Glass } from '@/constants/theme';
import { getSession, isAnonymous } from '@/lib/auth';
import { loadCovers, type FilmCover } from '@/lib/covers';
import { isDeveloped, listMyEventSummaries, type EventSummary } from '@/lib/events';
import { destinationFor, filmPhase, posterStatus, tickIntervalMs } from '@/lib/film-status';
import { tintFor } from '@/lib/film-tint';
import { dismissPrompt, isPromptDismissed } from '@/lib/prompt-dismissal';

const C = Films.carousel;

/** One shared identity for "no events", so a non-ready render is stable. */
const EMPTY: EventSummary[] = [];
const NO_COVERS = new Map<string, FilmCover>();

/** What the carousel scrolls: every moment, then the stack that starts a new one. */
type Item = { kind: 'moment'; event: EventSummary } | { kind: 'new' };

const NEW_ITEM: Item = { kind: 'new' };
/** Seeds the new-moment stack's samples and tint, the way an event id does. */
const NEW_SEED = 'new-moment';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; events: EventSummary[] }
  | { kind: 'error' };

export default function FilmsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [covers, setCovers] = useState(NO_COVERS);
  const [session, setSession] = useState<Session | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [active, setActive] = useState(0);
  const [carouselHeight, setCarouselHeight] = useState(0);

  const load = useCallback(async (isCancelled: () => boolean) => {
    try {
      const [events, current] = await Promise.all([listMyEventSummaries(), getSession()]);
      if (isCancelled()) return;

      setState({ kind: 'ready', events });
      setSession(current);
      setNow(new Date());

      // Covers arrive after the posters: the library should never wait on photos.
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
    status — and a stale cover — the moment someone took a photo.
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

  // --- the carousel ---------------------------------------------------------

  const posterWidth = width - 2 * C.sideInset;
  const step = posterWidth + C.gap;

  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  // The film in front drives the backdrop and the page dots.
  useAnimatedReaction(
    () => Math.round(scrollX.value / step),
    (index, previous) => {
      if (index !== previous) scheduleOnRN(setActive, index);
    }
  );

  const onCarouselLayout = useCallback((event: LayoutChangeEvent) => {
    setCarouselHeight(event.nativeEvent.layout.height);
  }, []);

  const items = useMemo<Item[]>(
    () => [...events.map((event): Item => ({ kind: 'moment', event })), NEW_ITEM],
    [events]
  );

  /** A moment's stack: its album once developed, samples until then. */
  const stackFor = useCallback(
    (event: EventSummary): { photos: ImageSource[]; sample: boolean } => {
      if (!isDeveloped(event, now)) return { photos: samplesFor(event.id), sample: true };
      return {
        photos: (covers.get(event.id)?.uris ?? []).map((uri) => ({ uri })),
        sample: false,
      };
    },
    [covers, now]
  );

  const ready = state.kind === 'ready';
  const frontIndex = Math.min(Math.max(active, 0), items.length - 1);
  const front = items[frontIndex];
  const frontSeed = front.kind === 'moment' ? front.event.id : NEW_SEED;
  const frontPhoto =
    front.kind === 'moment' ? stackFor(front.event).photos[0] : samplesFor(NEW_SEED)[0];

  return (
    <Screen transparent padded={false}>
      {ready ? (
        <View style={styles.backdrop} pointerEvents="none">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tintFor(frontSeed)[0] }]} />
          {frontPhoto ? (
            <Image
              source={frontPhoto}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={Films.backdrop.blurRadius}
              transition={Films.backdrop.transitionMs}
            />
          ) : null}
          <View style={[StyleSheet.absoluteFill, styles.backdropScrim]} />
        </View>
      ) : null}

      <View style={styles.header}>
        <Display size="md">Your Moments</Display>

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
      ) : (
        <>
          {showsPrompt ? (
            <View style={styles.prompt}>
              <KeepYourFilm onLinked={handleLinked} onDismiss={handleDismiss} />
            </View>
          ) : null}

          <View style={styles.carousel} onLayout={onCarouselLayout}>
            {carouselHeight > 0 ? (
              <Animated.FlatList
                horizontal
                data={items}
                keyExtractor={(item) => (item.kind === 'moment' ? item.event.id : NEW_SEED)}
                showsHorizontalScrollIndicator={false}
                snapToInterval={step}
                decelerationRate="fast"
                disableIntervalMomentum
                onScroll={onScroll}
                scrollEventThrottle={16}
                contentContainerStyle={styles.carouselContent}
                ItemSeparatorComponent={Separator}
                getItemLayout={(_, index) => ({ length: step, offset: step * index, index })}
                renderItem={({ item, index }) => (
                  <CarouselItem
                    index={index}
                    step={step}
                    scrollX={scrollX}
                    still={reducedMotion}
                    width={posterWidth}
                    height={carouselHeight - C.paddingTop}>
                    {(spread) => {
                      if (item.kind === 'new') {
                        return (
                          <NewMomentCard
                            photos={samplesFor(NEW_SEED)}
                            tint={tintFor(NEW_SEED)}
                            spread={spread}
                            onStart={startNewEvent}
                            onJoin={joinEvent}
                            style={styles.poster}
                          />
                        );
                      }

                      const { event } = item;
                      const phase = filmPhase(event, now);
                      const stack = stackFor(event);
                      return (
                        <FilmPoster
                          title={event.name}
                          status={posterStatus(event, covers.get(event.id)?.photoCount ?? 0, now)}
                          phase={phase}
                          members={event.memberCount}
                          photos={stack.photos}
                          sample={stack.sample}
                          tint={tintFor(event.id)}
                          spread={spread}
                          onPress={() => router.push(destinationFor(event, user?.id))}
                          // A live moment opens its camera; the capsule is the way to
                          // its count, its countdown and the host's "develop now".
                          onPressStatus={
                            phase === 'live'
                              ? () =>
                                  router.push({
                                    pathname: '/(library)/album/[id]',
                                    params: { id: event.id },
                                  })
                              : undefined
                          }
                          style={styles.poster}
                        />
                      );
                    }}
                  </CarouselItem>
                )}
              />
            ) : null}
          </View>

          <View
            style={styles.dots}
            accessible
            accessibilityRole="text"
            accessibilityLabel={
              front.kind === 'new'
                ? 'Start a moment'
                : `Moment ${frontIndex + 1} of ${events.length}`
            }>
            {items.length > 1
              ? items.map((item, index) => (
                  <View
                    key={item.kind === 'moment' ? item.event.id : NEW_SEED}
                    style={[styles.dot, index === frontIndex && styles.dotActive]}
                  />
                ))
              : null}
          </View>
        </>
      )}
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

type CarouselItemProps = {
  index: number;
  step: number;
  scrollX: SharedValue<number>;
  /** Reduced motion: every stack stays at full size, fanned out. */
  still: boolean;
  width: number;
  height: number;
  /** Handed how far the stack's fan is open: 1 in front, less beside it. */
  children: (spread: SharedValue<number>) => React.ReactNode;
};

/** A stack that recedes and squares up as it leaves the centre — with the finger. */
function CarouselItem({ index, step, scrollX, still, width, height, children }: CarouselItemProps) {
  /** 0 in front, 1 a whole page away. */
  const distance = useDerivedValue(() =>
    still ? 0 : Math.min(Math.abs(scrollX.value / step - index), 1)
  );

  const spread = useDerivedValue(() =>
    interpolate(distance.value, [0, 1], [1, Films.stack.restSpread])
  );

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(distance.value, [0, 1], [1, C.neighbourOpacity]),
    transform: [{ scale: interpolate(distance.value, [0, 1], [1, C.neighbourScale]) }],
  }));

  return <Animated.View style={[{ width, height }, style]}>{children(spread)}</Animated.View>;
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
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
  prompt: {
    paddingHorizontal: Films.prompt.paddingX,
    paddingTop: Films.prompt.paddingTop,
    paddingBottom: Films.prompt.paddingBottom,
  },
  carousel: {
    flex: 1,
    paddingTop: C.paddingTop,
  },
  carouselContent: {
    paddingHorizontal: C.sideInset,
  },
  separator: {
    width: C.gap,
  },
  poster: {
    flex: 1,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: C.dotGap,
    height: C.dotSize,
    marginTop: C.dotsGap,
    marginBottom: C.dotsBottom,
  },
  dot: {
    width: C.dotSize,
    height: C.dotSize,
    borderRadius: C.dotSize / 2,
    backgroundColor: Colors.dotCompleted,
  },
  dotActive: {
    width: C.dotActiveWidth,
    backgroundColor: Colors.text,
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
