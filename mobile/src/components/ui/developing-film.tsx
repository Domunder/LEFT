/**
 * The album before the reveal — a countdown, a count, and nothing to see.
 *
 * Not in the prototype. Deliberately quiet: the choreography belongs to the
 * reveal, not to the wait. The strip of frames is the film, undeveloped: a
 * frame is filled for every photo that exists (up to the strip's length),
 * blurred so far that it only says "there is a picture here" (2026-11-16, the
 * user's call, replacing blank frames).
 *
 * What is under the blur is the caller's business (`photos`). It cannot be
 * other people's photos: RLS does not hand those out before the reveal. The
 * album passes the viewer's own frames and stand-ins for the rest; at this
 * blur neither can be told apart from the other.
 */

import { Image, type ImageSource } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PillButton } from './pill-button';
import { Body, Display, Em, Label } from './typography';
import { Album, Colors, PhotoTile } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { countdownParts } from '@/lib/event-end';

const T = Album.developing;

type DevelopingFilmProps = {
  eventName: string;
  endsAt: string;
  shotsTaken: number;
  memberCount: number;
  /** What the filled frames hold under their blur, first frame first. */
  photos: readonly ImageSource[];
  /** The host may end the event early. */
  canDevelop: boolean;
  developing: boolean;
  onDevelop: () => void;
  onOpenCamera: () => void;
  /** Called once the clock passes `endsAt`. */
  onEnded: () => void;
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export function DevelopingFilm({
  eventName,
  endsAt,
  shotsTaken,
  memberCount,
  photos,
  canDevelop,
  developing,
  onDevelop,
  onOpenCamera,
  onEnded,
}: DevelopingFilmProps) {
  const [now, setNow] = useState(() => new Date());

  const end = new Date(endsAt);
  const remaining = end.getTime() - now.getTime();
  const parts = countdownParts(end, now);

  // Seconds are on screen in the last hour; before that a slow tick is enough.
  const interval = remaining < 3_600_000 ? T.fastTickMs : T.slowTickMs;

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(tick);
  }, [interval]);

  const ended = remaining <= 0;
  useEffect(() => {
    if (ended) onEnded();
    // Only the flip matters, not the callback's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <Label>{eventName}</Label>

        <Display size="xl" style={styles.headline}>
          Nothing to see{'\n'}
          <Em>yet.</Em>
        </Display>

        <View
          style={styles.countdown}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${parts[0].value} ${parts[0].unit}, ${parts[1].value} ${parts[1].unit} until the film is developed`}>
          {parts.map((part) => (
            <View key={part.unit} style={styles.unit}>
              <Text style={styles.value}>{part.value}</Text>
              <Text style={styles.suffix}>{part.unit}</Text>
            </View>
          ))}
        </View>

        <Body small style={styles.stat}>
          {plural(shotsTaken, 'photo', 'photos')} so far, from{' '}
          {plural(memberCount, 'person', 'people')}.{'\n'}
          They appear together when the film is developed.
        </Body>

        <View style={styles.strip} accessibilityElementsHidden importantForAccessibility="no">
          {Array.from({ length: T.frames }, (_, i) => {
            // Never more filled frames than there are photos.
            const source = i < shotsTaken ? photos[i] : undefined;
            return (
              <View key={i} style={styles.frame}>
                {source ? (
                  <>
                    <Image
                      source={source}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      blurRadius={T.frameBlur}
                      transition={T.frameFadeMs}
                    />
                    <View style={[StyleSheet.absoluteFill, styles.frameDim]} />
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.actions}>
        <PillButton label="Back to the camera" icon="camera" onPress={onOpenCamera} />
        {canDevelop ? (
          <PillButton
            label={developing ? 'Developing…' : 'Develop the film now'}
            variant="secondary"
            disabled={developing}
            onPress={onDevelop}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: T.paddingX,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    marginTop: T.eyebrowGap,
    textAlign: 'center',
  },
  countdown: {
    marginTop: T.countdownGap,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: T.unitGap,
  },
  unit: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: T.valueUnitGap,
  },
  value: {
    ...Typography.developingCount,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  suffix: {
    ...Typography.developingUnit,
    color: Colors.textMuted,
  },
  stat: {
    marginTop: T.statGap,
    textAlign: 'center',
  },
  strip: {
    marginTop: T.stripGap,
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: T.frameGap,
  },
  frame: {
    flex: 1,
    aspectRatio: PhotoTile.aspectRatio,
    borderRadius: T.frameRadius,
    backgroundColor: T.frameFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hairline,
    overflow: 'hidden',
  },
  frameDim: {
    backgroundColor: T.frameDim,
  },
  actions: {
    gap: T.actionsGap,
    paddingBottom: T.actionsBottom,
  },
});
