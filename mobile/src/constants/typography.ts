/**
 * LEFT type system.
 *
 * Three families, per design/README.md:
 *  - Newsreader        display/headline serif. Design weight 340 → Newsreader_300Light.
 *                      `<em>` emphasis spans → the italic variant.
 *  - DM Serif Display  big numerals (group size, price, dial readout).
 *  - Inter             all UI text.
 *  - system monospace  the REC counter and "camera feed" label.
 *
 * The design specifies letter-spacing in `em`; React Native takes absolute
 * points, so each preset below has it pre-multiplied by its own font size.
 */

import { Platform, type TextStyle } from 'react-native';

export const FontFamily = {
  display: 'Newsreader_300Light',
  displayItalic: 'Newsreader_300Light_Italic',
  displayMedium: 'Newsreader_400Regular',
  numeric: 'DMSerifDisplay_400Regular',
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
} as const;

/** Headline sizes used across the prototype (px). */
export const DisplaySize = {
  xxl: 40, // 11 Guest name — the largest headline in the app
  xl: 38, // 02 Event, 03 Format
  lg: 34, // 01 Landing
  md: 32, // 04 Event end
  sm: 30, // 05.1 Group size
  xs: 26, // 08 Join sheet
  xxs: 24, // 10.1 Group info
  xxxs: 22, // 15 Films — the "No films yet." empty-state headline
  card: 21, // 16 Films — an event card's title
} as const;

const displayBase = (size: number): TextStyle => ({
  fontFamily: FontFamily.display,
  fontSize: size,
  lineHeight: Math.round(size * 1.15),
  letterSpacing: size * -0.015,
  color: undefined, // set by the consuming component
});

