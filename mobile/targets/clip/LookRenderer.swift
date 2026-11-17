import CoreGraphics
import CoreVideo
import Metal
import simd

/// What the shader is told. Generated values in `LooksGenerated.swift`.
struct LookRecipe {
  let saturation: Float
  let gain: SIMD3<Float>
  let contrast: Float
  let shadowTint: SIMD3<Float>
  let highlightTint: SIMD3<Float>
  let fade: Float
  let grain: Float
  let vignette: Float
}

/*
  The looks, in Metal — the clip's copy of `mobile/src/lib/look-shader.ts`.

  The fragment shader below is a line-for-line port of the app's SkSL (and of
  the web camera's WebGL in `web/src/shoot/look-gl.ts`); the uniforms come
  from the same recipes, generated from `constants/looks.ts`. Change a look's
  recipe and all three follow. **Change the shader's maths in one place and
  you must change it in the other two**, or a clip guest's prints stop
  matching the app's.

  Compiled from source when the clip first needs it (`makeLibrary(source:)`),
  so the target needs no Metal build settings. Two callers: the live
  viewfinder (no grain, as in the app) and `Developer`, which renders a
  captured frame at print size.

  The colour maths runs on the sRGB-encoded values, as Skia's runtime effects
  do: textures are loaded and rendered as plain `unorm`, never `_srgb`.
*/
private let SOURCE = """
#include <metal_stdlib>
using namespace metal;

struct Uniforms {
  float4 size;           // xy: output size in pixels, z: grain cells, w: fringe
  float4 crop;           // the source rectangle in texture space: x, y, w, h
  float4 gain;           // xyz: gain, w: saturation
  float4 shadowTint;     // xyz: shadow tint, w: contrast
  float4 highlightTint;  // xyz: highlight tint, w: fade
  float4 extra;          // x: grain, y: vignette
};

struct VOut {
  float4 position [[position]];
  float2 uv;
};

// One triangle over the whole target; uv (0,0) is the top-left, as Skia's xy.
vertex VOut look_vertex(uint vid [[vertex_id]]) {
  float2 p = float2((vid << 1) & 2, vid & 2);
  VOut out;
  out.position = float4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
  out.uv = p;
  return out;
}

constant float3 LUMA = float3(0.2126, 0.7152, 0.0722);

static float4 eval(texture2d<float> image, sampler s, float2 p, float2 size, float4 crop) {
  float2 uv = clamp(p / size, 0.0, 1.0);
  return image.sample(s, crop.xy + uv * crop.zw);
}

static float hash(float2 p) {
  float3 p3 = fract(float3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fragment float4 look_fragment(VOut in [[stage_in]],
                              texture2d<float> image [[texture(0)]],
                              constant Uniforms& u [[buffer(0)]]) {
  constexpr sampler s(address::clamp_to_edge, filter::linear);
  float2 size = u.size.xy;
  float2 xy = in.uv * size;
  float4 src = eval(image, s, xy, size, u.crop);

  // The plastic lens: red and blue land slightly apart, more so off-centre.
  float2 off = (xy - size * 0.5) * u.size.w;
  float3 c = float3(eval(image, s, xy + off, size, u.crop).r, src.g, eval(image, s, xy - off, size, u.crop).b);

  float l = dot(c, LUMA);
  c = mix(float3(l), c, u.gain.w);
  c *= u.gain.xyz;
  c = (c - 0.5) * u.shadowTint.w + 0.5;

  float tone = clamp(dot(c, LUMA), 0.0, 1.0);
  c += u.shadowTint.xyz * (1.0 - tone) * (1.0 - tone);
  c += u.highlightTint.xyz * tone * tone;

  c = u.highlightTint.w + c * (1.0 - u.highlightTint.w);

  float2 v = xy / size - 0.5;
  c *= 1.0 - u.extra.y * smoothstep(0.1, 0.5, dot(v, v));

  float cell = max(size.x, size.y) / u.size.z;
  float n = hash(floor(xy / cell)) - 0.5;
  c += n * u.extra.x * (1.0 - 0.6 * tone);

  return float4(clamp(c, 0.0, 1.0), 1.0);
}
"""

/// Matches `Uniforms` in the shader: six float4s, no padding surprises.
struct LookUniforms {
  var size: SIMD4<Float>
  var crop: SIMD4<Float>
  var gain: SIMD4<Float>
  var shadowTint: SIMD4<Float>
  var highlightTint: SIMD4<Float>
  var extra: SIMD4<Float>

