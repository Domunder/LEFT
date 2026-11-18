/**
 * The one implementation of the looks.
 *
 * A single SkSL shader, parameterised by a recipe from `constants/looks.ts`.
 * Three callers, on purpose:
 *
 *  - `components/ui/look-preview.tsx` draws it on 03's cards;
 *  - `components/ui/film-camera.tsx` draws it over every live frame
 *    (`liveLookUniforms()`), so the viewfinder shows the film;
 *  - `developPhoto()` below runs it offscreen over a captured frame and encodes
 *    the JPEGs the upload queue sends.
 *
 * All get their uniforms from `lookUniforms()`, so the card and the viewfinder
 * are the camera's output at a smaller size — not drawings of it.
 *
 * Everything touching `Skia` is inside a function. The JSI API is synchronous
 * and lives on the JS thread; nothing here may run at import time.
 */

import {
  FilterMode,
  ImageFormat,
  MipmapMode,
  Skia,
  TileMode,
  type SkImage,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';

import { GRAIN_CELLS, LENS, LOOK_RECIPES, PhotoOutput } from '@/constants/looks';
import type { FilmLook } from '@/lib/events';

const SOURCE = `
uniform shader image;
uniform float2 size;
uniform float saturation;
uniform float3 gain;
uniform float contrast;
uniform float3 shadowTint;
uniform float3 highlightTint;
uniform float fade;
uniform float grain;
uniform float vignette;
uniform float grainCells;
uniform float fringe;

const float3 LUMA = float3(0.2126, 0.7152, 0.0722);

float hash(float2 p) {
  float3 p3 = fract(float3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

half4 main(float2 xy) {
  half4 src = image.eval(xy);

  // The plastic lens: red and blue land slightly apart, more so off-centre.
  float2 off = (xy - size * 0.5) * fringe;
  float3 c = float3(image.eval(xy + off).r, src.g, image.eval(xy - off).b);

  float l = dot(c, LUMA);
  c = mix(float3(l), c, saturation);
  c *= gain;
  c = (c - 0.5) * contrast + 0.5;

  float tone = clamp(dot(c, LUMA), 0.0, 1.0);
  c += shadowTint * (1.0 - tone) * (1.0 - tone);
  c += highlightTint * tone * tone;

  c = fade + c * (1.0 - fade);

  float2 uv = xy / size - 0.5;
  c *= 1.0 - vignette * smoothstep(0.1, 0.5, dot(uv, uv));

  float cell = max(size.x, size.y) / grainCells;
  float n = hash(floor(xy / cell)) - 0.5;
  c += n * grain * (1.0 - 0.6 * tone);

  return half4(clamp(c, 0.0, 1.0), src.a);
}
`;

let effect: SkRuntimeEffect | null = null;

/** The compiled shader, built on first use. */
export function lookEffect(): SkRuntimeEffect {
  if (!effect) {
    effect = Skia.RuntimeEffect.Make(SOURCE);
    if (!effect) throw new Error('The look shader did not compile');
  }
  return effect;
}

/** The shader's uniforms for a look drawn at `width` x `height`, by name. */
export function lookUniforms(look: FilmLook, width: number, height: number) {
  const recipe = LOOK_RECIPES[look];
  return {
    size: [width, height],
    saturation: recipe.saturation,
    gain: [...recipe.gain],
    contrast: recipe.contrast,
    shadowTint: [...recipe.shadowTint],
    highlightTint: [...recipe.highlightTint],
    fade: recipe.fade,
    grain: recipe.grain,
    vignette: recipe.vignette,
    grainCells: GRAIN_CELLS,
    fringe: LENS.fringe,
  };
}

/** The same uniforms flattened in declaration order, for the imperative API. */
function flatUniforms(look: FilmLook, width: number, height: number): number[] {
  const u = lookUniforms(look, width, height);
  return [
    ...u.size,
    u.saturation,
    ...u.gain,
    u.contrast,
    ...u.shadowTint,
    ...u.highlightTint,
    u.fade,
    u.grain,
    u.vignette,
    u.grainCells,
    u.fringe,
  ];
}

/**
 * The uniforms for the live viewfinder, drawn at `width` x `height`.
 *
 * Without grain: the viewfinder shows the film's colour, clean. Grain belongs
 * to the print.
 */
export function liveLookUniforms(look: FilmLook, width: number, height: number) {
  return { ...lookUniforms(look, width, height), grain: 0 };
}

/** Scale `width` x `height` so its long edge is at most `longEdge`. Never upscales. */
function fit(width: number, height: number, longEdge: number) {
  const scale = Math.min(1, longEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** A GPU surface where there is one, the CPU otherwise. */
function makeSurface(width: number, height: number) {
  const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
  if (!surface) throw new Error('No drawing surface available');
  return surface;
}

export type DevelopedPhoto = {
  /** The print-capable original, look baked in. JPEG bytes. */
  original: Uint8Array;
  /** The grid thumbnail, cut from the original so both carry the same look. */
  thumb: Uint8Array;
  width: number;
  height: number;
};

/**
 * Bake a look into a captured frame.
 *
 * `encoded` is the camera's JPEG. EXIF orientation is applied by the decoder, so
 * the width and height returned are what a viewer will see.
 *
 * Synchronous and heavy — a few hundred milliseconds for a 12MP frame — so the
 * upload queue calls it, never the shutter.
 */
export function developPhoto(
  encoded: Uint8Array,
  look: FilmLook,
  cropAspect?: number
): DevelopedPhoto {
  const data = Skia.Data.fromBytes(encoded);
  const source = Skia.Image.MakeImageFromEncoded(data);
  if (!source) throw new Error('The captured photo could not be read');

  /*
    Centre-crop to the viewfinder's shape, so the print holds what the guest
    saw. Only a portrait capture is cropped: a sideways phone takes a landscape
    picture, which the portrait-pinned viewfinder never showed whole anyway.
  */
  let cropW = source.width();
  let cropH = source.height();
  if (cropAspect && cropAspect > 0 && cropH > cropW) {
    if (cropAspect < cropW / cropH) cropW = Math.round(cropH * cropAspect);
    else cropH = Math.round(cropW / cropAspect);
  }
  const cropX = (source.width() - cropW) / 2;
  const cropY = (source.height() - cropH) / 2;

  const out = fit(cropW, cropH, PhotoOutput.longEdge);
  const surface = makeSurface(out.width, out.height);

  try {
    const matrix = Skia.Matrix();
    matrix.scale(out.width / cropW, out.height / cropH);
    matrix.translate(-cropX, -cropY);
    const pixels = source.makeShaderOptions(
      TileMode.Clamp,
      TileMode.Clamp,
      FilterMode.Linear,
      MipmapMode.Linear,
      matrix
    );

    const paint = Skia.Paint();
    paint.setShader(
      lookEffect().makeShaderWithChildren(flatUniforms(look, out.width, out.height), [pixels])
    );
    surface.getCanvas().drawPaint(paint);
    surface.flush();

    const developed = surface.makeImageSnapshot();
    const original = developed.encodeToBytes(ImageFormat.JPEG, PhotoOutput.quality);
    const thumb = encodeScaled(developed, PhotoOutput.thumbLongEdge, PhotoOutput.thumbQuality);
    developed.dispose();

    if (original.length === 0 || thumb.length === 0) {
      throw new Error('The developed photo could not be encoded');
    }
    return { original, thumb, width: out.width, height: out.height };
  } finally {
    surface.dispose();
    source.dispose();
    data.dispose();
  }
}

function encodeScaled(image: SkImage, longEdge: number, quality: number): Uint8Array {
  const size = fit(image.width(), image.height(), longEdge);
  const surface = makeSurface(size.width, size.height);
  try {
    surface
      .getCanvas()
      .drawImageRectOptions(
        image,
        Skia.XYWHRect(0, 0, image.width(), image.height()),
        Skia.XYWHRect(0, 0, size.width, size.height),
        FilterMode.Linear,
        MipmapMode.Linear
      );
    surface.flush();
    const scaled = surface.makeImageSnapshot();
    const bytes = scaled.encodeToBytes(ImageFormat.JPEG, quality);
    scaled.dispose();
    return bytes;
  } finally {
    surface.dispose();
  }
}
