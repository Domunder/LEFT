/**
 * "Your film is ready" (1.3.0) — the moment after an event was created: the
 * invitation as guests will get it, and one way on, to the QR code (09).
 *
 * Before, creating jumped straight to 09. This is the one beat in between
 * where the host sees that it worked — a success haptic as the sheet arrives —
 * and what they made. Dragging it away or tapping the scrim goes on to 09 too:
 * there is nothing to return to behind it (the draft is spent).
 */

import { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { InviteHeader, type InviteContent } from './invite-card';
import { PillButton } from './pill-button';
import { em } from './rich';
import { Sheet } from './sheet';
import { Body, Display } from './typography';
import { Colors, FilmReady as T } from '@/constants/theme';
import { t } from '@/i18n';
import { haptic } from '@/lib/haptics';

type FilmReadySheetProps = {
  /** The created event's invitation; null keeps the sheet closed. */
  content: InviteContent | null;
  /** On to the QR code. */
  onContinue: () => void;
};

export function FilmReadySheet({ content, onContinue }: FilmReadySheetProps) {
  const visible = content !== null;

  useEffect(() => {
    if (visible) haptic.success();
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onContinue}>
      {/* A Modal is its own native root: gestures need their own root view in it. */}
      <GestureHandlerRootView style={styles.root}>
        {content ? (
          <Sheet onDismiss={onContinue}>
            <View style={styles.text}>
              <Display size="md">{em(t('onboarding.readyHeadline'))}</Display>
              <Body small color={Colors.textDim}>
                {t('onboarding.readyBody')}
              </Body>
            </View>

            <InviteHeader {...content} style={styles.card} />

            <PillButton
              label={t('onboarding.readyCta')}
              icon="arrow-right"
              onPress={onContinue}
              style={styles.cta}
            />
          </Sheet>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  text: {
    gap: T.textGap,
  },
  card: {
    height: T.cardHeight,
    borderRadius: T.cardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.cardBorder,
  },
  cta: {
    marginTop: T.ctaGap,
  },
});
