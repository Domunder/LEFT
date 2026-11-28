/**
 * The invitation designer (1.3.0, the user) — the host sees their invitation
 * inside an iPhone, as a guest will get it, and changes its picture.
 *
 * Replaces the event image picker with its row of stock pictures: there is one
 * default image now, and the host's own photo. (A moment created earlier with
 * another stock picture keeps it until the host changes it.)
 *
 * Controlled: the parent holds the choice. Used by the creation step and by the
 * host's "Change image" (`(host)/cover`).
 */

import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleIconButton } from './circle-back-button';
import { InviteCardPreview, type InviteContent } from './invite-card';
import { PhoneFrame, phoneWidthFor } from './phone-frame';
import { PillButton } from './pill-button';
import { PressScale } from './press-scale';
import { Body } from './typography';
import { Colors, InviteCard as T, Motion } from '@/constants/theme';
import { t } from '@/i18n';
import { getSession, resolveDisplayName } from '@/lib/auth';
import { choiceSource, DEFAULT_COVER, type CoverChoice } from '@/lib/event-cover';
import type { FilmLook, RevealChoice } from '@/lib/events';
import { haptic } from '@/lib/haptics';
import { canImport, pickOnePhoto } from '@/lib/import-photos';

function isDefault(choice: CoverChoice): boolean {
  return (
    choice.kind === 'sample' && DEFAULT_COVER.kind === 'sample' && choice.key === DEFAULT_COVER.key
  );
}

type InviteDesignerProps = {
  look: FilmLook;
  name: string;
  endsAt: Date;
  /** Left out while the roll is not chosen yet (creation asks for it later). */
  rollSize?: number | null;
  developed?: boolean;
  reveal?: RevealChoice | null;
  choice: CoverChoice;
  onChange: (next: CoverChoice) => void;
};

export function InviteDesigner({
  look,
  name,
  endsAt,
  rollSize,
  developed,
  reveal,
  choice,
  onChange,
}: InviteDesignerProps) {
  const insets = useSafeAreaInsets();
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [previewing, setPreviewing] = useState(false);

  // The host is whoever is designing: their own name is the one on the card.
  const [hostName, setHostName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((session) => {
        const mine = session?.user ? resolveDisplayName(session.user) : null;
        if (!cancelled && mine) setHostName(mine);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const content: InviteContent = {
    look,
    source: choiceSource(choice),
    name,
    hostName,
    endsAt,
    rollSize,
    developed,
    reveal,
  };

  // As large as the room allows, never wider than the token.
  const phoneWidth = Math.floor(
    Math.min(
      T.designer.maxPhoneWidth,
      area.width,
      phoneWidthFor(Math.max(0, area.height - 2 * T.designer.paddingY)),
    ),
  );

  async function changeImage() {
    const uri = await pickOnePhoto().catch(() => null);
    if (!uri) return;
    haptic.select();
    onChange({ kind: 'upload', uri });
  }

  return (
    <>
      <View
        style={styles.area}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setArea({ width, height });
        }}>
        {phoneWidth > 0 ? (
          <Animated.View entering={FadeIn.duration(Motion.duration)}>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.invitePreviewA11y')}
              onPress={() => setPreviewing(true)}>
              <PhoneFrame width={phoneWidth}>
                <InviteCardPreview {...content} />
              </PhoneFrame>
            </PressScale>
          </Animated.View>
        ) : null}
      </View>

      {/* Without a picker in this build there is nothing to change: preview only. */}
      {canImport() ? (
        <PillButton
          variant="glass"
          icon="image"
          label={t('onboarding.inviteChangeImage')}
          onPress={() => void changeImage()}
        />
      ) : null}

      <View style={styles.links}>
        <Pressable
          accessibilityRole="button"
          hitSlop={T.designer.linkHitSlop}
          onPress={() => setPreviewing(true)}>
          <Body small color={Colors.textDim} style={styles.link}>
            {t('onboarding.invitePreview')}
          </Body>
        </Pressable>
        {!isDefault(choice) ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={T.designer.linkHitSlop}
            onPress={() => {
              haptic.select();
              onChange(DEFAULT_COVER);
            }}>
            <Body small color={Colors.textDim} style={styles.link}>
              {t('onboarding.inviteUseDefault')}
            </Body>
          </Pressable>
        ) : null}
      </View>

      <Modal
        visible={previewing}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setPreviewing(false)}>
        <View style={styles.preview}>
          <InviteCardPreview {...content} />
          <View
            style={[
              styles.close,
              { top: insets.top + T.preview.closeInset, right: T.preview.closeInset },
            ]}>
            <CircleIconButton
              glass
              icon="x"
              accessibilityLabel={t('common.close')}
              onPress={() => setPreviewing(false)}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  links: {
    minHeight: T.designer.linksHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.designer.linksGap,
  },
  link: {
    textDecorationLine: 'underline',
  },
  preview: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  close: {
    position: 'absolute',
  },
});
