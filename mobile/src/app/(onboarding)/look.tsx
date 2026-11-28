/**
 * 03 · Onboarding — Film
 *
 * "Which film are you loading?" — the host picks one look for the whole event.
 * Every photo is developed with it, so the album reads as one roll rather than
 * as a hundred different filters, which is also what a photo book needs later.
 *
 * **Not in the prototype.** This slot was "Format" (portrait or landscape video)
 * until LEFT became a photo app. It is designed in the existing language — same
 * header, eyebrow, headline rhythm and Continue pill as 02 and 04 — with four
 * cards in a two-by-two grid.
 *
 * The cards are real previews: one bundled sample photo run through the same
 * shader the camera bakes into every JPEG (`lib/look-shader.ts`).
 *
 * The ambient glow is not rendered here; it lives in (onboarding)/_layout.tsx so
 * it can travel between screens. `useGlow` just claims this screen's position.
 */

import { haptic } from '@/lib/haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

import { LookCard } from '@/components/ui/look-card';
import { PillButton } from '@/components/ui/pill-button';
import { Rise } from '@/components/ui/rise';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { em } from '@/components/ui/rich';
import { Display, Label } from '@/components/ui/typography';
import { DEFAULT_LOOK, LOOKS } from '@/constants/looks';
import { LookCard as Tokens, Motion, Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import type { FilmLook } from '@/lib/events';
import { useGlow, useOnboarding, useStep } from '@/lib/onboarding-draft';

const EASING = Easing.bezier(...Motion.bezier).factory();

/** Cards arrive in reading order, a beat apart. */
const ENTER_BASE = 120;
const ENTER_STAGGER = 50;

function entering(index: number) {
  return FadeInDown.duration(Motion.duration)
    .easing(EASING)
    .delay(ENTER_BASE + index * ENTER_STAGGER);
}

export default function LookScreen() {
  const router = useRouter();
  const { draft, patch } = useOnboarding();
  useGlow('format');
  useStep(2);

  // Preselected, so there is no empty state and Continue is always available.
  // Returning to this screen restores the earlier choice.
  const [look, setLook] = useState<FilmLook>(draft.look ?? DEFAULT_LOOK);

  /*
    Both rows must be on screen at once — a host compares the four looks, and a
    card below the fold is a look nobody picks. So the cards take their height
    from the space that is left rather than from their width: the print's 4:5
    where there is room, shorter where there is not, and never below
    `minHeight`, at which point the grid scrolls after all.
  */
  const [area, setArea] = useState({ width: 0, height: 0 });
  const cellWidth = (area.width - Tokens.gap) / 2;
  const cardHeight =
    area.height > 0
      ? Math.max(
          Tokens.minHeight,
          Math.min(cellWidth / Tokens.aspectRatio, (area.height - Tokens.gap) / 2)
        )
      : undefined;

  function select(next: FilmLook) {
    if (next === look) return;
    // Web has no haptics engine; calling through is a no-op but noisy in logs.
    haptic.select();
    setLook(next);
  }

  function handleContinue() {
    patch({ look });
    router.push('/(onboarding)/ending');
  }

  return (
    <Screen transparent>
      <ScreenHeader style={styles.header} />

      <Rise>
        <Label style={styles.eyebrow}>{t('onboarding.lookEyebrow')}</Label>

        <Display size="xl" style={styles.headline}>
          {em(t('onboarding.lookHeadline'))}
        </Display>
      </Rise>

      {/*
        Scrolls only when the cards have hit their minimum height: a small phone
        at a large text size must not push the last row under the button.
      */}
      <ScrollView
        style={styles.scroll}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setArea({ width, height });
        }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <View style={styles.grid} accessibilityRole="radiogroup">
          {LOOKS.map((option, index) => (
            <Animated.View key={option.id} entering={entering(index)} style={styles.cell}>
              <LookCard
                look={option}
                selected={option.id === look}
                onPress={() => select(option.id)}
                style={cardHeight ? { aspectRatio: undefined, height: cardHeight } : undefined}
              />
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <PillButton
        label={t('common.continue')}
        icon="arrow-right"
        onPress={handleContinue}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Tokens.headerGap,
  },
  eyebrow: {
    marginBottom: Tokens.eyebrowGap,
  },
  headline: {
    marginBottom: Spacing.xxl,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Tokens.gap,
  },
  // Two per row. `flexBasis` under half so the gap fits; `flexGrow` takes up the rest.
  cell: {
    flexBasis: '45%',
    flexGrow: 1,
  },
  cta: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.screenBottom,
  },
});
