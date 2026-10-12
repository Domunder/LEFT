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
 * Kept separate from the screen so react-native-view-shot can capture the card
 * alone — "Save QR" should write the code and its white surround, not a crop of
 * the near-black screen.
 */

import { create as createQr } from 'qrcode';
import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Colors, Invite, Shadows } from '@/constants/theme';

type QrCodeProps = {
  /** What the code encodes — for us, always an invite URL. */
  value: string;
  /** Width/height of the matrix itself, inside the card's padding. */
  size?: number;
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

  for (let y = 0; y < size; y += 1) {
    let start = -1;

    for (let x = 0; x <= size; x += 1) {
      // The extra x === size iteration closes a run that reaches the right edge.
      const dark = x < size && data[y * size + x] === 1;

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

export function QrCode({ value, size = Invite.qrSize, style }: QrCodeProps) {
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

  return (
    <View style={[styles.card, Shadows.qrCard, style]}>
      <Svg width={qr.extent} height={qr.extent} viewBox={`0 0 ${qr.count} ${qr.count}`}>
        {qr.runs.map((run) => (
          <Rect
            key={`${run.y}-${run.x}`}
            x={run.x}
            y={run.y}
            width={run.length}
            height={1}
            fill={Colors.onLight}
          />
        ))}
      </Svg>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Invite.qrPadding,
    borderRadius: Invite.qrRadius,
    backgroundColor: Colors.text,
  },
  placeholder: {
    // No shadow and a dim fill: an empty light card at full brightness reads as a
    // finished element rather than a slot waiting for one.
    backgroundColor: Colors.surfaceSubtle,
  },
});
