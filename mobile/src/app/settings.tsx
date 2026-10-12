/**
 * 20 · Settings.
 *
 * Reached from the gear on 15/16. Everything on it is real: the profile card
 * reads the live session, Log Out actually signs out, the legal rows open the
 * screens that exist, and both switches persist per user.
 *
 * Deviations from the artboard, all deliberate:
 *
 *  - **a guest variant the artboard does not draw.** The card shows a name and an
 *    email; an anonymous user has neither, and the app's whole guest model is
 *    that they never had to sign up. Drawing a blank line or inventing an
 *    address would be the one thing this screen must not do. They get "Guest"
 *    and a sentence about where their films live, which is also the honest place
 *    to say it — 15's "Keep your films" panel makes the offer, this states the fact.
 *  - **two legal rows, where the artboard draws one.** It reads "Terms & Privacy
 *    Policy", and one row cannot open two routes. Both `(legal)/terms` and
 *    `(legal)/privacy` exist and are linked separately from Landing and 06, so
 *    they are linked separately here.
 *  - **Log Out confirms first.** The artboard fires on one tap. For a guest that
 *    is destructive in the strict sense: an anonymous session is the only key to
 *    their films, and signing out of one is not reversible. The confirmation says
 *    so in as many words when there is no account to come back to.
 *  - **the screen scrolls.** The artboard is a fixed 844pt frame with a trailing
 *    spacer. With three Account rows it still fits on a modern phone and does not
 *    on a small one, and a settings screen that cuts off its own Log Out is worse
 *    than one that scrolls.
 *  - **no version string**, as drawn. Conventional on a settings screen and worth
 *    revisiting, but the artboard draws none and there is nothing to put in it.
 *
 * `design/README.md` promises an "event management" group. The prototype draws no
 * such thing, and the prototype wins.
 *
 * The glow is mounted here rather than by a layout, unlike (library) and (host):
 * `settings` is a top-level route with no group of its own, and moving it into
 * one to gain a layout would touch the root Stack and 16's navigation for the
 * sake of one light. Same three-part setup, in one file.
 */

import type { Session } from '@supabase/supabase-js';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AmbientGlow } from '@/components/ui/ambient-glow';
import { CircleIconButton } from '@/components/ui/circle-back-button';
import { Screen } from '@/components/ui/screen';
import { SettingsGroup, SettingsListRow } from '@/components/ui/settings-group';
import { useToast } from '@/components/ui/toast-host';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Body, Display } from '@/components/ui/typography';
import { Colors, Settings as S } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { getSession, isAnonymous, resolveDisplayName, signOut } from '@/lib/auth';
import { initialsFor, restorePurchases } from '@/lib/events';
import { identify, PURCHASES_UNAVAILABLE, restore } from '@/lib/purchases';
import {
  DEFAULT_PREFS,
  readPrefs,
  writePref,
  type NotificationPrefs,
} from '@/lib/notification-prefs';

/** What the profile card shows, once the session has been read. */
type Profile = {
  name: string;
  initials: string;
  /** An email, or the sentence a guest gets instead. */
  detail: string;
  guest: boolean;
};

/**
 * Three real cases, and the third is the one the artboard has no answer for.
 *
 * A signed-in user with no resolvable name is not hypothetical: Apple hands over
 * a name exactly once and a private-relay address is unusable as a fallback, so
 * `resolveDisplayName` returning null is the documented outcome of a Hide My
 * Email sign-in. They still have an email worth showing.
 */
function profileFrom(session: Session | null): Profile | null {
  const user = session?.user;
  if (!user) return null;

  if (isAnonymous(user)) {
    return {
      name: 'Guest',
      initials: '?',
      detail: 'Not signed in — your films live on this device.',
      guest: true,
    };
  }

  const name = resolveDisplayName(user) ?? 'You';

  return {
    name,
    initials: initialsFor(name),
    detail: user.email ?? '',
    guest: false,
  };
}

