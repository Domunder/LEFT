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
          message: "Point your camera at the host’s QR code, or open the link they sent you.",
          retry: demoAction,
          retryLabel: "Try the demo"
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

  /// The clip was opened without a link (2026-11-23: from TestFlight it sat on
  /// "Scan an invite" with nothing to tap): the demo is always there.
  private var demoAction: (@MainActor () -> Void)? {
    let model = self.model
    return { model.tryDemo() }
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

/// The developing state. Until the film is developed it is the gallery
/// before the reveal (`GalleryView`, 2026-11-23); once it is, the group's
/// album (`AlbumView`, the same day, replacing "the album is the full app's").
/// The clock decides the switch, to the second, as `is_event_developed()` does.
struct DevelopingScreen: View {
  let event: EventInfo
  @State private var showStore = false

  var body: some View {
    TimelineView(.periodic(from: .now, by: 1)) { context in
      if event.isDeveloped(now: context.date) {
        AlbumView(event: event, showStore: $showStore)
      } else {
        GalleryView(event: event, now: context.date, showStore: $showStore)
      }
    }
    .appStoreOverlay(isPresented: $showStore) {
      SKOverlay.AppClipConfiguration(position: .bottom)
    }
  }
}

/// The album of a developed moment (2026-11-23, the user): the event image
/// with the name and "N photos · M people", "Get LEFT" as the one glass
/// capsule, then every photo three to a row, oldest first, the photographer's
/// name small on each print. A tap opens the viewer Your photos uses. Looking
/// only — saving, sharing and moderation are the full app's.
private struct AlbumView: View {
  let event: EventInfo
  @Binding var showStore: Bool
  @EnvironmentObject private var model: ClipModel
  @State private var open: AlbumItem?
  @Namespace private var zoom

  private let columns = Array(
    repeating: GridItem(.flexible(), spacing: GalleryTokens.gap),
    count: GalleryTokens.columns
  )

  var body: some View {
    let items = model.album
    GeometryReader { geo in
      let full = geo.size.height + geo.safeAreaInsets.top + geo.safeAreaInsets.bottom
      let cover = (full * GalleryTokens.coverRatio).rounded()
      ZStack(alignment: .top) {
        // Behind the page, from the physical top edge; the grid slides over it.
        CoverImage(event: event)
          .frame(width: geo.size.width, height: cover)
          .overlay(LinearGradient(gradient: GalleryTokens.coverFade, startPoint: .top, endPoint: .bottom))
          .clipped()
          .offset(y: -geo.safeAreaInsets.top)
          .allowsHitTesting(false)

        ScrollView {
          VStack(alignment: .leading, spacing: 0) {
            header(count: items.count)
              .padding(.horizontal, Theme.gutter)
              .padding(.top, max(48, cover * GalleryTokens.titleAt - geo.safeAreaInsets.top))
            prints(items)
              .padding(.top, GalleryTokens.gridTop)
              .padding(.bottom, 24)
              .frame(maxWidth: .infinity)
              .background(Theme.bg)
          }
        }
        .scrollIndicators(.hidden)
      }
    }
    .task(id: event.id) {
      await model.loadAlbum()
    }
    .fullScreenCover(item: $open) { item in
      PhotoViewer(start: item.id, event: event, zoom: zoom,
                  items: model.album.map(\.shot), authors: model.albumAuthors)
        .environmentObject(model)
    }
  }

  // MARK: Header

  @ViewBuilder private func header(count: Int) -> some View {
    let people = model.albumPeople
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: AlbumTokens.demoGap) {
        Eyebrow(text: "Developed")
        if model.isDemo { DemoTag() }
      }
      Text(event.name)
        .font(Fonts.display(GalleryTokens.titleSize))
        .foregroundStyle(Theme.text)
        .fixedSize(horizontal: false, vertical: true)
        .padding(.top, 10)

      // Nothing to count: the page under it says why.
      if count > 0 {
        Text("\(count) \(count == 1 ? "photo" : "photos") · \(people) \(people == 1 ? "person" : "people")")
          .font(Fonts.medium(15))
          .monospacedDigit()
          .foregroundStyle(Theme.text)
          .padding(.top, GalleryTokens.countsTop)
      }

      Button { showStore = true } label: {
        HStack(spacing: AlbumTokens.capsuleGap) {
          Image(systemName: "arrow.down.circle")
            .font(.system(size: AlbumTokens.capsuleIcon, weight: .medium))
          Text("Get LEFT")
            .font(Fonts.medium(16))
        }
        .foregroundStyle(Theme.text)
        .padding(.horizontal, AlbumTokens.capsulePaddingX)
        .frame(height: AlbumTokens.capsuleHeight)
        .glass(Capsule(), interactive: true)
      }
      .buttonStyle(PressScaleStyle())
      .padding(.top, GalleryTokens.actionsTop)
      .accessibilityHint("Shows LEFT in the App Store")

      Text(model.isDemo
        ? "That was the demo. Get LEFT to start a moment of your own."
        : "Save and share in the app.")
        .font(Fonts.body(14))
        .foregroundStyle(Theme.textMuted)
        .fixedSize(horizontal: false, vertical: true)
        .padding(.top, AlbumTokens.noteTop)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  // MARK: Prints

  @ViewBuilder private func prints(_ items: [AlbumItem]) -> some View {
    if !items.isEmpty {
      LazyVGrid(columns: columns, spacing: GalleryTokens.gap) {
        ForEach(items) { item in
          printTile(item)
        }
      }
    } else if case let .failed(message) = model.albumState {
      VStack(spacing: AlbumTokens.stateGap) {
        Text(message)
          .font(Fonts.body(14))
          .foregroundStyle(Theme.textMuted)
          .multilineTextAlignment(.center)
        Button("Try again") { model.reloadAlbum() }
          .buttonStyle(PillButtonStyle(light: false))
          .frame(width: AlbumTokens.retryWidth)
      }
      .frame(maxWidth: .infinity)
      .padding(.horizontal, Theme.gutter)
      .padding(.top, AlbumTokens.stateTop)
    } else if model.albumState == .loading {
      ProgressView()
        .tint(Theme.textMuted)
        .frame(maxWidth: .infinity)
        .padding(.top, AlbumTokens.stateTop)
        .accessibilityLabel("Loading the photos")
    } else {
      Text("No photos were taken.")
        .font(Fonts.body(14))
        .foregroundStyle(Theme.textMuted)
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Theme.gutter)
        .padding(.top, AlbumTokens.stateTop)
    }
  }

  private func printTile(_ item: AlbumItem) -> some View {
    Button { open = item } label: {
      GalleryTokens.tileBg
        .aspectRatio(GalleryTokens.tileAspect, contentMode: .fit)
        .overlay { GalleryThumb(url: item.shot.thumb) }
        .overlay(alignment: .bottom) {
          ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: GalleryTokens.tileScrim, startPoint: .top, endPoint: .bottom)
              .frame(height: GalleryTokens.tileScrimHeight)
            Text(item.author)
              .font(Fonts.medium(GalleryTokens.tileNameSize))
              .foregroundStyle(GalleryTokens.tileName)
              .lineLimit(1)
              .padding(GalleryTokens.tilePadding)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .allowsHitTesting(false)
        }
        .clipShape(RoundedRectangle(cornerRadius: GalleryTokens.tileRadius, style: .continuous))
    }
    .buttonStyle(PressScaleStyle(scale: 0.97))
    .zoomSource(id: item.id, in: zoom)
    .accessibilityLabel("Photo by \(item.author)")
    .accessibilityHint("Opens the photo")
  }
}

