/**
 * 05.1 · Onboarding — Group and roll
 *
 * **Two questions, both visible, both answerable**: how many people, and how
 * many shots each of them gets. A host knows roughly who is coming, and "24
 * shots each" is a unit anyone who has held a disposable camera understands.
 *
 * The two answers are independent — changing the group does not touch the roll —
 * and together they decide the price (lib/tiers.ts): free up to 50 guests on a
 * finite roll, then one purchase sized by the group — $9.99 for the unlimited
 * roll in a small group, 15 up to 100 guests, 20 up to 150, 25 up to 200.
 * `tierFor()` mirrors that for the button; `create_event()` enforces it, so a
 * modified client gets a refusal rather than a free event.
 *
 * The price is on the button that charges it; under the choices a paid event
 * says only "No subscription." (the user's call, 2026-11-15).
 *
 * Deviations from the prototype (which drew a film-length dial here, for video):
 *  - The roll row replaces the dial and its legend.
 *  - The artboard pads this screen to 24px; it keeps the flow's standard 28.
 *  - The CTA carries no arrow icon, unlike 02/03/04.
 *
 * The ambient glow is not rendered here; it lives in (onboarding)/_layout.tsx so
 * it can travel between screens. `useGlow` just claims this screen's position.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

import { GroupSizeRow } from '@/components/ui/group-size-row';
import { PillButton } from '@/components/ui/pill-button';
import { RollChoices } from '@/components/ui/roll-choices';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Body, Caption, Display, Em, Label } from '@/components/ui/typography';
import { Colors, GroupRow, LengthChoice, Motion, Spacing } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { useEventCreation, type CreationPhase } from '@/hooks/use-event-creation';
import { draftToCreateEventInput, useGlow, useOnboarding, useStep } from '@/lib/onboarding-draft';
import { DEFAULT_GROUP_SIZE, DEFAULT_ROLL_SIZE, type RollSize } from '@/lib/roll';
import { ctaLabel, tierFor, type EventTier } from '@/lib/tiers';

const EASING = Easing.bezier(...Motion.bezier).factory();

/** The group question arrives after the headline, and the roll question trails it. */
const ENTER_DELAY = { group: 120, roll: 180 } as const;

function entering(delay: number) {
  return FadeInDown.duration(Motion.duration).easing(EASING).delay(delay);
}

/**
 * What the button says in each phase.
 *
 * `settling` gets its own sentence rather than sharing "Working…": the money is
 * already gone by then, and a generic label there reads as a hang at the exact
 * moment someone is watching for a charge to go through.
 *
 * A paid event names the price on the button itself. A button that opens a store
 * sheet without saying what it costs is the thing every store guideline is about.
 */
function ctaFor(phase: CreationPhase['kind'], tier: EventTier | null): string {
  switch (phase) {
    case 'purchasing':
      return 'Opening the store…';
    case 'settling':
      return 'Confirming your purchase…';
    case 'creating':
      return 'Working…';
    default:
      return tier ? ctaLabel(tier) : 'Create event';
  }
}

