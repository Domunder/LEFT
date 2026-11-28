/**
 * 04.2 · When the photos show (1.3.0, the plan's step 5). Not in the prototype.
 *
 * The host decides when everyone sees everyone's photos:
 *  - **When it ends** — LEFT's original rule and the preselection.
 *  - **Later** — some hours after the end ("the morning after").
 *  - **During the event** — as they are taken; nothing is hidden.
 *
 * Above the choices three prints show what a guest will see: their own sharp,
 * the others' blurred — or all sharp for a live reveal — and one line says
 * until when, with the real date from 04.
 *
 * The choice rides in the draft; 05.1 writes it right after the event exists
 * (`setEventReveal`). The server holds it in RLS (`is_event_revealed()`), and
 * it cannot change once the event has started.
 */

import { Image, type ImageSource } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { ChoicePillButton } from '@/components/ui/choice-pill';
import { LookPreview } from '@/components/ui/look-preview';
import { PillButton } from '@/components/ui/pill-button';
import { PressScale } from '@/components/ui/press-scale';
import { em } from '@/components/ui/rich';
import { Rise } from '@/components/ui/rise';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Body, Display } from '@/components/ui/typography';
import { DEFAULT_LOOK } from '@/constants/looks';
import { samplesFor } from '@/constants/samples';
import { Colors, Motion, RevealStep as T, Spacing } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { t, type TKey } from '@/i18n';
import { defaultEndsAt, formatEndDate, formatEndTime } from '@/lib/event-end';
import { choiceSource, DEFAULT_COVER } from '@/lib/event-cover';
import { DEFAULT_REVEAL, REVEAL_DELAYS, type RevealChoice, type RevealMode } from '@/lib/events';
import { haptic } from '@/lib/haptics';
import { useGlow, useOnboarding, useStep } from '@/lib/onboarding-draft';

/** Reading order: the default in the middle would hide it; it leads. */
const MODES: readonly { mode: RevealMode; titleKey: TKey; bodyKey: TKey }[] = [
  { mode: 'end', titleKey: 'onboarding.revealEnd', bodyKey: 'onboarding.revealEndBody' },
  { mode: 'delayed', titleKey: 'onboarding.revealDelayed', bodyKey: 'onboarding.revealDelayedBody' },
  { mode: 'live', titleKey: 'onboarding.revealLive', bodyKey: 'onboarding.revealLiveBody' },
];

const DELAY_KEYS: Record<(typeof REVEAL_DELAYS)[number], TKey> = {
  12: 'onboarding.revealDelay12',
  24: 'onboarding.revealDelay24',
  72: 'onboarding.revealDelay72',
  168: 'onboarding.revealDelay168',
};

const [OTHER_A, OTHER_B] = samplesFor('reveal', 2);

export default function RevealScreen() {
  const router = useRouter();
  const { draft, patch } = useOnboarding();
  useGlow('ending');
  useStep(4);

  const [choice, setChoice] = useState<RevealChoice>(draft.reveal ?? DEFAULT_REVEAL);
  // 04 always fills this; the fallback only keeps a deep link here from crashing.
  const [fallbackEnd] = useState(defaultEndsAt);
  const endsAt = draft.endsAt ?? fallbackEnd;

  const showsAt =
    choice.mode === 'delayed'
      ? new Date(endsAt.getTime() + (choice.delayHours ?? REVEAL_DELAYS[0]) * 3_600_000)
      : endsAt;
  const when = { date: formatEndDate(showsAt), time: formatEndTime(showsAt) };
  const caption =
    choice.mode === 'live'
      ? t('onboarding.revealCaptionLive')
      : choice.mode === 'end'
        ? t('onboarding.revealCaptionEnd', when)
        : t('onboarding.revealCaptionDelayed', when);

  function select(mode: RevealMode) {
    if (mode === choice.mode) return;
    haptic.select();
    setChoice({
      mode,
      delayHours: mode === 'delayed' ? (choice.delayHours ?? REVEAL_DELAYS[0]) : null,
    });
  }

  const live = choice.mode === 'live';

  return (
    <Screen transparent>
      <ScreenHeader style={styles.header} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}>
        <Rise>
          <Display size="md" style={styles.headline}>
            {em(t('onboarding.revealHeadline'))}
          </Display>
        </Rise>

        <Rise index={1}>
          <View style={styles.prints} accessible accessibilityRole="image" accessibilityLabel={caption}>
            <Print source={OTHER_A} sharp={live} side />
            <View style={styles.print}>
              <LookPreview
                look={draft.look ?? DEFAULT_LOOK}
                source={choiceSource(draft.cover ?? DEFAULT_COVER)}
              />
              <View style={styles.tag}>
                <Text style={styles.tagText}>{t('guest.introYours')}</Text>
              </View>
            </View>
            <Print source={OTHER_B} sharp={live} side />
          </View>
          <Body small color={Colors.textDim} style={styles.caption}>
            {caption}
          </Body>
        </Rise>

        <Rise index={2}>
          <View accessibilityRole="radiogroup" style={styles.options}>
            {MODES.map(({ mode, titleKey, bodyKey }) => {
              const selected = mode === choice.mode;
              return (
                <PressScale
                  key={mode}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => select(mode)}
                  style={[styles.option, selected && styles.optionSelected]}>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>{t(titleKey)}</Text>
                    <Body small color={Colors.textDim}>
                      {t(bodyKey)}
                    </Body>

                    {mode === 'delayed' && selected ? (
                      <View style={styles.delays}>
                        {REVEAL_DELAYS.map((hours) => (
                          <ChoicePillButton
                            key={hours}
                            label={t(DELAY_KEYS[hours])}
                            selected={choice.delayHours === hours}
                            onPress={() => setChoice({ mode: 'delayed', delayHours: hours })}
                          />
                        ))}
                      </View>
                    ) : null}
                  </View>
                </PressScale>
              );
            })}
          </View>
        </Rise>
      </ScrollView>

      <PillButton
        label={t('common.continue')}
        icon="arrow-right"
        onPress={() => {
          patch({ reveal: choice });
          router.push('/(onboarding)/cover');
        }}
        style={styles.cta}
      />
    </Screen>
  );
}

