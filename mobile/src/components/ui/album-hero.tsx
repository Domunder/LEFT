/**
 * The top of a developed album: one of its photos, full-bleed, going dark
 * towards the bottom, with the event's name, two counts and "Save all" on it.
 *
 * It is the header of the album's list, so it scrolls away with the grid. On
 * an overscroll the picture stretches from its top edge instead of showing the
 * page behind it — 1:1 with the finger, so it needs no reduced-motion variant.
 *
 * The picture is the 640px thumbnail at first (already on the phone from the
 * grid) and the original over it once that has a URL: a thumbnail alone is
 * soft at this size.
 *
 * Without a photo (a film that came back blank) it is only the title block.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PillButton } from './pill-button';
import { Display } from './typography';
import { Album, Colors } from '@/constants/theme';
import { Typography } from '@/constants/typography';

const T = Album.hero;

type AlbumHeroProps = {
  title: string;
  photoCount: number;
  memberCount: number;
  /** The chosen photo; absent for an album without photos. */
  photo?: { id: string; thumbUri: string; fullUri?: string };
  /** The list's scroll offset — negative while it is pulled down. */
  scrollY: SharedValue<number>;
  /** Drawn over the picture and under the text — the reveal's veil. */
  veil?: ReactNode;
  onPressPhoto?: () => void;
  onSaveAll: () => void;
  saveDisabled?: boolean;
};

export function AlbumHero({
  title,
  photoCount,
  memberCount,
  photo,
  scrollY,
  veil,
  onPressPhoto,
  onSaveAll,
  saveDisabled = false,
}: AlbumHeroProps) {
  const insets = useSafeAreaInsets();
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

  if (!photo) {
    return (
      <View style={[styles.plain, { paddingTop: insets.top + T.plainPaddingTop }]}>
        <Display size="xl" style={styles.title}>
          {title}
        </Display>
      </View>
    );
  }

  return (
    <View style={[styles.hero, { minHeight: height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, stretch]}>
        <Image
          source={{ uri: photo.thumbUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={photo.id}
          transition={0}
        />
        {photo.fullUri ? (
          <Image
            source={{ uri: photo.fullUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={T.sharpenMs}
          />
        ) : null}
        {veil}
      </Animated.View>

      <LinearGradient
        pointerEvents="none"
        colors={T.shade.colors}
        locations={T.shade.locations}
        style={StyleSheet.absoluteFill}
      />

      {onPressPhoto ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel="Open this photo"
          onPress={onPressPhoto}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <View style={styles.content} pointerEvents="box-none">
        <Display size="xl" style={styles.title} numberOfLines={3}>
          {title}
        </Display>

        <View style={styles.stats} accessible accessibilityLabel={`${photoCount} photos, ${memberCount} people`}>
          <Stat value={photoCount} label={photoCount === 1 ? 'Photo' : 'Photos'} />
          <View style={styles.divider} />
          <Stat value={memberCount} label={memberCount === 1 ? 'Person' : 'People'} />
        </View>

        <PillButton
          label="Save all"
          icon="download"
          disabled={saveDisabled}
          onPress={onSaveAll}
          style={styles.save}
        />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value.toLocaleString('en-US')}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    justifyContent: 'flex-end',
    backgroundColor: Colors.bg,
  },
  plain: {
    paddingHorizontal: T.paddingX,
    paddingBottom: T.paddingBottom,
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
  save: {
    alignSelf: 'stretch',
    marginTop: T.actionsGap,
  },
});
