/**
 * The full-bleed ambient background loop.
 *
 * Used by Landing (01) at 0.85 opacity, the Format preview cards (03), and
 * Sign Up (06) at 0.55. Muted and looping, with no player controls — it is
 * decoration, so it is hidden from the accessibility tree.
 *
 * expo-video, not the deprecated expo-av.
 *
 * ## Why this measures the screen instead of using absoluteFill
 *
 * left-bg.mp4 has a malformed `tkhd` box: its matrix reads
 * `[0 1 0 | 0 0 1 | 0 0 0]` instead of the identity `[1 0 0 | 0 1 0 | 0 0 1]`,
 * i.e. the field block is shifted 4 bytes, so the declared display size comes
 * out as 16384x1080 (~15:1) rather than the true coded 1080x1920 (9:16).
 *
 * A player that trusts `tkhd` lays the frame out in that ~15:1 box, and `cover`
 * then scales it enormously to fill the screen — a hugely over-zoomed crop that
 * also magnifies compression artifacts into visible blocking.
 *
 * Sizing the video view explicitly to a 9:16 box derived from the real screen
 * dimensions takes that decision away from the container metadata. Re-encoding
 * the asset with a correct header would be the better long-term fix.
 *
 * ## fit="cover"
 *
 * That window math only makes sense when the video covers the whole screen. The
 * Format preview cards (03) put the same loop inside a small box whose ratio is
 * not the source's — a 9:16 clip inside a 16:9 card — so `fit="cover"` runs the
 * identical scale-and-centre math against the measured parent instead of the
 * window. Stretching to the parent would squash the footage; cropping it is what
 * `contentFit="cover"` would do if the container reported honest dimensions.
 *
 * The container metadata never gets a vote in either mode: the view is always
 * given an explicit, correctly-proportioned box and `contentFit="fill"` inside it.
 *
 * ## Why the loop stops when the screen is not focused
 *
 * **This is what keeps 13 able to record.** On iOS there is one AVAudioSession
 * for the whole process, and both video modules fight over it. expo-video's
 * `VideoManager` forces it to `.playback` for every live player and never puts it
 * back; expo-camera's capture session claims `.playAndRecord` when it starts, and
 * `recordAsync` fails instantly with `ERR_CAMERA_RECORDING_FAILED` if the category
 * is not one that permits recording.
 *
 * Screens below the camera in the stack stay mounted — Landing (01) and the two
 * Format cards (03) are still there while 13 is on screen — so an ambient loop
 * left playing behind the viewfinder goes on re-asserting `.playback` and takes
 * the session back out from under the camera. That was the first take of an event
 * failing while every take after a camera flip worked: the flip rebuilds the
 * capture session late enough to win the argument.
 *
 * A loop nobody can see has nothing to lose by pausing, so it pauses on blur and
 * picks up where it left off on focus. Filming is the only part of this app that
 * cannot share the audio session, so it is the one that gets to keep it.
 */

import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import { useCallback, useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { VideoOverlay } from '@/constants/theme';

const LEFT_BG = require('@/assets/video/left-bg.mp4');

/** True coded dimensions of left-bg.mp4, per its stsd box. */
const SOURCE_ASPECT = 1080 / 1920;

type BackgroundVideoProps = {
  /** Defaults to the shared left-bg.mp4 ambient loop. */
  source?: VideoSource;
  /**
   * `screen` (default) sizes the frame from the window, for full-bleed use.
   * `cover` sizes it from the measured parent, filling any box without distortion.
   */
  fit?: 'screen' | 'cover';
  /** Design opacity for this screen. Landing 0.85, Sign Up 0.55. */
  opacity?: number;
  /**
   * Source aspect ratio (width / height). Defaults to left-bg.mp4's 9:16.
   * Pass the real ratio when supplying a different `source`.
   */
  aspectRatio?: number;
  style?: StyleProp<ViewStyle>;
};

export function BackgroundVideo({
  source = LEFT_BG,
  fit = 'screen',
  opacity = VideoOverlay.videoOpacity,
  aspectRatio = SOURCE_ASPECT,
  style,
}: BackgroundVideoProps) {
  const window = useWindowDimensions();

  // In cover mode the box comes from the parent, which has to be measured; until
  // the first layout arrives there is nothing sensible to draw.
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  const ownPlayer = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    // Decoration: a paused first frame would read as a broken image.
    p.play();
  });

  /*
    Hold the audio session only while this screen is actually on top. See the
    header: a loop still running underneath 13 is what makes the camera's first
    take fail.
  */
  useFocusEffect(
    useCallback(() => {
      ownPlayer.play();
      return () => {
        /*
          On unmount the player has usually been released already — `useVideoPlayer`
          tears down before this cleanup runs — and calling into a released shared
          object throws. There is nothing to pause in that case.
        */
        try {
          ownPlayer.pause();
        } catch {
          /* released with the screen */
        }
      };
    }, [ownPlayer])
  );

  const bounds = fit === 'cover' ? box : window;

  // Cover the box by hand: scale to whichever axis needs the larger factor, then
  // centre the overflow so the crop is even on both sides.
  const scale = bounds ? Math.max(bounds.width / aspectRatio / bounds.height, 1) : 1;
  const videoHeight = (bounds?.height ?? 0) * scale;
  const videoWidth = videoHeight * aspectRatio;

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.clip, { opacity }, style]}
      onLayout={
        fit === 'cover'
          ? (e) => {
              const { width: w, height: h } = e.nativeEvent.layout;
              setBox((prev) => (prev?.width === w && prev?.height === h ? prev : { width: w, height: h }));
            }
          : undefined
      }
      pointerEvents="none">
      <VideoView
        player={ownPlayer}
        style={{
          width: Math.max(videoWidth, bounds?.width ?? 0),
          height: videoHeight,
        }}
        // The frame is already sized to the correct ratio, so stretch it to fill
        // exactly that box — `cover` here would re-apply the bogus metadata.
        contentFit="fill"
        nativeControls={false}
        // The loop is ambient; it must never take over the screen.
        // SDK 57 replaced `allowsFullscreen` with `fullscreenOptions.enable`.
        fullscreenOptions={{ enable: false }}
        allowsPictureInPicture={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
