/**
 * 03.1 · Event image (2026-11-21, the user). Not in the prototype.
 *
 * The host picks the picture guests see behind the waiting screen (12), that
 * stands behind the QR (09) and on the Moments card until there are photos:
 * one of LEFT's stock pictures, or their own from the library. It is drawn
 * through the look chosen on 03 — the preview is what guests will see.
 *
 * A stock picture is preselected, so Continue is always there; nothing is
 * uploaded here. The choice rides in the draft and 05.1 applies it right after
 * the event exists (`applyCover`) — an own photo is uploaded then.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { CoverPicker } from '@/components/ui/cover-picker';
import { PillButton } from '@/components/ui/pill-button';
import { Rise } from '@/components/ui/rise';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { em } from '@/components/ui/rich';
import { Body, Display, Label } from '@/components/ui/typography';
import { DEFAULT_LOOK } from '@/constants/looks';
import { Colors, CoverStep as T, Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { DEFAULT_COVER, type CoverChoice } from '@/lib/event-cover';
import { useGlow, useOnboarding, useStep } from '@/lib/onboarding-draft';

export default function CoverScreen() {
  const router = useRouter();
  const { draft, patch } = useOnboarding();
  useGlow('format');
  useStep(3);

  const look = draft.look ?? DEFAULT_LOOK;
  const [choice, setChoice] = useState<CoverChoice>(draft.cover ?? DEFAULT_COVER);
  /** The host's own photo, kept while they try stock pictures. */
  const [own, setOwn] = useState<string | null>(
    draft.cover?.kind === 'upload' ? draft.cover.uri : null,
  );

  return (
    <Screen transparent>
      <ScreenHeader style={styles.header} />

      <Rise>
        <Label style={styles.eyebrow}>{t('onboarding.coverEyebrow')}</Label>
        <Display size="xl" style={styles.headline}>
          {em(t('onboarding.coverHeadline'))}
        </Display>
        <Body small color={Colors.textDim}>
          {t('onboarding.coverBody')}
        </Body>
      </Rise>

      <CoverPicker
        look={look}
        choice={choice}
        onChange={setChoice}
        own={own}
        onOwnPicked={setOwn}
      />

      <PillButton
        label={t('common.continue')}
        icon="arrow-right"
        onPress={() => {
          patch({ cover: choice });
          router.push('/(onboarding)/ending');
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
  eyebrow: {
    marginBottom: T.eyebrowGap,
  },
  headline: {
    marginBottom: T.headlineGap,
  },
  cta: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.screenBottom,
  },
});
