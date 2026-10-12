/**
 * 05.1 · Onboarding — Group Size
 *
 * **Two questions, both visible, both answerable.**
 *
 * This screen used to ask three things at once — group size, film length, price
 * — and the middle one was a control with a dominant option: within any tier
 * both lengths cost the same, so the longer one was strictly better and the
 * choice was decoration. It was also unanswerable. Nobody knows, before their
 * wedding, whether it is a four-minute film or a six-minute one. They do know
 * roughly how many people are coming.
 *
 * The fix then was to demote the length: derive it from the group, draw it as a
 * bar, and hide the alternatives behind an "Adjust" popover. That went too far in
 * the other direction. The one adjustable thing on the screen was the one thing
 * you could not see, and the bar it hid behind measured the film against the
 * longest one the app can make — so a small group's film always looked like a
 * shortfall.
 *
 * Now both questions are face-up, and the second one is answerable because each
 * option states the only thing that separates them: **how long each person gets
 * to film.** That is a unit a host has intuition for, where "six minutes" is not,
 * and it is what makes a longer film a trade rather than a free upgrade. See
 * components/ui/film-length-choices.tsx.
 *
 * **The duration is the shared budget, not a film length.** They were two numbers
 * while a renderer cut a short film out of a larger pool of footage; nothing
 * renders now, so what the host picks here is what the group may film *and* how
 * long what they watch runs. The per-person line on each card is therefore the
 * real share, and a smaller number than it used to be.
 *
 * **The price is back on this screen, and the middle option is no longer free.**
 * It moved to 17 when what was being sold was a clean re-render; with nothing
 * rendered there is nothing to sell after the fact, so the ask returns to where
 * it started. Groups of four or fewer stay free and never see a store sheet —
 * `isFreeGroup()` decides, and `create_event()` enforces the same band
 * server-side, so a modified client gets a refusal rather than a free event.
 *
 * The invariant this screen holds is that the chosen duration is always legal for
 * the chosen group. A group change **resets** the duration to that group's
 * default rather than clamping it: a duration picked for a different group is not
 * a preference worth preserving, and the default is the recommendation. It
 * happens in the same handler rather than an effect — clamping later would render
 * a frame of an illegal pair and re-animate the cards twice. The prototype does
 * exactly that, with a `setTimeout` fired during render.
 *
 * Deviations from the prototype, all in CLAUDE.md's known-conflicts list:
 *  - The artboard pads this screen to 24px; it keeps the flow's standard 28.
 *  - The prototype's glossy length *dial* is gone, and so is the meter that
 *    replaced it. The options themselves are the readout.
 *  - The CTA carries no arrow icon, unlike 02/03/04. The artboard omits it.
 *
 * The ambient glow is not rendered here; it lives in (onboarding)/_layout.tsx so
 * it can travel between screens. `useGlow` just claims this screen's position.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

import { FilmLengthChoices } from '@/components/ui/film-length-choices';
import { GroupSizeRow } from '@/components/ui/group-size-row';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Body, Caption, Display, Em, Label } from '@/components/ui/typography';
import { Colors, GroupRow, LengthChoice, Motion, Spacing } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { useEventCreation, type CreationPhase } from '@/hooks/use-event-creation';
import { draftToCreateEventInput, useGlow, useOnboarding, useStep } from '@/lib/onboarding-draft';
import { GROUP_PRESETS, adjustOptionsFor, budgetSecondsFor } from '@/lib/pricing';
import { ctaLabel, isFreeGroup, tierFor, type EventTier } from '@/lib/tiers';

const EASING = Easing.bezier(...Motion.bezier).factory();

/** The group question arrives after the headline, and the length question trails it. */
const ENTER_DELAY = { group: 120, length: 180 } as const;

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
 * A paid group names the price on the button itself. A button that opens a store
 * sheet without saying what it costs is the thing every store guideline is about.
 */
function ctaFor(phase: CreationPhase['kind'], free: boolean, tier: EventTier): string {
  switch (phase) {
    case 'purchasing':
      return 'Opening the store…';
    case 'settling':
      return 'Confirming your purchase…';
    case 'creating':
      return 'Working…';
    default:
      return free ? 'Start filming' : ctaLabel(tier);
  }
}

