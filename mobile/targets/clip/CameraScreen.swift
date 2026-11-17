import SwiftUI
import UIKit

/// 13 in the clip. Every control sits outside the viewfinder, as in the app
/// (decided 2026-11-16): the counter in the header under the event's name,
/// flash · flip under the frame, the shutter in the bottom row.
struct CameraScreen: View {
  let event: EventInfo
  @EnvironmentObject private var model: ClipModel
  @StateObject private var camera = CameraController()
  @Environment(\.scenePhase) private var scenePhase

  @State private var flash = false
  @State private var blink = false
  @State private var whiteScreen = false
  @State private var capturing = false
  @State private var error: String?

  private var canShoot: Bool {
    camera.ready && !capturing && model.shotsLeft != 0
  }

  var body: some View {
    VStack(spacing: 0) {
      header
        .padding(.horizontal, Theme.gutter)
        .padding(.top, 8)

      viewfinder
        .padding(.horizontal, 12)
        .padding(.top, 16)

      HStack(spacing: 28) {
        if camera.hasFlash {
          RoundControl(symbol: flash ? "bolt.fill" : "bolt.slash", label: flash ? "Flash on" : "Flash off") {
            flash.toggle()
          }
        }
        RoundControl(symbol: "arrow.triangle.2.circlepath", label: "Switch camera") {
          camera.flip()
        }
      }
      .padding(.top, 16)

      Spacer(minLength: 12)

      Shutter(enabled: canShoot, action: shoot)
        .padding(.bottom, 20)
    }
    .overlay {
      // The front camera's flash: the screen itself, at full brightness.
      if whiteScreen { Color.white.ignoresSafeArea() }
    }
    .onAppear {
      camera.viewfinder.setLook(event.look)
      camera.start()
    }
    .onDisappear { camera.stop() }
    .onChange(of: scenePhase) { _, phase in
      if phase == .active { camera.start() } else if phase == .background { camera.stop() }
    }
  }

  private var header: some View {
    HStack(alignment: .bottom) {
      VStack(alignment: .leading, spacing: 4) {
        Eyebrow(text: event.name)
        HStack(alignment: .firstTextBaseline, spacing: 6) {
          Text(model.shotsLeft.map { "\($0)" } ?? "∞")
            .font(Fonts.numeral(40))
            .foregroundStyle(Theme.text)
            .contentTransition(.numericText())
            .animation(.spring(response: 0.3, dampingFraction: 1), value: model.shotsLeft)
          Text("left")
            .font(Fonts.body(14))
            .foregroundStyle(Theme.textMuted)
        }
      }
      Spacer()
      // The countdown is the way to the developing state, as in the app.
      Button { model.showDeveloping() } label: {
        TimelineView(.periodic(from: .now, by: 1)) { context in
          Text(countdown(to: event.endsAt, now: context.date))
            .font(Fonts.medium(13))
            .monospacedDigit()
            .foregroundStyle(Theme.textMuted)
            .padding(.horizontal, 14)
            .frame(height: 34)
            .background(Theme.field, in: Capsule())
        }
      }
      .accessibilityLabel("Time until the film is developed")
    }
  }

  private var viewfinder: some View {
    ZStack {
      ViewfinderRepresentable(camera: camera)
      if blink { Color.black }
      if camera.permission == .denied {
        VStack(spacing: 14) {
          Text("LEFT needs the camera to take your photos.")
            .font(Fonts.body(15))
            .foregroundStyle(Theme.text)
            .multilineTextAlignment(.center)
          Button("Open Settings") {
            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
          }
          .buttonStyle(PillButtonStyle())
          .frame(width: 200)
        }
        .padding(24)
      }
      if let error {
        Text(error)
          .font(Fonts.body(13))
          .foregroundStyle(Theme.text)
          .padding(.horizontal, 14)
          .padding(.vertical, 8)
          .background(.black.opacity(0.55), in: Capsule())
          .frame(maxHeight: .infinity, alignment: .bottom)
          .padding(.bottom, 14)
      }
    }
    .aspectRatio(3 / 4, contentMode: .fit)
    .background(Color.black)
    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
  }

  /// Shutter, haptic and blink on the same frame; then the white screen for a
  /// front flash, the capture, the develop and the queue.
  private func shoot() {
    guard canShoot else { return }
    capturing = true
    error = nil
    let lastShot = model.shotsLeft == 1
    UIImpactFeedbackGenerator(style: .medium).impactOccurred()

    let front = camera.position == .front
    let useScreen = flash && front
    if useScreen { whiteScreen = true }
    // `Camera.flash.leadMs` in the app: let the screen light the face first.
    let lead: Double = useScreen ? 0.32 : 0

    DispatchQueue.main.asyncAfter(deadline: .now() + lead) {
      model.shotStarted()
      blinkShutter()
      camera.capture(flash: flash) { result in
        whiteScreen = false
        capturing = false
        if lastShot { UINotificationFeedbackGenerator().notificationOccurred(.success) }
        switch result {
        case let .success(data):
          develop(data)
        case .failure:
          model.shotQueued(false)
          error = "That one didn’t come out. Try again."
        }
      }
    }
  }

  private func blinkShutter() {
    if UIAccessibility.isReduceMotionEnabled {
      withAnimation(.easeInOut(duration: 0.12)) { blink = true }
    } else {
      blink = true
    }
    withAnimation(.easeOut(duration: 0.25).delay(0.06)) { blink = false }
  }

  private func develop(_ data: Data) {
    let event = self.event
    let model = self.model
    let errorText = $error
    let takenAt = timestampString(Date())
    Task.detached(priority: .userInitiated) {
      do {
        guard let userId = await Server.shared.userId else { throw ClipError.notConfigured }
        let photo = try await Developer.shared.develop(data, look: event.look)
        let shot = QueuedShot(
          id: UUID().uuidString.lowercased(), eventId: event.id, userId: userId, takenAt: takenAt,
          width: photo.width, height: photo.height, claimed: false, uploaded: false
        )
        try await UploadQueue.shared.enqueue(shot, photo: photo)
        await MainActor.run { model.shotQueued(true) }
      } catch {
        await MainActor.run {
          model.shotQueued(false)
          errorText.wrappedValue = "That one didn’t come out. Try again."
        }
      }
    }
  }
}

/// The shutter: an off-white disc in a ring, giving on press-in.
private struct Shutter: View {
  let enabled: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Circle()
        .fill(Theme.text)
        .frame(width: 64, height: 64)
        .padding(6)
        .overlay(Circle().stroke(Theme.text.opacity(0.5), lineWidth: 2))
    }
    .buttonStyle(ShutterPress())
    .opacity(enabled ? 1 : 0.35)
    .disabled(!enabled)
    .accessibilityLabel("Take photo")
  }
}

private struct ShutterPress: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .scaleEffect(configuration.isPressed ? 0.92 : 1)
      .animation(.spring(response: 0.2, dampingFraction: 1), value: configuration.isPressed)
  }
}

/// Flash and flip: round glass-like controls on the dark page.
private struct RoundControl: View {
  let symbol: String
  let label: String
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Image(systemName: symbol)
        .font(.system(size: 17, weight: .regular))
        .foregroundStyle(Theme.text)
        .frame(width: 48, height: 48)
        .background(.ultraThinMaterial, in: Circle())
        .overlay(Circle().stroke(Theme.hairline, lineWidth: 1))
    }
    .buttonStyle(ShutterPress())
    .accessibilityLabel(label)
  }
}
