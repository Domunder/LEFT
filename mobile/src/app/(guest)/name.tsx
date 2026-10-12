/**
 * 11 · Guest — Your Name
 *
 * The whole of a guest's onboarding. One field, one button, and they are in.
 *
 * **This screen owns the join**, which is why it does more than its artboard
 * suggests. `join_event(code, name)` wants both halves at once, and the name
 * only exists here — so 08 and the deep-link handler both forward a code to this
 * screen rather than joining themselves.
 *
 * On Continue, in order:
 *   1. an anonymous session, if there is not one already — silent, no UI
 *   2. the name onto the auth user, so it survives into later events
 *   3. join_event(code, name), which is what actually admits them
 *
 * **Guests never create an account.** They are anonymous auth users: a real
 * `auth.users` row with no email and no provider, which is what the schema needs
 * (RLS keys off membership, clips need an owner) without asking anyone to sign
 * up. The session persists across restarts, so force-quitting mid-event brings
 * them back as the same member. Signing in comes later, after the film exists
 * and there is finally a reason to — see `linkIdentity` in lib/auth.ts.
 *
 * The artboard draws no header and no back button. Kept as drawn: a guest
 * arriving by link has nothing behind them.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Body, Caption, Display, Em, Label } from '@/components/ui/typography';
import { Colors, Guest, Radii, Spacing } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { getSession, resolveDisplayName, setDisplayName, signInAnonymously } from '@/lib/auth';
import { joinEvent } from '@/lib/events';

/** Matches the `char_length(display_name) between 1 and 60` check on event_members. */
const MAX_NAME_LENGTH = 60;

export default function GuestNameScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();

  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    Reaching this screen without a code cannot be recovered from — there is no
    event to join and no field here to supply one. Send them to 08, which is the
    screen that can actually get one.
  */
  useEffect(() => {
    if (!code) router.replace('/(modals)/join');
  }, [code, router]);

  /*
    A returning guest — or a host who tapped somebody else's invite — already has
    a name worth offering. A fresh anonymous user has none, and gets an empty
    field rather than a placeholder pretending to be one.
  */
  useEffect(() => {
    let cancelled = false;

    async function prefill() {
      try {
        const session = await getSession();
        const existing = session?.user ? resolveDisplayName(session.user) : null;
        if (!cancelled && existing) setName(existing);
      } catch {
        // No session or no credentials — an empty field is the right answer.
      }
    }

    void prefill();
    return () => {
      cancelled = true;
    };
  }, []);

  const trimmed = name.trim();
  const canContinue = trimmed.length > 0 && !busy;

  const handleContinue = useCallback(async () => {
    if (!code || !canContinue) return;

    setBusy(true);
    setError(null);

    try {
      // Silent. The guest never learns they were signed in, which is the point.
      await signInAnonymously();

      // Before the join: add_host_as_member() reads user metadata at insert time,
      // and this guest may host their own event later from the same identity.
      await setDisplayName(trimmed);

      const eventId = await joinEvent(code, trimmed);

      // `replace`, not `push` — there is nothing behind this worth returning to.
      router.replace({ pathname: '/(guest)/waiting', params: { eventId } });
    } catch (e) {
      setError(describeJoinError(e));
      setBusy(false);
    }
  }, [code, canContinue, trimmed, router]);

  return (
    <Screen edges={['bottom']} style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.flex}>
          <Label style={styles.eyebrow}>Welcome</Label>

          <Display size="xxl" style={styles.headline}>
            What should{'\n'}we <Em>call you?</Em>
          </Display>

          {/*
            Not `TextField`: that component pairs an uppercase label with a 15px
            serif input at radius 14, and this artboard has no label, an 18px sans
            input and radius 18. Its own metrics, the same call ShareButton and
            AuthButton made.
          */}
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={Colors.textGhost}
            selectionColor={Colors.text}
            maxLength={MAX_NAME_LENGTH}
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="done"
            editable={!busy}
            onSubmitEditing={() => void handleContinue()}
            style={styles.input}
          />

          <Caption color={Guest.helper} style={styles.helper}>
            This is how the group will see you during the event.
          </Caption>

          {/*
            Reserved whether or not there is an error, so the CTA does not jump up
            the screen the moment a join fails.
          */}
          <View style={styles.error}>
            {error ? (
              <Body small color={Colors.textMuted}>
                {error}
              </Body>
            ) : null}
          </View>
        </View>

        <PillButton
          label={busy ? 'Joining…' : 'Continue'}
          disabled={!canContinue}
          onPress={() => void handleContinue()}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * Turn a join failure into a sentence.
 *
 * `join_event` raises three distinct conditions and they call for three
 * different responses from the guest — retype the code, ask the host to make
 * room, or accept that it is over. One generic "could not join" would hide which.
 */
function describeJoinError(e: unknown): string {
  const message = e instanceof Error ? e.message.toLowerCase() : '';

  if (message.includes('invalid invite code')) {
    return "That invite code doesn't match an event. Ask the host for a fresh link or QR.";
  }
  if (message.includes('already ended')) {
    return 'This event has already finished filming.';
  }
  if (message.includes('anonymous') || message.includes('disabled')) {
    // Anonymous sign-ins not enabled in the Supabase dashboard — a setup problem,
    // not something the guest did.
    return "Joining isn't available right now. Please try again shortly.";
  }
  return "Couldn't join the group. Check your connection and try again.";
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: Guest.paddingTop,
    paddingBottom: Guest.paddingBottom,
  },
  flex: {
    flex: 1,
  },
  eyebrow: {
    marginBottom: Guest.eyebrowGap,
  },
  headline: {
    marginBottom: Guest.headlineGap,
  },
  input: {
    width: '100%',
    fontFamily: FontFamily.regular,
    fontSize: Guest.field.fontSize,
    paddingVertical: Guest.field.paddingY,
    paddingHorizontal: Guest.field.paddingX,
    borderRadius: Radii.fieldLg,
    borderWidth: 1,
    borderColor: Guest.field.border,
    backgroundColor: Guest.field.bg,
    color: Colors.text,
    marginBottom: Guest.helperGap,
  },
  helper: {
    marginBottom: Spacing.md,
  },
  error: {
    minHeight: Spacing.xl,
  },
});
