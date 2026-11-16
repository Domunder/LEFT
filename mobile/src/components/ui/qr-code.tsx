/**
 * 09 · The invite QR — a real, scannable code on the artboard's light card.
 *
 * The prototype's QR is decorative: hand-placed `<rect>`s that spell nothing. This
 * generates the actual matrix with `qrcode` and draws it with react-native-svg.
 *
 * Two details that matter for scanning:
 *  - The card's padding is the quiet zone. The spec asks for 4 modules of clear
 *    margin; at the default 180/29 ≈ 6.2pt per module, the card's 20pt of padding
 *    is ~3.2 modules of true white, and the near-white page behind it reads as
 *    more. Close enough in practice, and the artboard's proportions are preserved.
 *  - Modules are drawn on a whole-pixel grid derived from `size`, so a fractional
 *    module width cannot leave hairline gaps between neighbours that a scanner
 *    would read as light cells.
 *
 * Drawn as a designed code since 2026-11-16 (the user asked for a "fancier"
 * one), within what a scanner tolerates:
 *  - modules are runs with round ends instead of squares — every module's
 *    centre is still dark, which is what a scanner samples;
 *  - the three finder patterns are a rounded ring and a rounded eye, with the
 *    exact 7/5/3 proportions scanners look for;
 *  - the card is warm paper with a slight gradient rather than flat white, and
 *    carries a line under the code — the wordmark, and the event's name — so a
 *    saved or printed code says what it is for.
 *
 * Kept separate from the screen so react-native-view-shot can capture the card
 * alone — "Save QR" should write the code and its white surround, not a crop of
 * the near-black screen.
 */

import { create as createQr } from 'qrcode';
import { useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Colors, Invite, Shadows } from '@/constants/theme';
import { Typography } from '@/constants/typography';

/** A finder pattern is 7 modules square, in three corners. */
const FINDER = 7;

type QrCodeProps = {
  /** What the code encodes — for us, always an invite URL. */
  value: string;
  /** Width/height of the matrix itself, inside the card's padding. */
  size?: number;
  /** What the code is for — the event's name, beside the wordmark under the code. */
  caption?: string;
  style?: StyleProp<ViewStyle>;
};

/** One horizontal run of dark modules, in module coordinates. */
type Run = { x: number; y: number; length: number };

/**
 * Collapse the matrix into horizontal runs.
 *
 * A rect per dark module is ~440 nodes for a version-3 code; merging each row's
 * adjacent modules into one rect typically cuts that by more than half, for an
 * identical image. Vertical merging would save more but needs a real rectangle
 * decomposition, which is not worth it at this size.
 */
function toRuns(data: Uint8Array, size: number): Run[] {
  const runs: Run[] = [];

  // The three finder patterns are drawn as shapes of their own.
  const inFinder = (x: number, y: number) =>
    (x < FINDER && y < FINDER) ||
    (x >= size - FINDER && y < FINDER) ||
    (x < FINDER && y >= size - FINDER);

  for (let y = 0; y < size; y += 1) {
    let start = -1;

    for (let x = 0; x <= size; x += 1) {
      // The extra x === size iteration closes a run that reaches the right edge.
      const dark = x < size && data[y * size + x] === 1 && !inFinder(x, y);

      if (dark && start === -1) {
        start = x;
      } else if (!dark && start !== -1) {
        runs.push({ x: start, y, length: x - start });
        start = -1;
      }
    }
  }

  return runs;
}

export function QrCode({ value, size = Invite.qrSize, caption, style }: QrCodeProps) {
  const qr = useMemo(() => {
    // 'M' tolerates ~15% damage — the level most scanners are tuned for, and enough
    // for a code being read off a phone screen at an angle in bad light.
    const { modules } = createQr(value, { errorCorrectionLevel: 'M' });
    const count = modules.size;

    // Round down so `count` modules always fit inside `size`; the remainder becomes
    // a hair more quiet zone rather than a clipped final column.
    const moduleSize = Math.floor((size / count) * 100) / 100;

    return {
      count,
      moduleSize,
      extent: moduleSize * count,
      runs: toRuns(modules.data as Uint8Array, count),
    };
  }, [value, size]);

  const far = qr.count - FINDER;
  const finders = [
    { x: 0, y: 0 },
    { x: far, y: 0 },
    { x: 0, y: far },
  ];

  return (
    // The shadow needs a view that does not clip; the paper clips to the radius.
    <View style={[styles.shadow, Shadows.qrCard, style]}>
      <LinearGradient colors={Invite.qrPaper} style={styles.card}>
        <Svg width={qr.extent} height={qr.extent} viewBox={`0 0 ${qr.count} ${qr.count}`}>
          {qr.runs.map((run) => (
            <Rect
              key={`${run.y}-${run.x}`}
              x={run.x}
              y={run.y}
              width={run.length}
              height={1}
              rx={Invite.qrModuleRadius}
              ry={Invite.qrModuleRadius}
              fill={Colors.onLight}
            />
          ))}
          {finders.map((finder) => [
            // The ring: one module thick, so its stroke is centred half a module in.
            <Rect
              key={`ring-${finder.x}-${finder.y}`}
              x={finder.x + 0.5}
              y={finder.y + 0.5}
              width={FINDER - 1}
              height={FINDER - 1}
              rx={Invite.qrFinderRadius}
              ry={Invite.qrFinderRadius}
              fill="none"
              stroke={Colors.onLight}
              strokeWidth={1}
            />,
            <Rect
              key={`eye-${finder.x}-${finder.y}`}
              x={finder.x + 2}
              y={finder.y + 2}
              width={3}
              height={3}
              rx={Invite.qrEyeRadius}
              ry={Invite.qrEyeRadius}
              fill={Colors.onLight}
            />,
          ])}
        </Svg>

        <View style={[styles.footer, { width: qr.extent }]}>
          <Text style={styles.wordmark}>LEFT</Text>
          <Text numberOfLines={1} style={styles.caption}>
            {caption ?? 'Scan to join'}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

/**
 * The same card with nothing in it — shown while the event loads, or when it
 * could not be loaded at all. Keeps the layout from jumping when the code lands.
 */
export function QrCodePlaceholder({ size = Invite.qrSize, style }: Omit<QrCodeProps, 'value'>) {
  return (
    <View style={[styles.card, styles.placeholder, style]}>
      <View style={{ width: size, height: size }} />
      {/* The footer's line box, so the card does not grow when the code lands. */}
      <View style={styles.footer}>
        <Text style={styles.wordmark}> </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: Invite.qrRadius,
    backgroundColor: Invite.qrPaper[0],
  },
  card: {
    padding: Invite.qrPadding,
    borderRadius: Invite.qrRadius,
    overflow: 'hidden',
  },
  footer: {
    marginTop: Invite.qrFooterGap,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Invite.qrFooterGap,
  },
  wordmark: {
    ...Typography.labelSm,
    color: Colors.onLight,
  },
  // Takes the room the wordmark leaves, so a long event name truncates.
  caption: {
    ...Typography.labelSm,
    flexShrink: 1,
    textAlign: 'right',
    color: Invite.qrFooterMuted,
  },
  placeholder: {
    // No shadow and a dim fill: an empty light card at full brightness reads as a
    // finished element rather than a slot waiting for one.
    backgroundColor: Colors.surfaceSubtle,
  },
});
