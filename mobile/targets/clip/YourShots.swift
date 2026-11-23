import ImageIO
import SwiftUI
import UIKit

/*
  Your photos in the clip (2026-11-18; restyled to the app's `(capture)/roll`
  later the same day: a full screen with a back button, "Your photos.", the count, a
  contact sheet newest first) — the guest's own frames, from the tile left of
  the shutter. Others' stay hidden until the film is developed; that is RLS,
  nothing here can widen it.

  A tap opens `PhotoViewer` below — the app's `PhotoViewer` in SwiftUI
  (2026-11-19, the user: "exactly like the app"): full screen, swipe sideways,
  pinch and double-tap to zoom, drag down to close, a tap hides the chrome.
  It opens from its tile and returns to the current photo's tile.
*/
struct YourShotsSheet: View {
  let event: EventInfo
  @EnvironmentObject private var model: ClipModel
  @Environment(\.dismiss) private var dismiss
  @State private var open: ShotItem?
  @Namespace private var zoom

  private let columns = Array(repeating: GridItem(.flexible(), spacing: 3), count: 3)

  var body: some View {
    let count = model.shots.count
    VStack(alignment: .leading, spacing: 0) {
      // The app's `(capture)/roll`: back to the camera, "Your photos.", a contact sheet.
      Button { dismiss() } label: {
        Image(systemName: "chevron.left")
          .font(.system(size: 16, weight: .medium))
          .foregroundStyle(Theme.text)
          .frame(width: 44, height: 44)
          .background(Theme.field, in: Circle())
          .overlay(Circle().stroke(Theme.hairline, lineWidth: 1))
      }
      .buttonStyle(PressScaleStyle())
      .accessibilityLabel("Back to the camera")
      .padding(.horizontal, Theme.gutter)
      .padding(.top, 16)

      VStack(alignment: .leading, spacing: 6) {
        Headline(plain: "Your ", emphasis: "photos.", size: 34)
        Text(count == 0
          ? "Only you can see these until the film is developed."
          : "\(count) so far. Only you can see these until the film is developed.")
          .font(Fonts.body(14))
          .foregroundStyle(Theme.textMuted)
      }
      .padding(.horizontal, Theme.gutter)
      .padding(.vertical, 20)

      if model.shots.isEmpty {
        Text("Nothing yet. Your photos show up here as you take them.")
          .font(Fonts.body(14))
          .foregroundStyle(Theme.textMuted)
          .multilineTextAlignment(.center)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .padding(.horizontal, Theme.gutter)
      } else {
        ScrollView {
          LazyVGrid(columns: columns, spacing: 3) {
            ForEach(Array(model.shots.reversed().enumerated()), id: \.element.id) { index, shot in
              let mission = model.mission(for: shot.id)
              Button { open = shot } label: {
                Color(hex: 0x141316)
                  .aspectRatio(3 / 4, contentMode: .fit)
                  .overlay { ShotImage(url: shot.thumb).scaledToFill() }
                  .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                  .overlay(alignment: .topTrailing) {
                    if mission != nil {
                      Image(systemName: "scope")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.text)
                        .frame(width: 22, height: 22)
                        .background(Theme.badgeScrim, in: Circle())
                        .padding(6)
                    }
                  }
              }
              .buttonStyle(PressScaleStyle(scale: 0.97))
              .zoomSource(id: shot.id, in: zoom)
              .accessibilityLabel("Photo \(index + 1) of \(count)" + (mission.map { ", for the mission: \($0.body)" } ?? ""))
            }
          }
          .padding(.bottom, 24)
        }
      }
    }
    .background(Theme.bg.ignoresSafeArea())
    // A swipe in from the left edge goes back to the camera, which shows
    // through behind the sliding page (2026-11-19, the user).
    .modifier(EdgeSwipeBack(slideOut: true) { dismiss() })
    .presentationBackground(.clear)
    .task { await model.loadShots() }
    .fullScreenCover(item: $open) { shot in
      PhotoViewer(start: shot.id, event: event, zoom: zoom)
        .environmentObject(model)
    }
  }
}

// MARK: - The viewer

