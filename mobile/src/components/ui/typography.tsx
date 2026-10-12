/**
 * Text primitives bound to the presets in @/constants/typography.
 * Screens should use these rather than styling <Text> directly, so the three
 * font families stay consistent.
 */

import { Text, type TextProps, type TextStyle } from 'react-native';

import { Colors } from '@/constants/theme';
import { Typography } from '@/constants/typography';

type BaseProps = TextProps & { color?: string };

type DisplaySize = 'xxl' | 'xl' | 'lg' | 'md' | 'sm' | 'xs' | 'xxs' | 'xxxs' | 'card';

const displayStyles: Record<DisplaySize, TextStyle> = {
  xxl: Typography.displayXxl,
  xl: Typography.displayXl,
  lg: Typography.display,
  md: Typography.displayMd,
  sm: Typography.displaySm,
  xs: Typography.displayXs,
  xxs: Typography.displayXxs,
  xxxs: Typography.displayXxxs,
  card: Typography.displayCard,
};

/**
 * Serif headline. Wrap emphasis words in <Em> to match the design's `<em>` spans.
 *
 *   <Display size="xl">What are you{'\n'}<Em>capturing?</Em></Display>
 */
export function Display({
  size = 'lg',
  color = Colors.text,
  style,
  ...rest
}: BaseProps & { size?: DisplaySize }) {
  return <Text {...rest} style={[displayStyles[size], { color }, style]} />;
}

/** Italic emphasis run inside a <Display>. */
export function Em({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[Typography.displayItalic, style]} />;
}

/** Big serif numeral — group size, price, dial readout. */
export function Numeric({ color = Colors.text, style, ...rest }: BaseProps) {
  return <Text {...rest} style={[Typography.numeric, { color }, style]} />;
}

/** Body copy. */
export function Body({ color = Colors.textDim, small, style, ...rest }: BaseProps & { small?: boolean }) {
  return <Text {...rest} style={[small ? Typography.bodySm : Typography.body, { color }, style]} />;
}

/** Uppercase eyebrow label. */
export function Label({ color = Colors.textFaint, small, style, ...rest }: BaseProps & { small?: boolean }) {
  return <Text {...rest} style={[small ? Typography.labelSm : Typography.label, { color }, style]} />;
}

/** Fine print. */
export function Caption({ color = Colors.textGhost, style, ...rest }: BaseProps) {
  return <Text {...rest} style={[Typography.caption, { color }, style]} />;
}

/** Monospace — REC counter, camera-feed label. */
export function Mono({ color = Colors.text, style, ...rest }: BaseProps) {
  return <Text {...rest} style={[Typography.mono, { color }, style]} />;
}
