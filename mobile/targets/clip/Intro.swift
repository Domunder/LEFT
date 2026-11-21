import SwiftUI
import UIKit

/*
  11.5 — how this moment works: the app's `(guest)/intro.tsx` (2026-11-21).

  Between the name (11) and the wait (12), once per moment and phone
  (`ClipModel.introSeen`), and again from 12's "How it works". The point the
  guests missed most: **the roll is limited** — so page 1 writes the number huge.

   1. "24 photos. That's your whole roll." — the roll in DM Serif
   2. Hidden until the end — the guest's own print clear, the others dark
   3. Missions, only when the moment has them
   4. When it develops, for everyone at once → "Got it"

  Swipe or "Next"; "Skip" top right. It always continues through
  `ClipModel.finishIntro()`, which routes to 12, the camera or the
  developing state. A developed moment never shows it.

  Differences from the app, on purpose: no "or add some from your phone" (the
  clip cannot import), no "We'll let you know" (the clip has no push), and
  page 1's picture is a little iPhone with the camera (`PhoneMock`, as the
  app's `MiniCamera`, 2026-11-21).
*/

/// `GuestIntro` in theme.ts.
private enum IntroTokens {
  static let headerTop: CGFloat = 8
  static let headerHeight: CGFloat = 44
  static let visualGap: CGFloat = 28
  /// Every page's picture gets the same height, so the text holds still while paging.
  static let visualHeight: CGFloat = 260
  static let textGap: CGFloat = 12
  static let headline: CGFloat = 32
  /// `Typography.introNumeral`.
  static let numeral: CGFloat = 96
  /// `Typography.endAnswer`.
  static let date: CGFloat = 34
  static let printWidth: CGFloat = 110
  static let sideScale: CGFloat = 0.82
  static let printGap: CGFloat = 10
  static let printRadius: CGFloat = 10
  static let hiddenBlur: CGFloat = 14
  static let hiddenDim = Color(red: 8 / 255, green: 8 / 255, blue: 10 / 255).opacity(0.45)
  static let chip = Theme.bg.opacity(0.55)
  static let tagInset: CGFloat = 8
  static let tagHeight: CGFloat = 20
  static let tagPaddingX: CGFloat = 8
  static let missionGap: CGFloat = 12
  static let missionCapsuleHeight: CGFloat = 30
  static let missionPaddingX: CGFloat = 14
  static let missionPaddingY: CGFloat = 9
  static let missionNoteRadius: CGFloat = 14
  static let missionNoteMax: CGFloat = 300
  static let footerGap: CGFloat = 20
  static let footerBottom: CGFloat = 12
  static let dot: CGFloat = 6
  static let dotActive: CGFloat = 18
  static let dotGap: CGFloat = 6
}

/// One of the general missions, as an example.
private let exampleMission = "A photo with someone you’ve never met"

/// "Sat, 22 Nov" and "23:00" — `formatEndDate()` / `formatEndTime()` in `lib/event-end.ts`.
enum EndFormat {
  static func date(_ value: Date) -> String {
    value.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated))
  }

  static func time(_ value: Date) -> String {
    value.formatted(.dateTime.hour(.twoDigits(amPM: .abbreviated)).minute(.twoDigits))
  }
}

struct IntroScreen: View {
  let event: EventInfo
  @EnvironmentObject private var model: ClipModel
  @State private var page = 0

  private enum Page: Hashable {
    case roll, hidden, missions(Int), develop
  }

  private var pages: [Page] {
    var list: [Page] = [.roll, .hidden]
    if let count = event.missionsPerGuest, count > 0 { list.append(.missions(count)) }
    list.append(.develop)
    return list
  }

  var body: some View {
    let pages = self.pages
    let last = page >= pages.count - 1
    VStack(spacing: 0) {
      HStack(spacing: 16) {
        Eyebrow(text: event.name)
          .lineLimit(1)
          .frame(maxWidth: .infinity, alignment: .leading)
        if !last {
          Button("Skip") { model.finishIntro() }
            .font(Fonts.medium(13))
            .foregroundStyle(Theme.textMuted)
            .buttonStyle(PressScaleStyle())
            .accessibilityLabel("Skip the introduction")
        }
      }
      .frame(minHeight: IntroTokens.headerHeight)
      .padding(.top, IntroTokens.headerTop)
      .padding(.horizontal, Theme.gutter)

      TabView(selection: $page) {
        ForEach(Array(pages.enumerated()), id: \.offset) { index, item in
          pageView(item)
            .padding(.horizontal, Theme.gutter)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .tag(index)
        }
      }
      .tabViewStyle(.page(indexDisplayMode: .never))

      VStack(spacing: IntroTokens.footerGap) {
        PageDots(count: pages.count, current: page)
        Button(last ? "Got it" : "Next") {
          if last {
            model.finishIntro()
          } else {
            withAnimation(.easeInOut(duration: 0.3)) { page = min(page + 1, pages.count - 1) }
          }
        }
        .buttonStyle(PillButtonStyle())
      }
      .padding(.horizontal, Theme.gutter)
      .padding(.bottom, IntroTokens.footerBottom)
    }
  }