/** Someone else's print: blurred and dim, clearing when the reveal is live. */
function Print({ source, sharp, side }: { source: ImageSource; sharp: boolean; side?: boolean }) {
  // The dependency array is required: `sharp` is a plain prop read in a worklet.
  const veil = useAnimatedStyle(
    () => ({ opacity: withTiming(sharp ? 0 : 1, { duration: Motion.duration }) }),
    [sharp]
  );
  return (
    <View style={[styles.print, side && styles.printSide]}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
      <Animated.View style={[StyleSheet.absoluteFill, veil]}>
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={T.blur}
        />
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: T.headerGap,
  },
  scroll: {
    flex: 1,
    marginHorizontal: -Spacing.screenX,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenX,
  },
  headline: {
    marginBottom: T.headlineGap,
  },
  prints: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.print.gap,
  },
  print: {
    width: T.print.width,
    aspectRatio: 3 / 4,
    borderRadius: T.print.radius,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceFaint,
  },
  printSide: {
    width: T.print.sideWidth,
  },
  dim: {
    backgroundColor: T.print.dim,
  },
  tag: {
    position: 'absolute',
    left: T.tag.inset,
    bottom: T.tag.inset,
    paddingVertical: T.tag.paddingY,
    paddingHorizontal: T.tag.paddingX,
    borderRadius: T.tag.radius,
    backgroundColor: T.tag.bg,
  },
  tagText: {
    ...Typography.labelSm,
    color: Colors.text,
  },
  caption: {
    textAlign: 'center',
    marginTop: T.captionGap,
    marginBottom: T.optionsGap,
    minHeight: T.captionMinHeight,
  },
  options: {
    gap: T.option.gap,
  },
  option: {
    flexDirection: 'row',
    gap: T.option.innerGap,
    paddingVertical: T.option.paddingY,
    paddingHorizontal: T.option.paddingX,
    borderRadius: T.option.radius,
    borderWidth: 1,
    borderColor: T.option.border,
    backgroundColor: T.option.bg,
  },
  optionSelected: {
    borderColor: Colors.text,
    backgroundColor: T.option.selectedBg,
  },
  radio: {
    width: T.radio.size,
    height: T.radio.size,
    borderRadius: T.radio.size / 2,
    borderWidth: T.radio.border,
    borderColor: T.radio.color,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: T.radio.top,
  },
  radioSelected: {
    borderColor: Colors.text,
  },
  radioDot: {
    width: T.radio.dot,
    height: T.radio.dot,
    borderRadius: T.radio.dot / 2,
    backgroundColor: Colors.text,
  },
  optionText: {
    flex: 1,
    gap: T.option.textGap,
  },
  optionTitle: {
    ...Typography.groupHeading,
    color: Colors.text,
  },
  delays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.delaysGap,
    marginTop: T.delaysTop,
  },
  cta: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.screenBottom,
  },
});
