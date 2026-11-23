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
 *
 * **Missions: "Are you one of these?"** (2026-11-17; names first since
 * 2026-11-19, the user). A host with missions on can list names ("Tom") and
 * write personal missions for them. When the event has such names, the screen
 * shows them first, one per row (`NamePicker`), and "Add your name" at the end
 * opens the field — so a guest reads the list before typing. Tapping a name
 * again closes the field: the way back for someone who typed, then saw
 * themselves listed. Only names nobody else holds are listed; the list is asked
 * again every `MissionsJoin.refreshMs`, so a name someone takes disappears.
 *
 * Reading the names needs a session, so the anonymous sign-in starts when the
 * screen opens — idempotent, and Continue waits for that same attempt rather
 * than racing it into a second anonymous user. If the names fail to load or
 * there are none, the screen is the artboard's: the field alone.
 *
 * Picking a host's name makes it the guest's name too ("Tom" is what the group
 * sees). On Continue, after the join, the choice is written (`claimName`; with
 * no name chosen it gives back any name held):
 *   - taken by someone else meanwhile: the guest stays joined, the name leaves
 *     the list and they choose again (no second join);
 *   - missions already dealt (the event started): they keep the cards they
 *     have — silently;
 *   - anything else: logged, never in the way of joining.
 *
 * **Back from 12** (`change=1`): a guest waiting for the start can come back
 * here to switch to or from a host's name. Their current name is chosen, a
 * back button returns without changes, and Continue goes back to 12. Once the
 * host starts, 12 is gone and so is the way here.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { CircleBackButton } from '@/components/ui/circle-back-button';
import { NamePicker } from '@/components/ui/name-picker';
import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Body, Caption, Display, Em, Label } from '@/components/ui/typography';
import { Colors, Guest, MissionsJoin, Radii, Spacing } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { getSession, resolveDisplayName, setDisplayName, signInAnonymously } from '@/lib/auth';
import { isDemoCode } from '@/lib/demo-code';
import { joinEvent } from '@/lib/events';
import {
  claimName,
  listUnclaimedNames,
  MissionNameTakenError,
  MissionsDealtError,
  type MissionName,
} from '@/lib/missions';

/** Matches the `char_length(display_name) between 1 and 60` check on event_members. */
const MAX_NAME_LENGTH = 60;

