/**
 * 15's empty state — the library before the first event exists.
 *
 * Its CTA is auto-width where every other screen's is full-width, so it is built
 * here rather than from `PillButton` (which is `width: '100%'` by contract) —
 * the same call `EndRow.pill` and 05.1's duration legend made rather than
 * bending a full-width primitive into a shape it was not drawn as.
 *
 * The label reads "Start a Memory", matching what Landing's CTA used to read.
 * design/README.md calls it "Start a shared memory"; the artboard puts that phrase
 * in the subcopy and this on the button, and the prototype wins.
 *
 * The "Join a Group" link below it is not in the artboard. An account with no
 * films is exactly the account most likely to have been sent an invite, and this
 * screen would otherwise offer them only the one thing they did not come to do.
 * A text link rather than a second pill: it is the quieter of the two actions.
 */

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { Body, Display } from './typography';
import { Colors, Films, Radii, Shadows } from '@/constants/theme';
import { Typography } from '@/constants/typography';

/** The artboard's glyph — a film strip, drawn as a frame with two sprocket rails. */
function FilmStripGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={2}
        y={6}
        width={20}
        height={12}
        rx={2}
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1={6} y1={6} x2={6} y2={18} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={18} y1={6} x2={18} y2={18} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

type FilmEmptyProps = {
  onStart: () => void;
  onJoin: () => void;
};

export function FilmEmpty({ onStart, onJoin }: FilmEmptyProps) {
  return (
    <View style={styles.root}>
      <View style={styles.tile} accessibilityElementsHidden importantForAccessibility="no">
        <FilmStripGlyph size={Films.empty.tileIconSize} color={Colors.textDim} />
      </View>

      <Display size="xxxs" style={styles.headline}>
        No films yet.
      </Display>

      <Body small color={Colors.textFaint} style={styles.subcopy}>
        Start a shared memory and invite{'\n'}your group to begin filming.
      </Body>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start a memory"
        onPress={onStart}
        style={({ pressed }) => [styles.cta, Shadows.pill, pressed && styles.pressed]}>
        {/* RN has no inset box-shadow — the design's top highlight is an overlay view,
            the same answer PillButton gives. */}
        <View style={styles.insetHighlight} pointerEvents="none" />
        <Feather name="play" size={Films.empty.ctaIconSize} color={Colors.onLight} />
        <Text style={styles.ctaLabel}>Start a Memory</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Join a group"
        onPress={onJoin}
        hitSlop={Films.empty.joinHitSlop}
        style={({ pressed }) => [styles.join, pressed && styles.pressed]}>
        <Body small color={Colors.textFaint}>
          Or join a group
        </Body>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Films.empty.paddingX,
  },
  tile: {
    width: Films.empty.tileSize,
    height: Films.empty.tileSize,
    borderRadius: Radii.tile,
    borderWidth: 1,
    borderColor: Colors.hairline,
    backgroundColor: Colors.surfaceFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Films.empty.tileGap,
  },
  headline: {
    textAlign: 'center',
    marginBottom: Films.empty.headlineGap,
  },
  subcopy: {
    textAlign: 'center',
    marginBottom: Films.empty.subcopyGap,
  },
  join: {
    marginTop: Films.empty.joinGap,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Films.empty.ctaGap,
    paddingVertical: Films.empty.ctaPaddingY,
    paddingHorizontal: Films.empty.ctaPaddingX,
    borderRadius: Radii.pill,
    backgroundColor: Films.empty.ctaBg,
    overflow: 'hidden',
  },
  insetHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  pressed: {
    opacity: 0.85,
  },
  ctaLabel: {
    ...Typography.authButton,
    color: Colors.onLight,
  },
});
