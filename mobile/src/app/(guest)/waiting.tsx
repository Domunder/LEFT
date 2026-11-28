/**
 * 12 · Guest — Waiting for Host
 *
 * A guest is in the group but filming has not started. This is the screen that
 * ends by itself: it subscribes to `events.status` and advances the moment the
 * host taps "Start the Event" on 10, carrying the event id with it so the camera
 * does not have to guess which event it is filming into.
 *
 * The wait is the point, so the screen says who is being waited on. A bare
 * spinner would leave a guest wondering whether the app had stalled.
 *
 * **"Are you on the host's list?"** (2026-11-19, the user): when the host
 * listed names for personal missions, a guest can go back to 11 from here to
 * switch to one of them — or away from one — until the event starts. The link
 * shows while 11 would have something to offer: names nobody else holds, or
 * the one this guest holds.
 *
 * **One screen, no scroll** (2026-11-21, the user): the sample photo in the
 * moment's look fills the top and fades into the page, the title on its foot;
 * under the card two chips (the roll, the end) and a "How it works" row that
 * replays the intro (`(guest)/intro`, which 11 opens once per moment first).
 */

import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Glass } from '@/components/ui/glass';
import { LookPreview } from '@/components/ui/look-preview';
import { PillButton } from '@/components/ui/pill-button';
import { PressScale } from '@/components/ui/press-scale';
import { em } from '@/components/ui/rich';
import { Screen } from '@/components/ui/screen';
import { Body, Display, Label } from '@/components/ui/typography';
import {
  Colors,
  Glass as GlassTokens,
  Guest,
  MissionsJoin,
  Spacing,
  Waiting,
} from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { t } from '@/i18n';
import { useEventCover } from '@/lib/event-cover';
import { formatEndDate, formatEndTime } from '@/lib/event-end';
import {
  getEvent,
  isDeveloped,
  revealAt,
  listMembers,
  subscribeToEventStatus,
  type Event,
} from '@/lib/events';
import { listUnclaimedNames, type MissionName } from '@/lib/missions';
import { askForPushOnce } from '@/lib/push';

