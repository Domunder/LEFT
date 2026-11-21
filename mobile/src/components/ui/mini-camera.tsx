/**
 * A small still picture of 13, for the waiting screen (12, 2026-11-21, the
 * user: "show how it looks"). The sample photo in this moment's look as the
 * viewfinder, the roll counter on it, "Next photo: …" when missions are on,
 * and the shutter row under it.
 *
 * A drawing, not a control: nothing in it is pressable, and it is one image to
 * VoiceOver. Plain scrims rather than glass — it is small, and glass here would
 * promise buttons that are not there.
 */

import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { LookPreview } from './look-preview';
import { Colors, MiniCamera as T } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import type { FilmLook } from '@/lib/events';

type MiniCameraProps = {
  look: FilmLook;
  /** The roll; null is unlimited. */
  rollSize: number | null;
  /** An example mission for the armed note; absent when missions are off. */
  mission?: string;
  /** Defaults to `MiniCamera.width`. */
  width?: number;
};

export function MiniCamera({ look, rollSize, mission, width = T.width }: MiniCameraProps) {
  const counter = rollSize === null ? '∞' : `${rollSize} left`;

  return (
    <View
      style={[styles.root, { width }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`The camera: a photo in this film's look, ${rollSize === null ? 'an unlimited roll' : `${rollSize} photos left`}${mission ? `, and a mission for the next photo: ${mission}` : ''}.`}>
      <View style={styles.frame}>
        <LookPreview look={look} />
        <View style={styles.topScrim} />

        <View style={styles.top}>
          <View style={styles.counter}>
            <Text style={styles.counterText}>{counter}</Text>
          </View>
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
          <LookPreview look={look} />
        </View>
        <View style={styles.shutter}>
          <View style={styles.shutterInner} />
        </View>
        <View style={[styles.tile, styles.tileIcon]}>
          <Feather name="user-plus" size={T.tileIcon} color={Colors.textMuted} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'center',
    gap: T.barGap,
  },
  frame: {
    aspectRatio: 3 / 4,
    borderRadius: T.radius,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceFaint,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: T.scrimHeight,
    backgroundColor: T.scrim,
  },
  top: {
    position: 'absolute',
    top: T.inset,
    left: T.inset,
    right: T.inset,
    alignItems: 'center',
    gap: T.noteGap,
  },
  counter: {
    paddingHorizontal: T.counterPaddingX,
    height: T.counterHeight,
    borderRadius: T.counterHeight / 2,
    backgroundColor: T.chip,
    justifyContent: 'center',
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
  },
  tile: {
    width: T.tile,
    height: T.tile,
    borderRadius: T.tileRadius,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceFaint,
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
});
