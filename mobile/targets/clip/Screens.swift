import StoreKit
import SwiftUI
import UIKit

struct RootView: View {
  @EnvironmentObject private var model: ClipModel

  var body: some View {
    ZStack {
      Theme.bg.ignoresSafeArea()
      switch model.phase {
      case .starting:
        ProgressView().tint(Theme.textMuted)
      case .noInvite:
        MessageScreen(
          eyebrow: "LEFT",
          plain: "Scan an ",
          emphasis: "invite.",
          message: "Point your camera at the host’s QR code, or open the link they sent you."
        )
      case .name:
        NameScreen()
      case let .intro(event):
        IntroScreen(event: event)
      case let .waiting(event):
        WaitingScreen(event: event)
      case let .camera(event):
        CameraScreen(event: event)
      case let .developing(event):
        DevelopingScreen(event: event)
      case let .failed(message):
        MessageScreen(eyebrow: "LEFT", plain: "Something ", emphasis: "went wrong.", message: message,
                      retry: retryAction)
      }
    }
    .animation(.easeInOut(duration: 0.25), value: model.phase)
  }

  /// "Try again" only when there is a code to retry. Spelled out rather than a
  /// `cond ? { … } : nil` inline: that ternary sank the whole body's type
  /// check in Xcode 27.1 ("failed to produce diagnostic", 2026-11-18).
  private var retryAction: (@MainActor () -> Void)? {
    guard model.canRetry else { return nil }
    let model = self.model
    return { model.retry() }
  }
}

// MARK: 11 — Name

/// The app's `(guest)/name.tsx`. With names the host listed for personal
/// missions, the names come first and "Add your name" opens the field
/// (`NameList`); without, the field alone. Picking a host's name makes it the
/// guest's name. Reached again from 12 (`changingName`) until the start.
struct NameScreen: View {
  @EnvironmentObject private var model: ClipModel
  @State private var name = ""
  @FocusState private var focused: Bool

  private var trimmed: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
  private var hasNames: Bool { !model.names.isEmpty }
  private var chosen: MissionName? { model.names.first { $0.id == model.pickedName } }
  /// The name the group will see: the host's, or what they typed.
  private var finalName: String { hasNames && !model.typingName ? (chosen?.name ?? "") : trimmed }
  private var canContinue: Bool { model.namesLoaded && !finalName.isEmpty && !model.busy }

  var body: some View {
    VStack(spacing: 0) {
      // Scrolls only when it has to: the names, large text, or the keyboard up.
      ScrollView {
        fields
      }
      .scrollBounceBehavior(.basedOnSize)
      .scrollDismissesKeyboard(.never)

      Button(model.busy ? (model.changingName ? "Saving…" : "Joining…") : "Continue", action: submit)
        .buttonStyle(PillButtonStyle())
        .disabled(!canContinue)
        .padding(.top, 8)
        .padding(.bottom, 12)
    }
    .padding(.horizontal, Theme.gutter)
    .onAppear {
      if model.changingName, let current = model.memberName { name = current }
    }
    .task {
      // Asked again every few seconds, so a name someone else takes disappears.
      model.beginNames()
      while !Task.isCancelled {
        await model.loadNames()
        try? await Task.sleep(nanoseconds: 10_000_000_000)
      }
    }
    .onChange(of: model.namesLoaded) { _, loaded in
      // The field alone is the screen: focus it, as before.
      if loaded, !hasNames { focused = true }
    }
    .animation(.easeInOut(duration: 0.2), value: model.namesLoaded)
  }

  private func submit() {
    guard canContinue else { return }
    let personId = hasNames && !model.typingName ? chosen?.id : nil
    model.join(name: finalName, personId: personId)
  }