export default function WaitingScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const { height: windowHeight } = useWindowDimensions();
  const backdropHeight = Math.round(windowHeight * Waiting.backdrop.heightRatio);
  const insets = useSafeAreaInsets();

  const [event, setEvent] = useState<Event | null>(null);
  const cover = useEventCover(event);
  const [hostName, setHostName] = useState<string | null>(null);
  /** The host's names this guest could switch to (or holds). Empty hides the link. */
  const [names, setNames] = useState<MissionName[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const found = eventId ? await getEvent(eventId) : null;
        if (cancelled || !found) return;

        setEvent(found);

        const host = (await listMembers(found.id)).find((m) => m.role === 'host');
        if (!cancelled) setHostName(host?.display_name ?? null);
      } catch {
        // The waiting copy reads fine without a name; the subscription is what matters.
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const liveEventId = event?.id;

  /*
    Already live by the time we got here — a guest who joined late, or one
    returning after a force-quit. Nothing to wait for.
  */
  useEffect(() => {
    if (!event || !liveEventId) return;
    if (isDeveloped(event)) {
      // Joined after the event ended: the link that let people shoot now opens the album.
      router.replace({
        pathname: '/(library)/album/[id]',
        params: { id: liveEventId },
      });
    } else if (event.status === 'live') {
      router.replace({
        pathname: '/(capture)/camera',
        params: { eventId: liveEventId },
      });
    }
  }, [event, liveEventId, router]);

  /*
    The notification prompt, for a guest who is actually waiting. They have just
    joined something that ends later without them — the one moment "tell me when
    the photos are developed" needs no explaining. Not when the cameras are
    already open: that guest is on their way to the camera's own permission
    prompt, and is asked after their first shot instead.
  */
  const waiting = !!event && event.status === 'setup' && !isDeveloped(event);
  useEffect(() => {
    if (waiting) askForPushOnce();
  }, [waiting]);

  /*
    Asked again whenever the screen comes back into view (from 11) and on an
    interval, so the link leaves once nobody's name is left to pick.
  */
  const inviteCode = waiting && event?.missions_per_guest != null ? event.invite_code : null;
  const focused = useIsFocused();
  useEffect(() => {
    if (!inviteCode || !focused) return;
    let cancelled = false;
    const load = () =>
      listUnclaimedNames(inviteCode)
        .then((list) => {
          if (!cancelled) setNames(list);
        })
        .catch(() => undefined);
    void load();
    const timer = setInterval(load, MissionsJoin.refreshMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [inviteCode, focused]);

  const mine = names.find((n) => n.mine);

  useEffect(() => {
    if (!liveEventId) return;
    return subscribeToEventStatus(liveEventId, (status) => {
      if (status === 'live') {
        router.replace({
          pathname: '/(capture)/camera',
          params: { eventId: liveEventId },
        });
      } else if (status === 'developed') {
        router.replace({
          pathname: '/(library)/album/[id]',
          params: { id: liveEventId },
        });
      }
    });
  }, [liveEventId, router]);

  const ends = event ? new Date(event.ends_at) : null;

  return (
    <View style={styles.root}>
      {/*
        The event image in the moment's look, fading into the page (2026-11-21,
        the user) — picked by the host on 03.1, a stock picture otherwise.
      */}
      <View style={[styles.backdrop, { height: backdropHeight }]} pointerEvents="none">
        {event && cover !== null ? (
          <LookPreview key={String(cover)} look={event.look} source={cover} />
        ) : null}
        <LinearGradient
          colors={Waiting.backdrop.fade}
          locations={Waiting.backdrop.fadeLocations}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <Screen transparent>
        {/* Scrolls only when it has to — large text sizes can push the text past the fold. */}
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: backdropHeight * Waiting.backdrop.titleAt },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <Label style={styles.eyebrow}>{event?.name ?? ' '}</Label>

          <Display size="lg" style={styles.headline}>
            {em(t('guest.waitingHeadline'))}
          </Display>

          {/* No cards (2026-11-21, the user): the wait, then the facts, on the page itself. */}
          <View style={styles.waitRow}>
            <WaitPing />
            <Body color={Colors.textDim} style={styles.copy}>
              {/* The marked run is who is waited on, drawn brighter. */}
              {(hostName ? t('guest.waitingForName') : t('guest.waitingForHost'))
                .split('*')
                .map((part, index) =>
                  index % 2 === 1 ? (
                    <Body key={index} color={Colors.text}>
                      {part.replace('{name}', () => hostName ?? '')}
                    </Body>
                  ) : (
                    part
                  )
                )}
            </Body>
          </View>

          {event && ends ? (
            <>
              <View style={styles.facts}>
                <Fact
                  icon="camera"
                  label={
                    event.roll_size === null
                      ? t('guest.rollEachUnlimited')
                      : t('guest.rollEach', { count: event.roll_size })
                  }
                />
                <Fact
                  icon="clock"
                  label={
                    event.reveal_mode === 'live'
                      ? t('guest.photosLive')
                      : t('guest.develops', {
                          date: formatEndDate(revealAt(event) ?? ends),
                          time: formatEndTime(revealAt(event) ?? ends),
                        })
                  }
                />
              </View>
            </>
          ) : null}

          {/* At the foot of the page: the wait is still the screen. */}
          <View style={styles.foot}>
            {inviteCode && names.length > 0 ? (
              <View>
                <Body small color={Colors.textDim} style={styles.namesCopy}>
                  {mine
                    ? t('guest.onListAs', { name: mine.name })
                    : t('guest.listHint')}
                </Body>
                <PillButton
                  variant="secondary"
                  label={mine ? t('guest.changeName') : t('guest.onTheList')}
                  onPress={() =>
                    router.push({
                      pathname: '/(guest)/name',
                      params: { code: inviteCode, change: '1' },
                    })
                  }
                />
              </View>
            ) : null}

            {event ? (
              <PillButton
                variant="secondary"
                icon="info"
                label={t('guest.howItWorks')}
                onPress={() =>
                  router.push({
                    pathname: '/(guest)/intro',
                    params: { eventId: event.id, replay: '1' },
                  })
                }
              />
            ) : null}
          </View>
        </ScrollView>
      </Screen>

      {/*
        Invite more people (2026-11-21, the user): 09 with the QR and the link,
        as the camera's invite tile opens it. Glass, because it floats over the
        event image.
      */}
      {event ? (
        <View style={[styles.chrome, { top: insets.top + Waiting.chromeInset }]}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={t('guest.inviteA11y')}
            accessibilityHint={t('guest.inviteHint')}
            scale={GlassTokens.pressScale}
            onPress={() =>
              router.push({
                pathname: '/(host)/invite',
                params: { eventId: event.id, from: 'waiting' },
              })
            }>
            <Glass radius={GlassTokens.buttonSize / 2} interactive style={styles.qr}>
              <MaterialCommunityIcons name="qrcode" size={Waiting.qrIconSize} color={Colors.text} />
            </Glass>
          </PressScale>
        </View>
      ) : null}
    </View>
  );
}

/** "24 photos each", "Develops Sat, 22 Nov at 23:00" — on the page, no chip. */
function Fact({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
}) {
  return (
    <View style={styles.fact}>
      <Feather name={icon} size={Waiting.fact.iconSize} color={Colors.textMuted} />
      <Text style={styles.factText}>{label}</Text>
    </View>
  );
}

/**
 * The artboard's `wait-ping` — a ring expanding out of a solid dot and fading.
 *
 * Scale and opacity animate together on one repeating timing rather than as a
 * spring: this is a metronome telling a guest the app is still listening, and it
 * should look identical on every cycle.
 */
function WaitPing() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, {
        duration: Waiting.pingDuration,
        easing: Easing.out(Easing.ease),
      }),
      -1,
      false,
    );
    return () => {
      pulse.value = 0;
    };
  }, [pulse]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * (Waiting.pingScale - 1) }],
    opacity: Waiting.pingOpacity * (1 - pulse.value),
  }));

  return (
    <View
      style={styles.ping}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.ringOuter, ring]} />
      <View style={styles.ringDot} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  // Vertical padding lives on the scroll content so the viewport itself is not inset.
  content: {
    flexGrow: 1,
    paddingTop: Guest.paddingTop,
    paddingBottom: Guest.paddingBottom,
  },
  eyebrow: {
    marginBottom: Guest.eyebrowGap,
  },
  headline: {
    marginBottom: Waiting.backdrop.headlineGap,
  },
  waitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Waiting.cardGap,
  },
  copy: {
    flex: 1,
  },
  facts: {
    marginTop: Waiting.fact.top,
    gap: Waiting.fact.gap,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Waiting.fact.iconGap,
  },
  factText: {
    ...Typography.titleMd,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  // Top right (the user, 2026-11-21).
  chrome: {
    position: 'absolute',
    right: Spacing.screenX,
  },
  qr: {
    width: GlassTokens.buttonSize,
    height: GlassTokens.buttonSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // At the foot of the page: the wait is still the screen.
  // The names prompt and "How it works", pinned to the bottom of the page.
  foot: {
    marginTop: 'auto',
    paddingTop: Waiting.headlineGap,
    gap: Waiting.footGap,
  },
  namesCopy: {
    marginBottom: Spacing.md,
  },
  // As wide as the ring grows, so the scroll view's edge never clips it.
  ping: {
    width: Waiting.pingSize * Waiting.pingScale,
    height: Waiting.pingSize * Waiting.pingScale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    position: 'absolute',
    width: Waiting.pingSize,
    height: Waiting.pingSize,
    borderRadius: Waiting.pingSize / 2,
    backgroundColor: Colors.text,
  },
  ringDot: {
    width: Waiting.dotSize,
    height: Waiting.dotSize,
    borderRadius: Waiting.dotSize / 2,
    backgroundColor: Colors.text,
  },
});