/// The gallery before the reveal (2026-11-23, the user; the web camera's
/// `developing` view): the event image with the name and the countdown, how
/// many photos so far from how many people, then every photo of the film,
/// newest first — the guest's own sharp (a tap opens the viewer), everyone
/// else's as the blurhash their phone sent, with the photographer's name and
/// the time left. The files themselves stay behind RLS until the developing.
private struct GalleryView: View {
  let event: EventInfo
  let now: Date
  @Binding var showStore: Bool
  @EnvironmentObject private var model: ClipModel
  @State private var open: ShotItem?
  /// The host's "Develop now" asks first.
  @State private var confirmEnd = false
  @Namespace private var zoom

  private let columns = Array(
    repeating: GridItem(.flexible(), spacing: GalleryTokens.gap),
    count: GalleryTokens.columns
  )

  var body: some View {
    let tiles = model.galleryTiles
    GeometryReader { geo in
      let full = geo.size.height + geo.safeAreaInsets.top + geo.safeAreaInsets.bottom
      let cover = (full * GalleryTokens.coverRatio).rounded()
      ZStack(alignment: .top) {
        // Behind the page, from the physical top edge; the grid slides over it.
        CoverImage(event: event)
          .frame(width: geo.size.width, height: cover)
          .overlay(LinearGradient(gradient: GalleryTokens.coverFade, startPoint: .top, endPoint: .bottom))
          .clipped()
          .offset(y: -geo.safeAreaInsets.top)
          .allowsHitTesting(false)

        ScrollView {
          VStack(alignment: .leading, spacing: 0) {
            header(count: tiles.count)
              .padding(.horizontal, Theme.gutter)
              .padding(.top, max(48, cover * GalleryTokens.titleAt - geo.safeAreaInsets.top))
            grid(tiles)
              .padding(.top, GalleryTokens.gridTop)
              .padding(.bottom, 24)
              .frame(maxWidth: .infinity)
              .background(Theme.bg)
          }
        }
        .scrollIndicators(.hidden)
      }
    }
    .task(id: event.id) {
      await model.loadShots()
      await model.loadGallery()
    }
    .fullScreenCover(item: $open) { shot in
      PhotoViewer(start: shot.id, event: event, zoom: zoom)
        .environmentObject(model)
    }
    .alert("Develop now?", isPresented: $confirmEnd) {
      Button("Develop now") { model.developNow() }
      Button("Cancel", role: .cancel) {}
    } message: {
      Text("Everyone’s photos are revealed right away. This can’t be undone.")
    }
  }

