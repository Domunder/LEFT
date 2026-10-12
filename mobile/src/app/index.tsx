/**
 * 01 · Landing
 *
 * App entry / marketing splash, and now the app's **only** way in. Full-bleed
 * ambient video under a darkening gradient, the logo header on top, and a frosted
 * glass panel pinned to the bottom carrying the three things a new user can do:
 * sign in with Google, sign in with Apple, or join somebody else's group.
 *
 * Identity comes first here rather than at the end of onboarding. A host used to
 * walk 02→05.1 before the app knew who they were, which meant screen 06 owned the
 * sign-in, the purchase and the create all at once, and Landing's own header
 * button was a second, hidden way in. Both are gone: the providers sit on the
 * panel, and where a signed-in user goes next is `destinationAfterSignIn()`.
 *
 * Copy follows design/LEFT App.dc.html ("Join a Group"), which supersedes the
 * older labels in design/README.md. The artboard's "Start a Memory" CTA is
 * replaced by the provider row — there is nothing to start until we know who is
 * starting it.
 */

import type { Session } from '@supabase/supabase-js';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/ui/auth-button';
import { BackgroundVideo } from '@/components/ui/background-video';
import { GlassPanel } from '@/components/ui/glass-panel';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Body, Caption, Display, Em } from '@/components/ui/typography';
import {
  AuthButton as AuthButtonToken,
  Colors,
  LandingHeader,
  LandingPanel,
  Spacing,
  VideoOverlay,
} from '@/constants/theme';
import { Typography } from '@/constants/typography';
import {
  IS_WEB,
  NATIVE_AUTH_UNAVAILABLE,
  SHOWS_APPLE,
  isSignInCancelled,
  resolveDisplayName,
  signInAnonymously,
  signInWithApple,
  signInWithGoogle,
} from '@/lib/auth';
import { messageFor } from '@/lib/auth-errors';
import { destinationAfterSignIn } from '@/lib/entry';
import { identify, PURCHASES_UNAVAILABLE } from '@/lib/purchases';

const LOGO = require('@/assets/images/left-logo.png');

type Provider = 'google' | 'apple';

type Phase =
  | { kind: 'idle' }
  | { kind: 'signingIn'; provider: Provider }
  | { kind: 'error'; message: string };

