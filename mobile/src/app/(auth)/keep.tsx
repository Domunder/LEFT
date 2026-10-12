/**
 * Keep your film — the guest's end-of-film sign-up.
 *
 * A guest never signs up to take part: they tap an invite link, type a name on 11
 * and film. That identity is an anonymous `auth.users` row whose session lives
 * only in this device's AsyncStorage, so clearing the app data makes their
 * membership, their clips and every film they appear in unreachable.
 *
 * **The ordering is the point.** The prompt comes after the film, not before it —
 * a guest has a reason to keep something only once there is something to keep.
 * 14 replaces onto this screen the moment the event turns 'ready', but only for
 * an anonymous user who has not already declined; everyone else goes straight to
 * the library.
 *
 * It **links** rather than signs in. `linkIdentity()` attaches the provider to the
 * same user id, so all of the above survives; signing them in as a fresh user
 * would strand every bit of it on an identity nobody can reach.
 *
 * `components/ui/keep-your-film.tsx` is the same offer as a dismissible panel in
 * the library, for a guest who reaches it some other way. This screen is the one
 * that fires at the end of the film.
 *
 * Not in the artboard, which draws no such screen — flagged in CLAUDE.md.
 */

import type { User } from '@supabase/supabase-js';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
  SHOWS_APPLE,
} from '@/lib/auth';
import { dismissPrompt } from '@/lib/prompt-dismissal';

type Provider = 'google' | 'apple';

export default function KeepScreen() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
    Only needed to remember a decline, so a failed read is not worth an error
    state — the offer still works, it just would not be remembered.
  */
  useEffect(() => {
    let cancelled = false;
    void getSession()
      .then((session) => {
        if (!cancelled) setUser(session?.user ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function handle(provider: Provider) {
    if (busy) return;
    setBusy(provider);
    setError(null);

    try {
      await linkIdentity(provider);
      // They have at least this one film, so the library is where they belong —
      // the same rule destinationAfterSignIn() applies to a host.
      router.replace('/(library)/films');
    } catch (e) {
      // Backing out of a native sheet is not a failure; an error banner left
      // behind by a dismissed sheet reads as broken.
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

  function handleDecline() {
    /*
      Remembered per user id, and shared with the library panel — nothing about
      the guest model forces anyone to sign up, and asking again after every
      film would be nagging rather than offering.
    */
    if (user) void dismissPrompt(user.id);
    router.replace('/(library)/films');
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
        {/* Nothing behind it — 14 arrives here with `router.replace`. */}
        <ScreenHeader glass back={false} />

        <View style={styles.center}>
          <Display size="xl" style={styles.headline}>
            Your film is{'\n'}
            <Em>ready.</Em>
          </Display>
          <Body color={Colors.textMuted} style={styles.subcopy}>
            You filmed as a guest, so it lives on this phone alone. Sign in and it
            stays yours.
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not now"
            onPress={handleDecline}
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