  // MARK: Header

  @ViewBuilder private func header(count: Int) -> some View {
    let parts = galleryCountdownParts(to: event.endsAt, now: now)
    let people = model.galleryPeople
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: AlbumTokens.demoGap) {
        Eyebrow(text: "Developing")
        if model.isDemo { DemoTag() }
      }
      Text(event.name)
        .font(Fonts.display(GalleryTokens.titleSize))
        .foregroundStyle(Theme.text)
        .fixedSize(horizontal: false, vertical: true)
        .padding(.top, 10)

      HStack(alignment: .firstTextBaseline, spacing: GalleryTokens.countdownGap) {
        ForEach(Array(parts.enumerated()), id: \.offset) { _, part in
          HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text(part.value).font(Fonts.numeral(GalleryTokens.countdownSize)).foregroundStyle(Theme.text)
            Text(part.unit.uppercased())
              .font(Fonts.medium(GalleryTokens.countdownUnitSize))
              .foregroundStyle(Theme.textFaint)
          }
        }
      }
      .monospacedDigit()
      .lineLimit(1)
      .minimumScaleFactor(0.6)
      .padding(.top, 12)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(parts.map { "\($0.value) \($0.unit)" }.joined(separator: ", ") + " until the film is developed")

      // Nothing to count yet: the grid says so.
      if count > 0 {
        Text("\(count) \(count == 1 ? "photo" : "photos") so far from \(people) \(people == 1 ? "person" : "people")")
          .font(Fonts.medium(15))
          .monospacedDigit()
          .foregroundStyle(Theme.text)
          .padding(.top, GalleryTokens.countsTop)
      }

      VStack(spacing: GalleryTokens.actionsGap) {
        // As `backToCamera()` decides it: while the roll has shots left.
        if model.shotsLeft != 0 {
          Button("Back to the camera") { model.backToCamera() }
            .buttonStyle(PillButtonStyle())
        }
        Button("Get LEFT") { showStore = true }
          .buttonStyle(PillButtonStyle(light: model.shotsLeft == 0))
        // The host need not wait for the clock (`end_event()`); in a demo
        // that is the visitor.
        if model.isHost {
          Button { confirmEnd = true } label: {
            Text(model.ending ? "Developing…" : "Develop now")
              .font(Fonts.medium(16))
              .foregroundStyle(Theme.text)
              .frame(maxWidth: .infinity, minHeight: Theme.pillHeight)
              .glass(Capsule(), interactive: true)
          }
          .buttonStyle(PressScaleStyle(scale: 0.97))
          .disabled(model.ending)
          .accessibilityHint("Reveals everyone’s photos now")
        }
      }
      .padding(.top, GalleryTokens.actionsTop)

      if let failure = model.endError {
        Text(failure)
          .font(Fonts.body(14))
          .foregroundStyle(Theme.textMuted)
          .fixedSize(horizontal: false, vertical: true)
          .padding(.top, GalleryTokens.ledeTop)
      }

      Text(model.shotsLeft == 0
        ? "That was your last photo. Everyone else’s clear up when the film is developed."
        : "Only yours are sharp for now. Everyone else’s clear up when the film is developed.")
        .font(Fonts.body(14))
        .foregroundStyle(Theme.textMuted)
        .fixedSize(horizontal: false, vertical: true)
        .padding(.top, GalleryTokens.ledeTop)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  // MARK: Grid

  @ViewBuilder private func grid(_ tiles: [GalleryTile]) -> some View {
    if tiles.isEmpty {
      Text("No photos yet. The first one shows up here.")
        .font(Fonts.body(14))
        .foregroundStyle(Theme.textMuted)
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Theme.gutter)
        .padding(.top, 24)
    } else {
      let time = tileCountdown(to: event.endsAt, now: now)
      LazyVGrid(columns: columns, spacing: GalleryTokens.gap) {
        ForEach(tiles) { tile in
          switch tile.kind {
          case let .mine(shot):
            mineTile(shot)
          case let .theirs(blurhash, author, portrait):
            TheirTile(blurhash: blurhash, portrait: portrait, author: author, time: time)
          }
        }
      }
    }
  }

  private func mineTile(_ shot: ShotItem) -> some View {
    let mission = model.mission(for: shot.id)
    return Button { open = shot } label: {
      GalleryTokens.tileBg
        .aspectRatio(GalleryTokens.tileAspect, contentMode: .fit)
        .overlay { GalleryThumb(url: shot.thumb) }
        .clipShape(RoundedRectangle(cornerRadius: GalleryTokens.tileRadius, style: .continuous))
        .overlay(alignment: .topTrailing) {
          if mission != nil {
            Image(systemName: "scope")
              .font(.system(size: GalleryTokens.badgeIcon, weight: .semibold))
              .foregroundStyle(Theme.text)
              .frame(width: GalleryTokens.badgeSize, height: GalleryTokens.badgeSize)
              .background(Theme.badgeScrim, in: Circle())
              .padding(GalleryTokens.badgeInset)
          }
        }
    }
    .buttonStyle(PressScaleStyle(scale: 0.97))
    .zoomSource(id: shot.id, in: zoom)
    .accessibilityLabel("Your photo" + (mission.map { ", for the mission: \($0.body)" } ?? ""))
    .accessibilityHint("Opens the photo")
  }
}

