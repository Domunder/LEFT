/**
 * 17's player — the group's film, at the top of the screen.
 *
 * **The film is a sequence, not a file.** The artboard draws a hero playing a
 * finished compiled video; nothing makes one, because concatenating clips needs
 * ffmpeg and nothing in this stack can run it. So the hero plays every clip in
 * turn instead, which is the same footage in the same order. `use-clip-playlist`
 * owns the player and the cursor; this component draws whatever it is told is
 * happening and reports taps back.
 *
 * Purely presentational, deliberately: the player is created in exactly one
 * place, because expo-video binds a player to a single rendering surface and a
 * second `useVideoPlayer` here would be the start of violating that.
 *
 * **The author pill is invented, and it is the point.** The artboard had one
 * film by nobody in particular, so it named no one. Here the picture cuts
 * between people, and a pill that changes at each cut is what tells the viewer
 * they are watching their group rather than one long take.
 *
 * **The ended state is invented too.** A compiled film would simply stop on its
 * last frame; a sequence that stops needs to say it has finished rather than
 * look like it broke mid-clip.
 *
 * **It is sized by the film, not by the artboard.** The 280pt box this was
 * drawn as cropped a horizontal film to a near-square: `events.format` reached
 * the renderer, which output 1280x720, and then playback threw the shape away.
 * The height now comes from `aspect`, capped at `maxHeightRatio` of the window
 * so a 9:16 film does not push the whole rest of the screen below the fold.
 *
 * `aspect` is the format and only the format — see `useClipPlaylist`. It is the
 * group's own choice on screen 03, and it is what every clip is drawn inside:
 * a clip is whatever the device recorded and need not match, so
 * `contentFit="contain"` letterboxes rather than cropping. The box never changes
 * shape while someone is watching, which is the whole point.
 *
 * **The poster is a frame from the film's first clip**, built off-screen by
 * `use-clip-thumbnails`. Where there is none — nothing decoded yet, or clips that
 * will not open — the tint gradient shows instead, which is what every cover in
 * this app was.
 *
 * **A tap on a tile in the grid below opens `FilmStage`** rather than swapping
 * anything in here. There is one player and the two surfaces trade it, so this
 * view is unmounted while the stage is up.
 *
 * **The scrub bar is a readout, not a scrubber.** The artboard draws a 3px track
 * with no thumb and freezes the fill at 38% — a mock, not a control. A 3px
 * target cannot be dragged, and inventing a thumb would be inventing an
 * interaction the design never specified. It now spans the *whole film* rather
 * than one clip, so it keeps advancing across a cut instead of snapping back.
 */

import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { Body } from '@/components/ui/typography';
import { ClipDetail, Colors, Radii } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import type { PlaylistPhase } from '@/hooks/use-clip-playlist';

type ClipHeroProps = {
  /** From `useClipPlaylist`. Never create a second player for this view. */
  player: VideoPlayer;
  phase: PlaylistPhase;
  /** 0–1 across the whole film. */
  progress: number;
  /** Whose clip is on screen. Null before anything plays, and once it ends. */
  authorName: string | null;
  /** "3 of 8". Null when there is only one clip to place. */
  positionLabel: string | null;
  /** `tintFor(event.id)` — the wash behind the idle and ended states. */
  tint: readonly [string, string];
  /** What is going on, in a sentence, for the states with no picture. */
  note: string;
  /** False when no clip has a file yet: the play button goes inert. */
  playable: boolean;
  /**
   * Width over height, from `useClipPlaylist`. Sets the height of the box.
   */
  aspect: number;
  /**
   * A still of the film's first second, or null to fall back to `tint`.
   *
   * Accepts an `ImageSource` as well as a URL so a spotlit clip can show the
   * frame `useClipThumbnails` already made for its tile.
   */
  poster: ImageSource | string | null;
  /** Opens the large view. Hidden when there is nothing to play. */
  onExpand: () => void;
  /**
   * False while the large view is open, which unmounts this `VideoView`.
   *
   * **Not an optimisation.** expo-video binds a player to one rendering surface
   * and two views on one player crashes on device — see `use-clip-playlist`'s
   * header. The stage shows the same player, so exactly one of the two must be
   * mounted at a time, and this is the flag that guarantees it.
   */
  inline: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
};

