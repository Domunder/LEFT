/**
 * A labeled text input.
 *
 * Used by the film-name field (02), the account name field (06) and the guest name
 * screen (11). The design gives the film-name input the display serif rather than
 * Inter — `serif` is on by default here and the sans variant is opt-out.
 */

import { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Colors, Field, Radii } from '@/constants/theme';
import { FontFamily, Typography } from '@/constants/typography';

type TextFieldProps = TextInputProps & {
  /** Uppercase label above the input. */
  label?: string;
  /** Use the display serif for the entered text. Default true. */
  serif?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, serif = true, containerStyle, style, ...rest },
  ref
) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        style={[styles.input, !serif && styles.sans, style]}
        placeholderTextColor={Colors.textGhost}
        selectionColor={Colors.text}
        {...rest}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: Field.labelGap,
  },
  label: {
    ...Typography.fieldLabel,
    color: Colors.link,
  },
  input: {
    ...Typography.fieldInput,
    width: '100%',
    paddingVertical: Field.paddingY,
    paddingHorizontal: Field.paddingX,
    borderRadius: Radii.field,
    borderWidth: 1,
    borderColor: Colors.hairlineStrong,
    backgroundColor: Field.bg,
    color: Colors.text,
  },
  sans: {
    fontFamily: FontFamily.regular,
  },
});