export default function SettingsScreen() {
  const router = useRouter();
  const toast = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [restoring, setRestoring] = useState(false);

  /*
    On focus rather than on mount: linking an identity from 15's prompt changes
    the session without unmounting this screen, and a stale card would still read
    "Guest" after someone had just signed in.
  */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        try {
          const current = await getSession();
          if (cancelled) return;
          setSession(current);

          if (current?.user) {
            const loaded = await readPrefs(current.user.id);
            if (!cancelled) setPrefs(loaded);
          }
        } catch {
          // The screen is still usable signed-out; the card simply stays empty.
        }
      }

      void load();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const profile = profileFrom(session);
  const userId = session?.user?.id;

  /*
    Optimistic. The switch is flipped in state first and persisted after, and a
    storage failure is swallowed rather than reverted — the same posture
    prompt-dismissal takes. A switch that springs back under the finger because
    AsyncStorage hiccuped reads as a broken control, and the preference holds for
    this session regardless.
  */
  const setPref = useCallback(
    (key: keyof NotificationPrefs, value: boolean) => {
      setPrefs((previous) => ({ ...previous, [key]: value }));
      if (userId) void writePref(userId, key, value);
    },
    [userId]
  );

  /**
   * Restore Purchases — required for any app selling in-app purchases.
   *
   * Two halves, and both are needed. `restore()` re-syncs the store's receipts
   * up to RevenueCat; `restorePurchases()` then asks the server to write what
   * RevenueCat holds into `public.purchases`. Skipping the second half is the
   * compliance-theatre version — RevenueCat validates receipts but explicitly
   * does not track whether a *consumable* has been spent, so a reinstalled
   * device with perfect receipts still has no rows here and would be charged
   * again for an event it already owns.
   *
   * `identify()` first, always. Without it the receipts land on an anonymous
   * RevenueCat id and the ledger rows match nobody — the failure docs/payments.md
   * lists as "$RCAnonymousID in the ledger".
   */
  const handleRestore = useCallback(async () => {
    if (restoring) return;

    if (PURCHASES_UNAVAILABLE) {
      toast.show({
        initials: '!',
        title: 'Purchases need the full app.',
        message: 'This is a development build limitation, not an error.',
      });
      return;
    }

    if (!userId) {
      toast.show({ initials: '!', title: 'Sign in to restore purchases.' });
      return;
    }

    setRestoring(true);
    try {
      await identify(userId);
      await restore();
      const count = await restorePurchases();

      toast.show({
        initials: '✓',
        title:
          count > 0
            ? `${count} ${count === 1 ? 'purchase' : 'purchases'} restored.`
            : 'Nothing to restore.',
        message: count > 0 ? 'They are ready to use on your next film.' : undefined,
      });
    } catch {
      toast.show({
        initials: '!',
        title: "Couldn't restore purchases.",
        message: 'Check your connection and try again.',
      });
    } finally {
      setRestoring(false);
    }
  }, [restoring, userId, toast]);

  const handleLogOut = useCallback(() => {
    const guest = profile?.guest ?? false;

    Alert.alert(
      'Log out?',
      guest
        ? 'You are signed in as a guest, so there is no account to come back to. Your films will stay on this device but you will not be able to reach them again.'
        : 'You can sign back in at any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            void signOut()
              // `replace`, not `push`: a back gesture must not return to a
              // signed-out settings screen holding the previous user's card.
              .then(() => router.replace('/'))
              .catch(() => {
                Alert.alert('Could not log out', 'Check your connection and try again.');
              });
          },
        },
      ]
    );
  }, [profile, router]);

  return (
    <View style={styles.root}>
      <AmbientGlow preset="settings" />

      <Screen transparent style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <CircleIconButton
              icon="chevron-left"
              variant="flat"
              accessibilityLabel="Back"
              onPress={() => router.back()}
            />
          </View>

          <Display size="md" style={styles.headline}>
            Settings
          </Display>

          {profile ? (
            <View style={styles.profile}>
              <View style={styles.avatar}>
                <Text style={styles.initials}>{profile.initials}</Text>
              </View>

              <View style={styles.profileCopy}>
                <Text style={styles.name}>{profile.name}</Text>
                {profile.detail ? (
                  <Text style={styles.detail} numberOfLines={2}>
                    {profile.detail}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <SettingsGroup title="Notifications">
            <SettingsListRow label="Someone films a clip">
              <ToggleSwitch
                value={prefs.clipFilmed}
                onValueChange={(next) => setPref('clipFilmed', next)}
                accessibilityLabel="Notify me when someone films a clip"
              />
            </SettingsListRow>

            {/*
              Recorded and honoured by nobody yet — there is no push
              infrastructure in the app, so nothing raises a "film is ready"
              notification to suppress. Drawn because the artboard draws it, and
              read the moment there is something to gate. See notification-prefs.ts.
            */}
            <SettingsListRow label="Film is ready">
              <ToggleSwitch
                value={prefs.filmReady}
                onValueChange={(next) => setPref('filmReady', next)}
                accessibilityLabel="Notify me when the film is ready"
              />
            </SettingsListRow>
          </SettingsGroup>

          <SettingsGroup title="Account">
            <SettingsListRow
              label="Terms of Service"
              onPress={() => router.push('/(legal)/terms')}
            />
            <SettingsListRow
              label="Privacy Policy"
              onPress={() => router.push('/(legal)/privacy')}
            />
            {/*
              Required for any app selling in-app purchases, and genuinely needed
              after a reinstall — see `handleRestore`. The spinner sits in the
              control slot a toggle would occupy.
            */}
            <SettingsListRow
              label={restoring ? 'Restoring…' : 'Restore Purchases'}
              disabled={restoring}
              onPress={() => void handleRestore()}>
              {restoring ? <ActivityIndicator size="small" color={Colors.textMuted} /> : null}
            </SettingsListRow>
            <SettingsListRow label="Log Out" destructive onPress={handleLogOut} />
            {/*
              Apple 5.1.1(v). A sheet rather than 20's own Alert pattern: the
              consequences take three lines to state honestly, which is more than
              an alert gets read for.
            */}
            <SettingsListRow
              label="Delete Account"
              destructive
              onPress={() => router.push('/(modals)/delete-account')}
            />
          </SettingsGroup>

          {!profile ? (
            <Body small color={Colors.textDim}>
              You are not signed in.
            </Body>
          ) : null}
        </ScrollView>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  screen: {
    // The ScrollView owns the bottom padding, so the safe area must not add its own.
    paddingBottom: 0,
  },
  content: {
    flexGrow: 1,
    paddingBottom: S.paddingBottom,
  },
  header: {
    flexDirection: 'row',
    marginBottom: S.backGap,
  },
  headline: {
    marginBottom: S.headlineGap,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.profile.gap,
    paddingVertical: S.profile.paddingY,
    paddingHorizontal: S.profile.paddingX,
    borderRadius: S.profile.radius,
    borderWidth: 1,
    borderColor: S.group.border,
    backgroundColor: S.group.bg,
    marginBottom: S.profile.marginBottom,
  },
  /** A circle, where 18's toast avatar is a rounded rect. Both as drawn. */
  avatar: {
    width: S.profile.avatarSize,
    height: S.profile.avatarSize,
    borderRadius: S.profile.avatarSize / 2,
    backgroundColor: S.profile.avatarBg,
    borderWidth: 1,
    borderColor: S.profile.avatarBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...Typography.initialsMd,
    color: Colors.textStrong,
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
    gap: S.profile.emailGap,
  },
  name: {
    ...Typography.titleMd,
    color: Colors.text,
  },
  detail: {
    ...Typography.metaMd,
    color: Colors.textFaint,
  },
});
