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
 * **Rebuilt for 1.3.0 (2026-11-28, the plan's step 4):**
 *  - The group is one segment bar with a sliding thumb (`GroupSegments`),
 *    and what that group costs stands beside "Up to N people" — "Free" or the
 *    tier's price. This puts the price in a second place besides the button,
 *    against the 2026-11-15 call above; flagged to the user.
 *  - The roll is chosen beside LEFT's camera in an iPhone (`PhoneFrame` +
 *    `CameraMock`): its counter is 13's own and rolls to the picked number.
 *  - After the event exists a sheet says "Your film is ready" with the
 *    invitation (`FilmReadySheet`), and its button goes on to 09.
 *
 * **Missions (2026-11-17)** sit under both answers as an optional third one:
 * a switch, off by default, and when on "Missions per guest" 1 · 2 · 3
 * (`MissionsSetup`). They are free — `tierFor()` never sees them, so the price
 * on the button cannot move when the switch does. The server seeds the list
 * from the event type; the host edits it before the start, not here.
 *
 * Deviations from the prototype (which drew a film-length dial here, for video):
 *  - The roll row replaces the dial and its legend.
 *  - The Missions section is not in the prototype at all (see above). Turning
 *    it on grows the centred content, so every section moves on a layout
 *    spring rather than jumping, and the page scrolls the new row into view
 *    when it no longer fits.
 *  - The artboard pads this screen to 24px; it keeps the flow's standard 28.
 *  - The CTA carries no arrow icon, unlike 02/03/04.
 *
 * The ambient glow is not rendered here; it lives in (onboarding)/_layout.tsx so
 * it can travel between screens. `useGlow` just claims this screen's position.
 */

import { haptic } from '@/lib/haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

import { CameraMock } from '@/components/ui/camera-mock';
import { FilmReadySheet } from '@/components/ui/film-ready-sheet';
import { GroupSegments } from '@/components/ui/group-segments';
import type { InviteContent } from '@/components/ui/invite-card';
import { MissionsSetup } from '@/components/ui/missions-setup';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { PillButton } from '@/components/ui/pill-button';
import { RollChoices } from '@/components/ui/roll-choices';
import { Rise } from '@/components/ui/rise';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { em } from '@/components/ui/rich';
import { Body, Caption, Display, Label } from '@/components/ui/typography';
import { DEFAULT_LOOK } from '@/constants/looks';
import {
  Colors,
  GroupRow,
  GroupSegments as SegmentTokens,
  LengthChoice,
  MissionsSetup as MissionsTokens,
  Motion,
  RollSetup,
  Spacing,
  Springs,
} from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { useEventCreation, type CreationPhase } from '@/hooks/use-event-creation';
import { t } from '@/i18n';
import { getSession, resolveDisplayName } from '@/lib/auth';
import { applyCover, choiceSource, DEFAULT_COVER } from '@/lib/event-cover';
import { draftToCreateEventInput, useGlow, useOnboarding, useStep } from '@/lib/onboarding-draft';
import { DEFAULT_GROUP_SIZE, DEFAULT_ROLL_SIZE, rollWords, type RollSize } from '@/lib/roll';
import { ctaLabel, tierFor, type EventTier } from '@/lib/tiers';

const EASING = Easing.bezier(...Motion.bezier).factory();

/** The group question arrives after the headline, the roll trails it, missions last. */
const ENTER_DELAY = { group: 120, roll: 180, missions: 240 } as const;

function entering(delay: number) {
  return FadeInDown.duration(Motion.duration).easing(EASING).delay(delay);
}

/**
 * How the sections move when the content grows or shrinks (the missions count
 * row, the "No subscription." line). Critically damped, no overshoot; under
 * reduced motion Reanimated skips it and the sections simply take their place.
 */
const LAYOUT = LinearTransition.springify(Springs.settle.duration).dampingRatio(
  Springs.settle.dampingRatio
);

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
      return t('onboarding.ctaOpeningStore');
    case 'settling':
      return t('onboarding.ctaConfirming');
    case 'creating':
      return t('onboarding.ctaWorking');
    default:
      return tier ? ctaLabel(tier) : t('onboarding.ctaCreate');
  }
}

