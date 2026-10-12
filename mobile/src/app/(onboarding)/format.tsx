/**
 * 03 · Onboarding — Format
 *
 * "Portrait or landscape?" — two film-strip preview cards, each playing the
 * ambient loop in its own aspect window. This picks the *recording* aspect
 * ratio; the app itself stays portrait-locked.
 *
 * Each card owns its own video player. expo-video binds a native player to a
 * single rendering surface, so pointing two VideoViews at one player crashes the
 * app on device; the shared-player version of this screen did exactly that.
 *
 * Two deliberate deviations from the prototype, both agreed with the user and
 * recorded in CLAUDE.md's known-conflicts list:
 *  - The artboard has no Continue button, which leaves the flow with no way
 *    forward. The standard pill from 02/04 is added here.
 *  - The artboard's labels use `space-around` across the full width, so neither
 *    sits under its card. Each is centred over its own card instead.
 *
 * The ambient glow is not rendered here; it lives in (onboarding)/_layout.tsx so
 * it can travel between screens. `useGlow` just claims this screen's position.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

import { FilmStripCard, FilmStripLabel } from '@/components/ui/film-strip-card';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Display, Em, Label } from '@/components/ui/typography';
import { FilmStrip, Motion, Spacing } from '@/constants/theme';
import type { FilmFormat } from '@/lib/events';
import { useGlow, useOnboarding, useStep } from '@/lib/onboarding-draft';

const EASING = Easing.bezier(...Motion.bezier).factory();

/** Cards arrive after the headline, and the second trails the first. */
const ENTER_DELAY = { vertical: 120, horizontal: 180 } as const;

function entering(delay: number) {
  return FadeInDown.duration(Motion.duration).easing(EASING).delay(delay);
}

export default function FormatScreen() {
  const router = useRouter();
  const { draft, patch } = useOnboarding();
  useGlow('format');
  useStep(2);

  // The design preselects Portrait, so there is no empty state and Continue is
  // always available. Returning to this screen restores the earlier choice.
  const [format, setFormat] = useState<FilmFormat>(draft.format ?? 'vertical');

  function select(next: FilmFormat) {
    if (next === format) return;
    // Web has no haptics engine; calling through is a no-op but noisy in logs.
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setFormat(next);
  }

  function handleContinue() {
    patch({ format });
    router.push('/(onboarding)/ending');
  }

  return (
    <Screen transparent>
      <ScreenHeader style={styles.header} />

      <Label style={styles.eyebrow}>Format</Label>

      <Display size="xl" style={styles.headline}>
        Portrait or{'\n'}
        <Em>landscape?</Em>
      </Display>

      {/*
        Names and cards move as one block, which takes all the vertical slack and
        centres itself in it — so the cards land in the middle of the screen with
        their names carried directly above, rather than the cards centring in
        whatever room the names happen to leave over.
      */}
      <View style={styles.picker}>
        {/*
          Both names share one row, so they sit on a common baseline. Putting each
          above its own card would stagger them: the cards are centred on each
          other and the portrait one is more than twice as tall. Slot widths
          mirror the card row, so each name stays over its card.
        */}
        <View style={styles.labels}>
          <View style={styles.verticalSlot}>
            <FilmStripLabel label="Portrait" selected={format === 'vertical'} />
          </View>
          <View style={styles.horizontalSlot}>
            <FilmStripLabel label="Landscape" selected={format === 'horizontal'} />
          </View>
        </View>

        <View style={styles.cards} accessibilityRole="radiogroup">
          <Animated.View entering={entering(ENTER_DELAY.vertical)} style={styles.verticalSlot}>
            <FilmStripCard
              ratio="vertical"
              selected={format === 'vertical'}
              onPress={() => select('vertical')}
              accessibilityLabel="Portrait, 9 by 16"
            />
          </Animated.View>

          <Animated.View entering={entering(ENTER_DELAY.horizontal)} style={styles.horizontalSlot}>
            <FilmStripCard
              ratio="horizontal"
              selected={format === 'horizontal'}
              onPress={() => select('horizontal')}
              accessibilityLabel="Landscape, 16 by 9"
            />
          </Animated.View>
        </View>
      </View>

      <PillButton
        label="Continue"
        icon="arrow-right"
        onPress={handleContinue}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 52,
  },
  eyebrow: {
    marginBottom: 14,
  },
  headline: {
    marginBottom: Spacing.xxl,
  },
  // Takes all the slack between the headline and the CTA, and centres the names
  // and cards together within it.
  picker: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  cards: {
    flexDirection: 'row',
    gap: FilmStrip.gap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The portrait card is a fixed width; the landscape card takes what is left.
  verticalSlot: {
    width: FilmStrip.vertical.width,
  },
  horizontalSlot: {
    flex: 1,
  },
  labels: {
    flexDirection: 'row',
    gap: FilmStrip.gap,
    marginBottom: FilmStrip.labelGap,
  },
  cta: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.screenBottom,
  },
});