/// The app's `Viewer` tokens.
private enum ViewerTokens {
  static let backdrop = Color(hex: 0x050506)
  static let maxZoom: CGFloat = 4
  static let doubleTapZoom: CGFloat = 2.5
  /// Pages are this far apart while swiping.
  static let pageGap: CGFloat = 16
  /// Drag down past this (projected) and the viewer closes. iOS 17 only:
  /// from iOS 18 the zoom transition's own drag does it.
  static let dismissDistance: CGFloat = 140
  static let dismissMinScale: CGFloat = 0.72
  static let chromeInset: CGFloat = 12
  static let chromeGap: CGFloat = 10
  static let fadeMs: Double = 0.18
}

/// The frames full screen, newest first like the grid. Chrome floats as glass
/// over the photo, as in the app: ✕ and "3 / 12" at the top, "Mission · …"
/// and the "Mission" button at the bottom. Also opened from the gallery before
/// the reveal (`GalleryView`), on the guest's own photos, and from the album
/// of a developed moment (`AlbumView`) with `items`: everyone's photos, in the
/// order given, each with its photographer's name (`authors`).
struct PhotoViewer: View {
  let event: EventInfo
  let zoom: Namespace.ID
  /// nil: the guest's own frames, newest first, live from the model.
  let items: [ShotItem]?
  /// Photo id → who took it; empty for the guest's own.
  let authors: [String: String]
  @EnvironmentObject private var model: ClipModel
  @Environment(\.dismiss) private var dismiss
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var current: String
  @State private var picking = false
  @State private var chrome = true
  /// The shown page is zoomed in: its scroll view pans, nothing else drags.
  @State private var zoomed = false
  /// iOS 17's drag down to close.
  @State private var drag: CGSize = .zero

  init(start: String, event: EventInfo, zoom: Namespace.ID,
       items: [ShotItem]? = nil, authors: [String: String] = [:]) {
    self.event = event
    self.zoom = zoom
    self.items = items
    self.authors = authors
    _current = State(initialValue: start)
  }

  private var canTag: Bool { items == nil && !model.missions.isEmpty && !event.isDeveloped() }
  private var shots: [ShotItem] {
    if let items { return items }
    return model.shots.reversed()
  }
  private var index: Int { shots.firstIndex { $0.id == current } ?? 0 }
  /// 0…1 while dragged down: the backdrop and chrome fade with it.
  private var dragProgress: CGFloat { min(1, max(0, drag.height) / 400) }

  var body: some View {
    let shot = shots.first { $0.id == current }
    ZStack {
      ViewerTokens.backdrop
        .opacity(1 - dragProgress)
        .ignoresSafeArea()

      TabView(selection: $current) {
        ForEach(shots) { item in
          ZoomablePhoto(
            thumb: item.thumb,
            full: item.full,
            onTap: { withAnimation(.easeInOut(duration: ViewerTokens.fadeMs)) { chrome.toggle() } },
            onZoomChange: { if item.id == current { zoomed = $0 } }
          )
          .padding(.horizontal, ViewerTokens.pageGap / 2)
          .tag(item.id)
        }
      }
      .tabViewStyle(.page(indexDisplayMode: .never))
      .padding(.horizontal, -ViewerTokens.pageGap / 2)
      .ignoresSafeArea()
      .offset(drag)
      .scaleEffect(1 - (1 - ViewerTokens.dismissMinScale) * dragProgress)
      .modifier(DragToClose(enabled: !zoomed, drag: $drag, reduceMotion: reduceMotion) { dismiss() })
      .onChange(of: current) { _, _ in zoomed = false }
      .accessibilityElement(children: .contain)
      .accessibilityLabel("Photo \(index + 1) of \(shots.count)")
      .accessibilityAdjustableAction { direction in
        let next = direction == .increment ? index + 1 : index - 1
        if shots.indices.contains(next) { current = shots[next].id }
      }

      VStack(spacing: 0) {
        topBar
        Spacer(minLength: 0)
        if let shot { bottomBar(shot) }
      }
      .opacity((chrome ? 1 : 0) * (1 - dragProgress))
      .allowsHitTesting(chrome)
    }
    .statusBarHidden(!chrome)
    // In from the left edge: back to the grid, like the system's back swipe.
    .modifier(EdgeSwipeBack(slideOut: false) { dismiss() })
    .zoomDestination(id: current, in: zoom)
    .sheet(isPresented: $picking) {
      MissionPicker(photoId: current) { picking = false }
        .environmentObject(model)
    }
  }

