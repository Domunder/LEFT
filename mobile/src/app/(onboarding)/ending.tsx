/**
 * 04 · Onboarding — Event End
 *
 * "When does the event end?" — the moment after which guests can no longer
 * shoot and the film is developed. Stored as one `Date` on the draft, which is
 * the shape `createEvent()` wants (`endsAt` in lib/events.ts).
 *
 * **Rebuilt 2026-11-15 (the user's call), replacing the artboard's two rows
 * with a picker behind each.** The screen reads top to bottom as question,
 * answer, ways to change the answer:
 *  - the answer is written large right under the headline — the chosen day and
 *    time, and how far away that is — so it is never in doubt when the film ends
 *  - the two wheels, straight on the screen with no card around them (the
 *    user's call): days sideways (day-strip.tsx), time upright (time-wheel.tsx)
 *
 * Nothing is staged and there is no Done button: a tap or a settled wheel is
 * the choice. (A row of shortcuts — "Tonight", "Tomorrow" — was tried and
 * removed the same day: it crowded the screen.)
 *
 * The wheels mount with the screen. They can, because they are cheap: the
 * time wheel only mounts the rows near its band (wheel.tsx), and the day wheel
 * is told its width up front rather than measuring itself first.
 *
 * The ambient glow is not rendered here; it lives in (onboarding)/_layout.tsx so
 * it can travel between screens. `useGlow` just claims this screen's position.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { DayStrip } from '@/components/ui/day-strip';
import { PillButton } from '@/components/ui/pill-button';
import { Rise } from '@/components/ui/rise';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TimeWheel } from '@/components/ui/time-wheel';
import { Body, Display, Em } from '@/components/ui/typography';
import { Colors, Ending, Spacing } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { defaultEndsAt, formatEndDate, formatEndTime, formatTimeUntil } from '@/lib/event-end';
import { useGlow, useOnboarding, useStep } from '@/lib/onboarding-draft';

export default function EndingScreen() {
  const router = useRouter();
  const { draft, patch } = useOnboarding();
  useGlow('ending');
  useStep(4);

  // Preseeded like 02/03, so there is no empty state to explain. Returning to
  // this screen restores the earlier choice.
  const [endsAt, setEndsAt] = useState<Date>(draft.endsAt ?? defaultEndsAt());

  // The wheels span the screen's content width — known before layout.
  const { width } = useWindowDimensions();
  const wheelWidth = width - 2 * Spacing.screenX;

  // Read per render rather than held in state: a screen left open past the chosen
  // moment should go invalid on its own, not stay valid against a stale "now".
  const now = new Date();
  const until = formatTimeUntil(endsAt, now);
  const isValid = until !== null;
  function handleContinue() {
    if (!isValid) return;
    patch({ endsAt });
    router.push('/(onboarding)/group-size');
  }

  return (
    <Screen transparent>
      <ScreenHeader style={styles.header} />

      {/* Scrolls only where it has to: a small phone with large text. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}>
        <Rise>
          <Display size="md" style={styles.headline}>
            When does{'\n'}
            <Em>the event end?</Em>
          </Display>
        </Rise>

        <View
          style={styles.answer}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Ends ${formatEndDate(endsAt)} at ${formatEndTime(endsAt)}, ${
            until ?? 'which has already passed'
          }`}>
          <Text style={styles.answerText} numberOfLines={1} adjustsFontSizeToFit>
            {formatEndDate(endsAt)} · {formatEndTime(endsAt)}
          </Text>
          <Body small color={isValid ? Colors.textDim : Ending.answer.pastColor}>
            {isValid
              ? `The film is developed ${until}.`
              : 'That has already passed — pick a later time.'}
          </Body>
        </View>

        {/* No surface around the wheels: they sit straight on the screen. */}
        <DayStrip value={endsAt} onChange={setEndsAt} initialWidth={wheelWidth} />

        <View style={styles.rule} />

        <TimeWheel value={endsAt} onChange={setEndsAt} />
      </ScrollView>

      <PillButton
        label="Continue"
        icon="arrow-right"
        onPress={handleContinue}
        disabled={!isValid}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Ending.headerGap,
  },
  scroll: {
    flex: 1,
    marginHorizontal: -Spacing.screenX,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenX,
  },
  headline: {
    marginBottom: Ending.headlineGap,
  },
  answer: {
    gap: Ending.answer.gap,
    marginBottom: Ending.answerGap,
  },
  answerText: {
    ...Typography.endAnswer,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Ending.hairline,
  },
  cta: {
    marginTop: Ending.ctaGap,
    marginBottom: Spacing.screenBottom,
  },
});
