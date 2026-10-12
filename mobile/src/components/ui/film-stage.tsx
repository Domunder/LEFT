/**
 * The large view — the film, or one clip, filling the screen.
 *
 * Opened two ways, and it is the same view both times: the expand button on the
 * hero, and a tap on any tile in the grid. A tile does not play inline; it comes
 * straight here, which is what makes the grid read as a list of clips rather
 * than a list of chapters.
 *
 * **The controls are the platform's.** `nativeControls` hands playback to
 * AVPlayer's overlay on iOS and ExoPlayer's on Android — play, pause, a real
 * draggable scrubber, skip gestures, AirPlay, the volume and route behaviour
 * people already know. The hero keeps the app's own drawn controls, because it
 * is part of a page and a native overlay would fight the layout around it; here
 * there is no page to fight, and the drawn readout this used to carry was a
 * strictly worse player than the one the OS ships.
 *
 * **A modal, not native fullscreen.** `expo-video`'s `enterFullscreen()` is
 * right there and was not used, for one reason: it rotates the device for a
 * landscape film, and `app.json` locks this app to portrait. Unlocking it would
 * mean every other screen has to be re-locked by hand with
 * `expo-screen-orientation`, which is a lot of surface area moved to serve one
 * control. This stays portrait and offers to rotate *the picture* instead — a
 * transform, costing nothing and asking the OS for nothing.
 *
 * **It borrows the hero's player.** A second `useVideoPlayer` here would be two
 * players holding two copies of the same film, and opening this would restart
 * it. Instead the same player moves surfaces: `ClipHero` unmounts its
 * `VideoView` while this is mounted (its `inline` prop), so exactly one view
 * points at the player at any moment. That is the rule `use-clip-playlist`'s
 * header documents and `(onboarding)/format.tsx` records crashing on device when
 * broken — the one thing in this file not to change without reading both.
 */

import { VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleIconButton } from '@/components/ui/circle-back-button';
import { ClipDetail, Colors } from '@/constants/theme';
import { Typography } from '@/constants/typography';

type FilmStageProps = {
  /** The hero's player. Never make another — see the header. */
  player: VideoPlayer;
  /**
   * Width over height of the group's chosen format, from `filmAspect(event)`.
   *
   * The shape of the *box*, not a measurement of what loaded — a clip that is
   * not this shape is letterboxed inside it. Constant while this is open, which
   * is what lets `canRotate` below stand in for "the group chose landscape".
   */
  aspect: number;
  /**
   * What is on screen — "The film", or whose clip this is.
   *
   * The grid is 400px away behind a modal, so without this there is nothing to
   * say which of eight similar-looking clips was tapped.
   */
  title: string;
  onClose: () => void;
};

export function FilmStage({ player, aspect, title, onClose }: FilmStageProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  /**
   * Whether the picture has been turned on its side to fill the screen.
   *
   * `aspect` is the event's format, so this reads exactly as "the group chose
   * landscape" — a horizontal film is 16:9 and nothing else is. A vertical event
   * never sees the button: 9:16 already fills a portrait phone as far as it can,
   * and rotating that would make it smaller, which is the opposite of what the
   * button is for.
   *
   * There is no effect resetting this, deliberately. `aspect` cannot change while
   * this is mounted, so a portrait event cannot become rotatable mid-view.
   */
  const canRotate = aspect > 1;
  const [rotated, setRotated] = useState(false);

  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(turn, {
      toValue: rotated ? 1 : 0,
      duration: ClipDetail.stage.rotateMs,
      useNativeDriver: true,
    }).start();
  }, [rotated, turn]);

  /*
    Sized to whichever edge runs out first, so the picture is as large as it can
    be without cropping. Rotated, the box is laid out a quarter turn from where
    it ends up, so its width is measured against the screen's height.

    A 9:16 film therefore leaves a black band above and below on a phone taller
    than 16:9, which is the intended trade: the alternative is blowing the film
    up until it covers the screen and cutting ~9% off each end of the frame.
  */
  const along = rotated ? height : width;
  const across = rotated ? width : height;
  const boxWidth = Math.min(along, across * aspect);
  const boxHeight = boxWidth / aspect;

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      supportedOrientations={['portrait']}
      onRequestClose={onClose}>
      <View style={styles.root}>
        {/*
          No Pressable around this. The native overlay owns taps — wrapping it
          would swallow the first one and make the controls feel broken.
        */}
        <View style={styles.picture}>
          <Animated.View
            style={{
              width: boxWidth,
              height: boxHeight,
              transform: [
                {
                  rotate: turn.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '90deg'],
                  }),
                },
              ],
            }}>
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              // See the header: the platform's controls, not the app's.
              nativeControls
              /*
                Already as large as it goes. The overlay's own fullscreen button
                would offer a rotation this app is not set up to survive.
              */
              fullscreenOptions={{ enable: false }}
            />
          </Animated.View>
        </View>

        {/*
          The chrome sits above the picture, clear of where both platforms put
          their transport controls (the bottom edge) and their AirPlay/cast
          button (bottom-right).
        */}
        <View style={[styles.chrome, { top: insets.top + ClipDetail.stage.closeInset }]}>
          <CircleIconButton
            icon="x"
            variant="glass"
            accessibilityLabel="Close"
            onPress={onClose}
          />

          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>

          {canRotate ? (
            <CircleIconButton
              icon="rotate-cw"
              variant="glass"
              size={ClipDetail.stage.rotate.size}
              iconSize={ClipDetail.stage.rotate.iconSize}
              accessibilityLabel={
                rotated ? 'Turn the picture upright' : 'Turn the picture sideways'
              }
              onPress={() => setRotated((on) => !on)}
            />
          ) : (
            // Keeps the title centred whether or not the button is there.
            <View style={styles.rotateSpacer} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ClipDetail.stage.bg,
  },
  picture: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chrome: {
    position: 'absolute',
    left: ClipDetail.stage.closeInset,
    right: ClipDetail.stage.closeInset,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClipDetail.stage.chromeGap,
  },
  title: {
    ...Typography.clipBadge,
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },
  rotateSpacer: {
    width: ClipDetail.stage.rotate.size,
  },
});
