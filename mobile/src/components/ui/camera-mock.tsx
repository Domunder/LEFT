/**
 * LEFT's camera as a still, for the inside of `PhoneFrame` (1.3.0): the
 * viewfinder down to the shutter bar, the event's name and the real roll
 * counter over it, the shutter between its two tiles.
 *
 * The counter is 13's own `RollCounter`, so on 05.1 its digits roll when the
 * host picks another roll — the number they are choosing, where guests will
 * read it. A drawing: nothing is pressable, VoiceOver reads it as one image.
 *
 * (`MiniCamera` is the older, hand-drawn little phone of the guest intro.)
 */

import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { LookPreview } from './look-preview';
import { RollCounter } from './roll-counter';
import { Label } from './typography';
import { CameraMock as T, Colors } from '@/constants/theme';
import { t } from '@/i18n';
import type { FilmLook } from '@/lib/events';
import { rollWords, type RollSize } from '@/lib/roll';

type CameraMockProps = {
  look: FilmLook;
  /** What the viewfinder shows: a bundled picture or a URL. */
  source: number | string;
  name: string;
  rollSize: RollSize;
};

export function CameraMock({ look, source, name, rollSize }: CameraMockProps) {
  return (
    <View
      style={styles.root}
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('onboarding.cameraMockA11y', { roll: rollWords(rollSize) })}>
      <View style={styles.viewfinder}>
        <LookPreview key={String(source)} look={look} source={source} />
        <LinearGradient colors={T.topFade} style={styles.topFade} pointerEvents="none" />

        <View style={styles.top}>
          <Label small numberOfLines={1} color={Colors.textDim}>
            {name}
          </Label>
          <RollCounter shotsLeft={rollSize} />
        </View>
      </View>

      <View style={styles.bar}>
        <View style={styles.tile}>
          <LookPreview look={look} source={source} />
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

const INNER = T.shutter - 2 * (T.shutterRing + T.shutterGap);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
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
    height: T.topFadeHeight,
  },
  top: {
    position: 'absolute',
    top: T.top,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: T.nameGap,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: T.bar.paddingX,
    paddingTop: T.bar.paddingTop,
    paddingBottom: T.bar.paddingBottom,
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
    width: INNER,
    height: INNER,
    borderRadius: INNER / 2,
    backgroundColor: Colors.text,
  },
});
