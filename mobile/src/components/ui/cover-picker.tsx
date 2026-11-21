/**
 * The event image picker (2026-11-21): a large preview through the look, and a
 * row — "your photo" first, then the six stock pictures. Used by the creation
 * step (03.1) and by the host's "Change image" (`(host)/cover`).
 *
 * Controlled: the parent holds the choice. An own photo stays in the row while
 * the host tries stock pictures (`own`). `own` may also be a URL — the
 * already-uploaded cover when changing it later.
 */

import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

import { LookPreview } from './look-preview';
import { PressScale } from './press-scale';
import { COVER_SAMPLES } from '@/constants/samples';
import { Colors, CoverStep as T, Motion, Spacing } from '@/constants/theme';
import type { CoverChoice } from '@/lib/event-cover';
import type { FilmLook } from '@/lib/events';
import { canImport, pickOnePhoto } from '@/lib/import-photos';

const EASING = Easing.bezier(...Motion.bezier).factory();

function sourceOf(choice: CoverChoice): number | string {
  if (choice.kind === 'upload') return choice.uri;
  return (COVER_SAMPLES.find((s) => s.key === choice.key) ?? COVER_SAMPLES[0]).source;
}

type CoverPickerProps = {
  look: FilmLook;
  choice: CoverChoice;
  onChange: (next: CoverChoice) => void;
  /** The host's own photo (a file, or the uploaded cover's URL), if any. */
  own: string | null;
  onOwnPicked: (uri: string) => void;
};

export function CoverPicker({ look, choice, onChange, own, onOwnPicked }: CoverPickerProps) {
  function select(next: CoverChoice) {
    void Haptics.selectionAsync();
    onChange(next);
  }

  async function chooseOwn() {
    const uri = await pickOnePhoto().catch(() => null);
    if (!uri) return;
    onOwnPicked(uri);
    select({ kind: 'upload', uri });
  }

  return (
    <>
    <Animated.View
      entering={FadeInDown.duration(Motion.duration).easing(EASING).delay(T.enterDelayMs)}
      style={styles.previewArea}>
      <View
        style={styles.preview}
        accessible
        accessibilityRole="image"
        accessibilityLabel={
          choice.kind === 'upload'
            ? 'Your photo, in your film’s look'
            : 'A stock picture, in your film’s look'
        }>
        {/* Keyed so a new pick starts a fresh decode instead of showing the last one. */}
        <LookPreview
          key={choice.kind === 'upload' ? choice.uri : choice.key}
          look={look}
          source={sourceOf(choice)}
        />
      </View>
    </Animated.View>

    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.rowScroll}
      accessibilityRole="radiogroup">
      {canImport() ? (
        <PressScale
          accessibilityRole="radio"
          accessibilityState={{ selected: choice.kind === 'upload' }}
          accessibilityLabel={own ? 'Your photo' : 'Choose from your photos'}
          onPress={() => {
            if (own && choice.kind !== 'upload') select({ kind: 'upload', uri: own });
            else void chooseOwn();
          }}
          style={[styles.tile, styles.ownTile, choice.kind === 'upload' && styles.selected]}>
          {own ? <LookPreview key={own} look={look} source={own} /> : null}
          <View style={[styles.ownBadge, own ? styles.ownBadgeOver : null]}>
            <Feather name={own ? 'refresh-cw' : 'plus'} size={T.iconSize} color={Colors.text} />
          </View>
        </PressScale>
      ) : null}

      {COVER_SAMPLES.map((sample) => {
        const selected = choice.kind === 'sample' && choice.key === sample.key;
        return (
          <PressScale
            key={sample.key}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`Stock picture ${sample.key.replace('sample-', '')}`}
            onPress={() => select({ kind: 'sample', key: sample.key })}
            style={[styles.tile, selected && styles.selected]}>
            {/* In the film's look too (the user, 2026-11-21), so the row compares like for like. */}
            <LookPreview look={look} source={sample.source} />
          </PressScale>
        );
      })}
    </ScrollView>

    </>
  );
}

const styles = StyleSheet.create({
  previewArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: T.previewPaddingY,
  },
  // As tall as the room allows, at the photos' 3:4.
  preview: {
    height: '100%',
    maxHeight: T.previewMaxHeight,
    aspectRatio: 3 / 4,
    borderRadius: T.previewRadius,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceFaint,
  },
  rowScroll: {
    flexGrow: 0,
    marginHorizontal: -Spacing.screenX,
  },
  row: {
    gap: T.tileGap,
    paddingHorizontal: Spacing.screenX,
    paddingVertical: T.selectedWidth,
  },
  tile: {
    width: T.tile,
    height: T.tile,
    borderRadius: T.tileRadius,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceFaint,
  },
  selected: {
    borderWidth: T.selectedWidth,
    borderColor: Colors.text,
  },
  ownTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.hairlineStrong,
  },
  ownBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Over the picked photo: a small dark disc, so the icon reads on any picture.
  ownBadgeOver: {
    width: T.badge,
    height: T.badge,
    borderRadius: T.badge / 2,
    backgroundColor: T.badgeBg,
  },
});
