/**
 * One moment in the library's list (16): its name, how many photos and people
 * it has, when it was, and a small stack of its prints.
 *
 * Redesigned 2026-11-21 (the user), replacing the card with a strip of four
 * tiles: no card, no border — the row sits on the page, and the screen draws a
 * hairline between rows. The prints have no white frame either: they are
 * separated by a shadow and by the ones behind being a little darker.
 *
 * The stack is up to `STACK_SIZE` prints, front last. With more photos than
 * prints a glass badge reads "+N" — the rest of the album. With no photo yet,
 * `samples` stand in, dimmed, and the badge reads "Sample" instead; before the
 * caller knows, one empty frame.
 *
 * The whole row answers on touch-down and opens on release; a held row opens
 * its menu. Purely presentational: the words and the targets are the caller's.
 */

import { Feather } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Glass } from './glass';
import { PressScale } from './press-scale';
import { Display } from './typography';
import { Colors, Films } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { STACK_SIZE } from '@/lib/covers';
import { memberLabel, photoLabel, type FilmPhase } from '@/lib/film-status';

const T = Films.row;
const S = T.stack;

type MomentRowProps = {
  title: string;
  phase: FilmPhase;
  /** The third line: "October", "01d 23h left", "Not started". */
  when: string;
  members: number;
  /** Every photo of the moment so far. */
  photoCount: number;
  /** Up to `STACK_SIZE` thumbnails, the one in front first. */
  photos: readonly string[];
  /** How many photos the stack stands for; past the prints shown, the badge reads "+N". */
  stackCount: number;
  /** Stand-ins for a moment with no photo to show yet: dimmed, tagged "Sample". */
  samples?: readonly ImageSource[];
  onPress: () => void;
  onLongPress?: () => void;
};

export function MomentRow({
  title,
  phase,
  when,
  members,
  photoCount,
  photos,
  stackCount,
  samples,
  onPress,
  onLongPress,
}: MomentRowProps) {
  const sampled = photos.length === 0 && samples !== undefined && samples.length > 0;
  const sources: ImageSource[] = sampled
    ? samples.slice(0, STACK_SIZE)
    : photos.slice(0, STACK_SIZE).map((uri) => ({ uri }));
  const more = sampled ? 0 : stackCount - sources.length;

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${when}. ${photoLabel(photoCount)}, ${memberLabel(members)}.${sampled ? ' Showing sample pictures.' : ''}`}
      accessibilityActions={onLongPress ? [{ name: 'longpress', label: 'More' }] : undefined}
      onAccessibilityAction={onLongPress ? () => onLongPress() : undefined}
      scale={T.pressScale}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.row}>
      <View style={styles.text}>
        <Display size="card" numberOfLines={1}>
          {title}
        </Display>
        <Text style={styles.meta}>
          {photoLabel(photoCount)} · {memberLabel(members)}
        </Text>
        <View style={styles.when}>
          {phase === 'live' ? <View style={styles.liveDot} /> : null}
          <Text style={styles.meta}>{when}</Text>
        </View>
      </View>

      <PrintStack
        sources={sources}
        dimmed={sampled}
        badge={sampled ? 'Sample' : more > 0 ? `+${more}` : null}
      />
    </PressScale>
  );
}

/**
 * Up to three prints, turned a little, the first source in front. One photo is
 * the front print alone; two add the one behind to the right.
 */
function PrintStack({
  sources,
  dimmed,
  badge,
}: {
  sources: readonly ImageSource[];
  dimmed: boolean;
  badge: string | null;
}) {
  // Slots back left, back right, front: the front gets the first source.
  const slots =
    sources.length >= 3
      ? [
          { print: S.prints[0], source: sources[2] },
          { print: S.prints[1], source: sources[1] },
          { print: S.prints[2], source: sources[0] },
        ]
      : sources.length === 2
        ? [
            { print: S.prints[1], source: sources[1] },
            { print: S.prints[2], source: sources[0] },
          ]
        : [{ print: S.prints[2], source: sources[0] }];

  return (
    <View style={styles.stack} pointerEvents="none">
      {slots.map(({ print, source }, i) => {
        const front = i === slots.length - 1;
        return (
          <View
            key={i}
            style={[
              styles.print,
              {
                width: print.width,
                height: print.height,
                left: print.left,
                top: print.top,
                transform: [{ rotate: `${print.rotate}deg` }],
              },
            ]}>
            <View style={styles.printClip}>
              {source ? (
                <>
                  <Image
                    source={source}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={S.fadeMs}
                  />
                  {!front || dimmed ? (
                    <View style={[StyleSheet.absoluteFill, styles.behind]} />
                  ) : null}
                </>
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.empty]}>
                  <Feather name="image" size={S.emptyIconSize} color={Colors.textDim} />
                </View>
              )}
            </View>
          </View>
        );
      })}

      {badge ? (
        <Glass radius={T.badge.height / 2} style={styles.badge}>
          <Text style={[styles.badgeText, badge === 'Sample' && styles.badgeWord]}>{badge}</Text>
        </Glass>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.gap,
    paddingHorizontal: T.paddingX,
    paddingVertical: T.paddingY,
  },
  // Takes the room the stack leaves, so a long name truncates instead of pushing it out.
  text: {
    flex: 1,
    gap: T.lineGap,
  },
  meta: {
    ...Typography.metaMd,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  when: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.liveDotGap,
  },
  liveDot: {
    width: T.liveDot,
    height: T.liveDot,
    borderRadius: T.liveDot / 2,
    backgroundColor: Colors.green,
  },
  stack: {
    width: S.width,
    height: S.height,
  },
  // The shadow lives outside the clip: a view that clips cannot cast one.
  print: {
    position: 'absolute',
    borderRadius: S.radius,
    backgroundColor: Colors.card,
    shadowColor: S.shadow.color,
    shadowOpacity: S.shadow.opacity,
    shadowRadius: S.shadow.radius,
    shadowOffset: { width: 0, height: S.shadow.offsetY },
    elevation: S.shadow.elevation,
  },
  printClip: {
    flex: 1,
    borderRadius: S.radius,
    overflow: 'hidden',
  },
  behind: {
    backgroundColor: S.behindDim,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceFaint,
  },
  badge: {
    position: 'absolute',
    right: T.badge.right,
    bottom: T.badge.bottom,
    height: T.badge.height,
    paddingHorizontal: T.badge.paddingX,
    justifyContent: 'center',
  },
  badgeText: {
    ...Typography.stackBadge,
    color: Colors.text,
  },
  badgeWord: {
    ...Typography.clipBadge,
  },
});
