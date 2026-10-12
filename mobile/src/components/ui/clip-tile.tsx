/**
 * One contributor's clip in 17's grid.
 *
 * Purely presentational, like `FilmCard`: it knows nothing about signed URLs or
 * whose clip it is beyond the name it is handed.
 *
 * **The cover is a real frame, when there is one.** It was a gradient for a long
 * time — nothing in the app could extract a frame from a clip, so this took a
 * tint hashed from the clip's own id (lib/film-tint.ts). `use-clip-thumbnails`
 * closes that: expo-video makes one off-screen and hands it here as
 * `thumbnail`. The tint stays underneath and is what shows while a frame is
 * still being made, and for good: a clip whose file will not open never gets
 * one, and a deterministic colour is a better answer there than an empty box.
 *
 * **The scrim is applied to every tile, where the artboard scrims only the
 * first.** Tiles 2–4 carry the same white-on-image name and duration badges with
 * nothing behind them, which over a bright frame would be unreadable. That reads
 * as an oversight in a four-tile mock rather than as intent, so it is fixed here
 * — flagged rather than done silently, per the house rule.
 *
 * **The selected ring and the now-playing dot are invented.** The artboard has
 * no notion of tapping a tile, because it drew a hero that already had a film in
 * it. Here a tap opens this clip full screen — the ring says which clip that was
 * and the dot says it is running, so the grid still reads correctly underneath
 * once the large view is dismissed.
 *
 * The badges are geometrically identical to `FilmCard`'s and are duplicated
 * rather than shared: that component does not export them, and extracting a
 * `<CoverBadge>` for a second caller is a refactor better done when a third
 * appears.
 */

import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ClipDetail, Colors, Radii } from '@/constants/theme';
import { Typography } from '@/constants/typography';

type ClipTileProps = {
  /** One of `ClipDetail.grid`'s three heights, set by the grid's own rule. */
  height: number;
  /** What shows until — and if — a frame arrives. `tintFor(clip.id)`. */
  tint: readonly [string, string];
  /**
   * A frame from half a second into the clip, from `useClipThumbnails`.
   *
   * Null while one is being made and forever for a clip that will not open.
   * Either way the tint below it is a complete cover on its own.
   */
  thumbnail?: ImageSource | null;
  authorName: string;
  /** Preformatted — "12s". */
  durationLabel: string;
  onPress: () => void;
  /** Omitted when there is no file to download. */
  onDownload?: () => void;
  downloading?: boolean;
  /** This clip is the one the hero is showing. */
  selected?: boolean;
  /** ...and it is running right now, rather than paused on it. */
  playing?: boolean;
  /** Filmed, charged, but the file has not landed — 'pending' or 'failed'. */
  unavailable?: boolean;
};

export function ClipTile({
  height,
  tint,
  thumbnail = null,
  authorName,
  durationLabel,
  onPress,
  onDownload,
  downloading = false,
  selected = false,
  playing = false,
  unavailable = false,
}: ClipTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: unavailable }}
      accessibilityLabel={`${authorName}, ${durationLabel}`}
      accessibilityHint={
        unavailable
          ? 'This clip has not finished uploading yet.'
          : 'Opens this clip full screen and plays it.'
      }
      // A tile that looks tappable and does nothing reads worse than one that
      // looks unfinished, so an unavailable clip is inert rather than silent.
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.root,
        { height },
        selected && styles.selected,
        unavailable && styles.unavailable,
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient colors={[tint[0], tint[1]]} style={StyleSheet.absoluteFill} />

      {/* Over the tint rather than instead of it — see the header. */}
      {thumbnail ? (
        <Image
          source={thumbnail}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={ClipDetail.grid.coverTransitionMs}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}

      {/* Gives the badges something to sit against — on every tile. See the header. */}
      <LinearGradient
        colors={[ClipDetail.grid.scrim[1], ClipDetail.grid.scrim[0]]}
        locations={[1 - ClipDetail.grid.scrimLocations[1], 1]}
        style={StyleSheet.absoluteFill}
      />

      {onDownload ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Save ${authorName}'s clip`}
          accessibilityState={{ busy: downloading }}
          disabled={downloading}
          onPress={onDownload}
          // 26pt against a 44pt target.
          hitSlop={9}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        >
          {downloading ? (
            <ActivityIndicator size="small" color={Colors.text} />
          ) : (
            /*
              The artboard draws this at stroke-width 2.2. Feather ships a fixed
              2px path and exposes no stroke prop, so the weight is approximate —
              the same limitation as 18's dismiss X.
            */
            <Feather name="download" size={ClipDetail.grid.chip.iconSize} color={Colors.text} />
          )}
        </Pressable>
      ) : null}

      <View style={[styles.badge, styles.badgeLeft]}>
        <BlurView
          intensity={ClipDetail.grid.badge.blurIntensity}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        {playing ? <View style={styles.nowPlayingDot} /> : null}
        <Text style={styles.badgeText} numberOfLines={1}>
          {authorName}
        </Text>
      </View>

      <View style={[styles.badge, styles.badgeRight]}>
        <BlurView
          intensity={ClipDetail.grid.badge.blurIntensity}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.badgeText}>{durationLabel}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    borderRadius: ClipDetail.grid.radius,
    overflow: 'hidden',
    backgroundColor: ClipDetail.grid.placeholder,
  },
  selected: {
    borderWidth: 1,
    borderColor: Colors.hairlineStrong,
  },
  unavailable: {
    opacity: ClipDetail.grid.unavailableOpacity,
  },
  pressed: {
    opacity: 0.8,
  },
  chip: {
    position: 'absolute',
    top: ClipDetail.grid.chip.inset,
    right: ClipDetail.grid.chip.inset,
    width: ClipDetail.grid.chip.size,
    height: ClipDetail.grid.chip.size,
    borderRadius: ClipDetail.grid.chip.size / 2,
    backgroundColor: ClipDetail.grid.chip.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    bottom: ClipDetail.grid.badge.inset,
    paddingVertical: ClipDetail.grid.badge.paddingY,
    paddingHorizontal: ClipDetail.grid.badge.paddingX,
    borderRadius: Radii.pill,
    backgroundColor: Colors.badgeScrim,
    overflow: 'hidden',
    // Leaves room for the other badge on the narrowest (163pt) tile.
    maxWidth: '62%',
  },
  badgeLeft: {
    left: ClipDetail.grid.badge.inset,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClipDetail.grid.badge.paddingY,
  },
  nowPlayingDot: {
    width: ClipDetail.grid.nowPlayingDotSize,
    height: ClipDetail.grid.nowPlayingDotSize,
    borderRadius: ClipDetail.grid.nowPlayingDotSize / 2,
    backgroundColor: ClipDetail.grid.nowPlayingColor,
  },
  badgeRight: {
    right: ClipDetail.grid.badge.inset,
  },
  badgeText: {
    ...Typography.clipBadge,
    color: Colors.text,
  },
});
