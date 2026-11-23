import SwiftUI
import UIKit

/// 13 in the clip — the app's `(capture)/camera.tsx` as of 2026-11-18.
///
/// **The viewfinder is the screen** (the user, 2026-11-18): it runs under the
/// status bar down to the shutter bar, its bottom corners rounded. The header
/// (the event's name, "17 left", "Missions 1/3", the countdown) and flash ·
/// zoom · flip are glass laid over it, on soft scrims so they stay readable
/// over a bright picture. The print is centre-cropped to the frame's shape
/// (`cropAspect`), so it holds exactly what the frame showed.
///
/// What the app has and the clip does not: the close button (the clip has
/// nowhere to go back to — its left header slot stays empty so the counter
/// keeps the centre line) and the invite tile (inviting is the host's app).
struct CameraScreen: View {
  let event: EventInfo
  @EnvironmentObject private var model: ClipModel
  @StateObject private var camera = CameraController()
  @Environment(\.scenePhase) private var scenePhase
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  @State private var flash = false
  @State private var blackout = false
  @State private var whiteScreen = false
  @State private var capturing = false
  @State private var error: String?
  @State private var missionList = false
  @State private var yourShots = false
  /// The viewfinder's size, for the print's crop.
  @State private var frameSize: CGSize = .zero
  /// How far the controls' icons turn to stay upright. The screen itself stays
  /// portrait (as Apple's Camera does): only the icons follow the phone.
  @State private var tilt: Angle = .zero

  private var canShoot: Bool {
    camera.ready && !capturing && model.shotsLeft != 0
  }

