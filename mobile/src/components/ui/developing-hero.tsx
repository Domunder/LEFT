/**
 * The top of a moment that is not developed yet (2026-11-23, the user,
 * replacing "Nothing to see yet"): the event image full-bleed like the
 * developed album's `AlbumHero`, the name, a large countdown to the developing,
 * the count so far, and "Back to the camera" · "Develop now" (host) as small
 * glass capsules. The gallery under it is the album screen's.
 *
 * It is the list's header, so it scrolls away with the prints; an overscroll
 * stretches the picture as in `AlbumHero`.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { EventCoverImage } from './event-cover-image';
import { GlassButton } from './glass';
import { Body, Display } from './typography';
import { Album, Colors } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { t } from '@/i18n';
import type { Event } from '@/lib/events';

const H = Album.hero;
const T = Album.developing;

type Part = { value: string; unit: string };

type DevelopingHeroProps = {
  title: string;
  cover: Pick<Event, 'id' | 'cover' | 'look'>;
  /** From `countdownParts`, ticked by the screen (the tiles share it). */
  countdown: readonly [Part, Part];
  shotsTaken: number;
  memberCount: number;
  scrollY: SharedValue<number>;
  onOpenCamera: () => void;
  /** Only the host's, only while live. */
  onDevelop?: () => void;
  developing: boolean;
};

export function DevelopingHero({
  title,
  cover,
  countdown,
  shotsTaken,
  memberCount,
  scrollY,
  onOpenCamera,
  onDevelop,
  developing,
}: DevelopingHeroProps) {
  const { height: windowHeight } = useWindowDimensions();
  const height = Math.max(H.minHeight, Math.round(windowHeight * H.heightRatio));

  const stretch = useAnimatedStyle(() => {
    const pull = Math.max(0, -scrollY.value);
    return { transform: [{ translateY: -pull / 2 }, { scale: 1 + pull / height }] };
  });

  return (
    <View style={[styles.hero, { minHeight: height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, stretch]}>
        <EventCoverImage event={cover} />
      </Animated.View>
      <LinearGradient
        pointerEvents="none"
        colors={H.shade.colors}
        locations={H.shade.locations}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content} pointerEvents="box-none">
        <Display size="xl" style={styles.title} numberOfLines={3}>
          {title}
        </Display>

        <View
          style={styles.countdown}
          accessible
          accessibilityRole="text"
          accessibilityLabel={t('album.countdownA11y', {
            time: `${countdown[0].value} ${countdown[0].unit}, ${countdown[1].value} ${countdown[1].unit}`,
          })}>
          {countdown.map((part) => (
            <View key={part.unit} style={styles.unit}>
              <Text style={styles.value}>{part.value}</Text>
              <Text style={styles.suffix}>{part.unit}</Text>
            </View>
          ))}
        </View>

        <Body small style={styles.stat}>
          {t('album.soFar', {
            photos: t('common.photos', { count: shotsTaken }),
            people: t('common.people', { count: memberCount }),
          })}
        </Body>

        <View style={styles.actions}>
          <GlassButton
            icon="camera"
            label={t('album.camera')}
            accessibilityLabel={t('album.backToCamera')}
            onPress={onOpenCamera}
          />
          {onDevelop ? (
            <GlassButton
              icon="sunrise"
              label={developing ? t('album.developing') : t('album.developNow')}
              accessibilityLabel={t('album.developNowA11y')}
              disabled={developing}
              onPress={onDevelop}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    justifyContent: 'flex-end',
    backgroundColor: Colors.bg,
  },
  content: {
    paddingHorizontal: H.paddingX,
    paddingTop: H.contentPaddingTop,
    paddingBottom: H.paddingBottom,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  countdown: {
    marginTop: T.countdownGap,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: T.unitGap,
  },
  unit: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: T.valueUnitGap,
  },
  value: {
    ...Typography.developingCount,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  suffix: {
    ...Typography.developingUnit,
    color: Colors.textMuted,
  },
  stat: {
    marginTop: T.statGap,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: H.actionGap,
    marginTop: T.actionsGap,
  },
});
