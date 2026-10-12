/**
 * 04 · Onboarding — Event End
 *
 * "When does filming end?" — the moment after which guests can no longer add
 * clips. Shown as two rows, a date and a time, but stored as one `Date` on the
 * draft, which is the shape `createEvent()` wants (`endsAt` in lib/events.ts).
 *
 * Each pill is ours and matches the prototype; tapping one opens a picker in a
 * popover anchored under it (date-time-sheet.tsx) — a month grid for the date, a
 * Clock-app-style wheel for the time. Both are in-app views rather than the system
 * picker, so the whole screen works in Expo Go and in a browser, and neither
 * carries a confirm button: picking is the choice.
 *
 * Two deviations from the prototype, both recorded in CLAUDE.md's known-conflicts
 * list:
 *  - The back button sits 44px above the headline here where 02/03 use 52. That is
 *    what the artboard specifies; the subcopy this screen adds absorbs the rest.
 *  - The artboard's pills are static display only, with no picker behind them.
 *
 * The ambient glow is not rendered here; it lives in (onboarding)/_layout.tsx so
 * it can travel between screens. `useGlow` just claims this screen's position.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

import { DateTimeSheet } from '@/components/ui/date-time-sheet';
import { PillButton } from '@/components/ui/pill-button';
import type { AnchorRect } from '@/components/ui/popover';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SettingRow } from '@/components/ui/setting-row';
import { Body, Display, Em } from '@/components/ui/typography';
import { ValuePill } from '@/components/ui/value-pill';
import { EndRow, Motion, Spacing } from '@/constants/theme';
import { defaultEndsAt, formatEndDate, formatEndTime } from '@/lib/event-end';
import { useGlow, useOnboarding, useStep } from '@/lib/onboarding-draft';

const EASING = Easing.bezier(...Motion.bezier).factory();

/** The rows arrive after the headline, and the second trails the first. */
const ENTER_DELAY = { date: 120, time: 180 } as const;

function entering(delay: number) {
  return FadeInDown.duration(Motion.duration).easing(EASING).delay(delay);
}

/** The open picker and the pill it hangs from, or null for none. */
type OpenPicker = { mode: 'date' | 'time'; anchor: AnchorRect } | null;

export default function EndingScreen() {
  const router = useRouter();
  const { draft, patch } = useOnboarding();
  useGlow('ending');
  useStep(3);

  // Preseeded like 02/03, so there is no empty state to explain. Returning to
  // this screen restores the earlier choice.
  const [endsAt, setEndsAt] = useState<Date>(draft.endsAt ?? defaultEndsAt());
  const [picker, setPicker] = useState<OpenPicker>(null);

  // Read per render rather than held in state: a screen left open past the chosen
  // moment should go invalid on its own, not stay valid against a stale "now".
  const now = new Date();
  const isValid = endsAt.getTime() > now.getTime();

  // Each grid edits only its own half and returns the whole moment, so this takes
  // the value as given. Dismissal belongs to the sheet: the date closes on a tap
  // and the time does not, and only the sheet knows which it is showing.
  function handleChange(next: Date) {
    setEndsAt(next);
  }

  function handleContinue() {
    if (!isValid) return;
    patch({ endsAt });
    router.push('/(onboarding)/group-size');
  }

  return (
    <Screen transparent>
      <ScreenHeader style={styles.header} />

      {/*
        No eyebrow label here. 02 has "Event" and 03 has "Format", but the
        artboard for this screen goes straight from the back button to the
        headline — the subcopy below does that work instead.
      */}
      <Display size="md" style={styles.headline}>
        When does{'\n'}
        <Em>filming end?</Em>
      </Display>

      <Body small style={styles.subcopy}>
        Pick when the event wraps up. Guests can keep adding clips until then.
      </Body>

      <Animated.View entering={entering(ENTER_DELAY.date)}>
        <SettingRow label="Ending Date">
          <ValuePill
            icon="calendar"
            label={formatEndDate(endsAt)}
            onPress={(anchor) => setPicker({ mode: 'date', anchor })}
            accessibilityLabel={`Ending date, ${formatEndDate(endsAt)}`}
          />
        </SettingRow>
      </Animated.View>

      <Animated.View entering={entering(ENTER_DELAY.time)}>
        <SettingRow label="Ending Time">
          <ValuePill
            icon="clock"
            label={formatEndTime(endsAt)}
            onPress={(anchor) => setPicker({ mode: 'time', anchor })}
            accessibilityLabel={`Ending time, ${formatEndTime(endsAt)}`}
          />
        </SettingRow>
      </Animated.View>

      {/* Pushes the CTA to the bottom, matching the artboard's flex:1 spacer. */}
      <View style={styles.spacer} />

      <PillButton
        label="Continue"
        icon="arrow-right"
        onPress={handleContinue}
        disabled={!isValid}
        style={styles.cta}
      />

      {picker !== null && (
        <DateTimeSheet
          mode={picker.mode}
          anchor={picker.anchor}
          value={endsAt}
          // Only the date needs flooring; "today at 09:00" is a legal pick as
          // long as the chosen day is later, which the Continue guard checks.
          minimumDate={now}
          onChange={handleChange}
          onDismiss={() => setPicker(null)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: EndRow.headerGap,
  },
  headline: {
    marginBottom: Spacing.md,
  },
  subcopy: {
    marginBottom: EndRow.topGap,
  },
  spacer: {
    flex: 1,
  },
  cta: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.screenBottom,
  },
});