  var body: some View {
    GeometryReader { outer in
      let top = outer.safeAreaInsets.top
      VStack(spacing: 0) {
        viewfinder(top: top)
          .clipShape(UnevenRoundedRectangle(
            bottomLeadingRadius: CameraTokens.viewfinderRadius,
            bottomTrailingRadius: CameraTokens.viewfinderRadius,
            style: .continuous
          ))
          .ignoresSafeArea(edges: .top)

        bottomBar
      }
    }
    .sheet(isPresented: $missionList) {
      MissionListSheet().environmentObject(model)
    }
    .fullScreenCover(isPresented: $yourShots) {
      YourShotsSheet(event: event).environmentObject(model)
    }
    .overlay {
      // The front camera's flash: the screen itself, at full brightness.
      if whiteScreen { Color.white.ignoresSafeArea() }
    }
    .onAppear {
      camera.viewfinder.setLook(event.look)
      camera.start()
      UIDevice.current.beginGeneratingDeviceOrientationNotifications()
      followTilt()
    }
    .onDisappear {
      camera.stop()
      UIDevice.current.endGeneratingDeviceOrientationNotifications()
    }
    .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in
      followTilt()
    }
    .onChange(of: scenePhase) { _, phase in
      if phase == .active { camera.start() } else if phase == .background { camera.stop() }
    }
  }

  // MARK: The frame

  private func viewfinder(top: CGFloat) -> some View {
    ZStack(alignment: .top) {
      CameraTokens.viewfinderBg
      ViewfinderRepresentable(camera: camera)

      Color.black
        .opacity(blackout ? (reduceMotion ? 0.55 : 1) : 0)
        .allowsHitTesting(false)

      // Keeps the header's and the controls' text readable over a bright picture.
      LinearGradient(colors: CameraTokens.scrimTop, startPoint: .top, endPoint: .bottom)
        .frame(height: top + CameraTokens.scrimTopHeight)
        .allowsHitTesting(false)
      LinearGradient(colors: CameraTokens.scrimBottom, startPoint: .top, endPoint: .bottom)
        .frame(height: CameraTokens.scrimBottomHeight)
        .frame(maxHeight: .infinity, alignment: .bottom)
        .allowsHitTesting(false)

      header
        .padding(.horizontal, CameraTokens.headerPaddingX)
        .padding(.top, top + CameraTokens.headerPaddingTop)

      if let armed = model.missions.first(where: { $0.id == model.armedId }) {
        ArmedNote(text: armed.body, open: { missionList = true }) {
          withAnimation(reduceMotion ? .easeInOut(duration: 0.18) : .spring(response: 0.35, dampingFraction: 1)) {
            model.arm(nil)
          }
        }
        .padding(.top, top + CameraTokens.armedOffset)
      }

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
        .frame(maxHeight: .infinity)
      }

      if let note = noteText {
        HStack(spacing: 6) {
          Image(systemName: "exclamationmark.circle")
            .font(.system(size: 12))
          Text(note).font(Fonts.body(13))
        }
        .foregroundStyle(CameraTokens.noteColor)
        .padding(.vertical, 6)
        .padding(.horizontal, 12)
        .background(CameraTokens.noteBg, in: Capsule())
        .overlay(Capsule().stroke(CameraTokens.noteBorder, lineWidth: 1))
        .frame(maxHeight: .infinity, alignment: .bottom)
        .padding(.bottom, CameraTokens.controlsHeight + CameraTokens.noteInset)
        .accessibilityAddTraits(.updatesFrequently)
      }

      controls
        .frame(maxHeight: .infinity, alignment: .bottom)
    }
    .animation(reduceMotion ? .easeInOut(duration: 0.18) : .spring(response: 0.35, dampingFraction: 1), value: model.armedId)
    .onGeometryChange(for: CGSize.self) { $0.size } action: { frameSize = $0 }
  }

  private var noteText: String? { error }

  /// Face up, face down and upside down keep the last angle, as the system camera does.
  private func followTilt() {
    let angle: Angle
    switch UIDevice.current.orientation {
    case .portrait: angle = .zero
    case .landscapeLeft: angle = .degrees(90)
    case .landscapeRight: angle = .degrees(-90)
    default: return
    }
    guard angle != tilt else { return }
    withAnimation(reduceMotion ? .easeInOut(duration: 0.18) : .spring(response: 0.4, dampingFraction: 1)) {
      tilt = angle
    }
  }

  // MARK: Header

  private var header: some View {
    HStack(alignment: .top, spacing: 0) {
      // The app's close button lives here; the clip has nowhere to go back to.
      // A demo says so in its place.
      ZStack(alignment: .topLeading) {
        Color.clear.frame(width: CameraTokens.headerSideWidth, height: 1)
        if model.isDemo {
          DemoTag().padding(.top, CameraTokens.countdownTop)
        }
      }
      .frame(width: CameraTokens.headerSideWidth, alignment: .topLeading)

      VStack(spacing: 2) {
        Text(event.name.uppercased())
          .font(Fonts.label())
          .tracking(1.6)
          .foregroundStyle(Theme.textMuted)
          .lineLimit(1)
        RollCounter(left: model.shotsLeft)
        // While a mission is armed the note below stands in for the capsule.
        if !model.missions.isEmpty, model.armedId == nil {
          MissionCapsule(
            done: model.missions.filter { $0.photoId != nil }.count,
            total: model.missions.count
          ) { missionList = true }
          .padding(.top, 6)
          .transition(.opacity)
        }
      }
      .frame(maxWidth: .infinity)

      // The countdown is the way to the film's developing state, as in the app.
      Button { model.showDeveloping() } label: {
        HStack(spacing: 2) {
          Countdown(endsAt: event.endsAt)
          Image(systemName: "chevron.right")
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(Theme.textMuted)
        }
        .padding(.vertical, 14)
        .contentShape(Rectangle())
      }
      .buttonStyle(PressScaleStyle())
      .padding(.top, CameraTokens.countdownTop - 14)
      .frame(width: CameraTokens.headerSideWidth, alignment: .trailing)
      .accessibilityLabel("See how the event is doing")
    }
  }

  // MARK: Flash · zoom · flip

  private var controls: some View {
    HStack {
      GlassControl(
        symbol: flash ? "bolt.fill" : "bolt.slash",
        tint: flash ? Theme.text : CameraTokens.flashOff,
        label: flash ? "Flash on" : "Flash off",
        tilt: tilt
      ) { flash.toggle() }
      .opacity(camera.hasFlash ? 1 : 0)
      .disabled(!camera.hasFlash)

      Spacer()
      if !camera.stops.isEmpty || !camera.liveZoom.isEmpty {
        ZoomSelector(camera: camera, tilt: tilt)
      }
      Spacer()

      GlassControl(symbol: "arrow.triangle.2.circlepath", tint: Theme.text, label: "Switch camera", tilt: tilt) {
        camera.flip()
      }
    }
    .padding(.horizontal, CameraTokens.controlsPaddingX)
    .padding(.bottom, CameraTokens.controlsPaddingBottom)
    .frame(height: CameraTokens.controlsHeight, alignment: .bottom)
  }

  // MARK: Shutter bar

  /// The shutter is centred on its own and the side items sit over it, so the
  /// upload count coming and going never moves it. (An empty `Group` is no
  /// view at all: its `.frame` vanished with the count and the shutter
  /// slid right.)
  private var bottomBar: some View {
    ZStack {
      Shutter(enabled: canShoot, action: shoot)
      HStack {
        LastShotTile(url: model.shots.last?.thumb, tilt: tilt) { yourShots = true }
        Spacer(minLength: 0)
        let pending = model.shots.filter(\.queued).count
        if pending > 0 {
          HStack(spacing: 5) {
            Image(systemName: "icloud.and.arrow.up").font(.system(size: 13))
            Text("\(pending)").font(Fonts.medium(13)).monospacedDigit()
          }
          .foregroundStyle(CameraTokens.queueColor)
          .accessibilityElement(children: .combine)
          .accessibilityLabel(pending == 1 ? "1 photo uploading" : "\(pending) photos uploading")
        }
      }
    }
    .frame(maxWidth: .infinity)
    .padding(.horizontal, CameraTokens.bottomPaddingX)
    .padding(.top, CameraTokens.bottomPaddingTop)
    .padding(.bottom, CameraTokens.bottomPaddingBottom)
  }

  // MARK: Taking a photo

  /// Shutter, haptic and blackout on the same frame; then the white screen for
  /// a front flash, the capture, the develop and the queue.
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
      closeShutter()
      camera.capture(flash: flash) { result in
        whiteScreen = false
        capturing = false
        if lastShot { UINotificationFeedbackGenerator().notificationOccurred(.success) }
        switch result {
        case let .success(data):
          develop(data)
        case .failure:
          model.shotQueued(nil)
          error = "That one didn’t save. Try again."
        }
      }
    }
  }

  /// `Camera.blackout`: closed for 70 ms, open over 240 ms; a dip under reduced motion.
  private func closeShutter() {
    blackout = true
    withAnimation(.easeOut(duration: 0.24).delay(0.07)) { blackout = false }
  }

  private func develop(_ data: Data) {
    let event = self.event
    let model = self.model
    let errorText = $error
    let takenAt = timestampString(Date())
    let aspect: CGFloat? = frameSize.width > 0 && frameSize.height > 0 ? frameSize.width / frameSize.height : nil
    // The armed mission goes with this frame; the next one is for none.
    let missionId = model.armedId
    model.arm(nil)
    Task.detached(priority: .userInitiated) {
      do {
        guard let userId = await Server.shared.userId else { throw ClipError.notConfigured }
        let photo = try await Developer.shared.develop(data, look: event.look, cropAspect: aspect)
        let shot = QueuedShot(
          id: UUID().uuidString.lowercased(), eventId: event.id, userId: userId, takenAt: takenAt,
          width: photo.width, height: photo.height, claimed: false, uploaded: false,
          missionId: missionId, missionDirty: missionId == nil ? nil : true, tagAttempts: nil,
          blurhash: photo.blurhash
        )
        let count = try await UploadQueue.shared.enqueue(shot, photo: photo)
        await MainActor.run { model.shotQueued(count) }
      } catch {
        await MainActor.run {
          model.shotQueued(nil)
          errorText.wrappedValue = "That one didn’t save. Try again."
        }
      }
    }
  }
}