  private var topBar: some View {
    HStack {
      Button { dismiss() } label: {
        Image(systemName: "xmark")
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(Theme.text)
          .frame(width: 44, height: 44)
          .glass(Circle(), interactive: true)
      }
      .buttonStyle(PressScaleStyle())
      .accessibilityLabel("Close photo")

      Spacer(minLength: 0)
      Text("\(index + 1) / \(shots.count)")
        .font(Fonts.medium(14))
        .monospacedDigit()
        .foregroundStyle(Theme.text)
        .padding(.horizontal, 14)
        .frame(height: 36)
        .glass(Capsule())
        .accessibilityLabel("Photo \(index + 1) of \(shots.count)")
      Spacer(minLength: 0)
      // Balances the close button so the counter stays centred.
      Color.clear.frame(width: 44, height: 44)
    }
    .padding(.horizontal, ViewerTokens.chromeInset)
    .padding(.top, ViewerTokens.chromeInset)
  }

  @ViewBuilder private func bottomBar(_ shot: ShotItem) -> some View {
    let mission = model.mission(for: shot.id)
    VStack(spacing: ViewerTokens.chromeGap) {
      if let author = authors[shot.id] {
        Text(author)
          .font(Fonts.medium(14))
          .foregroundStyle(Theme.text)
          .lineLimit(1)
          .padding(.horizontal, 14)
          .frame(height: 36)
          .glass(Capsule())
          .accessibilityLabel("Photo by \(author)")
      }
      if let mission {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
          Image(systemName: "scope").font(.system(size: 12)).foregroundStyle(Theme.textMuted)
          (Text("Mission · ").foregroundStyle(Theme.textMuted) + Text(mission.body).foregroundStyle(Theme.text))
            .font(Fonts.body(14))
            .lineLimit(2)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 14)
        .glass(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Mission: \(mission.body)")
      }
      if canTag {
        Button { picking = true } label: {
          Label("Mission", systemImage: "scope")
            .font(Fonts.medium(15))
            .foregroundStyle(Theme.text)
            .padding(.horizontal, 18)
            .frame(height: 44)
            .glass(Capsule(), interactive: true)
        }
        .buttonStyle(PressScaleStyle())
        .accessibilityLabel(mission.map { "Mission: \($0.body). Change it." } ?? "Mark this photo for a mission")
      }
    }
    .padding(.horizontal, ViewerTokens.chromeInset)
    .padding(.bottom, ViewerTokens.chromeInset)
  }
}

// MARK: Open from the tile, return to it

extension View {
  /// A grid tile the viewer zooms out of (iOS 18+; a plain cover before).
  @ViewBuilder func zoomSource(id: String, in ns: Namespace.ID) -> some View {
    if #available(iOS 18.0, *) {
      matchedTransitionSource(id: id, in: ns)
    } else {
      self
    }
  }

  /// The viewer zooms from, and back into, the tile of the photo shown —
  /// the current one, so closing on another photo returns to *its* tile. From
  /// iOS 18 the transition also brings the system's drag down to close.
  @ViewBuilder func zoomDestination(id: String, in ns: Namespace.ID) -> some View {
    if #available(iOS 18.0, *) {
      navigationTransition(.zoom(sourceID: id, in: ns))
    } else {
      self
    }
  }
}

/// Drag down to close on iOS 17, where the zoom transition does not exist.
/// 1:1 with the finger, shrinking as it goes; let go past the distance (or
/// with a flick) and it closes, otherwise it springs back.
private struct DragToClose: ViewModifier {
  let enabled: Bool
  @Binding var drag: CGSize
  let reduceMotion: Bool
  let close: () -> Void

  @ViewBuilder func body(content: Content) -> some View {
    if #available(iOS 18.0, *) {
      content
    } else {
      content.simultaneousGesture(
        DragGesture(minimumDistance: 12)
          .onChanged { value in
            guard enabled, value.translation.height > abs(value.translation.width) || drag != .zero else { return }
            drag = value.translation
          }
          .onEnded { value in
            guard drag != .zero else { return }
            if value.predictedEndTranslation.height > ViewerTokens.dismissDistance {
              close()
            } else {
              withAnimation(reduceMotion ? .easeOut(duration: ViewerTokens.fadeMs) : .spring(response: 0.35, dampingFraction: 1)) {
                drag = .zero
              }
            }
          },
        including: enabled ? .all : .subviews
      )
    }
  }
}

