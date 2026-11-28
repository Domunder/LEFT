/**
 * 11.5 · Guest — How this moment works (2026-11-21, the user). Not in the
 * prototype.
 *
 * A short swipe-through between the name (11) and the wait (12), once per
 * moment and phone (`lib/guest-intro.ts`), replacing the steps that made 12
 * scroll. The point the user missed most: **the roll is limited** — so page 1
 * writes the number huge.
 *
 *  1. "24 photos. That's your whole roll. No retakes." + a still of the camera
 *  2. Hidden until the end — the guest's own print clear, the others dark
 *  3. Missions, only when the moment has them
 *  4. When it develops, for everyone at once → "Got it"
 *
 * Swipe or "Next"; "Skip" at the top. It always continues to 12, which sends a
 * late joiner on to the camera or the album. A developed moment skips the
 * intro (nothing left to explain), and so does a phone that has seen it.
 * From 12's "How it works" (`replay=1`) it only goes back.
 *
 * Motion: paging is the scroll view's own (1:1, momentum); the dots and the
 * button follow the page. Nothing else moves.
 */

import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';

import { LookPreview } from '@/components/ui/look-preview';
import { MiniCamera } from '@/components/ui/mini-camera';
import { PillButton } from '@/components/ui/pill-button';
import { ProgressDots } from '@/components/ui/progress-dots';
import { em } from '@/components/ui/rich';
import { Screen } from '@/components/ui/screen';
import { Spinner } from '@/components/ui/spinner';
import { Body, Display, Label } from '@/components/ui/typography';
import { samplesFor } from '@/constants/samples';
import { Colors, GuestIntro as T, Spacing } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { t } from '@/i18n';
import { formatEndDate, formatEndTime } from '@/lib/event-end';
import { getEvent, isDeveloped, revealAt, revealModeOf, type Event } from '@/lib/events';
import { hasSeenIntro, markIntroSeen } from '@/lib/guest-intro';