// MARK: Pieces

/// "17 left" — the numeral warms over the last three, as a film counter's last frames do.
private struct RollCounter: View {
  let left: Int?

  var body: some View {
    let low = (left ?? .max) <= CameraTokens.counterLowAt
    HStack(alignment: .firstTextBaseline, spacing: 6) {
      Text(left.map { "\($0)" } ?? "∞")
        .font(Fonts.numeral(34))
        .foregroundStyle(low ? CameraTokens.counterLow : Theme.text)
        .contentTransition(.numericText())
        .animation(.spring(response: 0.3, dampingFraction: 1), value: left)
      Text("left")
        .font(Fonts.body(14))
        .foregroundStyle(CameraTokens.counterSuffix)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(left.map { $0 == 1 ? "1 photo left" : "\($0) photos left" } ?? "Unlimited photos")
  }
}

/// "01 d 23 h" — two units, ticking once a minute (`EventCountdown`).
private struct Countdown: View {
  let endsAt: Date

  var body: some View {
    TimelineView(.periodic(from: .now, by: 60)) { context in
      let parts = countdownParts(to: endsAt, now: context.date)
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        ForEach(Array(parts.enumerated()), id: \.offset) { index, part in
          HStack(alignment: .firstTextBaseline, spacing: 2) {
            Text(part.value)
              .font(Fonts.numeral(16))
              .foregroundStyle(CameraTokens.countdownValue[index])
            Text(part.unit.uppercased())
              .font(Fonts.medium(9))
              .foregroundStyle(CameraTokens.countdownUnit[index])
          }
        }
      }
      .monospacedDigit()
      .accessibilityElement(children: .ignore)
      .accessibilityLabel("\(parts[0].value) \(parts[0].unit), \(parts[1].value) \(parts[1].unit) left to shoot")
    }
  }
}

