/**
 * One moment in the library's list (16): its name, how many photos and people
 * it has, where it stands, and a strip of its photos.
 *
 * Designed 2026-11-16, replacing the full-screen stack of the carousel: a
 * thumbnail stretched over the whole screen looked soft, and only one moment
 * fitted. Here a thumbnail is drawn at a quarter of the card's width, which is
 * what it was made for, and three moments fit on a screen.
 *
 * The strip has `STRIP_SIZE` tiles. With more photos than tiles the last one is
 * blurred and carries "+N" — the rest of the album. Where there is no photo
 * yet the tile is an empty frame. Which photos those are is the caller's
 * business (`lib/covers.ts`): the album's once developed, the viewer's own
 * before that.
 *
 * A flat surface, not `Glass`: the card sits on the page, not on a picture.
 * The whole card answers on touch-down and opens on release; the status
 * capsule and the strip may lead somewhere else (`onPressStatus`,
 * `onPressPhotos`), and then each is a target of its own.
 *
 * Purely presentational: what the capsule says and where a tap goes are
 * computed by lib/film-status.ts and handed in.
 */

import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { PressScale } from './press-scale';
import { Display } from './typography';
import { Colors, Films } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { STRIP_SIZE } from '@/lib/covers';
import { memberLabel, photoLabel, type FilmPhase } from '@/lib/film-status';

const T = Films.moment;

type MomentCardProps = {
  title: string;
  /** "1d 23h left", "Developed", "Not started". */
  status: string;
  phase: FilmPhase;
  /** The roster size. */
  members: number;
  /** Every photo of the moment so far — the number beside the title. */
  photoCount: number;
  /** Up to `STRIP_SIZE` thumbnails, first tile first. */
  photos: readonly string[];
  /** How many photos the strip stands for; above `STRIP_SIZE` the last tile reads "+N". */
  stripCount: number;
  onPress: () => void;
  /** Tapping the status capsule — a running moment's way to its developing state. */
  onPressStatus?: () => void;
  /** Set when the strip leads somewhere other than the card does. */
  onPressPhotos?: () => void;
  photosLabel?: string;
};

export function MomentCard({
  title,
  status,
  phase,
  members,
  photoCount,
  photos,
  stripCount,
  onPress,
  onPressStatus,
  onPressPhotos,
  photosLabel,
}: MomentCardProps) {
  const shown = photos.slice(0, STRIP_SIZE);
  // The last tile gives way to the count, so it stands for itself and the rest.
  const more = stripCount > STRIP_SIZE ? stripCount - (STRIP_SIZE - 1) : 0;

  const strip = (
    <View style={styles.strip}>
      {Array.from({ length: STRIP_SIZE }, (_, i) => {
        const uri = shown[i];
        const counted = more > 0 && i === STRIP_SIZE - 1;

        if (!uri) {
          return (
            <View key={i} style={[styles.tile, styles.empty]}>
              {i === 0 ? (
                <Feather name="image" size={T.emptyIconSize} color={Colors.textDim} />
              ) : counted ? (
                <Text style={styles.more}>+{more}</Text>
              ) : null}
            </View>
          );
        }

        return (
          <View key={i} style={styles.tile}>
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={counted ? T.moreBlur : 0}
              transition={T.fadeMs}
            />
            {counted ? (
              <View style={[StyleSheet.absoluteFill, styles.moreScrim]}>
                <Text style={styles.more}>+{more}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );

  const capsule = (
    <View style={styles.capsule}>
      {phase === 'live' ? <View style={styles.liveDot} /> : null}
      <Text style={styles.capsuleText}>{status}</Text>
      {onPressStatus ? (
        <Feather name="chevron-right" size={T.metaIconSize} color={Colors.textMuted} />
      ) : null}
    </View>
  );

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${status}. ${photoLabel(photoCount)}, ${memberLabel(members)}.`}
      scale={T.pressScale}
      onPress={onPress}
      style={styles.card}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Display size="sm" numberOfLines={1}>
            {title}
          </Display>

          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <Feather name="image" size={T.metaIconSize} color={Colors.textMuted} />
              <Text style={styles.metaText}>{photoLabel(photoCount)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="users" size={T.metaIconSize} color={Colors.textMuted} />
              <Text style={styles.metaText}>{memberLabel(members)}</Text>
            </View>
          </View>
        </View>

        {onPressStatus ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`${status}. See how the film is doing`}
            hitSlop={10}
            onPress={onPressStatus}>
            {capsule}
          </PressScale>
        ) : (
          capsule
        )}
      </View>

      {onPressPhotos ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={photosLabel}
          scale={T.pressScale}
          onPress={onPressPhotos}>
          {strip}
        </PressScale>
      ) : (
        strip
      )}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: T.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hairline,
    backgroundColor: Colors.surfaceFaint,
    padding: T.padding,
    gap: T.stripGap,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: T.metaGap,
  },
  // Takes the room the capsule leaves, so a long name truncates instead of pushing it out.
  heading: {
    flex: 1,
    gap: T.titleGap,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.metaGap,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.metaIconGap,
  },
  metaText: {
    ...Typography.metaMd,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  capsule: {
    height: T.capsuleHeight,
    paddingHorizontal: T.capsulePaddingX,
    borderRadius: T.capsuleHeight / 2,
    backgroundColor: Colors.surfaceSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.capsuleGap,
  },
  capsuleText: {
    ...Typography.durationPill,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  liveDot: {
    width: T.liveDot,
    height: T.liveDot,
    borderRadius: T.liveDot / 2,
    backgroundColor: Colors.green,
  },
  strip: {
    flexDirection: 'row',
    gap: T.tileGap,
  },
  tile: {
    flex: 1,
    aspectRatio: T.tileAspect,
    borderRadius: T.tileRadius,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceFaint,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.hairlineStrong,
  },
  moreScrim: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.moreDim,
  },
  more: {
    ...Typography.stripMore,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
});
