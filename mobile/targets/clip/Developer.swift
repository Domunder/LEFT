import CoreImage
import ImageIO
import Metal
import MetalKit
import UniformTypeIdentifiers

struct DevelopedPhoto {
  /// The print-capable original, look baked in. JPEG bytes.
  let original: Data
  /// The grid thumbnail, cut from the original so both carry the same look.
  let thumb: Data
  let width: Int
  let height: Int
}

enum DevelopError: Error {
  case unreadable
  case render
  case encode
}

/// `developPhoto()` in `lib/look-shader.ts`: bake a look into a captured frame.
///
/// The orientation the camera wrote is applied first, so the width and height
/// are what a viewer will see; the selfie is already mirrored by the capture
/// connection, as previewed. One frame at a time — a 12 MP develop holds a
/// few hundred megabytes for a moment.
actor Developer {
  static let shared = Developer()

  private let context = CIContext(options: [.cacheIntermediates: false])

  /// `cropAspect` is the viewfinder's width / height when the shutter fired:
  /// the print is centre-cropped to it, so it holds what the guest saw. Only a
  /// portrait capture is cropped — a sideways phone takes a landscape picture,
  /// which the portrait viewfinder never showed whole anyway.
  func develop(_ encoded: Data, look: FilmLook, cropAspect: CGFloat? = nil) throws -> DevelopedPhoto {
    guard let renderer = LookRenderer.shared else { throw DevelopError.render }
    guard var image = CIImage(data: encoded, options: [.applyOrientationProperty: true]) else {
      throw DevelopError.unreadable
    }

    var extent = image.extent
    if let aspect = cropAspect, aspect > 0, extent.height > extent.width {
      var w = extent.width, h = extent.height
      if aspect < w / h { w = (h * aspect).rounded() } else { h = (w / aspect).rounded() }
      extent = CGRect(x: extent.midX - w / 2, y: extent.midY - h / 2, width: w, height: h).integral
      image = image.cropped(to: extent)
    }

    // Fit the long edge to `PhotoOutput.longEdge`; never upscale.
    // Clamped first so the filter has pixels past the edge and the borders
    // do not fade to transparent; cropped back to the scaled size after.
    image = image.transformed(by: CGAffineTransform(translationX: -extent.minX, y: -extent.minY))
    let scale = min(1, CGFloat(PhotoOutput.longEdge) / max(extent.width, extent.height))
    let rect = CGRect(x: 0, y: 0, width: (extent.width * scale).rounded(), height: (extent.height * scale).rounded())
    if scale < 1 {
      image = image.clampedToExtent().applyingFilter("CILanczosScaleTransform", parameters: [
        kCIInputScaleKey: scale,
        kCIInputAspectRatioKey: 1,
      ])
    }
    guard let cgSource = context.createCGImage(image, from: rect, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)) else {
      throw DevelopError.render
    }
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

    // Read the print back and wrap it as a CGImage.
    let rowBytes = width * 4
    var pixels = Data(count: rowBytes * height)
    pixels.withUnsafeMutableBytes { raw in
      target.getBytes(raw.baseAddress!, bytesPerRow: rowBytes,
                      from: MTLRegionMake2D(0, 0, width, height), mipmapLevel: 0)
    }
    guard let provider = CGDataProvider(data: pixels as CFData),
          let developed = CGImage(
            width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: rowBytes,
            space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
            provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent
          )
    else { throw DevelopError.render }

    let original = try jpeg(developed, quality: PhotoOutput.quality)
    let thumb = try jpeg(scaled(developed, longEdge: PhotoOutput.thumbLongEdge), quality: PhotoOutput.thumbQuality)
    return DevelopedPhoto(original: original, thumb: thumb, width: width, height: height)
  }

  private func scaled(_ image: CGImage, longEdge: Int) throws -> CGImage {
    let scale = min(1, Double(longEdge) / Double(max(image.width, image.height)))
    let w = max(1, Int((Double(image.width) * scale).rounded()))
    let h = max(1, Int((Double(image.height) * scale).rounded()))
    guard let ctx = CGContext(
      data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
      space: CGColorSpace(name: CGColorSpace.sRGB)!,
      bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ) else { throw DevelopError.encode }
    ctx.interpolationQuality = .high
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
    guard let out = ctx.makeImage() else { throw DevelopError.encode }
    return out
  }

  private func jpeg(_ image: CGImage, quality: Double) throws -> Data {
    let data = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil) else {
      throw DevelopError.encode
    }
    CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
    guard CGImageDestinationFinalize(destination), data.length > 0 else { throw DevelopError.encode }
    return data as Data
  }
}
