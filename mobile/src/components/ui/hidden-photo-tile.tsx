/**
 * Someone else's print before the reveal (2026-11-23, the user): its blurhash
 * — a colour smudge, nothing recognisable — with the photographer's name and a
 * small countdown on glass. Not pressable: there is nothing to open yet.
 *
 * The smudge is all the server hands out before the developing
 * (`event_gallery()`); without one (upload on its way, or an older client)
 * the tile is a dark frame.
 */

import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Glass } from './glass';
import { Album, Colors, PhotoTile } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { t } from '@/i18n';

const T = Album.developing;
const Tile = Album.tile;

type HiddenPhotoTileProps = {
  blurhash: string | null;
  author?: string;
  /** "01d 23h" — the screen ticks it for every tile at once. */
  countdown: string;
  style?: StyleProp<ViewStyle>;
};

export function HiddenPhotoTile({ blurhash, author, countdown, style }: HiddenPhotoTileProps) {
  return (
    <View
      style={[styles.tile, style]}
      accessible
      accessibilityLabel={
        author
          ? t('album.hiddenByA11y', { author, time: countdown })
          : t('album.hiddenA11y', { time: countdown })
      }>
      {blurhash ? (
        <>
          <Image
            source={{ blurhash }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={T.smudgeFadeMs}
          />
          <View style={[StyleSheet.absoluteFill, styles.dim]} />
        </>
      ) : null}

      <View style={styles.center} pointerEvents="none">
        <Glass radius={T.badgeHeight / 2} style={styles.badge}>
          <Feather name="clock" size={T.badgeIcon} color={Colors.text} />
          <Text style={styles.badgeText}>{countdown}</Text>
        </Glass>
      </View>

      {author ? (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={Tile.captionFade}
            style={styles.captionFade}
          />
          <Text style={styles.caption} numberOfLines={1}>
            {author}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    aspectRatio: PhotoTile.aspectRatio,
    borderRadius: Tile.radius,
    overflow: 'hidden',
    backgroundColor: T.frameFill,
  },
  dim: {
    backgroundColor: T.smudgeDim,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    height: T.badgeHeight,
    paddingHorizontal: T.badgePaddingX,
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.badgeIconGap,
  },
  badgeText: {
    ...Typography.durationPill,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  captionFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: Tile.captionFadeHeight,
  },
  caption: {
    ...Typography.tileCaptionSm,
    position: 'absolute',
    left: Tile.captionPaddingX,
    right: Tile.captionPaddingX,
    bottom: Tile.captionPaddingBottom,
    color: Colors.text,
  },
});