export default function GroupSizeScreen() {
  const router = useRouter();
  const { draft, patch, reset } = useOnboarding();
  const creation = useEventCreation();
  useGlow('groupSize');
  useStep(5);

  // Preseeded like 02/03/04, so there is no empty state and the CTA is never
  // disabled. Returning to this screen restores the earlier choices.
  const [groupSize, setGroupSize] = useState(draft.maxMembers ?? DEFAULT_GROUP_SIZE);

  // `undefined` in the draft is "never asked"; null is a deliberate unlimited roll.
  const [rollSize, setRollSize] = useState<RollSize>(
    draft.rollSize === undefined ? DEFAULT_ROLL_SIZE : draft.rollSize
  );

  // Null (and an unanswered draft) is "missions off", the default.
  const [missionsPerGuest, setMissionsPerGuest] = useState<number | null>(
    draft.missionsPerGuest ?? null
  );

  // What the mock camera shows, held from the first render: the draft is reset
  // after the create, and the camera behind the sheet must not change with it.
  const [scene] = useState(() => ({
    look: draft.look ?? DEFAULT_LOOK,
    source: choiceSource(draft.cover ?? DEFAULT_COVER),
    name: draft.filmName?.trim() || t('onboarding.inviteNameFallback'),
  }));

  /** The created event and its invitation: the "film is ready" sheet is up. */
  const [ready, setReady] = useState<{ eventId: string; invite: InviteContent } | null>(null);

  // A mirror of the server's rule, for the copy and the button only. Missions
  // are free, so they are deliberately not an input here.
  const tier = tierFor(groupSize, rollSize);

  const scroll = useRef<ScrollViewInstance>(null);
  // Set when the switch turns on, so the grown content is scrolled to once.
  const revealMissions = useRef(false);

  function selectGroup(next: number) {
    if (next === groupSize) return;
    // Web has no haptics engine; calling through is a no-op but noisy in logs.
    haptic.select();
    setGroupSize(next);
  }

  function selectRoll(next: RollSize) {
    if (next === rollSize) return;
    haptic.select();
    setRollSize(next);
  }

  function selectMissions(next: number | null) {
    if (next === missionsPerGuest) return;
    haptic.select();
    if (missionsPerGuest === null && next !== null) revealMissions.current = true;
    setMissionsPerGuest(next);
  }

  /*
    On a short screen (or large text) the count row turns up below the fold;
    bring it into view once, after the content has grown. A no-op when
    everything already fits.
  */
  function handleContentSize() {
    if (!revealMissions.current) return;
    revealMissions.current = false;
    scroll.current?.scrollToEnd({ animated: true });
  }

  async function handleContinue() {
    if (creation.busy) return;

    const chosen = { maxMembers: groupSize, rollSize, missionsPerGuest };
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
          ? t('onboarding.errorEndPassed')
          : t('onboarding.errorIncomplete'),
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

    // The event image (2026-11-21). Best effort: a failed upload must not
    // strand a created, possibly paid, event on this screen — the stock
    // fallback shows instead, and the host's choice is only lost on this try.
    if (draft.cover) await applyCover(event.id, draft.cover).catch(() => undefined);

    // Whose invitation it is. Best effort: without a name the chip is left out.
    const hostName = await getSession()
      .then((session) => (session?.user ? resolveDisplayName(session.user) : null))
      .catch(() => null);

    // Load-bearing: the draft outlives this group, so without it the next event
    // starts prefilled with this one's answers.
    reset();

    // One beat before the QR (1.3.0): the invitation, and "Your film is ready".
    setReady({
      eventId: event.id,
      invite: {
        look: event.look,
        source: scene.source,
        name: event.name,
        hostName,
        endsAt: new Date(event.ends_at),
        rollSize: event.roll_size,
      },
    });
  }

  // On to the QR, missions on or not (2026-11-19, the user): the host plans
  // them from 10's Missions row while guests join, until the start. 09 reads
  // `eventId`; it falls back to the newest event only when missing.
  function goToInvite() {
    if (!ready) return;
    const { eventId } = ready;
    setReady(null);
    router.replace({ pathname: '/(host)/invite', params: { eventId } });
  }

  return (
    <Screen transparent>
      <ScreenHeader style={styles.header} />

      {/*
        No eyebrow label, as on 04 — the artboard goes straight from the back
        button to the headline and lets the subcopy do that work.
      */}
      <Rise>
        <Display size="sm" style={styles.headline}>
          {em(t('onboarding.groupHeadline'))}
        </Display>

        <Body small style={styles.subcopy}>
          {t('onboarding.groupSubcopy')}
        </Body>
      </Rise>

      {/*
        The densest screen in the flow, so the middle scrolls on a short device
        while the header and the CTA stay put.

        The content is centred by `justifyContent` on the container rather than by
        a `flex: 1` spacer child — inside a ScrollView a flex child grows the
        scrollable area instead of pushing against it, which buys a blank
        screenful below the last row.
      */}
      <ScrollView
        ref={scroll}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        onContentSizeChange={handleContentSize}
        // Nothing here scrolls sideways; without this web lets a stray overflowing
        // child pan the whole view.
        horizontal={false}>
        <Animated.View entering={entering(ENTER_DELAY.group)} layout={LAYOUT}>
          <View style={styles.answerRow}>
            <Text style={styles.answer}>{t('onboarding.groupUpTo', { count: groupSize })}</Text>
            {/* Keyed, so a changed price fades in instead of swapping. */}
            <Animated.Text
              key={tier?.price ?? 'free'}
              entering={FadeIn.duration(Motion.duration)}
              style={[styles.priceTag, !tier && styles.priceFree]}>
              {tier ? tier.price : t('onboarding.priceFree')}
            </Animated.Text>
          </View>

          <GroupSegments value={groupSize} onChange={selectGroup} />
        </Animated.View>

        <Animated.View layout={LAYOUT} style={styles.divider} />

        <Animated.View entering={entering(ENTER_DELAY.roll)} layout={LAYOUT}>
          <Label small style={styles.sectionLabel}>
            {t('onboarding.rollLabel')}
          </Label>

          <View style={styles.rollRow}>
            <PhoneFrame width={RollSetup.phoneWidth}>
              <CameraMock
                look={scene.look}
                source={scene.source}
                name={scene.name}
                rollSize={rollSize}
              />
            </PhoneFrame>

            <View style={styles.rollSide}>
              <RollChoices wrap value={rollSize} onChange={selectRoll} />

              <Body small color={Colors.textDim} style={styles.rollSummary}>
                {rollWords(rollSize)}
              </Body>
              {/* Only when the event costs something. A free event says nothing here. */}
              {tier ? (
                <Caption color={Colors.textFaint} style={styles.price}>
                  {t('onboarding.noSubscription')}
                </Caption>
              ) : null}
            </View>
          </View>
        </Animated.View>

        <Animated.View layout={LAYOUT} style={[styles.divider, styles.missionsDivider]} />

        <Animated.View entering={entering(ENTER_DELAY.missions)} layout={LAYOUT}>
          <MissionsSetup value={missionsPerGuest} onChange={selectMissions} />
        </Animated.View>
      </ScrollView>

      {creation.phase.kind === 'error' && (
        <>
          <Caption color={Colors.gold} style={styles.note}>
            {creation.phase.message}
          </Caption>
          {creation.phase.recover === 'ending' && (
            <PillButton
              label={t('onboarding.changeEnding')}
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
        disabled={creation.busy || ready !== null}
        style={styles.cta}
      />

      <FilmReadySheet content={ready?.invite ?? null} onContinue={goToInvite} />
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
  answerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: SegmentTokens.headingGap,
  },
  answer: {
    ...Typography.groupHeading,
    color: Colors.text,
  },
  priceTag: {
    ...Typography.numeric,
    fontSize: SegmentTokens.priceSize,
    color: Colors.text,
  },
  priceFree: {
    color: Colors.textDim,
  },
  rollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RollSetup.gap,
  },
  rollSide: {
    flex: 1,
  },
  rollSummary: {
    marginTop: RollSetup.summaryGap,
  },
  divider: {
    height: 1,
    backgroundColor: GroupRow.divider,
    marginTop: GroupRow.bottomGap,
    marginBottom: GroupRow.dividerGap,
  },
  missionsDivider: {
    marginTop: MissionsTokens.dividerTop,
    marginBottom: MissionsTokens.dividerBottom,
  },
  sectionLabel: {
    marginBottom: LengthChoice.labelGap,
  },
  price: {
    marginTop: RollSetup.footnoteGap,
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