  @ViewBuilder
  private func pageView(_ item: Page) -> some View {
    switch item {
    case .roll: rollPage
    case .hidden: hiddenPage
    case let .missions(count): missionsPage(count)
    case .develop: developPage
    }
  }

  /// The picture on top, the words under it; the picture gives way first on a small phone.
  private func layout<Visual: View, Words: View>(@ViewBuilder visual: () -> Visual,
                                                 @ViewBuilder words: () -> Words) -> some View {
    VStack(spacing: IntroTokens.visualGap) {
      visual()
        .frame(maxWidth: .infinity, maxHeight: IntroTokens.visualHeight)
        .layoutPriority(0)
      VStack(spacing: IntroTokens.textGap) {
        words()
      }
      .multilineTextAlignment(.center)
      .frame(maxWidth: .infinity)
      .layoutPriority(1)
    }
  }

  private func caption(_ text: String) -> some View {
    Text(text)
      .font(Fonts.body(14))
      .foregroundStyle(Theme.textDim)
      .fixedSize(horizontal: false, vertical: true)
  }

  // MARK: The pages

  private var rollPage: some View {
    let unlimited = event.rollSize == nil
    return layout {
      PhoneMock(event: event)
    } words: {
      Text(unlimited ? "∞" : "\(event.rollSize ?? 0)")
        .font(Fonts.numeral(IntroTokens.numeral))
        .monospacedDigit()
        .foregroundStyle(Theme.text)
        .accessibilityLabel(unlimited ? "Unlimited" : "\(event.rollSize ?? 0)")
      if unlimited {
        Headline(plain: "Shoot ", emphasis: "freely.", size: IntroTokens.headline)
        caption("No roll to run out of. Use the camera.")
      } else {
        Headline(plain: "photos. That’s your ", emphasis: "whole roll.", size: IntroTokens.headline)
        caption("No retakes. Use the camera.")
      }
    }
  }

  private var hiddenPage: some View {
    // The others' prints: two stock pictures seeded by the event, as `samplesFor`.
    let sides = EventCover.sampleIndices(seed: event.id, count: 3).dropFirst().map { $0 + 1 }
    let side = IntroTokens.printWidth * IntroTokens.sideScale
    return layout {
      HStack(spacing: IntroTokens.printGap) {
        HiddenPrint(number: sides.first ?? 1, width: side)
        CoverImage(event: event)
          .frame(width: IntroTokens.printWidth, height: IntroTokens.printWidth * 4 / 3)
          .background(Theme.surfaceSubtle)
          .overlay(alignment: .bottomLeading) {
            Text("Yours")
              .font(Fonts.medium(11))
              .foregroundStyle(Theme.text)
              .padding(.horizontal, IntroTokens.tagPaddingX)
              .frame(height: IntroTokens.tagHeight)
              .background(IntroTokens.chip, in: Capsule())
              .padding(IntroTokens.tagInset)
          }
          .clipShape(RoundedRectangle(cornerRadius: IntroTokens.printRadius, style: .continuous))
        HiddenPrint(number: sides.last ?? 2, width: side)
      }
      .accessibilityHidden(true)
    } words: {
      Headline(plain: "Hidden until ", emphasis: "the end.", size: IntroTokens.headline)
      caption("You can look at your own photos. Everyone else’s stay dark until the film develops.")
    }
  }

  private func missionsPage(_ count: Int) -> some View {
    layout {
      VStack(spacing: IntroTokens.missionGap) {
        Text("Example")
          .font(Fonts.medium(13))
          .monospacedDigit()
          .foregroundStyle(Theme.text)
          .padding(.horizontal, IntroTokens.missionPaddingX)
          .frame(height: IntroTokens.missionCapsuleHeight)
          .background(Theme.surfaceSubtle, in: Capsule())
        HStack(spacing: 8) {
          Image(systemName: "scope")
            .font(.system(size: 14, weight: .medium))
          Text(exampleMission)
            .font(Fonts.medium(15))
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(Theme.text)
        .padding(.horizontal, IntroTokens.missionPaddingX)
        .padding(.vertical, IntroTokens.missionPaddingY)
        .frame(maxWidth: IntroTokens.missionNoteMax)
        .background(Theme.surfaceSubtle, in: RoundedRectangle(cornerRadius: IntroTokens.missionNoteRadius, style: .continuous))
      }
      .accessibilityElement(children: .combine)
    } words: {
      Headline(plain: "Your ", emphasis: "missions.", size: IntroTokens.headline)
      caption("Your missions for this film: \(count == 1 ? "one photo" : "\(count) photos") to take, like this one. They show up in the camera when it starts.")
    }
  }

  private var developPage: some View {
    layout {
      VStack(spacing: 4) {
        Text(EndFormat.date(event.endsAt))
          .font(Fonts.numeral(IntroTokens.date))
          .tracking(-0.4)
        Text(EndFormat.time(event.endsAt))
          .font(Fonts.numeral(IntroTokens.numeral))
          .tracking(-1)
          .monospacedDigit()
          .minimumScaleFactor(0.6)
          .lineLimit(1)
      }
      .foregroundStyle(Theme.text)
      .accessibilityElement(children: .combine)
    } words: {
      Headline(plain: "Developed ", emphasis: "together.", size: IntroTokens.headline)
      caption("Then the cameras close and everyone sees every photo at once.")
    }
  }
}

/// Someone else's print: a stock picture, blurred past recognition and dimmed.
/// A small iPhone showing the camera, as the app's `MiniCamera` (2026-11-21,
/// the user): the event image as the viewfinder from the top to the shutter
/// bar, the counter under the Dynamic Island, a soft fade behind it (no band),
/// and the last-shot tile, the shutter and the invite tile. A drawing only.
private struct PhoneMock: View {
  let event: EventInfo
  var width: CGFloat = 130

