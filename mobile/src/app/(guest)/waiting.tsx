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
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Screen } from '@/components/ui/screen';
import { Body, Display, Em, Label } from '@/components/ui/typography';
import { Colors, Guest, Waiting } from '@/constants/theme';
import {
  getEvent,
  isDeveloped,
  listMembers,
  subscribeToEventStatus,
  type Event,
} from '@/lib/events';
import { askForPushOnce } from '@/lib/push';

export default function WaitingScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [hostName, setHostName] = useState<string | null>(null);

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
      router.replace({ pathname: '/(library)/album/[id]', params: { id: liveEventId } });
    } else if (event.status === 'live') {
      router.replace({ pathname: '/(capture)/camera', params: { eventId: liveEventId } });
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

  useEffect(() => {
    if (!liveEventId) return;
    return subscribeToEventStatus(liveEventId, (status) => {
      if (status === 'live') {
        router.replace({ pathname: '/(capture)/camera', params: { eventId: liveEventId } });
      } else if (status === 'developed') {
        router.replace({ pathname: '/(library)/album/[id]', params: { id: liveEventId } });
      }
    });
  }, [liveEventId, router]);

  return (
    <Screen>
      {/* Scrolls only when it has to — large text sizes can push the card past the fold. */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <Label style={styles.eyebrow}>{event?.name ?? ' '}</Label>

        <Display size="md" style={styles.headline}>
          Almost <Em>there.</Em>
        </Display>

        <View style={styles.card}>
          <WaitPing />
          <Body small color={Colors.textDim} style={styles.copy}>
            Waiting for{' '}
            <Body small color={Colors.textMuted}>
              {hostName ?? 'the host'}
            </Body>{' '}
            to start the event. The cameras open for everyone at once.
          </Body>
        </View>

      </ScrollView>
    </Screen>
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
      withTiming(1, { duration: Waiting.pingDuration, easing: Easing.out(Easing.ease) }),
      -1,
      false
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
    <View style={styles.ping} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.ringOuter, ring]} />
      <View style={styles.ringDot} />
    </View>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: Waiting.headlineGap,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Waiting.cardGap,
    padding: Waiting.cardPadding,
    borderRadius: Waiting.cardRadius,
    borderWidth: 1,
    borderColor: Waiting.cardBorder,
    backgroundColor: Waiting.cardBg,
  },
  copy: {
    flex: 1,
  },
  ping: {
    width: Waiting.pingSize,
    height: Waiting.pingSize,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Waiting.pingOffset,
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
    backgroundColor: Colors.textMuted,
  },
});