  private var field: some View {
    VStack(alignment: .leading, spacing: 0) {
      TextField("", text: $name, prompt: Text("Your name").foregroundColor(Theme.textGhost))
        .font(Fonts.body(18))
        .foregroundStyle(Theme.text)
        .tint(Theme.text)
        .textContentType(.name)
        .textInputAutocapitalization(.words)
        .autocorrectionDisabled()
        .submitLabel(.done)
        .focused($focused)
        .onSubmit(submit)
        .onChange(of: name) { _, value in
          if value.count > ClipConfig.maxNameLength { name = String(value.prefix(ClipConfig.maxNameLength)) }
        }
        .padding(.horizontal, 20)
        .frame(height: 58)
        .background(Theme.field, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .disabled(model.busy)

      Text("This is how the group will see you during the event.")
        .font(Fonts.body(13))
        .foregroundStyle(Theme.textDim)
        .padding(.top, 12)
    }
  }

  private var fields: some View {
    VStack(alignment: .leading, spacing: 0) {
      if model.changingName {
        Button { model.cancelChangeName() } label: {
          Image(systemName: "chevron.left")
            .font(.system(size: 16, weight: .medium))
            .foregroundStyle(Theme.text)
            .frame(width: 44, height: 44)
            .background(Theme.field, in: Circle())
            .overlay(Circle().stroke(Theme.hairline, lineWidth: 1))
        }
        .buttonStyle(PressScaleStyle())
        .accessibilityLabel("Back")
        .padding(.top, 16)
      }

      Eyebrow(text: model.changingName ? "Your name" : "Welcome")
        .padding(.top, model.changingName ? 20 : 48)
      Headline(plain: "What should\nwe ", emphasis: "call you?", size: 44).padding(.top, 14)

      if hasNames {
        NameList(onAdd: { focused = true }) { field }
          .padding(.top, 36)
      } else if model.namesLoaded {
        field.padding(.top, 36)
      }

      // Reserved whether or not there is an error, so nothing jumps.
      Text(model.nameError ?? " ")
        .font(Fonts.body(14))
        .foregroundStyle(Theme.textMuted)
        .padding(.top, 16)
        .frame(minHeight: 40, alignment: .top)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

// MARK: 12 — Waiting

/// `Waiting` in theme.ts.
private enum WaitingTokens {
  /// The event image covers the top half of the screen.
  static let backdropRatio: CGFloat = 0.5
  /// Where the title starts, as a share of the backdrop's height.
  static let titleAt: CGFloat = 0.62
  static let fade = Gradient(stops: [
    .init(color: Theme.bg.opacity(0.25), location: 0),
    .init(color: Theme.bg.opacity(0.1), location: 0.3),
    .init(color: Theme.bg.opacity(0.75), location: 0.75),
    .init(color: Theme.bg, location: 1),
  ])
  static let headlineGap: CGFloat = 24
  static let pingGap: CGFloat = 14
  static let pingSize: CGFloat = 22
  static let dotSize: CGFloat = 11
  static let pingScale: CGFloat = 2.4
  static let pingOpacity: Double = 0.45
  static let pingDuration: Double = 2
  static let factTop: CGFloat = 24
  static let factGap: CGFloat = 12
  static let factIcon: CGFloat = 15
  static let factIconGap: CGFloat = 10
  static let footGap: CGFloat = 16
  static let chromeInset: CGFloat = 8
  static let qrButton: CGFloat = 44
  static let qrIcon: CGFloat = 19
}

/// The app's `(guest)/waiting.tsx` (2026-11-21): the event image in the
/// moment's look over the top half, fading into the page; no cards — the
/// wait, then the facts, on the page itself; "How it works" at the foot
/// (replays the intro), and a glass QR button top right to invite more people.
struct WaitingScreen: View {
  let event: EventInfo
  @EnvironmentObject private var model: ClipModel
  @State private var hostName: String?
  @State private var showInvite = false

  /// "Are you on the list?" (2026-11-19, the user): back to 11 to switch to
  /// or from a host's name, while there is one to pick and until the start.
  private var mine: MissionName? { model.names.first(where: \.isMine) }

  var body: some View {
    GeometryReader { geo in
      let full = geo.size.height + geo.safeAreaInsets.top + geo.safeAreaInsets.bottom
      let backdrop = (full * WaitingTokens.backdropRatio).rounded()
      ZStack(alignment: .top) {
        // Drawn from the physical top edge, under the status bar.
        CoverImage(event: event)
          .frame(width: geo.size.width, height: backdrop)
          .overlay(LinearGradient(gradient: WaitingTokens.fade, startPoint: .top, endPoint: .bottom))
          .clipped()
          .offset(y: -geo.safeAreaInsets.top)
          .allowsHitTesting(false)

        VStack(alignment: .leading, spacing: 0) {
          // Scrolls only when it has to — large text can push it past the fold.
          ScrollView {
            content
              .padding(.top, max(48, backdrop * WaitingTokens.titleAt - geo.safeAreaInsets.top))
          }
          .scrollBounceBehavior(.basedOnSize)
          .scrollIndicators(.hidden)
          foot
        }
        .padding(.horizontal, Theme.gutter)
      }
      .overlay(alignment: .topTrailing) { qrButton }
    }
    .animation(.easeInOut(duration: 0.2), value: model.names)
    .task(id: event.id) {
      // The copy reads fine without the name ("the host").
      hostName = try? await Server.shared.hostName(eventId: event.id)
    }
    .task {
      while !Task.isCancelled {
        await model.loadNames()
        try? await Task.sleep(nanoseconds: 10_000_000_000)
      }
    }
    .sheet(isPresented: $showInvite) {
      if let code = model.inviteCode {
        InviteSheet(code: code, eventName: event.name)
      }
    }
  }

  private var content: some View {
    VStack(alignment: .leading, spacing: 0) {
      Eyebrow(text: event.name)
      Headline(plain: "Almost ", emphasis: "there.", size: 44).padding(.top, 14)

      HStack(spacing: WaitingTokens.pingGap) {
        WaitPing()
        (Text("Waiting for ").foregroundColor(Theme.textDim)
          + Text(hostName ?? "the host").foregroundColor(Theme.text)
          + Text(" to start the event.").foregroundColor(Theme.textDim))
          .font(Fonts.body(16))
          .fixedSize(horizontal: false, vertical: true)
      }
      .padding(.top, WaitingTokens.headlineGap)

      VStack(alignment: .leading, spacing: WaitingTokens.factGap) {
        fact("camera", event.rollSize.map { "\($0) photos each" } ?? "Unlimited photos each")
        fact("clock", "Develops \(EndFormat.date(event.endsAt)) at \(EndFormat.time(event.endsAt))")
      }
      .padding(.top, WaitingTokens.factTop)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func fact(_ icon: String, _ label: String) -> some View {
    HStack(spacing: WaitingTokens.factIconGap) {
      Image(systemName: icon)
        .font(.system(size: WaitingTokens.factIcon))
        .foregroundStyle(Theme.textMuted)
        .accessibilityHidden(true)
      Text(label)
        .font(Fonts.medium(15))
        .monospacedDigit()
        .foregroundStyle(Theme.text)
        .fixedSize(horizontal: false, vertical: true)
    }
  }

  /// At the foot of the page: the names prompt, then "How it works".
  private var foot: some View {
    VStack(alignment: .leading, spacing: WaitingTokens.footGap) {
      if !model.names.isEmpty {
        VStack(alignment: .leading, spacing: 12) {
          Text(mine.map { "You are \($0.name) on the host’s list." }
            ?? "The host planned something for some of you by name.")
            .font(Fonts.body(14))
            .foregroundStyle(Theme.textDim)
          Button(mine == nil ? "Are you on the list?" : "Change your name") { model.changeName() }
            .buttonStyle(PillButtonStyle(light: false))
        }
        .transition(.opacity)
      }
      Button { model.replayIntro() } label: {
        Label("How it works", systemImage: "info.circle")
      }
      .buttonStyle(PillButtonStyle(light: false))
    }
    .padding(.top, 16)
    .padding(.bottom, 12)
  }

  /// Glass, because it floats over the event image.
  private var qrButton: some View {
    Button { showInvite = true } label: {
      Image(systemName: "qrcode")
        .font(.system(size: WaitingTokens.qrIcon, weight: .medium))
        .foregroundStyle(Theme.text)
        .frame(width: WaitingTokens.qrButton, height: WaitingTokens.qrButton)
        .glass(Circle(), interactive: true)
    }
    .buttonStyle(PressScaleStyle(scale: 0.9))
    .padding(.top, WaitingTokens.chromeInset)
    .padding(.trailing, Theme.gutter)
    .accessibilityLabel("Invite")
    .accessibilityHint("Shows the QR code and the link to this moment")
    .opacity(model.inviteCode == nil ? 0 : 1)
    .disabled(model.inviteCode == nil)
  }
}

/// The artboard's `wait-ping` — a ring expanding out of a solid dot and
/// fading, identical on every cycle. Still under Reduce Motion.
private struct WaitPing: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var pulse = false

  var body: some View {
    ZStack {
      Circle()
        .fill(Theme.text)
        .frame(width: WaitingTokens.pingSize, height: WaitingTokens.pingSize)
        .scaleEffect(pulse ? WaitingTokens.pingScale : 1)
        .opacity(reduceMotion ? 0 : (pulse ? 0 : WaitingTokens.pingOpacity))
      Circle()
        .fill(Theme.text)
        .frame(width: WaitingTokens.dotSize, height: WaitingTokens.dotSize)
    }
    // As wide as the ring grows, so nothing clips it.
    .frame(width: WaitingTokens.pingSize * WaitingTokens.pingScale,
           height: WaitingTokens.pingSize * WaitingTokens.pingScale)
    .accessibilityHidden(true)
    .onAppear {
      guard !reduceMotion else { return }
      withAnimation(.easeOut(duration: WaitingTokens.pingDuration).repeatForever(autoreverses: false)) {
        pulse = true
      }
    }
  }
}

/// 09 for a guest: the QR code and the link, to invite more people.
private struct InviteSheet: View {
  let code: String
  let eventName: String
  @State private var qr: UIImage?

  private var url: URL? { InviteQR.url(code: code) }

  var body: some View {
    VStack(spacing: 0) {
      Eyebrow(text: eventName).padding(.top, 32)
      Headline(plain: "Invite ", emphasis: "more people.", size: 34)
        .multilineTextAlignment(.center)
        .padding(.top, 12)
      Text("They scan this or open the link. No app needed.")
        .font(Fonts.body(14))
        .foregroundStyle(Theme.textDim)
        .multilineTextAlignment(.center)
        .padding(.top, 10)

      ZStack {
        Color.white
        if let qr {
          Image(uiImage: qr)
            .interpolation(.none)
            .resizable()
            .scaledToFit()
            .padding(16)
        }
      }
      .frame(width: 240, height: 240)
      .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
      .padding(.top, 28)
      .accessibilityLabel("QR code for the invite link")

      if let url {
        Text(url.absoluteString.replacingOccurrences(of: "https://", with: ""))
          .font(Fonts.body(14))
          .foregroundStyle(Theme.textMuted)
          .textSelection(.enabled)
          .padding(.top, 16)
      }

      Spacer(minLength: 20)

      if let url {
        ShareLink(item: url) { Text("Share link") }
          .buttonStyle(PillButtonStyle())
      }
    }
    .padding(.horizontal, Theme.gutter)
    .padding(.bottom, 12)
    .frame(maxWidth: .infinity)
    .task { qr = url.flatMap { InviteQR.image(for: $0.absoluteString) } }
    .presentationDetents([.large])
    .presentationDragIndicator(.visible)
    .presentationBackground(Theme.bg)
  }
}

// MARK: Developing

struct DevelopingScreen: View {
  let event: EventInfo
  @EnvironmentObject private var model: ClipModel
  @State private var showStore = false

  var body: some View {
    TimelineView(.periodic(from: .now, by: 1)) { context in
      let developed = event.isDeveloped(now: context.date)
      VStack(alignment: .leading, spacing: 0) {
        Eyebrow(text: event.name).padding(.top, 48)
        if developed {
          Headline(plain: "The film is\n", emphasis: "developed.", size: 44).padding(.top, 14)
          Text("Get LEFT to see everyone’s photos. This event is waiting there, with your photos in it.")
            .font(Fonts.body(15))
            .foregroundStyle(Theme.textMuted)
            .padding(.top, 20)
        } else {
          Headline(plain: model.shotsLeft == 0 ? "That was your\n" : "Nothing to see\n",
                   emphasis: model.shotsLeft == 0 ? "last photo." : "yet.", size: 44)
            .padding(.top, 14)
          let parts = countdownParts(to: event.endsAt, now: context.date)
          HStack(alignment: .firstTextBaseline, spacing: 10) {
            ForEach(Array(parts.enumerated()), id: \.offset) { _, part in
              HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(part.value).font(Fonts.numeral(60)).foregroundStyle(Theme.text)
                Text(part.unit.uppercased()).font(Fonts.medium(13)).foregroundStyle(Theme.textFaint)
              }
            }
          }
          .monospacedDigit()
          .padding(.top, 28)
          .accessibilityElement(children: .ignore)
          .accessibilityLabel("\(parts[0].value) \(parts[0].unit), \(parts[1].value) \(parts[1].unit) until the film is developed")
          Text(model.shotsLeft == 0
            ? "Your roll is used up. Everyone’s photos appear together when the film is developed."
            : "They appear together when the film is developed.")
            .font(Fonts.body(15))
            .foregroundStyle(Theme.textMuted)
            .padding(.top, 20)
        }
        Spacer()
        Button("Get LEFT") { showStore = true }
          .buttonStyle(PillButtonStyle())
        if !developed, model.shotsLeft != 0 {
          Button("Back to the camera") { model.backToCamera() }
            .buttonStyle(PillButtonStyle(light: false))
            .padding(.top, 10)
        }
      }
      .padding(.horizontal, Theme.gutter)
      .padding(.bottom, 12)
    }
    .appStoreOverlay(isPresented: $showStore) {
      SKOverlay.AppClipConfiguration(position: .bottom)
    }
  }
}

// MARK: Messages

struct MessageScreen: View {
  let eyebrow: String
  let plain: String
  let emphasis: String
  let message: String
  var retry: (@MainActor () -> Void)?

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Eyebrow(text: eyebrow).padding(.top, 48)
      Headline(plain: plain, emphasis: emphasis, size: 44).padding(.top, 14)
      Text(message)
        .font(Fonts.body(15))
        .foregroundStyle(Theme.textMuted)
        .padding(.top, 20)
      Spacer()
      if let retry {
        Button("Try again", action: retry)
          .buttonStyle(PillButtonStyle())
          .padding(.bottom, 12)
      }
    }
    .padding(.horizontal, Theme.gutter)
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}
