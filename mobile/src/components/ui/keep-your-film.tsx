/**
 * "Keep your films" — the prompt that turns a guest into an account.
 *
 * This is the end-of-film sign-in CLAUDE.md's Open Gaps assign to screens 14/15.
 * A guest never signs up: they tap an invite link, type a name on 11 and film.
 * That identity is an anonymous `auth.users` row whose session lives only in this
 * device's AsyncStorage — clear the app data and their membership, their clips
 * and every film they appear in become unreachable.
 *
 * `linkIdentity()` attaches a provider to the *same* user id, so all of it
 * survives. Signing them in as a fresh user instead would strand it, which is
 * why this links rather than signs in.
 *
 * **The ordering is the point.** The prompt comes after the film, not before it:
 * a guest has a reason to keep something only once there is something to keep.
 *
 * This is the *fallback*. The offer a guest actually meets is `(auth)/keep`, the
 * screen 14 replaces onto the moment their film turns ready; this panel is for a
 * guest who reaches the library some other way, and the dismissal is shared so
 * declining either one silences both.
 *
 * Not in the artboard, which draws no such panel — flagged in CLAUDE.md.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthButton } from './auth-button';
import { GlassPanel } from './glass-panel';
import { Body, Caption, Label } from './typography';
import { Colors, Films, Radii, Spacing } from '@/constants/theme';
import {
  IS_WEB,
  isSignInCancelled,
  linkIdentity,
  NATIVE_AUTH_UNAVAILABLE,
  SHOWS_APPLE,
} from '@/lib/auth';

type Provider = 'google' | 'apple';

type KeepYourFilmProps = {
  /** Called once linking succeeds — the caller re-reads the session to dismiss this. */
  onLinked: () => void;
  onDismiss: () => void;
};

export function KeepYourFilm({ onLinked, onDismiss }: KeepYourFilmProps) {
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(provider: Provider) {
    if (busy) return;
    setBusy(provider);
    setError(null);

    try {
      await linkIdentity(provider);
      onLinked();
    } catch (e) {
      // Backing out of a native sheet is not a failure — leaving an error banner
      // behind for a dismissed sheet reads as broken. Same call 06 makes.
      if (!isSignInCancelled(e)) {
        setError(
          e instanceof Error && e.message.toLowerCase().includes('already')
            ? 'That account is already in use. Try the other option.'
            : "Couldn't sign in. Check your connection and try again."
        );
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <GlassPanel radius={Radii.card} contentStyle={styles.content}>
      <View style={styles.headingRow}>
        <Label small>Keep your films</Label>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onDismiss}
          hitSlop={Spacing.md}
          style={({ pressed }) => pressed && styles.pressed}>
          <Caption color={Colors.textFaint}>Not now</Caption>
        </Pressable>
      </View>

      <Body small style={styles.copy}>
        You&rsquo;re filming as a guest. Sign in so your films stay yours if you lose this
        phone.
      </Body>

      <View style={styles.buttons}>
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
        <Caption color={Colors.textMuted} style={styles.note}>
          {error}
        </Caption>
      ) : NATIVE_AUTH_UNAVAILABLE ? (
        <Caption style={styles.note}>
          {IS_WEB
            ? 'Google and Apple sign-in are native-only — use a development build.'
            : 'Google and Apple sign-in need a development build — see docs/social-sign-in.md.'}
        </Caption>
      ) : null}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copy: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  buttons: {
    flexDirection: 'row',
    gap: Films.header.buttonGap,
  },
  note: {
    marginTop: Spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
});
