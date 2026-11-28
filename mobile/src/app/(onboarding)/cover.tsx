/**
 * 04.1 · Your invitation (1.3.0, the user; was 03.1 "Event image" of
 * 2026-11-21). Not in the prototype.
 *
 * The host sees the invitation their guests get when they open the link — the
 * event image in the film's look, "Invited by …", the name and when it
 * develops — inside an iPhone, and changes its picture (`InviteDesigner`).
 *
 * One default picture, or the host's own: the row of six stock pictures is
 * gone (the user). The step moved behind 04 so the card can show the real end.
 * The roll is chosen on the next screen, so the card leaves that line out.
 *
 * Nothing is uploaded here. The choice rides in the draft and 05.1 applies it
 * right after the event exists (`applyCover`).
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { InviteDesigner } from '@/components/ui/invite-designer';
import { PillButton } from '@/components/ui/pill-button';
import { Rise } from '@/components/ui/rise';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { em } from '@/components/ui/rich';
import { Body, Display } from '@/components/ui/typography';
import { DEFAULT_LOOK } from '@/constants/looks';
import { Colors, CoverStep as T, Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { defaultEndsAt } from '@/lib/event-end';
import { DEFAULT_COVER, type CoverChoice } from '@/lib/event-cover';
import { useGlow, useOnboarding, useStep } from '@/lib/onboarding-draft';

export default function CoverScreen() {
  const router = useRouter();
  const { draft, patch } = useOnboarding();
  useGlow('ending');
  useStep(5);

  const [choice, setChoice] = useState<CoverChoice>(draft.cover ?? DEFAULT_COVER);
  // 04 always fills this; the fallback only keeps a deep link here from crashing.
  const [fallbackEnd] = useState(defaultEndsAt);

  return (
    <Screen transparent>
      <ScreenHeader style={styles.header} />

      <Rise>
        <Display size="md" style={styles.headline}>
          {em(t('onboarding.inviteHeadline'))}
        </Display>
        <Body small color={Colors.textDim}>
          {t('onboarding.inviteBody')}
        </Body>
      </Rise>

      <InviteDesigner
        look={draft.look ?? DEFAULT_LOOK}
        name={draft.filmName?.trim() || t('onboarding.inviteNameFallback')}
        endsAt={draft.endsAt ?? fallbackEnd}
        reveal={draft.reveal}
        choice={choice}
        onChange={setChoice}
      />

      <PillButton
        label={t('common.continue')}
        icon="arrow-right"
        onPress={() => {
          patch({ cover: choice });
          router.push('/(onboarding)/group-size');
        }}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: T.headerGap,
  },
  headline: {
    marginBottom: T.headlineGap,
  },
  cta: {
    marginBottom: Spacing.screenBottom,
  },
});
