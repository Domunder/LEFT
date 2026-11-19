import SwiftUI

/// The app's design tokens (`mobile/src/constants/theme.ts`, `typography.ts`),
/// the few the clip needs. Same values; change them there first.
enum Theme {
  static let bg = Color(hex: 0x101010)
  static let card = Color(hex: 0x141316)
  static let text = Color(hex: 0xF0EDE8)
  static let textMuted = text.opacity(0.55)
  static let textDim = text.opacity(0.42)
  static let textFaint = text.opacity(0.32)
  static let textGhost = text.opacity(0.22)
  static let onLight = Color(hex: 0x0B0B0C)
  static let hairline = Color.white.opacity(0.1)
  static let hairlineStrong = Color.white.opacity(0.14)
  static let field = Color.white.opacity(0.06)
  static let surfaceSubtle = Color.white.opacity(0.08)
  static let badgeScrim = Color.black.opacity(0.35)
  static let gold = Color(red: 240 / 255, green: 180 / 255, blue: 120 / 255).opacity(0.85)
  /** `Colors.green`: a mission done. */
  static let green = Color(red: 140 / 255, green: 220 / 255, blue: 120 / 255).opacity(0.85)

  static let gutter: CGFloat = 24
  static let pillHeight: CGFloat = 56
}

/// `Camera` in theme.ts — 13's full-screen viewfinder (2026-11-18).
enum CameraTokens {
  /// The viewfinder runs from the top edge to the shutter bar; its bottom corners are rounded.
  static let viewfinderRadius: CGFloat = 32
  static let viewfinderBg = Color(hex: 0x0A0A0C)

  static let headerPaddingX: CGFloat = 20
  static let headerPaddingTop: CGFloat = 8
  /// Both side slots, equal so the counter sits on the centre line.
  static let headerSideWidth: CGFloat = 76
  static let countdownTop: CGFloat = 12
  /// Under the safe area: where "Next photo" starts. The capsule is hidden while
  /// a mission is armed, so the note takes its place, a clear gap under the counter.
  static let armedOffset: CGFloat = 90

  static let scrimTop: [Color] = [.black.opacity(0.45), .black.opacity(0)]
  static let scrimTopHeight: CGFloat = 130
  static let scrimBottom: [Color] = [.black.opacity(0), .black.opacity(0.4)]
  static let scrimBottomHeight: CGFloat = 110

  /// "17 left": the numeral warms from this many down.
  static let counterLowAt = 3
  static let counterLow = Color(red: 240 / 255, green: 180 / 255, blue: 120 / 255).opacity(0.95)
  static let counterSuffix = Theme.text.opacity(0.55)

  /// Flash · zoom · flip along the frame's bottom edge.
  static let controlsHeight: CGFloat = 76
  static let controlsPaddingX: CGFloat = 24
  static let controlsPaddingBottom: CGFloat = 16
  static let controlSize: CGFloat = 44
  static let flashOff = Theme.text.opacity(0.6)

  static let zoomGap: CGFloat = 3
  static let zoomPaddingY: CGFloat = 4
  static let zoomPaddingX: CGFloat = 5
  static let zoomPillMinWidth: CGFloat = 42
  static let zoomPillHeight: CGFloat = 30
  static let zoomFontSize: CGFloat = 13
  static let zoomSelectedBg = Theme.text.opacity(0.16)
  static let zoomText = Theme.text.opacity(0.55)

  /// The "Your photos" tile left of the shutter, and the bottom row.
  static let tileSize: CGFloat = 46
  static let tileRadius: CGFloat = 12
  static let tileIcon = Theme.text.opacity(0.85)
  static let bottomPaddingX: CGFloat = 24
  static let bottomPaddingTop: CGFloat = 10
  static let bottomPaddingBottom: CGFloat = 16

  static let shutterSize: CGFloat = 76
  static let shutterRing: CGFloat = 3
  static let shutterRingColor = Theme.text.opacity(0.5)
  static let shutterDisc: CGFloat = 60
  static let shutterPressed: CGFloat = 0.86

  /// The status pill inside the frame's bottom edge.
  static let noteInset: CGFloat = 14
  static let noteBg = Color.black.opacity(0.52)
  static let noteBorder = Color.white.opacity(0.09)
  static let noteColor = Theme.text.opacity(0.8)

  static let queueColor = Theme.text.opacity(0.45)

  /// The countdown "01 d 23 h": the leading unit brighter than the trailing one.
  static let countdownValue: [Color] = [Theme.text, Theme.text.opacity(0.55)]
  static let countdownUnit: [Color] = [Theme.text.opacity(0.3), Theme.text.opacity(0.2)]
}

