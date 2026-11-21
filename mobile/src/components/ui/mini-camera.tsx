/**
 * A small iPhone showing LEFT's camera, for the guest intro (2026-11-21, the
 * user: "a little iPhone mock"). The viewfinder runs from the top of the
 * screen to the shutter bar, as on 13, with the roll counter under the
 * Dynamic Island and — when missions are on — "Next photo: …"; below it the
 * last-shot tile, the shutter and the invite tile.
 *
 * The picture is the event image in the moment's look (`cover`), or the look
 * sample without one. The top fades softly for the counter: the solid scrim
 * of the first version ended in a hard line across the picture (the user,
 * 2026-11-21).
 *
 * A drawing, not a control: nothing in it is pressable, and VoiceOver reads it
 * as one image.
 */

import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { EventCoverImage } from './event-cover-image';
import { LookPreview } from './look-preview';
import { Colors, MiniCamera as T } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import type { Event, FilmLook } from '@/lib/events';

type MiniCameraProps = {
  look: FilmLook;
  /** The roll; null is unlimited. */
  rollSize: number | null;
  /** An example mission for the armed note; absent when missions are off. */
  mission?: string;
  /** The phone's width; its height follows. Defaults to `MiniCamera.width`. */
  width?: number;
  /** The moment whose event image fills the viewfinder. */
  cover?: Pick<Event, 'id' | 'cover' | 'look'>;
};

export function MiniCamera({ look, rollSize, mission, width = T.width, cover }: MiniCameraProps) {
  const counter = rollSize === null ? '∞' : `${rollSize} left`;
  const height = Math.round(width * T.aspect);
  const outer = width * T.cornerRatio;

  return (
    <View
      style={[styles.phone, { width, height, borderRadius: outer }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`LEFT's camera on a phone: ${rollSize === null ? 'an unlimited roll' : `${rollSize} photos left`}${mission ? `, and a mission for the next photo: ${mission}` : ''}.`}>
      <View style={[styles.screen, { borderRadius: outer - T.bezel }]}>
        <View style={styles.viewfinder}>
          {cover ? <EventCoverImage event={cover} /> : <LookPreview look={look} />}
          <LinearGradient
            pointerEvents="none"
            colors={T.topFade}
            style={[styles.topFade, { height: height * T.topFadeRatio }]}
          />
          <View style={[styles.island, { width: width * T.islandRatio }]} />

          <View style={styles.top}>
            <Text style={styles.counterText}>{counter}</Text>
            {mission ? (
              <View style={styles.note}>
                <Feather name="target" size={T.noteIcon} color={Colors.text} />
                <Text style={styles.noteText} numberOfLines={2}>
                  Next photo: {mission}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.bar}>
          <View style={styles.tile}>
            {cover ? <EventCoverImage event={cover} /> : <LookPreview look={look} />}
          </View>
          <View style={styles.shutter}>
            <View style={styles.shutterInner} />
          </View>
          <View style={[styles.tile, styles.tileIcon]}>
            <Feather name="user-plus" size={T.tileIcon} color={Colors.textMuted} />
          </View>
        </View>

        <View style={styles.homeIndicator} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  phone: {
    alignSelf: 'center',
    padding: T.bezel,
    backgroundColor: T.body,
    borderWidth: T.frameWidth,
    borderColor: T.frame,
  },
  screen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: Colors.bg,
  },
  // Full width from the top edge to the shutter bar, bottom corners rounded — as on 13.
  viewfinder: {
    flex: 1,
    overflow: 'hidden',
    borderBottomLeftRadius: T.viewfinderRadius,
    borderBottomRightRadius: T.viewfinderRadius,
    backgroundColor: Colors.surfaceFaint,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  island: {
    position: 'absolute',
    top: T.islandTop,
    alignSelf: 'center',
    height: T.islandHeight,
    borderRadius: T.islandHeight / 2,
    backgroundColor: '#000',
  },
  top: {
    position: 'absolute',
    top: T.counterTop,
    left: T.inset,
    right: T.inset,
    alignItems: 'center',
    gap: T.noteGap,
  },
  counterText: {
    ...Typography.miniCounter,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.noteIconGap,
    paddingHorizontal: T.notePaddingX,
    paddingVertical: T.notePaddingY,
    borderRadius: T.noteRadius,
    backgroundColor: T.chip,
  },
  noteText: {
    ...Typography.miniNote,
    color: Colors.text,
    flexShrink: 1,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: T.barPaddingX,
    paddingTop: T.barPaddingTop,
    paddingBottom: T.barPaddingBottom,
  },
  tile: {
    width: T.tile,
    height: T.tile,
    borderRadius: T.tileRadius,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceSubtle,
  },
  tileIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: T.shutter,
    height: T.shutter,
    borderRadius: T.shutter / 2,
    borderWidth: T.shutterRing,
    borderColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: T.shutter - T.shutterRing * 2 - T.shutterGap * 2,
    height: T.shutter - T.shutterRing * 2 - T.shutterGap * 2,
    borderRadius: T.shutter,
    backgroundColor: Colors.text,
  },
  homeIndicator: {
    position: 'absolute',
    bottom: T.homeBottom,
    alignSelf: 'center',
    width: T.homeWidth,
    height: T.homeHeight,
    borderRadius: T.homeHeight / 2,
    backgroundColor: T.home,
  },
});
