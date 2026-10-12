/**
 * Delete Account — the confirmation.
 *
 * **Not in the prototype**, which has no account deletion at all. That is why it
 * exists: Apple's guideline 5.1.1(v) requires an app that creates accounts to
 * offer deletion from inside the app, and without it the build is rejected.
 *
 * **A sheet rather than 20's `Alert.alert`.** Log Out confirms in one line
 * because it is one fact. This is three, and they are not the ones people
 * assume: the events they host die for everyone in them, the clips they filmed
 * in *other* people's events stay, and nothing here refunds anything. An alert
 * long enough to say all that is an alert nobody finishes reading, so it gets
 * the same `Sheet` chrome 08 and 10.1 use, with a real destructive button.
 *
 * The consequences are stated before the button, not after it. Someone who taps
 * Delete having read only the headline should still not be surprised.
 */

import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PillButton } from '@/components/ui/pill-button';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast-host';
import { Body, Display, Em } from '@/components/ui/typography';
import { Colors, DeleteAccount as DA, Radii } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { signOut } from '@/lib/auth';
import { deleteAccount } from '@/lib/events';

/**
 * What someone is actually agreeing to.
 *
 * Written to be read in a hurry and to contain no pleasant surprises — the
 * middle one especially, since "delete my account" is normally taken to mean the
 * footage goes too. See supabase/functions/delete-account for why it does not.
 */
const CONSEQUENCES = [
  'Films you started are deleted for everyone in them, along with all their clips.',
  "Clips you filmed in other people's films stay, but are no longer linked to you.",
  'Purchases are not refunded, and cannot be restored afterwards.',
];

export default function DeleteAccountScreen() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const handleDelete = useCallback(async () => {
    setBusy(true);
    try {
      await deleteAccount();

      /*
        The server has already destroyed the session, so this is only clearing
        what is on the device — including the RevenueCat identity, which would
        otherwise follow the next person to sign in here. Best-effort for that
        reason: the account is gone either way.
      */
      try {
        await signOut();
      } catch {
        // Nothing actionable. The account no longer exists.
      }

      router.replace('/');
      toast.show({ initials: '✓', title: 'Your account has been deleted.' });
    } catch {
      setBusy(false);
      toast.show({
        initials: '!',
        title: "Couldn't delete your account.",
        message: 'Check your connection and try again.',
      });
    }
  }, [router, toast]);

  return (
    // Dismissing by scrim is left enabled: backing out must be the easy path.
    <Sheet onDismiss={busy ? () => {} : undefined}>
      <View style={styles.body}>
        <Display size="xs" style={styles.headline}>
          Delete your <Em>account?</Em>
        </Display>

        <View style={styles.list}>
          {CONSEQUENCES.map((line) => (
            <View key={line} style={styles.bullet}>
              <Text style={styles.glyph}>•</Text>
              <Body small color={Colors.textMuted} style={styles.bulletText}>
                {line}
              </Body>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          {/* Destructive first in reading order, but visually the quieter of the two. */}
          <PillButton
            label={busy ? 'Deleting…' : 'Delete Account'}
            variant="glass"
            labelColor={Colors.destructive}
            disabled={busy}
            onPress={() => void handleDelete()}
            style={styles.destructive}
          />
          <PillButton
            label="Cancel"
            disabled={busy}
            onPress={() => router.back()}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingTop: DA.handleGap,
    paddingHorizontal: DA.paddingX,
    paddingBottom: DA.paddingBottom,
  },
  headline: {
    marginBottom: DA.headlineGap,
  },
  list: {
    gap: DA.bulletGap,
  },
  bullet: {
    flexDirection: 'row',
    gap: DA.bulletTextGap,
  },
  glyph: {
    ...Typography.bodySm,
    color: Colors.textFaint,
  },
  bulletText: {
    flex: 1,
  },
  actions: {
    marginTop: DA.actionsGap,
    gap: DA.buttonGap,
  },
  /*
    The one destructive button in the app that is not merely coloured text. A
    glass pill with a red label rather than a red fill: a filled red button next
    to a filled light one competes for the eye, and the light one — Cancel — is
    the action that should win it.
  */
  destructive: {
    borderWidth: 1,
    borderColor: Colors.destructive,
    borderRadius: Radii.pill,
  },
});
