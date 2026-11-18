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
      case let .waiting(event):
        WaitingScreen(event: event)
      case let .camera(event):
        CameraScreen(event: event)
      case let .developing(event):
        DevelopingScreen(event: event)
      case let .failed(message):
        MessageScreen(eyebrow: "LEFT", plain: "Something ", emphasis: "went wrong.", message: message, retry: { model.retry() })
      }
    }
    .animation(.easeInOut(duration: 0.25), value: model.phase)
  }
}

// MARK: 11 — Name

struct NameScreen: View {
  @EnvironmentObject private var model: ClipModel
  @State private var name = ""
  @FocusState private var focused: Bool

  private var trimmed: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
  private var canContinue: Bool { !trimmed.isEmpty && !model.busy }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Eyebrow(text: "Welcome").padding(.top, 48)
      Headline(plain: "What should\nwe ", emphasis: "call you?", size: 44).padding(.top, 14)

      TextField("", text: $name, prompt: Text("Your name").foregroundColor(Theme.textGhost))
        .font(Fonts.body(18))
        .foregroundStyle(Theme.text)
        .tint(Theme.text)
        .textContentType(.name)
        .textInputAutocapitalization(.words)
        .autocorrectionDisabled()
        .submitLabel(.done)
        .focused($focused)
        .onSubmit { model.join(name: trimmed) }
        .onChange(of: name) { _, value in
          if value.count > ClipConfig.maxNameLength { name = String(value.prefix(ClipConfig.maxNameLength)) }
        }
        .padding(.horizontal, 20)
        .frame(height: 58)
        .background(Theme.field, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .disabled(model.busy)
        .padding(.top, 36)

      Text("This is how the group will see you during the event.")
        .font(Fonts.body(13))
        .foregroundStyle(Theme.textDim)
        .padding(.top, 12)

      NamePicker()
        .padding(.top, 24)

      Text(model.nameError ?? " ")
        .font(Fonts.body(14))
        .foregroundStyle(Theme.textMuted)
        .padding(.top, 16)
        .frame(minHeight: 40, alignment: .top)

      Spacer()

      Button(model.busy ? "Joining…" : "Continue") { model.join(name: trimmed) }
        .buttonStyle(PillButtonStyle())
        .disabled(!canContinue)
        .padding(.bottom, 12)
    }
    .padding(.horizontal, Theme.gutter)
    .onAppear { focused = true }
    .task { await model.loadNames() }
  }
}

// MARK: 12 — Waiting

struct WaitingScreen: View {
  let event: EventInfo
  @State private var pulse = false

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Eyebrow(text: event.name).padding(.top, 48)
      Headline(plain: "You’re in.\nWaiting for the ", emphasis: "host.", size: 44).padding(.top, 14)
      Text("The cameras open when the host starts the event. Keep this open — it moves on by itself.")
        .font(Fonts.body(15))
        .foregroundStyle(Theme.textMuted)
        .padding(.top, 20)
      Spacer()
      HStack {
        Spacer()
        Circle()
          .fill(Theme.gold)
          .frame(width: 10, height: 10)
          .overlay(Circle().stroke(Theme.gold, lineWidth: 1).scaleEffect(pulse ? 3 : 1).opacity(pulse ? 0 : 1))
        Spacer()
      }
      .padding(.bottom, 48)
    }
    .padding(.horizontal, Theme.gutter)
    .onAppear {
      guard !UIAccessibility.isReduceMotionEnabled else { return }
      withAnimation(.easeOut(duration: 1.6).repeatForever(autoreverses: false)) { pulse = true }
    }
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
          Headline(plain: "Your film is\n", emphasis: "developed.", size: 44).padding(.top, 14)
          Text("Get LEFT to see everyone’s photos. You’ll find this film there, with your shots in it.")
            .font(Fonts.body(15))
            .foregroundStyle(Theme.textMuted)
            .padding(.top, 20)
        } else {
          Headline(plain: "Your film is\n", emphasis: "developing.", size: 44).padding(.top, 14)
          Text(model.shotsLeft == 0 ? "Your roll is used up. Everyone’s photos appear when the film is developed." :
                "Nobody sees a photo until the film is developed — then everyone sees all of them at once.")
            .font(Fonts.body(15))
            .foregroundStyle(Theme.textMuted)
            .padding(.top, 20)
          Text(countdown(to: event.endsAt, now: context.date))
            .font(Fonts.numeral(56))
            .foregroundStyle(Theme.text)
            .monospacedDigit()
            .padding(.top, 36)
          Text("until it’s developed")
            .font(Fonts.body(13))
            .foregroundStyle(Theme.textDim)
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

/// "3:12:05", or "2 days" past a day.
func countdown(to end: Date, now: Date) -> String {
  let seconds = max(0, Int(end.timeIntervalSince(now)))
  let days = seconds / 86_400
  if days >= 2 { return "\(days) days" }
  let h = seconds / 3600, m = (seconds % 3600) / 60, s = seconds % 60
  return String(format: "%d:%02d:%02d", h, m, s)
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
