/**
 * SCAFFOLD — a route that exists so navigation and typed routes hold together
 * while the real screen is being built. Delete each usage as its screen lands,
 * and delete this file once none remain (see docs/MILESTONES.md).
 */

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PillButton } from '@/components/ui/pill-button';
import { Screen } from '@/components/ui/screen';
import { Body, Display, Label } from '@/components/ui/typography';
import { Colors, Spacing } from '@/constants/theme';

type Props = {
  /** The design screen this stands in for, e.g. "13 · Camera". */
  screen: string;
  /** What belongs here, in one or two sentences. */
  note: string;
};

export function Placeholder({ screen, note }: Props) {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.body}>
        <Label>{screen}</Label>
        <Display size="md">Not built yet.</Display>
        <Body small color={Colors.textDim}>
          {note}
        </Body>
      </View>

      <PillButton label="Back to your films" onPress={() => router.replace('/(library)/films')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.md,
  },
});
