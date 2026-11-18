/**
 * 05.1's Missions section — a switch and one line about what it does.
 *
 * Not in the prototype (missions arrived after it). The switch is 20's
 * `ToggleSwitch` beside a plain row title. How many each guest gets is not
 * asked here (decided 2026-11-18 by the user): switching on creates the event
 * with `MISSIONS_PER_GUEST_DEFAULT` and the next screen, Missions, is where the
 * host sets the count and plans the list.
 *
 * Off by default. The parent hears one value: `null` (off) or the default.
 * Missions are free, so nothing here touches the price.
 */

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Body } from '@/components/ui/typography';
import { Colors, MissionsSetup as Tokens } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { MISSIONS_PER_GUEST_DEFAULT } from '@/lib/missions';

type MissionsSetupProps = {
  /** Missions per guest, or null when missions are off. */
  value: number | null;
  onChange: (next: number | null) => void;
  style?: StyleProp<ViewStyle>;
};

export function MissionsSetup({ value, onChange, style }: MissionsSetupProps) {
  const on = value !== null;

  return (
    <View style={style}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Missions</Text>
        <ToggleSwitch
          value={on}
          onValueChange={(next) => onChange(next ? MISSIONS_PER_GUEST_DEFAULT : null)}
          accessibilityLabel="Missions"
        />
      </View>

      <Body small color={Colors.textFaint} style={styles.explainer}>
        {on
          ? 'You set them up next.'
          : 'Small photo missions for your guests.'}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Tokens.rowGap,
  },
  title: {
    ...Typography.choice,
    color: Colors.text,
    // Takes the row and wraps under large text; the switch keeps its size.
    flex: 1,
  },
  explainer: {
    marginTop: Tokens.explainerGap,
  },
});
