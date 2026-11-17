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
  static let hairline = text.opacity(0.08)
  static let field = Color.white.opacity(0.06)
  static let gold = Color(red: 240 / 255, green: 180 / 255, blue: 120 / 255).opacity(0.85)

  static let gutter: CGFloat = 24
  static let pillHeight: CGFloat = 56
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