/// Someone else's photo before the reveal: its smudge stretched to the tile
/// (a dark frame without one), the photographer's name and the time left.
/// Not tappable — there is nothing more to see yet.
private struct TheirTile: View {
  let blurhash: String?
  let portrait: Bool
  let author: String
  let time: String

  var body: some View {
    GalleryTokens.tileBg
      .aspectRatio(GalleryTokens.tileAspect, contentMode: .fit)
      .overlay {
        if let blurhash, let smudge = BlurhashCache.image(blurhash, portrait: portrait) {
          Image(uiImage: smudge)
            .resizable()
            .interpolation(.medium)
            .scaledToFill()
        }
      }
      .overlay(alignment: .bottom) {
        ZStack(alignment: .bottomLeading) {
          LinearGradient(colors: GalleryTokens.tileScrim, startPoint: .top, endPoint: .bottom)
            .frame(height: GalleryTokens.tileScrimHeight)
          VStack(alignment: .leading, spacing: 1) {
            Text(author)
              .font(Fonts.medium(GalleryTokens.tileNameSize))
              .foregroundStyle(GalleryTokens.tileName)
              .lineLimit(1)
            Text(time)
              .font(Fonts.body(GalleryTokens.tileTimeSize))
              .monospacedDigit()
              .foregroundStyle(GalleryTokens.tileTime)
              .lineLimit(1)
          }
          .padding(GalleryTokens.tilePadding)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      .clipShape(RoundedRectangle(cornerRadius: GalleryTokens.tileRadius, style: .continuous))
      .accessibilityElement(children: .ignore)
      .accessibilityLabel("A photo by \(author), hidden until the film is developed")
  }
}

/// A photo on a tile of the gallery or the album: a file while it is queued,
/// a signed URL once uploaded, decoded small. Loaded once into state (the gallery redraws every
/// second for its countdowns) and kept in a small cache across tiles.
private struct GalleryThumb: View {
  let url: URL?
  @State private var image: UIImage?

  var body: some View {
    ZStack {
      if let image {
        Image(uiImage: image)
          .resizable()
          .scaledToFill()
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .clipped()
    .task(id: url) {
      guard let url else { image = nil; return }
      if let hit = ThumbCache.images[url] { image = hit; return }
      guard let loaded = await PhotoLoader.thumbnail(url, maxPixel: GalleryTokens.thumbPixels) else { return }
      ThumbCache.store(loaded, for: url)
      image = loaded
    }
  }
}

@MainActor
private enum ThumbCache {
  static var images: [URL: UIImage] = [:]

  static func store(_ image: UIImage, for url: URL) {
    if images.count >= GalleryTokens.thumbCacheLimit { images.removeAll(keepingCapacity: true) }
    images[url] = image
  }
}

// MARK: Messages

struct MessageScreen: View {
  let eyebrow: String
  let plain: String
  let emphasis: String
  let message: String
  var retry: (@MainActor () -> Void)?
  var retryLabel = "Try again"

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
        Button(retryLabel, action: retry)
          .buttonStyle(PillButtonStyle())
          .padding(.bottom, 12)
      }
    }
    .padding(.horizontal, Theme.gutter)
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}