export const Typography = {
  /** Serif headline. Pair with `displayItalic` for emphasis words. */
  display: displayBase(DisplaySize.lg),
  displayXxl: displayBase(DisplaySize.xxl),
  displayXl: displayBase(DisplaySize.xl),
  displayMd: displayBase(DisplaySize.md),
  displaySm: displayBase(DisplaySize.sm),
  displayXs: displayBase(DisplaySize.xs),
  displayXxs: displayBase(DisplaySize.xxs),

  /**
   * 15's empty-state headline (22) and 16's card title (21).
   *
   * Both sit below `xxs` (24), the smallest headline the onboarding flow uses —
   * these are the serif at list scale, not a screen's own headline.
   */
  displayXxxs: displayBase(DisplaySize.xxxs),
  displayCard: displayBase(DisplaySize.card),

  /** Emphasis run inside a headline (`<em>` in the prototype). */
  displayItalic: { fontFamily: FontFamily.displayItalic } as TextStyle,

  /** Big numerals — group size counter, price, dial center readout. */
  numeric: {
    fontFamily: FontFamily.numeric,
    fontSize: 28,
    letterSpacing: -0.3,
  } as TextStyle,

  /** Body copy, 14px / 1.6. */
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 22,
  } as TextStyle,

  bodySm: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 21,
  } as TextStyle,

  /** Uppercase eyebrow label — 12px, letter-spacing 0.14em. */
  label: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    letterSpacing: 12 * 0.14,
    textTransform: 'uppercase',
  } as TextStyle,

  /** Smaller uppercase label — 11px, letter-spacing 0.12em. */
  labelSm: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    letterSpacing: 11 * 0.12,
    textTransform: 'uppercase',
  } as TextStyle,

  /** Button text. */
  button: {
    fontFamily: FontFamily.medium,
    fontSize: 16,
    letterSpacing: -0.16,
  } as TextStyle,

  /** Label on the Google / Apple buttons — 15px, weight 600. */
  authButton: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    letterSpacing: -0.15,
  } as TextStyle,

  /** Fine print under a CTA. */
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    lineHeight: 18,
  } as TextStyle,

  /** REC counter, camera-feed label. */
  mono: {
    fontFamily: FontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.5,
  } as TextStyle,

  /**
   * The REC counter on 13 — 11px, weight 600.
   *
   * Separate from `mono` (12px, and the system monospace face): the artboard
   * sets this one in the UI face at a semibold weight, so the seconds stay legible
   * against a moving camera preview at a smaller size than `mono` allows.
   */
  rec: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
  } as TextStyle,

  /**
   * The countdown numerals on 13 — DM Serif at 16px.
   *
   * Its own preset rather than an inline override on `numeric` (28px) or
   * `dialCap` (15px), so no screen hardcodes a font size.
   */
  countdown: {
    fontFamily: FontFamily.numeric,
    fontSize: 16,
  } as TextStyle,

  /** The unit letter beside it — 9px, weight 600, uppercase. */
  countdownUnit: {
    fontFamily: FontFamily.semibold,
    fontSize: 9,
    textTransform: 'uppercase',
  } as TextStyle,

  /** "Up to N people" on 05.1 — Newsreader at the design's 400 weight. */
  groupHeading: {
    fontFamily: FontFamily.displayMedium,
    fontSize: 19,
  } as TextStyle,

  /**
   * The dial's centre-cap readout on 05.1 — DM Serif at 15px.
   *
   * Separate from `numeric` (28px) rather than an inline override, so no screen
   * has to hardcode a font size.
   */
  dialCap: {
    fontFamily: FontFamily.numeric,
    fontSize: 15,
    letterSpacing: 15 * -0.01,
  } as TextStyle,

  /** Small tabular label — 05.1's group numerals, a film card's ratio — 11px, weight 600. */
  durationPill: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
  } as TextStyle,

  /** Label inside a selectable choice pill — 14px, weight 500. */
  choice: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
  } as TextStyle,

  /**
   * The month name above 04's calendar grid — Newsreader at 17.
   *
   * The panel's only display type, and what keeps a grid of numerals reading as
   * part of this app rather than as a generic picker. Letter-spacing follows the
   * display scale's own rule (size * -0.015), pre-multiplied as everything is here.
   */
  pickerTitle: {
    fontFamily: FontFamily.displayMedium,
    fontSize: 17,
    letterSpacing: 17 * -0.015,
  } as TextStyle,

  /**
   * 04's calendar column headings — "Su Mo Tu". Sentence case, unlike `label` and
   * `labelSm`: an uppercase "SU" above a column of numerals reads as a section
   * heading rather than as the scale it is.
   */
  weekday: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    letterSpacing: 11 * 0.06,
  } as TextStyle,

  /**
   * 04's time wheel — a step up from the calendar's 14, since a scrolling row is
   * read in motion and only one of them is ever in focus.
   *
   * Tabular figures, which Inter carries: without them the digits change width as
   * the wheel turns and the column visibly jitters under the selection band.
   */
  wheel: {
    fontFamily: FontFamily.medium,
    fontSize: 18,
    letterSpacing: 18 * -0.01,
    fontVariant: ['tabular-nums'],
  } as TextStyle,

  /** Uppercase label above a text field — 11px, ls 0.06em. */
  fieldLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    letterSpacing: 11 * 0.06,
    textTransform: 'uppercase',
  } as TextStyle,

  /** Text inside an input. The film-name field uses the display serif, per the design. */
  fieldInput: {
    fontFamily: FontFamily.display,
    fontSize: 15,
  } as TextStyle,

  /** The "LEFT" wordmark in the Landing header — 15px, ls 0.06em. */
  wordmark: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    letterSpacing: 15 * 0.06,
    textTransform: 'uppercase',
  } as TextStyle,

  /**
   * 17's header title and 20's profile name — 14/15px at weight 500.
   *
   * Sentence case, unlike `label`/`labelSm`, which are uppercase eyebrows. Both
   * screens caption real content (an event's name, a person's name) where an
   * eyebrow would read as a section heading rather than as the thing itself.
   */
  titleSm: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
  } as TextStyle,
  titleMd: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
  } as TextStyle,

  /** 18's toast title — 13px, weight 500. */
  toastTitle: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
  } as TextStyle,

  /**
   * The small print under a title on 17, 18 and 20 — "5 clips · 1m 0s",
   * "42s of budget left", an email address. 11–12px, regular, sentence case.
   */
  metaSm: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
  } as TextStyle,
  metaMd: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
  } as TextStyle,

  /**
   * Initials inside an avatar tile — 11px on 18's 36px rect, 13px on 20's 44px
   * circle. Semibold so two letters hold their own against a translucent fill.
   */
  initialsSm: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
  } as TextStyle,
  initialsMd: {
    fontFamily: FontFamily.semibold,
    fontSize: 13,
  } as TextStyle,

  /**
   * A settings row's label — 14px, regular, sentence case.
   *
   * Distinct from `choice` (also 14) which is weight 500: a row label is read,
   * not chosen, and at weight 500 the two Notifications rows compete with the
   * section headings above them.
   */
  settingsRow: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
  } as TextStyle,

  /** A badge over imagery — 17's name and duration pills. 11px, weight 600. */
  clipBadge: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
  } as TextStyle,
} as const;