export function ClipHero({
  player,
  phase,
  progress,
  authorName,
  positionLabel,
  tint,
  note,
  playable,
  aspect,
  poster,
  onExpand,
  inline,
  onTogglePlay,
  onRestart,
}: ClipHeroProps) {
  const idle = phase === 'idle';
  const ended = phase === 'ended';
  /** Idle and ended have no frame of their own, so the cover shows instead. */
  const showsTint = idle || ended;

  /*
    A 9:16 film at full width is taller than the phone. Capped so the actions
    below it stay on screen — see `maxHeightRatio`.
  */
  const { height: windowHeight } = useWindowDimensions();
  const maxHeight = windowHeight * ClipDetail.hero.maxHeightRatio;

  /*
    A boundary is normally cleared well inside `spinnerDelayMs`. Showing a
    spinner at every cut would make a film that is working look like one that is
    struggling, so it only appears if a swap genuinely drags.
  */
  const [slowAdvance, setSlowAdvance] = useState(false);
  useEffect(() => {
    if (phase !== 'loading') {
      setSlowAdvance(false);
      return;
    }
    const timer = setTimeout(
      () => setSlowAdvance(true),
      ClipDetail.hero.advance.spinnerDelayMs
    );
    return () => clearTimeout(timer);
  }, [phase]);

  /** Cross-fades the author pill at a cut rather than letting the name pop. */
  const pillFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(pillFade, {
      toValue: authorName && !showsTint ? 1 : 0,
      duration: ClipDetail.hero.nowPlaying.fadeMs,
      useNativeDriver: true,
    }).start();
  }, [authorName, showsTint, pillFade]);

  return (
    <View style={[styles.root, { aspectRatio: aspect, maxHeight }]}>
      {/* See `inline`: exactly one VideoView may point at this player. */}
      {inline ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          /*
            The box is the event's format, so this crops nothing when the film is
            on — the render is that shape by construction. It matters for a
            spotlit clip, which is whatever the device recorded: a portrait clip
            in a landscape event's 16:9 box is letterboxed rather than blown up
            and cut in half.
          */
          contentFit="contain"
          // The app draws its own controls, and SDK 54 renamed the fullscreen prop.
          nativeControls={false}
          fullscreenOptions={{ enable: false }}
        />
      ) : null}

      {/* Covers the swap, and stands in for a picture where there is none. */}
      {showsTint || phase === 'loading' ? (
        <LinearGradient
          colors={showsTint ? [tint[0], tint[1]] : [ClipDetail.hero.bg, ClipDetail.hero.bg]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {/*
        The real cover, over the tint rather than instead of it — the gradient
        stays underneath as the backdrop for a poster that has not decoded yet
        and for one that never arrives.
      */}
      {showsTint && poster ? (
        <Image
          source={typeof poster === 'string' ? { uri: poster } : poster}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={ClipDetail.hero.advance.scrimFadeMs}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}

      {/* Darkens a real frame enough for the play button and note to read. */}
      {showsTint && poster ? (
        <View style={styles.posterScrim} pointerEvents="none" />
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label(phase, authorName, playable)}
        accessibilityState={{ disabled: !playable, busy: phase === 'loading' }}
        disabled={!playable}
        onPress={ended ? onRestart : onTogglePlay}
        style={styles.playTarget}>
        {/* The button hides during playback so it does not sit over the picture. */}
        {phase === 'playing' ? null : phase === 'loading' ? (
          slowAdvance ? <View style={styles.play}><Spinner /></View> : null
        ) : (
          <View style={styles.copy}>
            <View style={[styles.play, !playable && styles.playInert]}>
              <Feather
                name={ended ? 'rotate-ccw' : 'play'}
                size={ended ? ClipDetail.hero.ended.iconSize : ClipDetail.hero.play.iconSize}
                color={Colors.text}
                style={ended ? undefined : styles.playIcon}
              />
            </View>

            {showsTint ? (
              <Body small color={Colors.textMuted} style={styles.note}>
                {note}
              </Body>
            ) : null}
          </View>
        )}
      </Pressable>

      {/*
        Bigger. Not the native fullscreen control — see `ClipDetail.stage` for
        why this app cannot afford to rotate the device.
      */}
      {playable ? (
        <View style={styles.expand}>
          <CircleIconButton
            icon="maximize-2"
            variant="glass"
            size={ClipDetail.hero.expand.size}
            iconSize={ClipDetail.hero.expand.iconSize}
            accessibilityLabel="Watch full screen"
            onPress={onExpand}
          />
        </View>
      ) : null}

      {/* Who filmed what is on screen, and where it sits in the film. */}
      <Animated.View style={[styles.pill, { opacity: pillFade }]} pointerEvents="none">
        <BlurView
          intensity={ClipDetail.hero.nowPlaying.blurIntensity}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.pillName} numberOfLines={1}>
          {authorName}
        </Text>
        {positionLabel ? <Text style={styles.pillPosition}>{positionLabel}</Text> : null}
      </Animated.View>

      <View style={styles.scrubStrip} pointerEvents="none">
        <View style={styles.scrubTrack}>
          <View style={[styles.scrubFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

/** The spinner shown only when a clip boundary drags. Matches `Spinner`'s ring. */
function Spinner() {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1000, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  return (
    <Animated.View
      style={[
        styles.spinner,
        { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
      ]}
    />
  );
}

function label(phase: PlaylistPhase, authorName: string | null, playable: boolean): string {
  if (!playable) return 'Nothing to play yet';
  if (phase === 'ended') return 'Watch the film again';
  if (phase === 'playing') return authorName ? `Pause ${authorName}'s clip` : 'Pause';
  if (phase === 'loading') return 'Loading the next clip';
  return 'Play the film';
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    /*
      Height comes entirely from `aspectRatio` and `maxHeight` — see the header.
      No `minHeight`: a floor would fight the ratio on a 16:9 film, which is
      shorter than the 280 this box used to be, and win by letterboxing it.
      There is no freak ratio to guard against — `aspect` is `events.format`,
      so it is 16/9 or 9/16 and never anything else.
    */
    borderRadius: ClipDetail.hero.radius,
    overflow: 'hidden',
    backgroundColor: ClipDetail.hero.bg,
    marginBottom: ClipDetail.hero.marginBottom,
    alignSelf: 'center',
  },
  posterScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ClipDetail.hero.posterScrim,
  },
  expand: {
    position: 'absolute',
    top: ClipDetail.hero.expand.inset,
    right: ClipDetail.hero.expand.inset,
  },

  playTarget: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    alignItems: 'center',
    gap: ClipDetail.hero.poster.copyGap,
    paddingHorizontal: ClipDetail.hero.poster.copyPaddingX,
  },
  play: {
    width: ClipDetail.hero.play.size,
    height: ClipDetail.hero.play.size,
    borderRadius: ClipDetail.hero.play.size / 2,
    backgroundColor: ClipDetail.hero.play.bg,
    borderWidth: ClipDetail.hero.play.borderWidth,
    borderColor: ClipDetail.hero.play.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playInert: {
    opacity: ClipDetail.hero.play.posterOpacity,
  },
  /** The artboard's `padding-left: 4` — optical centring for a triangle. */
  playIcon: {
    marginLeft: ClipDetail.hero.play.iconOffsetX,
  },
  spinner: {
    width: ClipDetail.hero.ended.iconSize,
    height: ClipDetail.hero.ended.iconSize,
    borderRadius: ClipDetail.hero.ended.iconSize / 2,
    borderWidth: 2,
    borderColor: ClipDetail.hero.play.border,
    borderTopColor: Colors.text,
  },
  note: {
    textAlign: 'center',
  },
  pill: {
    position: 'absolute',
    left: ClipDetail.hero.nowPlaying.inset,
    // Clear of the scrub strip, which owns the very bottom of the hero.
    bottom: ClipDetail.hero.scrub.stripHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClipDetail.hero.nowPlaying.gap,
    paddingVertical: ClipDetail.hero.nowPlaying.paddingY,
    paddingHorizontal: ClipDetail.hero.nowPlaying.paddingX,
    borderRadius: Radii.pill,
    backgroundColor: ClipDetail.hero.nowPlaying.bg,
    overflow: 'hidden',
    maxWidth: '70%',
  },
  pillName: {
    ...Typography.clipBadge,
    color: Colors.text,
    flexShrink: 1,
  },
  pillPosition: {
    ...Typography.clipBadge,
    color: Colors.textFaint,
  },
  scrubStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: ClipDetail.hero.scrub.stripHeight,
    justifyContent: 'flex-end',
    paddingBottom: ClipDetail.hero.scrub.paddingBottom,
  },
  scrubTrack: {
    height: ClipDetail.hero.scrub.trackHeight,
    marginHorizontal: ClipDetail.hero.scrub.marginX,
    borderRadius: ClipDetail.hero.scrub.trackHeight / 2,
    backgroundColor: ClipDetail.hero.scrub.track,
    overflow: 'hidden',
  },
  scrubFill: {
    height: '100%',
    backgroundColor: Colors.text,
    borderRadius: ClipDetail.hero.scrub.trackHeight / 2,
  },
});
