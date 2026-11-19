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

struct WaitingScreen: View {
  let event: EventInfo
  @EnvironmentObject private var model: ClipModel
  @State private var pulse = false

  /// "Are you on the list?" (2026-11-19, the user): back to 11 to switch to
  /// or from a host's name, while there is one to pick and until the start.
  private var mine: MissionName? { model.names.first(where: \.isMine) }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Eyebrow(text: event.name).padding(.top, 48)
      Headline(plain: "Almost ", emphasis: "there.", size: 44).padding(.top, 14)
      Text("Waiting for the host to start the event. The cameras open for everyone at once.")
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
      if !model.names.isEmpty {
        Text(mine.map { "You are \($0.name) on the host’s list." }
          ?? "The host planned something for some of you by name.")
          .font(Fonts.body(14))
          .foregroundStyle(Theme.textDim)
          .padding(.bottom, 12)
        Button(mine == nil ? "Are you on the list?" : "Change your name") { model.changeName() }
          .buttonStyle(PillButtonStyle(light: false))
          .padding(.bottom, 12)
          .transition(.opacity)
      }
    }
    .padding(.horizontal, Theme.gutter)
    .animation(.easeInOut(duration: 0.2), value: model.names)
    .onAppear {
      guard !UIAccessibility.isReduceMotionEnabled else { return }
      withAnimation(.easeOut(duration: 1.6).repeatForever(autoreverses: false)) { pulse = true }
    }
    .task {
      while !Task.isCancelled {
        await model.loadNames()
        try? await Task.sleep(nanoseconds: 10_000_000_000)
      }
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
