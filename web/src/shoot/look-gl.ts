/**
 * The looks, in WebGL — the browser's copy of `mobile/src/lib/look-shader.ts`.
 *
 * The shader below is a line-for-line port of the app's SkSL, and its uniforms
 * come from the same recipes (`LOOK_RECIPES`, `LENS`, `GRAIN_CELLS`, copied from
 * the app by `scripts/sync-legal.mjs`). Change a look in the app's recipe and the
 * web camera follows. **Change the shader's maths in one place and you must
 * change it in the other**, or a browser guest's prints stop matching the app's.
 *
 * Two callers: the live viewfinder (no grain, as in the app) and `develop()`,
 * which renders a captured frame at print size and encodes the two JPEGs.
 *
 * WebGL 1 on purpose — it is what every phone browser has.
 */

import { GRAIN_CELLS, LENS, LOOK_RECIPES, PhotoOutput } from '../generated/looks';
import type { FilmLook } from './api';

const VERTEX = `
attribute vec2 pos;
uniform vec2 size;
varying vec2 xy;
void main() {
  // Pixel coordinates, y down, as Skia's shaders see them.
  xy = vec2(pos.x * 0.5 + 0.5, 0.5 - pos.y * 0.5) * size;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

const FRAGMENT = (precision: string) => `
precision ${precision} float;

uniform sampler2D image;
uniform vec2 size;
uniform vec4 crop;      // the source rectangle in texture space: x, y, w, h
uniform float mirror;   // 1 flips the picture sideways (the front camera)
uniform float saturation;
uniform vec3 gain;
uniform float contrast;
uniform vec3 shadowTint;
uniform vec3 highlightTint;
uniform float fade;
uniform float grain;
uniform float vignette;
uniform float grainCells;
uniform float fringe;
varying vec2 xy;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec4 eval(vec2 p) {
  vec2 uv = clamp(p / size, 0.0, 1.0);
  if (mirror > 0.5) uv.x = 1.0 - uv.x;
  return texture2D(image, crop.xy + uv * crop.zw);
}

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec4 src = eval(xy);

  vec2 off = (xy - size * 0.5) * fringe;
  vec3 c = vec3(eval(xy + off).r, src.g, eval(xy - off).b);

  float l = dot(c, LUMA);
  c = mix(vec3(l), c, saturation);
  c *= gain;
  c = (c - 0.5) * contrast + 0.5;

  float tone = clamp(dot(c, LUMA), 0.0, 1.0);
  c += shadowTint * (1.0 - tone) * (1.0 - tone);
  c += highlightTint * tone * tone;

  c = fade + c * (1.0 - fade);

  vec2 uv = xy / size - 0.5;
  c *= 1.0 - vignette * smoothstep(0.1, 0.5, dot(uv, uv));

  float cell = max(size.x, size.y) / grainCells;
  float n = hash(floor(xy / cell)) - 0.5;
  c += n * grain * (1.0 - 0.6 * tone);

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

type Source = TexImageSource & { readonly width?: number };

export class LookRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private texture: WebGLTexture;
  private loc: Record<string, WebGLUniformLocation | null> = {};

  constructor(canvas: HTMLCanvasElement, options: { preserve?: boolean } = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: options.preserve ?? false,
    });
    if (!gl) throw new Error('This browser cannot draw the film look (no WebGL).');
    this.gl = gl;

    const high = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    const precision = high && high.precision > 0 ? 'highp' : 'mediump';

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT(precision)));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`The look shader did not link: ${gl.getProgramInfoLog(program)}`);
    }
    gl.useProgram(program);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'pos');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    // Camera frames are not powers of two: no mipmaps, clamp, linear.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    for (const name of [
      'image', 'size', 'crop', 'mirror', 'saturation', 'gain', 'contrast', 'shadowTint',
      'highlightTint', 'fade', 'grain', 'vignette', 'grainCells', 'fringe',
    ]) {
      this.loc[name] = gl.getUniformLocation(program, name);
    }
    gl.uniform1i(this.loc.image, 0);
  }

  /**
   * Draw `source` (srcW x srcH) through `look`, filling the canvas at its current
   * size. The source is centre-cropped to the canvas's aspect — what the
   * viewfinder shows is exactly what the print holds.
   */
  draw(source: Source, srcW: number, srcH: number, look: FilmLook, opts: { grain: boolean; mirror: boolean }) {
    const { gl, loc } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (!srcW || !srcH || !w || !h) return;

    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);

    const out = w / h;
    const src = srcW / srcH;
    const cw = src > out ? out / src : 1;
    const ch = src > out ? 1 : src / out;

    const r = LOOK_RECIPES[look];
    gl.uniform2f(loc.size, w, h);
    gl.uniform4f(loc.crop, (1 - cw) / 2, (1 - ch) / 2, cw, ch);
    gl.uniform1f(loc.mirror, opts.mirror ? 1 : 0);
    gl.uniform1f(loc.saturation, r.saturation);
    gl.uniform3f(loc.gain, r.gain[0], r.gain[1], r.gain[2]);
    gl.uniform1f(loc.contrast, r.contrast);
    gl.uniform3f(loc.shadowTint, r.shadowTint[0], r.shadowTint[1], r.shadowTint[2]);
    gl.uniform3f(loc.highlightTint, r.highlightTint[0], r.highlightTint[1], r.highlightTint[2]);
    gl.uniform1f(loc.fade, r.fade);
    // The viewfinder shows the film's colour, clean; grain belongs to the print.
    gl.uniform1f(loc.grain, opts.grain ? r.grain : 0);
    gl.uniform1f(loc.vignette, r.vignette);
    gl.uniform1f(loc.grainCells, GRAIN_CELLS);
    gl.uniform1f(loc.fringe, LENS.fringe);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`The look shader did not compile: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

export type Developed = { original: Blob; thumb: Blob; width: number; height: number };

let printer: LookRenderer | null = null;

/**
 * Bake the look into one frame, at print size.
 *
 * The frame is cropped to 3:4 (4:3 when the phone is sideways) like the app's
 * photos, never upscaled, and capped at the app's long edge. One offscreen
 * canvas is reused: phone browsers cap the canvas memory a page may hold.
 */
export async function develop(
  source: Source,
  srcW: number,
  srcH: number,
  look: FilmLook,
  mirror: boolean
): Promise<Developed> {
  const portrait = srcH >= srcW;
  const aspect = portrait ? 3 / 4 : 4 / 3;
  let w = srcW / srcH > aspect ? srcH * aspect : srcW;
  let h = w / aspect;
  const scale = Math.min(1, PhotoOutput.longEdge / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  if (!printer) printer = new LookRenderer(document.createElement('canvas'), { preserve: true });
  printer.canvas.width = w;
  printer.canvas.height = h;
  printer.draw(source, srcW, srcH, look, { grain: true, mirror });

  const original = await toJpeg(printer.canvas, PhotoOutput.quality / 100);

  const t = Math.min(1, PhotoOutput.thumbLongEdge / Math.max(w, h));
  const small = document.createElement('canvas');
  small.width = Math.round(w * t);
  small.height = Math.round(h * t);
  const ctx = small.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(printer.canvas, 0, 0, small.width, small.height);
  const thumb = await toJpeg(small, PhotoOutput.thumbQuality / 100);

  return { original, thumb, width: w, height: h };
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob && blob.size > 0 ? resolve(blob) : reject(new Error('The photo could not be encoded'))),
      'image/jpeg',
      quality
    )
  );
}