  var body: some View {
    let height = (width * 2.06).rounded()
    let outer = width * 0.2
    let bezel: CGFloat = 5
    VStack(spacing: 0) {
      ZStack(alignment: .top) {
        CoverImage(event: event)
        LinearGradient(
          colors: [Color(hex: 0x0A0A0B).opacity(0.55), Color(hex: 0x0A0A0B).opacity(0)],
          startPoint: .top, endPoint: .bottom
        )
        .frame(height: height * 0.28)
        .frame(maxHeight: .infinity, alignment: .top)
        Capsule()
          .fill(Color.black)
          .frame(width: width * 0.3, height: 9)
          .padding(.top, 6)
        Text(event.rollSize.map { "\($0) left" } ?? "∞")
          .font(Fonts.numeral(13))
          .monospacedDigit()
          .foregroundStyle(Theme.text)
          .padding(.top, 22)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Theme.surfaceSubtle)
      .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 12, bottomTrailingRadius: 12, style: .continuous))

      HStack {
        CoverImage(event: event)
          .frame(width: 22, height: 22)
          .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        Spacer()
        Circle()
          .strokeBorder(Theme.text, lineWidth: 2)
          .frame(width: 34, height: 34)
          .overlay(Circle().fill(Theme.text).padding(4.5))
        Spacer()
        RoundedRectangle(cornerRadius: 6, style: .continuous)
          .fill(Theme.surfaceSubtle)
          .frame(width: 22, height: 22)
          .overlay(
            Image(systemName: "person.badge.plus")
              .font(.system(size: 10))
              .foregroundStyle(Theme.textMuted)
          )
      }
      .padding(.horizontal, 12)
      .padding(.top, 10)
      .padding(.bottom, 16)
    }
    .overlay(alignment: .bottom) {
      Capsule().fill(Theme.text.opacity(0.5)).frame(width: 40, height: 3).padding(.bottom, 5)
    }
    .background(Theme.bg)
    .clipShape(RoundedRectangle(cornerRadius: outer - bezel, style: .continuous))
    .padding(bezel)
    .background(
      RoundedRectangle(cornerRadius: outer, style: .continuous)
        .fill(Color(hex: 0x0A0A0B))
        .overlay(
          RoundedRectangle(cornerRadius: outer, style: .continuous)
            .strokeBorder(Color.white.opacity(0.16), lineWidth: 1.5)
        )
    )
    .frame(width: width, height: height)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      "LEFT's camera on a phone: "
        + (event.rollSize.map { "\($0) photos left" } ?? "an unlimited roll")
    )
  }
}

private struct HiddenPrint: View {
  let number: Int
  let width: CGFloat
  @State private var image: UIImage?

  var body: some View {
    ZStack {
      Theme.surfaceSubtle
      if let image {
        Image(uiImage: image)
          .resizable()
          .scaledToFill()
          .frame(width: width, height: width * 4 / 3)
          .blur(radius: IntroTokens.hiddenBlur, opaque: true)
      }
      IntroTokens.hiddenDim
    }
    .frame(width: width, height: width * 4 / 3)
    .clipShape(RoundedRectangle(cornerRadius: IntroTokens.printRadius, style: .continuous))
    .task(id: number) { image = samplePicture(number) }
  }
}

/// The app's `ProgressDots`: the current page a short bar, the rest dots.
struct PageDots: View {
  let count: Int
  let current: Int

  var body: some View {
    HStack(spacing: IntroTokens.dotGap) {
      ForEach(0..<count, id: \.self) { index in
        Capsule()
          .fill(index == current ? Theme.text : Theme.textGhost)
          .frame(width: index == current ? IntroTokens.dotActive : IntroTokens.dot, height: IntroTokens.dot)
      }
    }
    .animation(.spring(response: 0.3, dampingFraction: 1), value: current)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Page \(current + 1) of \(count)")
  }
}
