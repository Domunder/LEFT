import CoreImage
import Metal
import MetalKit
import SwiftUI
import UIKit

/*
  The event image (2026-11-21) — the clip's copy of `mobile/src/lib/event-cover.ts`.

  `events.cover`:
    nil         no choice → a stock picture seeded by the event id
    "sample-N"  one of the six stock pictures (`Samples/sample-N.jpg`, the
                app's `assets/images/samples/`)
    "upload"    the host's own photo at `photos/{event_id}/cover.jpg`, which
                any member may read at any time (its own storage policy)

  Drawn through the moment's look with the clip's Metal `LookRenderer` — the
  same shader as the prints, grain included, as the app's `LookPreview` draws
  it. Until an uploaded cover is fetched (or when it cannot be), the seeded
  stock picture stands in, as in the app.
*/
enum EventCover {
  /// `SAMPLE_PHOTOS.length` in `constants/samples.ts`.
  static let sampleCount = 6

  /// `samplesFor(seed, count)` in `constants/samples.ts`, as 0-based indices:
  /// the same hash, so the clip picks the app's pictures for an event.
  static func sampleIndices(seed: String, count: Int) -> [Int] {
    var hash: UInt32 = 0
    // JS: `(hash * 31 + charCodeAt(i)) >>> 0` — UTF-16 units, wrapping at 2^32.
    for unit in seed.utf16 { hash = hash &* 31 &+ UInt32(unit) }
    // JS adds `i` to the uint32 without wrapping: do it in 64 bits.
    return (0..<count).map { Int((UInt64(hash) + UInt64($0)) % UInt64(sampleCount)) }
  }

  /// The stock picture's number (1…6) the event shows: its `sample-N`, or
  /// the seeded default (also the stand-in for an upload).
  static func sampleNumber(for event: EventInfo) -> Int {
    if let cover = event.cover, cover.hasPrefix("sample-"),
       let n = Int(cover.dropFirst("sample-".count)),
       (1...sampleCount).contains(n), cover == "sample-\(n)" {
      return n
    }
    return sampleIndices(seed: event.id, count: 1)[0] + 1
  }

  /// A bundled stock picture. Flattened into the bundle like `Fonts/`; the
  /// subfolder is the fallback should the group be a folder reference.
  static func sampleURL(_ number: Int) -> URL? {
    let name = "sample-\(number)"
    return Bundle.main.url(forResource: name, withExtension: "jpg")
      ?? Bundle.main.url(forResource: name, withExtension: "jpg", subdirectory: "Samples")
  }

  /// `coverPath()` in the app.
  static func path(eventId: String) -> String { "\(eventId)/cover.jpg" }

  /// The host's uploaded cover, through a signed URL; nil on any failure.
  static func uploadedData(eventId: String) async -> Data? {
    let file = path(eventId: eventId)
    guard let urls = try? await Server.shared.signedURLs([file]), let url = urls[file] else { return nil }
    guard let result = try? await URLSession.shared.data(from: url),
          (result.1 as? HTTPURLResponse)?.statusCode == 200, !result.0.isEmpty
    else { return nil }
    return result.0
  }
}

