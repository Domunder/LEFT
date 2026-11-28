/**
 * The top of a developed album: **the event image** in the moment's look
 * (2026-11-21, the user: one picture heads a moment everywhere — it replaced a
 * random print of the album), full-bleed, going dark towards the bottom, with
 * the event's name, two counts and two small glass capsules — "Save all" and
 * "Share" (2026-11-21: the white full-width "Save all" was too present).
 *
 * It is the header of the album's list, so it scrolls away with the grid. On
 * an overscroll the picture stretches from its top edge instead of showing the
 * page behind it — 1:1 with the finger, so it needs no reduced-motion variant.
 * A blank film gets the same header.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { EventCoverImage } from './event-cover-image';
import { GlassButton } from './glass';
import { Display } from './typography';
import { Album, Colors } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { locale, t } from '@/i18n';
import type { Event } from '@/lib/events';

const T = Album.hero;

type AlbumHeroProps = {
  title: string;
  photoCount: number;
  memberCount: number;
  /** The moment: its event image is the picture. */
  cover: Pick<Event, 'id' | 'cover' | 'look'>;
  /** The list's scroll offset — negative while it is pulled down. */
  scrollY: SharedValue<number>;
  onSaveAll: () => void;
  /** Shares the moment's link (the album, for anyone in the group). */
  onShare: () => void;
  saveDisabled?: boolean;
};

export function AlbumHero({
  title,
  photoCount,
  memberCount,
  cover,
  scrollY,
  onSaveAll,
  onShare,
  saveDisabled = false,
}: AlbumHeroProps) {
  const { height: windowHeight } = useWindowDimensions();
  const height = Math.max(T.minHeight, Math.round(windowHeight * T.heightRatio));

  const stretch = useAnimatedStyle(() => {
    const pull = Math.max(0, -scrollY.value);
    return {
      // Scaled about its centre and moved up by half the growth: the top edge
      // follows the pull, the bottom edge stays where it is.
      transform: [{ translateY: -pull / 2 }, { scale: 1 + pull / height }],
    };
  });

  return (
    <View style={[styles.hero, { minHeight: height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, stretch]}>
        <EventCoverImage event={cover} />
      </Animated.View>

      <LinearGradient
        pointerEvents="none"
        colors={T.shade.colors}
        locations={T.shade.locations}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content} pointerEvents="box-none">
        <Display size="xl" style={styles.title} numberOfLines={3}>
          {title}
        </Display>

        <View
          style={styles.stats}
          accessible
          accessibilityLabel={t('album.statsA11y', {
            photos: t('common.photos', { count: photoCount }),
            people: t('common.people', { count: memberCount }),
          })}>
          <Stat value={photoCount} label={t('album.statPhotos', { count: photoCount })} />
          <View style={styles.divider} />
          <Stat value={memberCount} label={t('album.statPeople', { count: memberCount })} />
        </View>

        <View style={styles.actions}>
          <GlassButton
            icon="download"
            label={t('album.saveAll')}
            accessibilityLabel={t('album.saveAllA11y', { count: photoCount })}
            disabled={saveDisabled}
            onPress={onSaveAll}
          />
          <GlassButton
            icon="share"
            label={t('common.share')}
            accessibilityLabel={t('album.shareAlbum')}
            onPress={onShare}
          />
        </View>
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value.toLocaleString(locale())}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    justifyContent: 'flex-end',
    backgroundColor: Colors.bg,
  },
  content: {
    paddingHorizontal: T.paddingX,
    paddingTop: T.contentPaddingTop,
    paddingBottom: T.paddingBottom,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.statsGap,
    marginTop: T.titleGap,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: T.statLabelGap,
  },
  statValue: {
    ...Typography.albumStat,
    color: Colors.text,
  },
  statLabel: {
    ...Typography.labelSm,
    color: Colors.textDim,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: T.dividerHeight,
    backgroundColor: Colors.textFaint,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.actionGap,
    marginTop: T.actionsGap,
  },
});