/// The two units of `countdownParts()` in `lib/event-end.ts`: "01 d 23 h",
/// "05 h 12 m", "12 m 40 s".
func countdownParts(to end: Date, now: Date = .now) -> [(value: String, unit: String)] {
  let total = max(0, Int(end.timeIntervalSince(now)))
  let days = total / 86_400, hours = (total % 86_400) / 3600, minutes = (total % 3600) / 60, seconds = total % 60
  let pad = { (n: Int) in String(format: "%02d", n) }
  if days > 0 { return [(pad(days), "d"), (pad(hours), "h")] }
  if hours > 0 { return [(pad(hours), "h"), (pad(minutes), "m")] }
  return [(pad(minutes), "m"), (pad(seconds), "s")]
}

// MARK: Glass

/// The app's `Glass`: Liquid Glass on iOS 26, a blur with a tint before it,
/// a solid surface under Reduce Transparency. Only over imagery, never glass
/// on glass, and never fade a glass view itself (fade a wrapper).
struct GlassBackground<S: Shape>: ViewModifier {
  let shape: S
  var interactive = false
  @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

  @ViewBuilder
  func body(content: Content) -> some View {
    if reduceTransparency {
      content.background(Theme.card, in: shape)
        .overlay(shape.stroke(Theme.hairline, lineWidth: 1))
    } else if #available(iOS 26.0, *) {
      content.glassEffect(interactive ? .regular.interactive() : .regular, in: shape)
    } else {
      content.background(.ultraThinMaterial, in: shape)
        .overlay(shape.stroke(Theme.hairline, lineWidth: 1))
    }
  }
}

extension View {
  func glass<S: Shape>(_ shape: S, interactive: Bool = false) -> some View {
    modifier(GlassBackground(shape: shape, interactive: interactive))
  }
}

/// The three families the app loads (`hooks/use-app-fonts.ts`), bundled in
/// `Fonts/`. Falls back to the system's when a face is missing.
enum Fonts {
  /// Newsreader Light: headlines.
  static func display(_ size: CGFloat) -> Font { .custom("Newsreader-Light", size: size, relativeTo: .largeTitle) }
  /// Newsreader Light Italic: the emphasised word in a headline.
  static func displayItalic(_ size: CGFloat) -> Font { .custom("Newsreader-LightItalic", size: size, relativeTo: .largeTitle) }
  /// DM Serif Display: numerals (the roll counter, the countdown).
  static func numeral(_ size: CGFloat) -> Font { .custom("DMSerifDisplay-Regular", size: size, relativeTo: .title) }
  static func body(_ size: CGFloat = 16) -> Font { .custom("Inter-Regular", size: size, relativeTo: .body) }
  static func medium(_ size: CGFloat = 16) -> Font { .custom("Inter-Medium", size: size, relativeTo: .body) }
  /// Uppercase eyebrow labels.
  static func label(_ size: CGFloat = 11) -> Font { .custom("Inter-Medium", size: size, relativeTo: .caption) }
}

extension Color {
  init(hex: UInt32) {
    self.init(
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255
    )
  }
}

/// The off-white pill, the app's primary button (`PillButton`). Gives on
/// press-in like `PressScale`.
struct PillButtonStyle: ButtonStyle {
  var light = true
  @Environment(\.isEnabled) private var isEnabled

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(Fonts.medium(16))
      .frame(maxWidth: .infinity, minHeight: Theme.pillHeight)
      .foregroundStyle(light ? Theme.onLight : Theme.text)
      .background(light ? Theme.text : Theme.field, in: Capsule())
      .opacity(isEnabled ? 1 : 0.35)
      .scaleEffect(configuration.isPressed ? 0.97 : 1)
      .animation(.spring(response: 0.25, dampingFraction: 1), value: configuration.isPressed)
  }
}

/// Small eyebrow above a headline.
struct Eyebrow: View {
  let text: String
  var body: some View {
    Text(text.uppercased())
      .font(Fonts.label())
      .tracking(1.6)
      .foregroundStyle(Theme.textFaint)
  }
}

/// "What should we *call you?*" — a headline whose second part is italic.
struct Headline: View {
  let plain: String
  let emphasis: String
  var size: CGFloat = 40

  var body: some View {
    (Text(plain).font(Fonts.display(size)) + Text(emphasis).font(Fonts.displayItalic(size)))
      .foregroundStyle(Theme.text)
      .fixedSize(horizontal: false, vertical: true)
  }
}
