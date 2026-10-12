/**
 * 06 · Your Name
 *
 * The detour Apple forces. `signInAsync` returns `fullName` on the *first* sign-in
 * for an Apple ID and app pair and never again, and a Hide-My-Email address is not
 * a usable fallback — its local part is a random handle. So an account can arrive
 * with no name worth showing a group, and this is where one is collected.
 *
 * It is reached only from Landing, by `router.replace`, when
 * `resolveDisplayName()` comes back null. There is deliberately no back button:
 * the account already exists and there is nothing coherent to return to.
 *
 * The name has to land **before** anything creates or joins an event — the
 * `add_host_as_member()` trigger reads `raw_user_meta_data ->> 'name'` at insert
 * time, so a later write would leave the host's first event showing the fallback.
 * That is why this sits between sign-in and `destinationAfterSignIn()` rather than
 * being offered later from settings.
 *
 * This screen used to be 06 Sign Up — the flow's last step, which signed in,
 * charged for the tier and created the event. Sign-in moved to Landing and the
 * purchase moved to 05.1; only the name question is left.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { BackgroundVideo } from '@/components/ui/background-video';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TextField } from '@/components/ui/text-field';
import { Body, Caption, Display } from '@/components/ui/typography';
import { Colors, SignUp, Spacing, VideoOverlay } from '@/constants/theme';
import { setDisplayName } from '@/lib/auth';
import { messageFor } from '@/lib/auth-errors';
import { destinationAfterSignIn } from '@/lib/entry';

type Phase = { kind: 'idle' } | { kind: 'saving' } | { kind: 'error'; message: string };

export default function NameScreen() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [name, setName] = useState('');

  const busy = phase.kind === 'saving';

  async function handleSubmit() {
    if (!name.trim() || busy) return;
    setPhase({ kind: 'saving' });
    try {
      await setDisplayName(name);
      router.replace(await destinationAfterSignIn());
    } catch (e) {
      setPhase({ kind: 'error', message: messageFor(e) });
    }
  }

  return (
    <Screen padded={false} edges={[]}>
      <BackgroundVideo opacity={VideoOverlay.signUpVideoOpacity} />

      <LinearGradient
        colors={[...VideoOverlay.signUpGradientColors]}
        locations={[...VideoOverlay.signUpGradientLocations]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          {/* No back button — see the note at the top of this file. */}
          <ScreenHeader glass back={false} />

          <View style={styles.center}>
            <Display size="xl" style={styles.headline}>
              What should we{'\n'}call you?
            </Display>
            <Body color={Colors.textMuted}>This is how your group will see you.</Body>
          </View>

          <View style={styles.actions}>
            <TextField
              label="Your name"
              value={name}
              onChangeText={setName}
              serif={false}
              autoFocus
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="done"
              // Matches the display_name check on event_members.
              maxLength={60}
              onSubmitEditing={() => void handleSubmit()}
            />
            <PillButton
              label={busy ? 'Working…' : 'Continue'}
              onPress={() => void handleSubmit()}
              disabled={!name.trim() || busy}
              style={styles.cta}
            />

            {phase.kind === 'error' && (
              <Caption color={Colors.gold} style={styles.note}>
                {phase.message}
              </Caption>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: Spacing.screenTop,
    paddingHorizontal: Spacing.screenX,
    paddingBottom: SignUp.paddingBottom,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SignUp.centerPaddingX,
  },
  headline: {
    textAlign: 'center',
    marginBottom: SignUp.headlineGap,
  },
  actions: {
    flexShrink: 0,
  },
  cta: {
    marginTop: Spacing.md,
  },
  note: {
    textAlign: 'center',
    marginTop: SignUp.noteGap,
  },
});
