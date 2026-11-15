/**
 * 15/16 · Your Films
 *
 * One screen, two states — the artboard's "empty" and "populated" library are not
 * separate routes, they are the same screen with and without events.
 *
 * This is the app's home screen for a returning user: the root layout replaces
 * onto it when a session already exists, and a sign-in on Landing lands here
 * whenever the account already has an event. So a film here is the way back into
 * whatever that event is currently doing, not just a link to a finished album —
 * see lib/film-status.ts for the routing table.
 *
 * **The populated state is a carousel, not the artboard's list** (redesigned
 * 2026-11-15, the user's call): one tall poster per film with a real photo as
 * its cover, swiped sideways, the neighbours peeking in and receding. It is a
 * native horizontal scroll, so tracking, momentum, rubber-banding and
 * interruption are the system's. Behind it the film in front is blurred into
 * the backdrop, so the screen is lit by its own content.
 *
 * Other deviations from the artboard, all flagged in CLAUDE.md:
 *  - the header carries a third control, Join, between the gear and the plus
 *  - a film reads three phases (not started / live with a countdown / developed)
 *    where the artboard draws two
 *  - a guest sees the "Keep your films" prompt, which the artboard does not draw
 *
 * It sets its own horizontal padding, so `<Screen>` cannot supply it.
 */

import type { Session } from '@supabase/supabase-js';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { FilmEmpty } from '@/components/ui/film-empty';
import { FilmPoster } from '@/components/ui/film-poster';
import { GlassButton } from '@/components/ui/glass';
import { KeepYourFilm } from '@/components/ui/keep-your-film';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Spinner } from '@/components/ui/spinner';
import { Body, Display } from '@/components/ui/typography';
import { Colors, Films, Glass } from '@/constants/theme';
import { getSession, isAnonymous } from '@/lib/auth';
import { loadCovers, type FilmCover } from '@/lib/covers';
import { listMyEventSummaries, type EventSummary } from '@/lib/events';
import { destinationFor, filmPhase, posterStatus, tickIntervalMs } from '@/lib/film-status';
import { tintFor } from '@/lib/film-tint';
import { dismissPrompt, isPromptDismissed } from '@/lib/prompt-dismissal';

const C = Films.carousel;

/** One shared identity for "no events", so a non-ready render is stable. */
const EMPTY: EventSummary[] = [];
const NO_COVERS = new Map<string, FilmCover>();

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

  const frontIndex = Math.min(Math.max(active, 0), events.length - 1);
  const front = events[frontIndex];
  const frontCover = front ? covers.get(front.id)?.uri : undefined;
  const populated = events.length > 0;

  return (
    <Screen transparent padded={false}>
      {front ? (
        <View style={styles.backdrop} pointerEvents="none">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tintFor(front.id)[0] }]} />
          {frontCover ? (
            <Image
              source={{ uri: frontCover }}
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
        <Display size="md">Your Films</Display>

        <View style={styles.headerButtons}>
          {/*
            Over the blurred backdrop the chrome is glass; on the empty state,
            where there is only the ambient glow behind it, it stays the
            artboard's quiet outline — glass needs something to refract.
          */}
          {populated ? (
            <>
              <GlassButton
                icon="settings"
                accessibilityLabel="Settings"
                onPress={() => router.push('/settings')}
              />
              <GlassButton icon="users" accessibilityLabel="Join a group" onPress={joinEvent} />
            </>
          ) : (
            <>
              <CircleIconButton
                icon="settings"
                variant="outline"
                size={Glass.buttonSize}
                iconSize={Films.header.gearIconSize}
                accessibilityLabel="Settings"
                onPress={() => router.push('/settings')}
              />
              <CircleIconButton
                icon="users"
                variant="outline"
                size={Glass.buttonSize}
                iconSize={Films.header.gearIconSize}
                accessibilityLabel="Join a group"
                onPress={joinEvent}
              />
            </>
          )}
          {/* Creating is the primary action here: the one light control. */}
          <CircleIconButton
            icon="plus"
            variant="light"
            size={Glass.buttonSize}
            iconSize={Films.header.plusIconSize}
            iconColor={Colors.onLight}
            accessibilityLabel="Start a memory"
            onPress={startNewEvent}
          />
        </View>
      </View>

      {/*
        Loading, load-failed and genuinely-empty are three different sentences:
        flashing "No films yet." at someone who has ten reads as data loss.
      */}
      {state.kind === 'loading' ? (
        <View style={styles.centered}>
          <Spinner />
        </View>
      ) : state.kind === 'error' ? (
        <View style={styles.centered}>
          <Body small color={Colors.textDim} style={styles.errorCopy}>
            Couldn&rsquo;t load your films.{'\n'}Check your connection and try again.
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
      ) : !populated ? (
        <>
          {showsPrompt ? (
            <View style={styles.prompt}>
              <KeepYourFilm onLinked={handleLinked} onDismiss={handleDismiss} />
            </View>
          ) : null}
          <FilmEmpty onStart={startNewEvent} onJoin={joinEvent} />
        </>
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
                data={events}
                keyExtractor={(event) => event.id}
                showsHorizontalScrollIndicator={false}
                snapToInterval={step}
                decelerationRate="fast"
                disableIntervalMomentum
                onScroll={onScroll}
                scrollEventThrottle={16}
                contentContainerStyle={styles.carouselContent}
                ItemSeparatorComponent={Separator}
                getItemLayout={(_, index) => ({ length: step, offset: step * index, index })}
                renderItem={({ item, index }) => {
                  const cover = covers.get(item.id);
                  const phase = filmPhase(item, now);
                  return (
                    <CarouselItem
                      index={index}
                      step={step}
                      scrollX={scrollX}
                      still={reducedMotion}
                      width={posterWidth}
                      height={carouselHeight - C.paddingTop}>
                      <FilmPoster
                        title={item.name}
                        status={posterStatus(item, cover?.photoCount ?? 0, now)}
                        phase={phase}
                        members={item.memberCount}
                        coverUri={cover?.uri}
                        tint={tintFor(item.id)}
                        onPress={() => router.push(destinationFor(item, user?.id))}
                        // A live film opens its camera; the capsule is the way to
                        // its count, its countdown and the host's "develop now".
                        onPressStatus={
                          phase === 'live'
                            ? () =>
                                router.push({
                                  pathname: '/(library)/album/[id]',
                                  params: { id: item.id },
                                })
                            : undefined
                        }
                        style={styles.poster}
                      />
                    </CarouselItem>
                  );
                }}
              />
            ) : null}
          </View>

          <View
            style={styles.dots}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Film ${frontIndex + 1} of ${events.length}`}>
            {events.length > 1
              ? events.map((event, index) => (
                  <View
                    key={event.id}
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
  /** Reduced motion: every poster stays at full size. */
  still: boolean;
  width: number;
  height: number;
  children: React.ReactNode;
};

/** A poster that recedes as it leaves the centre — continuously, with the finger. */
function CarouselItem({ index, step, scrollX, still, width, height, children }: CarouselItemProps) {
  const style = useAnimatedStyle(() => {
    if (still) return { opacity: 1, transform: [{ scale: 1 }] };
    const range = [(index - 1) * step, index * step, (index + 1) * step];
    return {
      opacity: interpolate(
        scrollX.value,
        range,
        [C.neighbourOpacity, 1, C.neighbourOpacity],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          scale: interpolate(
            scrollX.value,
            range,
            [C.neighbourScale, 1, C.neighbourScale],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  return <Animated.View style={[{ width, height }, style]}>{children}</Animated.View>;
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