  /// `lookUniforms()` for a look drawn at `width` x `height`. `live` drops the
  /// grain, as `liveLookUniforms()` does: grain belongs to the print.
  init(look: FilmLook, width: Int, height: Int, crop: SIMD4<Float> = [0, 0, 1, 1], live: Bool = false) {
    let r = Looks.recipes[look] ?? Looks.recipes[.fallback]!
    size = [Float(width), Float(height), Looks.grainCells, Looks.fringe]
    self.crop = crop
    gain = SIMD4(r.gain, r.saturation)
    shadowTint = SIMD4(r.shadowTint, r.contrast)
    highlightTint = SIMD4(r.highlightTint, r.fade)
    extra = [live ? 0 : r.grain, r.vignette, 0, 0]
  }
}

enum LookError: Error {
  case noMetal
  case texture
}

/// The compiled pipeline, built once. Thread-safe after `shared` is made:
/// Metal devices, pipelines and queues may be used from any thread (unlike
/// Skia's per-thread GPU context — the reason the app's viewfinder crashed).
final class LookRenderer {
  static let shared: LookRenderer? = try? LookRenderer()

  let device: MTLDevice
  let queue: MTLCommandQueue
  private let pipelines: [MTLPixelFormat: MTLRenderPipelineState]
  private let textureCache: CVMetalTextureCache

  private init() throws {
    guard let device = MTLCreateSystemDefaultDevice(), let queue = device.makeCommandQueue() else {
      throw LookError.noMetal
    }
    let library = try device.makeLibrary(source: SOURCE, options: nil)
    var pipelines: [MTLPixelFormat: MTLRenderPipelineState] = [:]
    for format in [MTLPixelFormat.bgra8Unorm, .rgba8Unorm] {
      let descriptor = MTLRenderPipelineDescriptor()
      descriptor.vertexFunction = library.makeFunction(name: "look_vertex")
      descriptor.fragmentFunction = library.makeFunction(name: "look_fragment")
      descriptor.colorAttachments[0].pixelFormat = format
      pipelines[format] = try device.makeRenderPipelineState(descriptor: descriptor)
    }
    var cache: CVMetalTextureCache?
    CVMetalTextureCacheCreate(nil, nil, device, nil, &cache)
    guard let cache else { throw LookError.noMetal }
    self.device = device
    self.queue = queue
    self.pipelines = pipelines
    self.textureCache = cache
  }

  /// Encode one pass of the look from `source` into `target`.
  func encode(_ buffer: MTLCommandBuffer, source: MTLTexture, target: MTLTexture, uniforms: LookUniforms) {
    let pass = MTLRenderPassDescriptor()
    pass.colorAttachments[0].texture = target
    pass.colorAttachments[0].loadAction = .dontCare
    pass.colorAttachments[0].storeAction = .store
    guard let pipeline = pipelines[target.pixelFormat],
          let encoder = buffer.makeRenderCommandEncoder(descriptor: pass)
    else { return }
    var u = uniforms
    encoder.setRenderPipelineState(pipeline)
    encoder.setFragmentTexture(source, index: 0)
    encoder.setFragmentBytes(&u, length: MemoryLayout<LookUniforms>.stride, index: 0)
    encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
    encoder.endEncoding()
  }

  /// A camera frame (BGRA) as a texture, without copying its pixels.
  /// Keep the returned `CVMetalTexture` alive until the GPU is done with it.
  func texture(from pixelBuffer: CVPixelBuffer) -> (MTLTexture, CVMetalTexture)? {
    var cvTexture: CVMetalTexture?
    let width = CVPixelBufferGetWidth(pixelBuffer)
    let height = CVPixelBufferGetHeight(pixelBuffer)
    CVMetalTextureCacheCreateTextureFromImage(
      nil, textureCache, pixelBuffer, nil, .bgra8Unorm, width, height, 0, &cvTexture
    )
    guard let cvTexture, let texture = CVMetalTextureGetTexture(cvTexture) else { return nil }
    return (texture, cvTexture)
  }

  /// Aspect-fill: the part of a `sourceW` x `sourceH` picture a
  /// `targetW` x `targetH` frame shows, centred, in texture space.
  static func fillCrop(sourceW: Int, sourceH: Int, targetW: Int, targetH: Int) -> SIMD4<Float> {
    let source = Float(sourceW) / Float(max(sourceH, 1))
    let target = Float(targetW) / Float(max(targetH, 1))
    if source > target {
      let w = target / source
      return [(1 - w) / 2, 0, w, 1]
    } else {
      let h = source / target
      return [0, (1 - h) / 2, 1, h]
    }
  }
}