export default function GroupSizeScreen() {
  const router = useRouter();
  const { draft, patch, reset } = useOnboarding();
  const creation = useEventCreation();
  useGlow('groupSize');
  useStep(4);

  // Preseeded like 02/03/04, so there is no empty state and the CTA is never
  // disabled. Returning to this screen restores the earlier choice.
  const [groupSize, setGroupSize] = useState(draft.maxMembers ?? GROUP_PRESETS[0]);

  /*
    Null means "whatever this group's default is", which is what almost every
    event sends. Storing the default itself would make it indistinguishable from a
    deliberate pick, and a later group change would have to guess whether to keep
    it.
  */
  const [budgetSeconds, setBudgetSeconds] = useState<number | null>(draft.budgetSeconds ?? null);

  /*
    Plain derivations. `adjustOptionsFor` returns a stable module constant, so
    this identity is safe to hand to animated styles.
  */
  const options = adjustOptionsFor(groupSize);
  const effectiveBudget = budgetSeconds ?? budgetSecondsFor(groupSize);

  /*
    What this group costs. Quoted from the client's mirror of the SKU table, which
    only decides which product the store sheet shows — `create_event()` compares
    the receipt against `max_members` itself.
  */
  const free = isFreeGroup(groupSize);
  const tier = tierFor(groupSize);

  function selectGroup(next: number) {
    if (next === groupSize) return;
    // Web has no haptics engine; calling through is a no-op but noisy in logs.
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setGroupSize(next);
    /*
      Reset rather than clamp, in the same handler. The duration must never be
      illegal — not even for the frame between the group change and a cleanup
      pass — and a duration chosen for twenty-five people means nothing at two
      hundred. Back to that group's recommendation.
    */
    setBudgetSeconds(null);
  }

  function selectBudgetSeconds(next: number) {
    if (next === effectiveBudget) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setBudgetSeconds(next);
  }

  async function handleContinue() {
    if (creation.busy) return;

    /*
      `budgetSeconds` is sent only when the host actually chose one. Sending the
      computed default instead would make this screen's mirror of `budget_plan()`
      authoritative by accident, which is the one thing lib/pricing.ts must not
      become.
    */
    const chosen = {
      maxMembers: groupSize,
      ...(budgetSeconds === null ? {} : { budgetSeconds }),
    };
    patch(chosen);

    /*
      Narrowed from a locally merged draft rather than from `draft` itself:
      `patch` is a state update, so the value read back on this tick is still
      the old one and the event would be created at the previous group size.
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
      Pays first when the group is a paid one, then creates. The hook owns that
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
        <Em>for your film?</Em>
      </Display>

      <Body small style={styles.subcopy}>
        Make sure everyone gets a turn behind the camera.
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
          {/*
            The answer to the headline, in words. It used to share this line with
            the price; the duration moved into the cards below, where it is chosen
            rather than merely reported, and the price moved under them, where it
            sits next to the thing being bought.
          */}
          <Text style={styles.answer}>Up to {groupSize} people</Text>

          <GroupSizeRow value={groupSize} onChange={selectGroup} />
        </Animated.View>

        <View style={styles.divider} />

        <Animated.View entering={entering(ENTER_DELAY.length)}>
          <Label small style={styles.sectionLabel}>
            Filming time
          </Label>

          <FilmLengthChoices
            options={options}
            value={effectiveBudget}
            group={groupSize}
            onChange={selectBudgetSeconds}
          />

          {/*
            One line, and it exists only to name the number on the cards. Without
            it "~18s each" is a quantity of nothing in particular; with it the
            options differ by something a host can actually weigh.
          */}
          <Caption color={Colors.textFaint} style={styles.footnote}>
            Shared between everyone — that’s roughly how long each person gets.
          </Caption>

          {/*
            The price, under the thing it buys rather than up by the headline. A
            host reads the group, then what it gets them, then what it costs, in
            that order — and the free tier says so plainly instead of showing a
            struck-out price, which would read as a discount that ran out.
          */}
          <Caption color={free ? Colors.textFaint : Colors.text} style={styles.price}>
            {free
              ? 'Free for groups of four or fewer.'
              : `${tier.price} once — ${tier.label}. No subscription.`}
          </Caption>
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
        label={ctaFor(creation.phase.kind, free, tier)}
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
  footnote: {
    textAlign: 'center',
    marginTop: LengthChoice.footnoteGap,
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