export default function GuestNameScreen() {
  const router = useRouter();
  const { code, change } = useLocalSearchParams<{ code?: string; change?: string }>();
  const changing = change === '1';

  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** The host's names nobody else holds. Empty (after loading) is the field alone. */
  const [names, setNames] = useState<MissionName[]>([]);
  /** False until the first answer, so the field does not flash before the list. */
  const [namesLoaded, setNamesLoaded] = useState(false);
  /** The host's name the guest chose; null while they type their own. */
  const [chosenId, setChosenId] = useState<string | null>(null);
  /** "Add your name" was tapped: the field shows in its place. */
  const [typing, setTyping] = useState(false);

  /** The sign-in started on open, so Continue waits for it instead of racing it. */
  const signingIn = useRef<Promise<unknown> | null>(null);
  /**
   * Set once join_event succeeded. A name taken in the meantime keeps the guest
   * on this screen as a member; the next Continue only re-joins if their name
   * changed (join_event updates it), never just to retry the claim.
   */
  const joined = useRef<{ eventId: string; name: string } | null>(null);

  const hasNames = names.length > 0;
  const chosen = names.find((n) => n.id === chosenId) ?? null;

  /*
    Reaching this screen without a code cannot be recovered from — there is no
    event to join and no field here to supply one. Send them to 08, which is the
    screen that can actually get one.
  */
  useEffect(() => {
    if (!code) router.replace('/(modals)/join');
    // The demo's QR, read by 08's scanner: not an invite, nothing to ask.
    else if (isDemoCode(code)) router.replace('/(guest)/demo');
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
        if (!cancelled && existing) setName((current) => (current === '' ? existing : current));
      } catch {
        // No session or no credentials — an empty field is the right answer.
      }
    }

    void prefill();
    return () => {
      cancelled = true;
    };
  }, []);

  /*
    The names need a session (the RPC refuses an anonymous caller without
    one), so sign in now rather than on Continue. Any failure here only hides
    the list — Continue signs in again and reports what goes wrong. Asked again
    on an interval, so a name someone else takes leaves the list.
  */
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    let first = true;

    const ready = signInAnonymously();
    signingIn.current = ready;

    async function load() {
      try {
        await ready;
        const list = await listUnclaimedNames(code!);
        if (cancelled) return;
        setNames(list);
        if (first) {
          const mine = list.find((n) => n.mine);
          if (mine) setChosenId(mine.id);
          // Back from 12 with their own name: the field, filled, is their choice.
          else if (changing && list.length > 0) setTyping(true);
        } else {
          setChosenId((current) => {
            if (current && !list.some((n) => n.id === current)) {
              setError('Someone else just took that name. Pick another.');
              return null;
            }
            return current;
          });
        }
      } catch (e) {
        if (__DEV__) console.warn('[join] names not loaded', e);
      } finally {
        if (!cancelled) setNamesLoaded(true);
        first = false;
      }
    }

    void load();
    const timer = setInterval(() => void load(), MissionsJoin.refreshMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [code, changing]);

  const handleChoose = useCallback((person: MissionName) => {
    setChosenId(person.id);
    setTyping(false);
    setError(null);
  }, []);

  const handleAdd = useCallback(() => {
    setChosenId(null);
    setTyping(true);
    setError(null);
  }, []);

  const trimmed = name.trim();
  /** The name the group will see: the host's, or what they typed. */
  const finalName = hasNames && !typing ? (chosen?.name ?? '') : trimmed;
  const canContinue = namesLoaded && finalName.length > 0 && !busy;

  const handleContinue = useCallback(async () => {
    if (!code || !canContinue) return;

    setBusy(true);
    setError(null);

    let eventId = joined.current?.name === finalName ? joined.current.eventId : null;

    if (!eventId) {
      try {
        // The attempt started on open, if it is still running. Its failure is
        // not this one's: the call below tries again and throws for real.
        await signingIn.current?.catch(() => undefined);

        // Silent. The guest never learns they were signed in, which is the point.
        await signInAnonymously();

        // Before the join: add_host_as_member() reads user metadata at insert time,
        // and this guest may host their own event later from the same identity.
        await setDisplayName(finalName);

        // A member already (back from 12): this only changes their name.
        eventId = await joinEvent(code, finalName);
        joined.current = { eventId, name: finalName };
      } catch (e) {
        setError(describeJoinError(e));
        setBusy(false);
        return;
      }
    }

    if (hasNames) {
      try {
        // null gives back a name held from before (back from 12, now typing).
        await claimName(eventId, typing ? null : (chosen?.id ?? null));
      } catch (e) {
        if (e instanceof MissionNameTakenError) {
          // Still a member. The name leaves the list; they choose again.
          const taken = chosenId;
          setChosenId(null);
          setError('Someone else just took that name. Pick another.');
          setNames((current) => current.filter((n) => n.id !== taken));
          try {
            setNames(await listUnclaimedNames(code));
          } catch {
            // The local list without the taken name is good enough.
          }
          setBusy(false);
          return;
        }
        // Dealt already: they keep the cards they have. Anything else must not
        // stand between a guest and the event.
        if (!(e instanceof MissionsDealtError) && __DEV__) {
          console.warn('[join] name not claimed', e);
        }
      }
    }

    if (changing && router.canGoBack()) {
      router.back();
      return;
    }
    // `replace`, not `push` — there is nothing behind this worth returning to.
    // The intro (once per moment) continues to 12 by itself.
    router.replace({ pathname: '/(guest)/intro', params: { eventId } });
  }, [code, canContinue, finalName, hasNames, typing, chosen, chosenId, changing, router]);

  /*
    Not `TextField`: that component pairs an uppercase label with a 15px
    serif input at radius 14, and this artboard has no label, an 18px sans
    input and radius 18. Its own metrics, the same call ShareButton and
    AuthButton made.
  */
  const field = (
    <View>
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
        // In the list it was asked for with a tap; alone it is the screen.
        autoFocus={hasNames}
        onSubmitEditing={() => void handleContinue()}
        style={styles.input}
      />
      <Caption color={Guest.helper} style={styles.helper}>
        This is how the group will see you during the event.
      </Caption>
    </View>
  );

  return (
    <Screen edges={['bottom']} style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/*
          Scrolls only when it has to — the names, large text, or the keyboard
          up. With no names it fits, and does not bounce, as before. Taps reach
          the rows without first dismissing the keyboard.
        */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          alwaysBounceVertical={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {changing ? (
            <View style={styles.back}>
              <CircleBackButton />
            </View>
          ) : null}

          <Label style={styles.eyebrow}>{changing ? 'Your name' : 'Welcome'}</Label>

          <Display size="xxl" style={hasNames ? undefined : styles.headline}>
            What should{'\n'}we <Em>call you?</Em>
          </Display>

          {hasNames ? (
            <NamePicker
              names={names}
              selectedId={chosenId}
              typing={typing}
              onSelect={handleChoose}
              onAdd={handleAdd}
              field={field}
              disabled={busy}
            />
          ) : namesLoaded ? (
            field
          ) : null}

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
        </ScrollView>

        <PillButton
          label={busy ? (changing ? 'Saving…' : 'Joining…') : 'Continue'}
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
    return 'This event has already ended.';
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
  content: {
    flexGrow: 1,
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
  back: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
  },
  error: {
    minHeight: Spacing.xl,
  },
});
