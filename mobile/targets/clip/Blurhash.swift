import CoreGraphics
import Foundation
import UIKit

/*
  Blurhash (2026-11-23) — a port of the reference algorithm
  (github.com/woltapp/blurhash, MIT): a picture as ~30 characters of colour,
  no recognisable content. The gallery before the reveal shows everyone
  else's photos as these smudges (`20261123000000_gallery_before_develop.sql`).

  The device encodes its own thumbnail once, when the frame is developed, and
  hands the string over with `mark_photo_uploaded()`. The app decodes the same
  strings with expo-image and the web with the `blurhash` npm package, so the
  maths here must stay the reference's exactly: base 83, sRGB <-> linear, the
  DC component as 24-bit sRGB, the AC components quantised to 19 levels
  against the maximum value (itself quantised to 83 levels).
*/
enum Blurhash {
  private static let digits: [Character] =
    Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~")

  private static let digitValues: [Character: Int] = {
    var map: [Character: Int] = [:]
    for (index, digit) in digits.enumerated() { map[digit] = index }
    return map
  }()

  /// Enough pixels to read a smudge from: what a source is shrunk to first
  /// when it comes from a file (`UploadQueue`).
  static let sourceMaxPixels = 96

  /// `sRGBToLinear()` for every 8-bit value.
  private static let linearTable: [Double] = (0..<256).map { srgbToLinear($0) }

  // MARK: Encode

  /// The hash of `image`, drawn first at most `maxWidth` pixels wide (the
  /// transform does not need more). nil when it cannot be drawn — the caller
  /// sends no smudge rather than holding anything up.
  static func encode(_ image: CGImage, componentsX: Int = 4, componentsY: Int = 3, maxWidth: Int = 32) -> String? {
    guard image.width > 0, image.height > 0 else { return nil }
    let scale = min(1, Double(maxWidth) / Double(image.width))
    let width = max(1, Int((Double(image.width) * scale).rounded()))
    let height = max(1, Int((Double(image.height) * scale).rounded()))
    let rowBytes = width * 4
    var pixels = [UInt8](repeating: 0, count: rowBytes * height)
    let drawn: Bool = pixels.withUnsafeMutableBytes { raw -> Bool in
      guard let base = raw.baseAddress,
            let space = CGColorSpace(name: CGColorSpace.sRGB),
            let context = CGContext(
              data: base, width: width, height: height, bitsPerComponent: 8, bytesPerRow: rowBytes,
              space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
            )
      else { return false }
      context.interpolationQuality = .high
      context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    guard drawn else { return nil }
    return encode(rgba: pixels, width: width, height: height, componentsX: componentsX, componentsY: componentsY)
  }

  /// The reference `encode()` over tightly packed RGBA rows, top row first
  /// (alpha ignored).
  static func encode(rgba pixels: [UInt8], width: Int, height: Int, componentsX: Int, componentsY: Int) -> String? {
    guard (1...9).contains(componentsX), (1...9).contains(componentsY),
          width > 0, height > 0, pixels.count >= width * height * 4
    else { return nil }

    var factors: [(r: Double, g: Double, b: Double)] = []
    factors.reserveCapacity(componentsX * componentsY)
    let scale = 1 / Double(width * height)
    for y in 0..<componentsY {
      for x in 0..<componentsX {
        let normalisation: Double = (x == 0 && y == 0) ? 1 : 2
        var r = 0.0, g = 0.0, b = 0.0
        for j in 0..<height {
          let cosY = cos(Double.pi * Double(y) * Double(j) / Double(height))
          for i in 0..<width {
            let basis = normalisation * cos(Double.pi * Double(x) * Double(i) / Double(width)) * cosY
            let p = 4 * i + j * width * 4
            r += basis * linearTable[Int(pixels[p])]
            g += basis * linearTable[Int(pixels[p + 1])]
            b += basis * linearTable[Int(pixels[p + 2])]
          }
        }
        factors.append((r: r * scale, g: g * scale, b: b * scale))
      }
    }

    let dc = factors[0]
    let ac = factors.dropFirst()

    var hash = ""
    let sizeFlag = (componentsX - 1) + (componentsY - 1) * 9
    hash += encode83(sizeFlag, length: 1)

    let maximumValue: Double
    if !ac.isEmpty {
      let actualMaximumValue = ac.map { max(abs($0.r), abs($0.g), abs($0.b)) }.max() ?? 0
      let quantisedMaximumValue = Int(max(0, min(82, (actualMaximumValue * 166 - 0.5).rounded(.down))))
      maximumValue = Double(quantisedMaximumValue + 1) / 166
      hash += encode83(quantisedMaximumValue, length: 1)
    } else {
      maximumValue = 1
      hash += encode83(0, length: 1)
    }

    hash += encode83(encodeDC(dc), length: 4)
    for factor in ac {
      hash += encode83(encodeAC(factor, maximumValue: maximumValue), length: 2)
    }
    return hash
  }

  private static func encodeDC(_ value: (r: Double, g: Double, b: Double)) -> Int {
    (linearToSrgb(value.r) << 16) + (linearToSrgb(value.g) << 8) + linearToSrgb(value.b)
  }

  private static func encodeAC(_ value: (r: Double, g: Double, b: Double), maximumValue: Double) -> Int {
    func quantise(_ v: Double) -> Int {
      Int(max(0, min(18, (signPow(v / maximumValue, 0.5) * 9 + 9.5).rounded(.down))))
    }
    return quantise(value.r) * 19 * 19 + quantise(value.g) * 19 + quantise(value.b)
  }

  private static func encode83(_ value: Int, length: Int) -> String {
    var result = ""
    for i in 1...length {
      var divisor = 1
      for _ in 0..<(length - i) { divisor *= 83 }
      result.append(digits[(value / divisor) % 83])
    }
    return result
  }

  // MARK: Decode

  /// The hash as a `width` x `height` picture; nil for a malformed hash.
  /// `punch` > 1 strengthens the colours, as in the reference.
  static func decode(_ hash: String, width: Int, height: Int, punch: Double = 1) -> UIImage? {
    let chars = Array(hash)
    guard chars.count >= 6, width > 0, height > 0,
          let sizeFlag = decode83(chars[0..<1]),
          let quantisedMaximumValue = decode83(chars[1..<2])
    else { return nil }
    let numY = sizeFlag / 9 + 1
    let numX = sizeFlag % 9 + 1
    guard chars.count == 4 + 2 * numX * numY else { return nil }
    let maximumValue = Double(quantisedMaximumValue + 1) / 166

    var colors: [(r: Double, g: Double, b: Double)] = []
    colors.reserveCapacity(numX * numY)
    for i in 0..<(numX * numY) {
      if i == 0 {
        guard let value = decode83(chars[2..<6]) else { return nil }
        colors.append(decodeDC(value))
      } else {
        guard let value = decode83(chars[(4 + i * 2)..<(6 + i * 2)]) else { return nil }
        colors.append(decodeAC(value, maximumValue: maximumValue * punch))
      }
    }

    let rowBytes = width * 4
    var pixels = [UInt8](repeating: 255, count: rowBytes * height)
    for y in 0..<height {
      for x in 0..<width {
        var r = 0.0, g = 0.0, b = 0.0
        for j in 0..<numY {
          let cosY = cos(Double.pi * Double(y) * Double(j) / Double(height))
          for i in 0..<numX {
            let basis = cos(Double.pi * Double(x) * Double(i) / Double(width)) * cosY
            let color = colors[i + j * numX]
            r += color.r * basis
            g += color.g * basis
            b += color.b * basis
          }
        }
        let p = 4 * x + y * rowBytes
        pixels[p] = UInt8(linearToSrgb(r))
        pixels[p + 1] = UInt8(linearToSrgb(g))
        pixels[p + 2] = UInt8(linearToSrgb(b))
      }
    }

    guard let space = CGColorSpace(name: CGColorSpace.sRGB),
          let provider = CGDataProvider(data: Data(pixels) as CFData),
          let image = CGImage(
            width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: rowBytes,
            space: space, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
            provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent
          )
    else { return nil }
    return UIImage(cgImage: image)
  }

  private static func decodeDC(_ value: Int) -> (r: Double, g: Double, b: Double) {
    (r: linearTable[(value >> 16) & 255], g: linearTable[(value >> 8) & 255], b: linearTable[value & 255])
  }

  private static func decodeAC(_ value: Int, maximumValue: Double) -> (r: Double, g: Double, b: Double) {
    let quantR = value / (19 * 19)
    let quantG = (value / 19) % 19
    let quantB = value % 19
    return (
      r: signPow((Double(quantR) - 9) / 9, 2) * maximumValue,
      g: signPow((Double(quantG) - 9) / 9, 2) * maximumValue,
      b: signPow((Double(quantB) - 9) / 9, 2) * maximumValue
    )
  }

  private static func decode83(_ chars: ArraySlice<Character>) -> Int? {
    var value = 0
    for char in chars {
      guard let digit = digitValues[char] else { return nil }
      value = value * 83 + digit
    }
    return value
  }

  // MARK: Colour

  private static func srgbToLinear(_ value: Int) -> Double {
    let v = Double(value) / 255
    return v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4)
  }

