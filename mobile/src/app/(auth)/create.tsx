/**
 * Sign in to host — the gate a guest meets when they try to start their own film.
 *
 * Joining needs no account; hosting does. A guest arrives by invite link, types a
 * name on 11 and films, and everything they own hangs off an anonymous
 * `auth.users` row that lives in this device's AsyncStorage alone. That is a fine
 * identity to *appear* in someone else's memory with. It is a bad one to be the
 * host of a memory other people are joining, paying into and coming back to
 * months later — clear the app data and the event has no owner left.
 *
 * So the library's plus routes here instead of into onboarding whenever the
 * session is anonymous, and `create_event()` refuses an anonymous caller outright
 * (20260823180000_hosts_are_not_anonymous.sql). This screen is the way through,
 * not the wall — the wall is in the database.
 *
 * Like `(auth)/keep` it **links** rather than signs in: `linkIdentity()` attaches
 * the provider to the same user id, so the guest's memberships, clips and the
 * films they appear in all survive. Signing them in as a fresh user would strand
 * every one of them on an identity nobody can reach.
 *
 * Where it differs from `(auth)/keep`:
 *  - it has a back button, because it is `push`ed from a screen worth returning to
 *  - declining does **not** call `dismissPrompt()`. That flag means "stop offering
 *    to keep my films"; backing out of creating something is not that answer, and
 *    silencing the end-of-film offer because someone changed their mind about
 *    hosting would be reading far too much into a tap.
 *  - it `replace`s onward on success, so the gate is not behind them once passed
 *
 * Not in the artboard, which draws no guest-to-host upgrade at all — flagged in
 * CLAUDE.md alongside `(auth)/keep`.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthButton } from '@/components/ui/auth-button';
import { BackgroundVideo } from '@/components/ui/background-video';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Body, Caption, Display, Em } from '@/components/ui/typography';
import {
  AuthButton as AuthButtonToken,
  Colors,
  SignUp,
  Spacing,
  VideoOverlay,
} from '@/constants/theme';
import {
  getSession,
  IS_WEB,
  isSignInCancelled,
  linkIdentity,
  NATIVE_AUTH_UNAVAILABLE,
  resolveDisplayName,
  SHOWS_APPLE,
} from '@/lib/auth';

type Provider = 'google' | 'apple';

export default function CreateAccountScreen() {
  const router = useRouter();

  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(provider: Provider) {
    if (busy) return;
    setBusy(provider);
    setError(null);

    try {
      await linkIdentity(provider);

      /*
        Defensive rather than expected. Every anonymous user reaching this screen
        should already have a name — a guest sets one on 11 before they can join,
        and the dev skip is sent to `(auth)/name` the moment it signs in — but the
        `add_host_as_member()` trigger reads `raw_user_meta_data ->> 'name'` at
        insert time and falls back to the literal 'Host'. A nameless host is worth
        one more screen, not a permanent wrong name on their own event.
      */
      const session = await getSession();
      if (session && !resolveDisplayName(session.user)) {
        router.replace('/(auth)/name');
        return;
      }

      router.replace('/(onboarding)/event');
    } catch (e) {
      // Backing out of a native sheet is not a failure; an error banner left
      // behind by a dismissed sheet reads as broken. Same call `keep` makes.
      if (!isSignInCancelled(e)) {
        setError(
          e instanceof Error && e.message.toLowerCase().includes('already')
            ? 'That account is already in use. Try the other option.'
            : "Couldn't sign in. Check your connection and try again."
        );
      }
      setBusy(null);
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

      <View style={styles.content}>
        {/* Pushed from the library, so back is a real answer here. */}
        <ScreenHeader glass backFallback="/(library)/films" />

        <View style={styles.center}>
          <Display size="xl" style={styles.headline}>
            Start your own{'\n'}
            <Em>memory.</Em>
          </Display>
          <Body color={Colors.textMuted} style={styles.subcopy}>
            Hosting needs an account. Sign in and everything you filmed as a guest
            comes with you.
          </Body>
        </View>

        <View style={styles.actions}>
          <View style={styles.providers}>
            <AuthButton
              label="Google"
              icon="google"
              onPress={() => void handle('google')}
              disabled={NATIVE_AUTH_UNAVAILABLE || busy !== null}
              busy={busy === 'google'}
            />
            {SHOWS_APPLE && (
              <AuthButton
                label="Apple"
                icon="apple"
                onPress={() => void handle('apple')}
                disabled={NATIVE_AUTH_UNAVAILABLE || busy !== null}
                busy={busy === 'apple'}
              />
            )}
          </View>

          {error ? (
            <Caption color={Colors.gold} style={styles.note}>
              {error}
            </Caption>
          ) : NATIVE_AUTH_UNAVAILABLE ? (
            <Caption style={styles.note}>
              {IS_WEB
                ? 'Google and Apple sign-in are native-only — use a development build.'
                : 'Google and Apple sign-in need a development build — see docs/social-sign-in.md.'}
            </Caption>
          ) : null}

          {/* See the note at the top — this declines *hosting*, nothing else. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not now"
            onPress={() => router.back()}
            disabled={busy !== null}
            hitSlop={Spacing.md}
            style={({ pressed }) => [styles.decline, pressed && styles.pressed]}>
            <Caption color={Colors.textFaint}>Not now</Caption>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  subcopy: {
    textAlign: 'center',
  },
  actions: {
    flexShrink: 0,
  },
  providers: {
    flexDirection: 'row',
    gap: AuthButtonToken.rowGap,
  },
  note: {
    textAlign: 'center',
    marginTop: SignUp.noteGap,
  },
  decline: {
    alignSelf: 'center',
    marginTop: SignUp.noteGap,
  },
  pressed: {
    opacity: 0.6,
  },
});