/// A still picture drawn through a look, cached by key so 12 and the intro do
/// not render (or download) it twice. One render at a time, off the main thread.
actor LookStill {
  static let shared = LookStill()

  private let context = CIContext(options: [.cacheIntermediates: false])
  private var cache: [String: UIImage] = [:]

  func cached(_ key: String) -> UIImage? { cache[key] }

  /// A bundled stock picture through `look`.
  func sample(_ number: Int, look: FilmLook) -> UIImage? {
    let key = "sample-\(number)|\(look.rawValue)"
    if let hit = cache[key] { return hit }
    guard let url = EventCover.sampleURL(number), let data = try? Data(contentsOf: url) else { return nil }
    return render(data, look: look, key: key)
  }

  /// Any JPEG through `look`; nil when it cannot be read or drawn.
  func render(_ data: Data, look: FilmLook, key: String) -> UIImage? {
    if let hit = cache[key] { return hit }
    guard let image = try? draw(data, look: look) else { return nil }
    cache[key] = image
    return image
  }

  /// `Developer.develop()`'s path at screen size: oriented, long edge at most
  /// `maxEdge`, one pass of the look, read back. No crop, no JPEG.
  private func draw(_ data: Data, look: FilmLook, maxEdge: CGFloat = 1080) throws -> UIImage {
    guard let renderer = LookRenderer.shared else { throw DevelopError.render }
    guard var image = CIImage(data: data, options: [.applyOrientationProperty: true]) else {
      throw DevelopError.unreadable
    }
    let extent = image.extent
    image = image.transformed(by: CGAffineTransform(translationX: -extent.minX, y: -extent.minY))
    let scale = min(1, maxEdge / max(extent.width, extent.height))
    let rect = CGRect(x: 0, y: 0, width: (extent.width * scale).rounded(), height: (extent.height * scale).rounded())
    if scale < 1 {
      image = image.clampedToExtent().applyingFilter("CILanczosScaleTransform", parameters: [
        kCIInputScaleKey: scale,
        kCIInputAspectRatioKey: 1,
      ])
    }
    guard rect.width >= 1, rect.height >= 1,
          let cgSource = context.createCGImage(image, from: rect, format: .RGBA8,
                                               colorSpace: CGColorSpace(name: CGColorSpace.sRGB))
    else { throw DevelopError.render }
    let width = cgSource.width
    let height = cgSource.height

    let loader = MTKTextureLoader(device: renderer.device)
    let source = try loader.newTexture(cgImage: cgSource, options: [
      .SRGB: false,
      .textureUsage: MTLTextureUsage.shaderRead.rawValue,
      .textureStorageMode: MTLStorageMode.private.rawValue,
    ])
    let descriptor = MTLTextureDescriptor.texture2DDescriptor(
      pixelFormat: .rgba8Unorm, width: width, height: height, mipmapped: false
    )
    descriptor.usage = [.renderTarget, .shaderRead]
    descriptor.storageMode = .shared
    guard let target = renderer.device.makeTexture(descriptor: descriptor),
          let buffer = renderer.queue.makeCommandBuffer()
    else { throw DevelopError.render }

    renderer.encode(buffer, source: source, target: target,
                    uniforms: LookUniforms(look: look, width: width, height: height))
    buffer.commit()
    buffer.waitUntilCompleted()
    if buffer.status != .completed { throw DevelopError.render }

    let rowBytes = width * 4
    var pixels = Data(count: rowBytes * height)
    pixels.withUnsafeMutableBytes { raw in
      target.getBytes(raw.baseAddress!, bytesPerRow: rowBytes,
                      from: MTLRegionMake2D(0, 0, width, height), mipmapLevel: 0)
    }
    guard let provider = CGDataProvider(data: pixels as CFData),
          let drawn = CGImage(
            width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: rowBytes,
            space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
            provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent
          )
    else { throw DevelopError.render }
    return UIImage(cgImage: drawn)
  }
}

/// The event image in the moment's look, aspect-filled into whatever frame
/// it is given. Fades in once drawn; nothing (the page) before.
struct CoverImage: View {
  let event: EventInfo
  @State private var image: UIImage?

  private var key: String { "\(event.id)|\(event.cover ?? "-")|\(event.look.rawValue)" }

  var body: some View {
    GeometryReader { geo in
      if let image {
        Image(uiImage: image)
          .resizable()
          .scaledToFill()
          .frame(width: geo.size.width, height: geo.size.height)
          .clipped()
          .transition(.opacity)
      }
    }
    .animation(.easeOut(duration: 0.35), value: image)
    .task(id: key) { await load() }
    .accessibilityHidden(true)
  }

  private func load() async {
    let event = self.event
    let look = event.look
    let stillKey = "upload|\(event.id)|\(look.rawValue)"
    if event.cover == "upload", let hit = await LookStill.shared.cached(stillKey) {
      image = hit
      return
    }
    // The stock picture first: the choice itself, or the stand-in for an upload.
    if let sample = await LookStill.shared.sample(EventCover.sampleNumber(for: event), look: look) {
      image = sample
    }
    guard event.cover == "upload", let data = await EventCover.uploadedData(eventId: event.id),
          !Task.isCancelled,
          let uploaded = await LookStill.shared.render(data, look: look, key: stillKey)
    else { return }
    image = uploaded
  }
}

/// A plain stock picture (no look) — the others' hidden prints on the intro.
func samplePicture(_ number: Int) -> UIImage? {
  EventCover.sampleURL(number).flatMap { UIImage(contentsOfFile: $0.path) }
}

/// The invite as a QR code: black modules on white, sharp at any size
/// (draw with `.interpolation(.none)`). The app's 09 encodes the same URL.
enum InviteQR {
  static func url(code: String) -> URL? { URL(string: "https://leftmoment.com/j/\(code)") }

  static func image(for text: String) -> UIImage? {
    guard let filter = CIFilter(name: "CIQRCodeGenerator") else { return nil }
    filter.setValue(Data(text.utf8), forKey: "inputMessage")
    filter.setValue("M", forKey: "inputCorrectionLevel")
    guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 12, y: 12)),
          let cg = CIContext().createCGImage(output, from: output.extent)
    else { return nil }
    return UIImage(cgImage: cg)
  }
}
