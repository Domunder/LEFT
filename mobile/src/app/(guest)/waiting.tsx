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
 * **It also teaches the format**, which no other screen a guest sees ever does.
 * A host learns the shared budget across 02→05.1 and can reopen it from 10.1's
 * info button; a guest scans a QR, types a name and arrives here — and the next
 * thing they see after this is a live camera spending time out of a pool nobody
 * told them about. So `BudgetExplainer` (the body of 10.1) sits under the
 * waiting card, where there is a genuine gap to fill rather than a screen to
 * interrupt.
 *
 * Shown only to **anonymous** guests. Somebody who is signed in reached this app
 * as a host at some point and has already been walked through it; re-explaining
 * the premise to them would be talking down. `isAnonymous` is the same test the
 * keep-your-film prompt uses.
 *
 * It is on the page rather than presented as the 10.1 modal on top of it: this
 * screen ends by itself the moment the host starts, and a sheet pushed over a
 * route that is about to `replace` itself is left stranded above the camera.
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

import { BudgetExplainer } from '@/components/ui/budget-explainer';
import { Screen } from '@/components/ui/screen';
import { Body, Display, Em, Label } from '@/components/ui/typography';
import { Colors, Guest, Waiting } from '@/constants/theme';
import { getSession, isAnonymous } from '@/lib/auth';
import { getEvent, listMembers, subscribeToEventStatus, type Event } from '@/lib/events';

export default function WaitingScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [hostName, setHostName] = useState<string | null>(null);

  /*
    Starts false so the explainer fades in with the answer rather than being torn
    off the screen once the session resolves — see the note at the top for who
    gets it and why.
  */
  const [explain, setExplain] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveAudience() {
      try {
        const session = await getSession();
        const user = session?.user;
        if (!cancelled && user) setExplain(isAnonymous(user));
      } catch {
        // No session to read. The wait still works; the lesson is what's missed.
      }
    }

    void resolveAudience();
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (event.status !== 'setup') {
      router.replace({ pathname: '/(capture)/camera', params: { eventId: liveEventId } });
    }
  }, [event, liveEventId, router]);

  useEffect(() => {
    if (!liveEventId) return;
    return subscribeToEventStatus(liveEventId, (status) => {
      if (status === 'live') {
        router.replace({ pathname: '/(capture)/camera', params: { eventId: liveEventId } });
      }
    });
  }, [liveEventId, router]);

  return (
    <Screen>
      {/*
        Scrolls only when it has to. The wait on its own sits comfortably above
        the fold; the explainer under it does not on a small phone, and a lesson
        with its last line cut off teaches worse than no lesson.
      */}
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
            to start the event. Filming begins for everyone at once.
          </Body>
        </View>

        {explain ? <BudgetExplainer style={styles.explainer} /> : null}
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
  /*
    The screen's vertical padding lives on the scroll content, not on the Screen:
    on the wrapper it would inset the viewport itself and the explainer would run
    out of room 120px early.
  */
  content: {
    flexGrow: 1,
    paddingTop: Guest.paddingTop,
    paddingBottom: Guest.paddingBottom,
  },
  explainer: {
    marginTop: Waiting.explainerGap,
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