export default function GuestIntroScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { eventId, replay } = useLocalSearchParams<{
    eventId?: string;
    replay?: string;
  }>();
  const replaying = replay === '1';

  const [event, setEvent] = useState<Event | null>(null);
  const [page, setPage] = useState(0);
  const pager = useRef<ScrollViewInstance>(null);

  const finish = useCallback(() => {
    if (eventId) void markIntroSeen(eventId);
    if (replaying && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace({ pathname: '/(guest)/waiting', params: { eventId } });
  }, [eventId, replaying, router]);

  useEffect(() => {
    if (!eventId) {
      router.replace('/(library)/films');
      return;
    }
    let cancelled = false;
    void (async () => {
      const seen = !replaying && (await hasSeenIntro(eventId));
      try {
        const found = await getEvent(eventId);
        if (cancelled) return;
        if (seen || isDeveloped(found)) {
          router.replace({ pathname: '/(guest)/waiting', params: { eventId } });
          return;
        }
        setEvent(found);
      } catch {
        // Offline or gone: 12 has its own handling; the intro is not worth a dead end.
        if (!cancelled) router.replace({ pathname: '/(guest)/waiting', params: { eventId } });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, replaying, router]);

  if (!event) {
    return (
      <Screen>
        <View style={styles.center}>
          <Spinner />
        </View>
      </Screen>
    );
  }

  const missions = event.missions_per_guest;
  const pages = [
    <RollPage key="roll" event={event} />,
    // A live reveal hides nothing: the page would be a lie.
    ...(revealModeOf(event) === 'live' ? [] : [<HiddenPage key="hidden" event={event} />]),
    ...(missions != null ? [<MissionsPage key="missions" count={missions} />] : []),
    <DevelopPage key="develop" event={event} />,
  ];
  const last = page === pages.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(Math.max(0, Math.min(pages.length - 1, next)));
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Label numberOfLines={1} style={styles.eventName}>
          {event.name}
        </Label>
        {last ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('guest.introSkipA11y')}
            hitSlop={T.skipHitSlop}
            onPress={finish}>
            <Text style={styles.skip}>{t('guest.introSkip')}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        style={styles.pager}>
        {pages.map((content, i) => (
          <View
            key={i}
            style={[styles.page, { width }]}
            accessibilityElementsHidden={i !== page}
            importantForAccessibility={i === page ? 'auto' : 'no-hide-descendants'}>
            {content}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <ProgressDots step={page + 1} total={pages.length} />
        <PillButton
          label={last ? t('guest.introGotIt') : t('guest.introNext')}
          onPress={() => {
            if (last) {
              finish();
              return;
            }
            pager.current?.scrollTo({ x: (page + 1) * width, animated: true });
          }}
          style={styles.next}
        />
      </View>
    </Screen>
  );
}

// --- the pages -----------------------------------------------------------------

function RollPage({ event }: { event: Event }) {
  const unlimited = event.roll_size === null;
  return (
    <>
      <View style={styles.visual}>
        <MiniCamera
          look={event.look}
          rollSize={event.roll_size}
          width={T.cameraWidth}
          cover={event}
        />
      </View>
      <View style={styles.text}>
        <Text style={styles.numeral} accessibilityLabel={unlimited ? t('guest.introUnlimited') : undefined}>
          {unlimited ? '∞' : event.roll_size}
        </Text>
        <Display size="md" style={styles.centered}>
          {em(unlimited ? t('guest.introFreelyHeadline') : t('guest.introRollHeadline'))}
        </Display>
        <Body small color={Colors.textDim} style={styles.centered}>
          {unlimited ? t('guest.introFreelyBody') : t('guest.introRollBody')}
        </Body>
      </View>
    </>
  );
}

function HiddenPage({ event }: { event: Event }) {
  const [left, right] = samplesFor(event.id, 2);
  return (
    <>
      <View style={[styles.visual, styles.prints]}>
        <View style={[styles.print, styles.printSide]}>
          <Image
            source={left}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={T.hiddenBlur}
          />
          <View style={[StyleSheet.absoluteFill, styles.printDim]} />
        </View>
        <View style={styles.print}>
          <LookPreview look={event.look} />
          <View style={styles.yoursTag}>
            <Text style={styles.yoursText}>{t('guest.introYours')}</Text>
          </View>
        </View>
        <View style={[styles.print, styles.printSide]}>
          <Image
            source={right}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={T.hiddenBlur}
          />
          <View style={[StyleSheet.absoluteFill, styles.printDim]} />
        </View>
      </View>
      <View style={styles.text}>
        <Display size="md" style={styles.centered}>
          {em(t('guest.introHiddenHeadline'))}
        </Display>
        <Body small color={Colors.textDim} style={styles.centered}>
          {t('guest.introHiddenBody')}
        </Body>
      </View>
    </>
  );
}

function MissionsPage({ count }: { count: number }) {
  return (
    <>
      <View style={[styles.visual, styles.missionVisual]}>
        <View style={styles.missionCapsule}>
          <Text style={styles.missionCapsuleText}>{t('guest.introExample')}</Text>
        </View>
        <View style={styles.missionNote}>
          <Feather name="target" size={T.missionIcon} color={Colors.text} />
          {/* One of the general missions, as an example. */}
          <Text style={styles.missionNoteText}>{t('guest.introExampleMission')}</Text>
        </View>
      </View>
      <View style={styles.text}>
        <Display size="md" style={styles.centered}>
          {em(t('guest.introMissionsHeadline'))}
        </Display>
        <Body small color={Colors.textDim} style={styles.centered}>
          {t('guest.introMissionsBody', { count })}
        </Body>
      </View>
    </>
  );
}

function DevelopPage({ event }: { event: Event }) {
  const mode = revealModeOf(event);
  const closes = new Date(event.ends_at);
  // The date written large is when the photos show — later than the end when delayed.
  const ends = (mode === 'delayed' ? revealAt(event) : null) ?? closes;
  return (
    <>
      <View style={styles.visual}>
        <Text style={styles.date}>{formatEndDate(ends)}</Text>
        <Text style={styles.time}>{formatEndTime(ends)}</Text>
      </View>
      <View style={styles.text}>
        <Display size="md" style={styles.centered}>
          {em(t(mode === 'live' ? 'guest.introLiveHeadline' : 'guest.introDevelopHeadline'))}
        </Display>
        <Body small color={Colors.textDim} style={styles.centered}>
          {mode === 'live'
            ? t('guest.introLiveBody')
            : mode === 'delayed'
              ? t('guest.introDelayedBody', {
                  end: `${formatEndDate(closes)}, ${formatEndTime(closes)}`,
                })
              : t('guest.introDevelopBody')}
        </Body>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.screenX,
    paddingTop: T.headerTop,
    minHeight: T.headerHeight,
  },
  eventName: {
    flex: 1,
  },
  skip: {
    ...Typography.labelSm,
    color: Colors.textMuted,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: Spacing.screenX,
    justifyContent: 'center',
    gap: T.visualGap,
  },
  visual: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: T.visualHeight,
  },
  text: {
    alignItems: 'center',
    gap: T.textGap,
  },
  centered: {
    textAlign: 'center',
  },
  numeral: {
    ...Typography.introNumeral,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  prints: {
    flexDirection: 'row',
    gap: T.printGap,
  },
  print: {
    width: T.printWidth,
    aspectRatio: 3 / 4,
    borderRadius: T.printRadius,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceFaint,
  },
  printSide: {
    width: T.printWidth * T.sideScale,
  },
  printDim: {
    backgroundColor: T.hiddenDim,
  },
  yoursTag: {
    position: 'absolute',
    left: T.tagInset,
    bottom: T.tagInset,
    height: T.tagHeight,
    paddingHorizontal: T.tagPaddingX,
    borderRadius: T.tagHeight / 2,
    backgroundColor: T.chip,
    justifyContent: 'center',
  },
  yoursText: {
    ...Typography.clipBadge,
    color: Colors.text,
  },
  missionVisual: {
    gap: T.missionGap,
  },
  missionCapsule: {
    height: T.missionCapsuleHeight,
    paddingHorizontal: T.missionPaddingX,
    borderRadius: T.missionCapsuleHeight / 2,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: 'center',
  },
  missionCapsuleText: {
    ...Typography.durationPill,
    color: Colors.text,
  },
  missionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.missionIconGap,
    maxWidth: T.missionNoteMax,
    paddingHorizontal: T.missionPaddingX,
    paddingVertical: T.missionPaddingY,
    borderRadius: T.missionNoteRadius,
    backgroundColor: Colors.surfaceSubtle,
  },
  missionNoteText: {
    ...Typography.titleSm,
    color: Colors.text,
    flexShrink: 1,
  },
  date: {
    ...Typography.endAnswer,
    color: Colors.text,
    textAlign: 'center',
  },
  time: {
    ...Typography.introNumeral,
    color: Colors.text,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.screenX,
    paddingBottom: T.footerBottom,
    gap: T.footerGap,
    alignItems: 'center',
  },
  next: {
    alignSelf: 'stretch',
  },
});