/// The system's back swipe for a full-screen cover, which has none: a drag
/// that starts at the left edge moves the page with the finger; let go far
/// enough (or with a flick) and it goes back, otherwise it springs home.
/// `slideOut`: finish by sliding off to the right instead of the cover's own
/// close animation (the viewer keeps its zoom back into the tile).
private struct EdgeSwipeBack: ViewModifier {
  let slideOut: Bool
  let back: () -> Void
  @State private var dx: CGFloat = 0
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  private static let edge: CGFloat = 24
  private static let distance: CGFloat = 140

  func body(content: Content) -> some View {
    content
      .offset(x: dx)
      .overlay(alignment: .leading) {
        Color.clear
          .frame(width: Self.edge)
          .frame(maxHeight: .infinity)
          .contentShape(Rectangle())
          .gesture(
            DragGesture(minimumDistance: 8, coordinateSpace: .global)
              .onChanged { value in dx = max(0, value.translation.width) }
              .onEnded { value in
                guard value.predictedEndTranslation.width > Self.distance else {
                  withAnimation(reduceMotion ? .easeOut(duration: 0.18) : .spring(response: 0.35, dampingFraction: 1)) {
                    dx = 0
                  }
                  return
                }
                if slideOut {
                  let width = UIScreen.main.bounds.width
                  withAnimation(.easeOut(duration: 0.22)) {
                    dx = width
                  } completion: {
                    var quiet = Transaction()
                    quiet.disablesAnimations = true
                    withTransaction(quiet) { back() }
                  }
                } else {
                  back()
                }
              }
          )
          .accessibilityHidden(true)
      }
  }
}

// MARK: One page

/// A photo that pinches and double-taps like Photos: a `UIScrollView` zooms
/// it (1×–4×, double tap to 2.5× at the finger and back), a single tap —
/// once it is clear it is not a double — toggles the chrome. The thumbnail
/// shows first, the original replaces it once loaded.
private struct ZoomablePhoto: View {
  let thumb: URL?
  let full: URL?
  let onTap: () -> Void
  let onZoomChange: (Bool) -> Void
  @State private var image: UIImage?

  var body: some View {
    ZoomScroll(image: image, onTap: onTap, onZoomChange: onZoomChange)
      .task(id: full) {
        if image == nil, let thumb { image = await PhotoLoader.load(thumb) }
        if let full, let original = await PhotoLoader.load(full) { image = original }
      }
  }
}

enum PhotoLoader {
  /// A small copy for a grid tile, decoded at most `maxPixel` along its long
  /// edge — a full thumbnail per tile is too much memory for a whole album.
  static func thumbnail(_ url: URL, maxPixel: Int) async -> UIImage? {
    var data: Data?
    if url.isFileURL {
      data = await Task.detached { try? Data(contentsOf: url) }.value
    } else if let response = try? await URLSession.shared.data(from: url) {
      data = response.0
    }
    guard let data else { return nil }
    return await Task.detached { () -> UIImage? in
      let options: [CFString: Any] = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: maxPixel,
      ]
      guard let source = CGImageSourceCreateWithData(data as CFData, nil),
            let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
      else { return nil }
      return UIImage(cgImage: image)
    }.value
  }

  static func load(_ url: URL) async -> UIImage? {
    if url.isFileURL {
      return await Task.detached { UIImage(contentsOfFile: url.path) }.value
    }
    guard let response = try? await URLSession.shared.data(from: url) else { return nil }
    let data = response.0
    return await Task.detached { UIImage(data: data)?.preparingForDisplay() }.value
  }
}

private struct ZoomScroll: UIViewRepresentable {
  let image: UIImage?
  let onTap: () -> Void
  let onZoomChange: (Bool) -> Void

  func makeUIView(context: Context) -> ZoomScrollView {
    let view = ZoomScrollView()
    view.onTap = onTap
    view.onZoomChange = onZoomChange
    view.image = image
    return view
  }