  /// 0…255. `Int()` truncates, as the reference's `Math.trunc` / C cast does.
  private static func linearToSrgb(_ value: Double) -> Int {
    let v = max(0, min(1, value))
    if v <= 0.0031308 { return Int(v * 12.92 * 255 + 0.5) }
    return Int((1.055 * pow(v, 1 / 2.4) - 0.055) * 255 + 0.5)
  }

  private static func signPow(_ value: Double, _ exponent: Double) -> Double {
    let magnitude = pow(abs(value), exponent)
    return value < 0 ? -magnitude : magnitude
  }
}

/// Decoded smudges, so a tile that redraws every second (its countdown) does
/// not decode again. Tiny pictures; the gallery of one event fits easily.
@MainActor
enum BlurhashCache {
  private static var images: [String: UIImage] = [:]
  private static let limit = 600

  static func image(_ hash: String, portrait: Bool) -> UIImage? {
    let key = (portrait ? "p|" : "l|") + hash
    if let hit = images[key] { return hit }
    guard let image = portrait
      ? Blurhash.decode(hash, width: GalleryTokens.smudgeShort, height: GalleryTokens.smudgeLong)
      : Blurhash.decode(hash, width: GalleryTokens.smudgeLong, height: GalleryTokens.smudgeShort)
    else { return nil }
    if images.count >= limit { images.removeAll(keepingCapacity: true) }
    images[key] = image
    return image
  }
}