export default function GroupSizeScreen() {
  const router = useRouter();
  const { draft, patch, reset } = useOnboarding();
  const creation = useEventCreation();
  useGlow('groupSize');
  useStep(4);

  // Preseeded like 02/03/04, so there is no empty state and the CTA is never
  // disabled. Returning to this screen restores the earlier choices.
  const [groupSize, setGroupSize] = useState(draft.maxMembers ?? DEFAULT_GROUP_SIZE);

  // `undefined` in the draft is "never asked"; null is a deliberate unlimited roll.
  const [rollSize, setRollSize] = useState<RollSize>(
    draft.rollSize === undefined ? DEFAULT_ROLL_SIZE : draft.rollSize
  );

  // A mirror of the server's rule, for the copy and the button only.
  const tier = tierFor(groupSize, rollSize);

  function selectGroup(next: number) {
    if (next === groupSize) return;
    // Web has no haptics engine; calling through is a no-op but noisy in logs.
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setGroupSize(next);
  }

  function selectRoll(next: RollSize) {
    if (next === rollSize) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setRollSize(next);
  }

  async function handleContinue() {
    if (creation.busy) return;

    const chosen = { maxMembers: groupSize, rollSize };
    patch(chosen);

    /*
      Narrowed from a locally merged draft rather than from `draft` itself:
      `patch` is a state update, so the value read back on this tick is still
      the old one and the event would be created with the previous answers.
    */
    const narrowed = draftToCreateEventInput({ ...draft, ...chosen });

    if (!narrowed.ok) {
      /*
        'incomplete' cannot happen from a legitimate path — 02, 03 and 04 all
        gate their own Continue — so it is reported rather than silently
        redirected. 'ended' can: the draft outlives the flow, so backgrounding
        the app on 04 and finishing an hour later can put the chosen moment in
        the past.
      */
      creation.fail(
        narrowed.problem === 'ended'
          ? 'That ending time has already passed. Pick a new one to continue.'
          : 'Something is missing from your film. Go back and fill it in.',
        narrowed.problem === 'ended' ? 'ending' : undefined
      );
      return;
    }

    /*
      Pays first when the event is a paid one, then creates. The hook owns that
      whole sequence — the store sheet, the settle backoff, and the receipt held
      across a retry so a second attempt never charges twice.
    */
    const event = await creation.submit(narrowed.input);
    // Null means the hook's phase now explains why — including a cancelled sheet,
    // which returns to idle and says nothing.
    if (!event) return;

    // Load-bearing: the draft outlives this group, so without it the next event
    // starts prefilled with this one's answers.
    reset();

    // 09 reads this param; it falls back to the newest event only when missing.
    router.replace({ pathname: '/(host)/invite', params: { eventId: event.id } });
  }

  return (
    <Screen transparent>
      <ScreenHeader style={styles.header} />

      {/*
        No eyebrow label, as on 04 — the artboard goes straight from the back
        button to the headline and lets the subcopy do that work.
      */}
      <Display size="sm" style={styles.headline}>
        How many people{'\n'}
        <Em>for your moment?</Em>
      </Display>

      <Body small style={styles.subcopy}>
        Everyone gets their own roll of film.
      </Body>

      {/*
        The densest screen in the flow, so the middle scrolls on a short device
        while the header and the CTA stay put.

        The content is centred by `justifyContent` on the container rather than by
        a `flex: 1` spacer child — inside a ScrollView a flex child grows the
        scrollable area instead of pushing against it, which buys a blank
        screenful below the last row.
      */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        // Nothing here scrolls sideways; without this web lets a stray overflowing
        // child pan the whole view.
        horizontal={false}>
        <Animated.View entering={entering(ENTER_DELAY.group)}>
          <Text style={styles.answer}>Up to {groupSize} people</Text>

          <GroupSizeRow value={groupSize} onChange={selectGroup} />
        </Animated.View>

        <View style={styles.divider} />

        <Animated.View entering={entering(ENTER_DELAY.roll)}>
          <Label small style={styles.sectionLabel}>
            Shots per person
          </Label>

          <RollChoices value={rollSize} onChange={selectRoll} />

          {/*
            Only when the event costs something, and only this: the price itself
            is on the button (the user's call, 2026-11-15). A free event says
            nothing here.
          */}
          {tier ? (
            <Caption color={Colors.textFaint} style={styles.price}>
              No subscription.
            </Caption>
          ) : null}
        </Animated.View>
      </ScrollView>

      {creation.phase.kind === 'error' && (
        <>
          <Caption color={Colors.gold} style={styles.note}>
            {creation.phase.message}
          </Caption>
          {creation.phase.recover === 'ending' && (
            <PillButton
              label="Change ending time"
              variant="secondary"
              onPress={() => router.replace('/(onboarding)/ending')}
              style={styles.recoverCta}
            />
          )}
        </>
      )}

      <PillButton
        label={ctaFor(creation.phase.kind, tier)}
        onPress={() => void handleContinue()}
        disabled={creation.busy}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: GroupRow.headerGap,
  },
  headline: {
    marginBottom: GroupRow.headlineGap,
  },
  subcopy: {
    marginBottom: GroupRow.subcopyGap,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  answer: {
    ...Typography.groupHeading,
    color: Colors.text,
    marginBottom: GroupRow.headingGap,
  },
  divider: {
    height: 1,
    backgroundColor: GroupRow.divider,
    marginTop: GroupRow.bottomGap,
    marginBottom: GroupRow.dividerGap,
  },
  sectionLabel: {
    marginBottom: LengthChoice.labelGap,
  },
  price: {
    textAlign: 'center',
    marginTop: LengthChoice.footnoteGap,
  },
  cta: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.screenBottom,
  },
  note: {
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  recoverCta: {
    marginTop: Spacing.md,
  },
});
