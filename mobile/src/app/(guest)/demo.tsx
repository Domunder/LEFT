/**
 * The demo's way in — `leftmoment.com/j/TRYLEFT`, tapped or scanned on a phone
 * that has the app (2026-11-23). Not in the prototype.
 *
 * Nothing to ask: sign in (anonymously when nobody is), ask the server for the
 * caller's demo moment, and go straight to its camera — or to its album when
 * they developed it a moment ago. The screen itself is only the wait and the
 * failure.
 */

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PillButton } from '@/components/ui/pill-button';
import { em } from '@/components/ui/rich';
import { Screen } from '@/components/ui/screen';
import { Body, Display } from '@/components/ui/typography';
import { Colors, Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { signInAnonymously } from '@/lib/auth';
import { messageFor } from '@/lib/auth-errors';
import { DemoLimitError, startDemo } from '@/lib/demo';
import { isDeveloped } from '@/lib/events';

export default function DemoScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await signInAnonymously();
        const event = await startDemo();
        if (cancelled) return;

        if (isDeveloped(event)) {
          router.replace({ pathname: '/(library)/album/[id]', params: { id: event.id } });
        } else {
          router.replace({ pathname: '/(capture)/camera', params: { eventId: event.id } });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof DemoLimitError ? e.message : messageFor(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt, router]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return (
    <Screen style={styles.screen}>
      {error ? (
        <View style={styles.block}>
          <Display size="md">{em(t('guest.demoFailedHeadline'))}</Display>
          <Body>{error}</Body>
          <PillButton label={t('common.tryAgain')} onPress={retry} />
          <PillButton variant="secondary" label={t('common.close')} onPress={() => router.replace('/')} />
        </View>
      ) : (
        <View style={styles.block}>
          <ActivityIndicator size="small" color={Colors.textMuted} />
          <Body>{t('guest.demoSettingUp')}</Body>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
  },
  block: {
    gap: Spacing.lg,
    alignItems: 'stretch',
  },
});
