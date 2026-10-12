/**
 * A label-left / control-right row divided by a hairline.
 *
 * Built for the Ending Date and Ending Time rows on 04, but deliberately generic —
 * 05.1 and Settings (20) lay their options out the same way.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, EndRow } from '@/constants/theme';
import { Label } from './typography';

type SettingRowProps = {
  /** Uppercase label on the left. */
  label: string;
  /** The control on the right — a ValuePill, switch, or stepper. */
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SettingRow({ label, children, style }: SettingRowProps) {
  return (
    <View style={[styles.row, style]}>
      {/*
        The prototype's label is 0.4 alpha; textDim (0.42) is the established token
        nearest to it. textFaint, the Label default, is 0.32 and reads too dim here.
      */}
      <Label small color={Colors.textDim}>
        {label}
      </Label>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: EndRow.paddingY,
    paddingHorizontal: EndRow.paddingX,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
});