  func updateUIView(_ view: ZoomScrollView, context: Context) {
    view.onTap = onTap
    view.onZoomChange = onZoomChange
    if view.image !== image { view.image = image }
  }
}

private final class ZoomScrollView: UIScrollView, UIScrollViewDelegate {
  var onTap: () -> Void = {}
  var onZoomChange: (Bool) -> Void = { _ in }
  private let imageView = UIImageView()
  private var wasZoomed = false
  private var laidOutFor: CGSize = .zero

  var image: UIImage? {
    didSet {
      imageView.image = image
      // A sharper copy of the same photo keeps the zoom; a first image lays out.
      if oldValue == nil || zoomScale <= minimumZoomScale { laidOutFor = .zero; setNeedsLayout() }
    }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    delegate = self
    minimumZoomScale = 1
    maximumZoomScale = ViewerTokens.maxZoom
    bouncesZoom = true
    showsVerticalScrollIndicator = false
    showsHorizontalScrollIndicator = false
    contentInsetAdjustmentBehavior = .never
    decelerationRate = .fast
    backgroundColor = .clear
    imageView.contentMode = .scaleAspectFit
    imageView.accessibilityIgnoresInvertColors = true
    addSubview(imageView)

    let double = UITapGestureRecognizer(target: self, action: #selector(doubleTapped(_:)))
    double.numberOfTapsRequired = 2
    addGestureRecognizer(double)
    let single = UITapGestureRecognizer(target: self, action: #selector(tapped))
    single.require(toFail: double)
    addGestureRecognizer(single)
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

  override func layoutSubviews() {
    super.layoutSubviews()
    guard bounds.size != laidOutFor, bounds.width > 0 else { return }
    laidOutFor = bounds.size
    setZoomScale(1, animated: false)
    imageView.frame = fittedFrame()
    contentSize = imageView.frame.size
    centerContent()
  }

  /// The photo at its aspect, fitted into the page (a frame without an image
  /// is 3:4, like the viewfinder).
  private func fittedFrame() -> CGRect {
    let size = image?.size ?? CGSize(width: 3, height: 4)
    let scale = min(bounds.width / size.width, bounds.height / size.height)
    return CGRect(origin: .zero, size: CGSize(width: size.width * scale, height: size.height * scale))
  }

  private func centerContent() {
    let x = max(0, (bounds.width - contentSize.width) / 2)
    let y = max(0, (bounds.height - contentSize.height) / 2)
    contentInset = UIEdgeInsets(top: y, left: x, bottom: y, right: x)
  }

  func viewForZooming(in scrollView: UIScrollView) -> UIView? { imageView }

  func scrollViewDidZoom(_ scrollView: UIScrollView) {
    centerContent()
    let zoomed = zoomScale > minimumZoomScale + 0.01
    if zoomed != wasZoomed {
      wasZoomed = zoomed
      onZoomChange(zoomed)
    }
  }

  @objc private func tapped() { onTap() }

  @objc private func doubleTapped(_ gesture: UITapGestureRecognizer) {
    if zoomScale > minimumZoomScale + 0.01 {
      setZoomScale(minimumZoomScale, animated: true)
      return
    }
    let point = gesture.location(in: imageView)
    let scale = ViewerTokens.doubleTapZoom
    let size = CGSize(width: bounds.width / scale, height: bounds.height / scale)
    zoom(to: CGRect(x: point.x - size.width / 2, y: point.y - size.height / 2, width: size.width, height: size.height), animated: true)
  }
}

/// A frame from a file (still queued) or a signed URL (uploaded).
private struct ShotImage: View {
  let url: URL?
  var placeholder = true

  var body: some View {
    if let url, url.isFileURL {
      if let image = UIImage(contentsOfFile: url.path) {
        Image(uiImage: image).resizable()
      } else {
        fallback
      }
    } else if let url {
      AsyncImage(url: url) { phase in
        if let image = phase.image {
          image.resizable()
        } else {
          fallback
        }
      }
    } else {
      fallback
    }
  }

  @ViewBuilder private var fallback: some View {
    if placeholder { Theme.field } else { Color.clear }
  }
}