/// The glass segment group between flash and flip: the phone's lenses, or —
/// after a pinch — one lit pill with the live zoom; a tap on it goes back to 1×.
private struct ZoomSelector: View {
  @ObservedObject var camera: CameraController
  let tilt: Angle

  var body: some View {
    HStack(spacing: CameraTokens.zoomGap) {
      if !camera.liveZoom.isEmpty, camera.selectedStop.isEmpty {
        pill(camera.liveZoom, selected: true, label: "Zoom \(camera.liveZoom). Back to 1×") {
          camera.resetZoom()
        }
        .transition(.opacity)
      } else {
        ForEach(camera.stops) { stop in
          pill(stop.label, selected: stop.label == camera.selectedStop, label: "Zoom \(stop.label)") {
            camera.select(stop)
          }
          .transition(.opacity)
        }
      }
    }
    .padding(.vertical, CameraTokens.zoomPaddingY)
    .padding(.horizontal, CameraTokens.zoomPaddingX)
    .glass(Capsule())
    .animation(.easeInOut(duration: 0.2), value: camera.liveZoom.isEmpty)
  }

  private func pill(_ text: String, selected: Bool, label: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Text(text)
        .font(Fonts.medium(CameraTokens.zoomFontSize))
        .monospacedDigit()
        .rotationEffect(tilt)
        .foregroundStyle(selected ? Theme.text : CameraTokens.zoomText)
        .frame(minWidth: CameraTokens.zoomPillMinWidth, minHeight: CameraTokens.zoomPillHeight)
        .background(selected ? CameraTokens.zoomSelectedBg : .clear, in: Capsule())
        .animation(.easeInOut(duration: 0.2), value: selected)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(label)
    .accessibilityAddTraits(selected ? .isSelected : [])
  }
}

/// Flash and flip: round glass buttons over the frame (`GlassButton`, 44 pt).
private struct GlassControl: View {
  let symbol: String
  let tint: Color
  let label: String
  let tilt: Angle
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Image(systemName: symbol)
        .font(.system(size: 17, weight: .regular))
        .foregroundStyle(tint)
        .rotationEffect(tilt)
        .frame(width: CameraTokens.controlSize, height: CameraTokens.controlSize)
        .glass(Circle(), interactive: true)
    }
    .buttonStyle(PressScaleStyle(scale: 0.9))
    .accessibilityLabel(label)
  }
}

/// The last photo taken; opens Your photos.
private struct LastShotTile: View {
  let url: URL?
  let tilt: Angle
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      ZStack {
        if let url, url.isFileURL, let image = UIImage(contentsOfFile: url.path) {
          Image(uiImage: image).resizable().scaledToFill()
        } else if let url {
          AsyncImage(url: url) { phase in
            phase.image?.resizable().scaledToFill()
          }
        } else {
          Image(systemName: "photo")
            .font(.system(size: 18))
            .foregroundStyle(CameraTokens.tileIcon)
        }
      }
      .frame(width: CameraTokens.tileSize, height: CameraTokens.tileSize)
      .rotationEffect(tilt)
      .glass(RoundedRectangle(cornerRadius: CameraTokens.tileRadius, style: .continuous), interactive: true)
      .clipShape(RoundedRectangle(cornerRadius: CameraTokens.tileRadius, style: .continuous))
    }
    .buttonStyle(PressScaleStyle(scale: 0.92))
    .accessibilityLabel("Your photos")
    .accessibilityHint("Shows the photos you have taken")
  }
}

/// The shutter: a cream disc in a ring. Cream, not red — nothing is recording.
private struct Shutter: View {
  let enabled: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Circle()
        .fill(Theme.text)
        .frame(width: CameraTokens.shutterDisc, height: CameraTokens.shutterDisc)
        .frame(width: CameraTokens.shutterSize, height: CameraTokens.shutterSize)
        .overlay(Circle().stroke(CameraTokens.shutterRingColor, lineWidth: CameraTokens.shutterRing))
    }
    .buttonStyle(PressScaleStyle(scale: CameraTokens.shutterPressed))
    .opacity(enabled ? 1 : 0.3)
    .disabled(!enabled)
    .accessibilityLabel("Take photo")
  }
}