export default function LandingScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const busy = phase.kind === 'signingIn';

  /**
   * Everything that happens once a session exists, whichever way it was minted.
   *
   * The order is load-bearing. `identify()` binds purchases to the real user
   * before any branch below, because the name detour returns early and those
   * users still pay — an identify() placed after it would leave their receipt on
   * an anonymous RevenueCat id, and a ledger row whose user_id matches nobody.
   */
  async function routeOnward(session: Session) {
    if (!PURCHASES_UNAVAILABLE) await identify(session.user.id);

    /*
      Apple hands over a name exactly once and sometimes not at all, and the
      `add_host_as_member()` trigger reads it out of user metadata at insert
      time. So a nameless account is sent to collect one before it can reach a
      screen that creates or joins anything.
    */
    if (!resolveDisplayName(session.user)) {
      router.replace('/(auth)/name');
      return;
    }

    router.replace(await destinationAfterSignIn());
  }

  async function handleProvider(provider: Provider) {
    setPhase({ kind: 'signingIn', provider });
    try {
      const session = provider === 'google' ? await signInWithGoogle() : await signInWithApple();
      await routeOnward(session);
    } catch (e) {
      // A dismissed native sheet should leave nothing behind.
      if (isSignInCancelled(e)) {
        setPhase({ kind: 'idle' });
        return;
      }
      setPhase({ kind: 'error', message: messageFor(e) });
    }
  }

  /**
   * The dev-only way in, for Expo Go.
   *
   * Neither provider's native module exists there, so without this the whole app
   * past this screen is unreachable — and navigating past the gate is not enough
   * on its own: `events.host_id` is `auth.uid()`, so with no session
   * `createEvent()` throws and `listMyEventSummaries()` comes back empty.
   *
   * So it signs in for real, anonymously, and then takes the same route a
   * provider does. Anonymous is the honest identity for it rather than a fake
   * account: it is a real `auth.users` row that every RLS policy already accepts
   * — it is exactly how guests work — and it has no name, so it lands on the
   * name screen just as a fresh Apple account would.
   *
   * Being exactly how guests work is also its limit now. Hosting requires a full
   * account — `create_event()` refuses an anonymous caller — so this lands in the
   * library rather than onboarding, and its plus offers `(auth)/create`, which
   * needs a provider Expo Go does not have. It exercises the guest half of the
   * app; the host flow needs a development build.
   */
  async function handleDevSkip() {
    setPhase({ kind: 'signingIn', provider: 'google' });
    try {
      await routeOnward(await signInAnonymously());
    } catch (e) {
      if (isSignInCancelled(e)) {
        setPhase({ kind: 'idle' });
        return;
      }
      setPhase({ kind: 'error', message: messageFor(e) });
    }
  }

  return (
    <Screen padded={false} edges={[]}>
      <BackgroundVideo opacity={VideoOverlay.videoOpacity} />

      <LinearGradient
        colors={[...VideoOverlay.gradientColors]}
        locations={[...VideoOverlay.gradientLocations]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/*
        The design's grain overlay (feTurbulence at 3.5%) is deliberately not
        rendered: on device it read as noise in the upper area rather than as
        film texture. GrainOverlay is kept in components/ui for later.
      */}

      {/*
        Brand alone. The artboard's header carries a "Sign in" circle on the
        right; the providers are on the panel now, so a second route to the same
        place would only be a way to get lost.
      */}
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={LOGO} style={styles.logo} accessible={false} />
          <Text style={styles.wordmark}>LEFT</Text>
        </View>
      </View>

      <GlassPanel style={styles.panel}>
        <Display size="lg" style={styles.headline}>
          Only one{'\n'}
          <Em>moment left?</Em>
        </Display>

        <Body style={styles.subcopy}>
          Set a time limit. Everyone films.{'\n'}One memory, automatically made.
        </Body>

        <View style={styles.providers}>
          <AuthButton
            label="Google"
            icon="google"
            onPress={() => void handleProvider('google')}
            disabled={NATIVE_AUTH_UNAVAILABLE || busy}
            busy={phase.kind === 'signingIn' && phase.provider === 'google'}
          />
          {SHOWS_APPLE && (
            <AuthButton
              label="Apple"
              icon="apple"
              onPress={() => void handleProvider('apple')}
              disabled={NATIVE_AUTH_UNAVAILABLE || busy}
              busy={phase.kind === 'signingIn' && phase.provider === 'apple'}
            />
          )}
        </View>

        {/*
          Joining needs no account, so it is never disabled — a guest whose host
          sent them a link can get in on a build where the providers cannot work.
        */}
        <PillButton
          label="Join a Group"
          icon="users"
          variant="glass"
          onPress={() => router.push('/(modals)/join')}
          style={styles.joinCta}
        />

        {phase.kind === 'error' ? (
          <Caption color={Colors.gold} style={styles.note}>
            {phase.message}
          </Caption>
        ) : NATIVE_AUTH_UNAVAILABLE ? (
          <Caption style={styles.note}>
            {IS_WEB
              ? 'Google and Apple sign-in are native-only — use a development build to sign in.'
              : 'Google and Apple sign-in need a development build — see docs/social-sign-in.md.'}
          </Caption>
        ) : null}

        {/* See handleDevSkip — this signs in anonymously *for real*. */}
        {__DEV__ && NATIVE_AUTH_UNAVAILABLE && (
          <PillButton
            label={busy ? 'Working…' : 'Skip sign-in (dev)'}
            variant="secondary"
            disabled={busy}
            onPress={() => void handleDevSkip()}
            style={styles.devSkip}
          />
        )}

        <Caption style={styles.finePrint}>
          By continuing you agree to our{' '}
          <Text style={styles.link} onPress={() => router.push('/(legal)/terms')}>
            Terms
          </Text>{' '}
          and{' '}
          <Text style={styles.link} onPress={() => router.push('/(legal)/privacy')}>
            Privacy Policy
          </Text>
        </Caption>
      </GlassPanel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: LandingHeader.paddingTop,
    paddingHorizontal: LandingHeader.paddingX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LandingHeader.logoGap,
  },
  logo: {
    width: LandingHeader.logoSize,
    height: LandingHeader.logoSize,
    resizeMode: 'contain',
  },
  wordmark: {
    ...Typography.wordmark,
    color: Colors.textSoft,
  },
  panel: {
    position: 'absolute',
    left: LandingPanel.inset,
    right: LandingPanel.inset,
    bottom: LandingPanel.bottom,
  },
  headline: {
    marginBottom: LandingPanel.headlineGap,
  },
  subcopy: {
    marginBottom: LandingPanel.subcopyGap,
  },
  providers: {
    flexDirection: 'row',
    gap: AuthButtonToken.rowGap,
    marginBottom: LandingPanel.ctaGap,
  },
  joinCta: {
    marginBottom: LandingPanel.actionsGap,
  },
  note: {
    textAlign: 'center',
    marginBottom: LandingPanel.noteGap,
  },
  devSkip: {
    marginBottom: Spacing.md,
  },
  finePrint: {
    textAlign: 'center',
  },
  link: {
    color: Colors.link,
    textDecorationLine: 'underline',
  },
});
