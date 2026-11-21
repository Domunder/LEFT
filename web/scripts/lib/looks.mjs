/**
 * The app's looks in JavaScript: LOOK_RECIPES, LENS and GRAIN_CELLS read from
 * mobile/src/constants/looks.ts, and a port of the SkSL in
 * mobile/src/lib/look-shader.ts. Used by social-posts.mjs and seed-demo.mjs.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// ── The looks, read from the app's own file ────────────────────────────────

/** LOOK_RECIPES, LENS and GRAIN_CELLS out of mobile/src/constants/looks.ts. */
function readLooks() {
  const source = readFileSync(path.join(root, 'mobile', 'src', 'constants', 'looks.ts'), 'utf8');
  const literal = (name) => {
    const start = source.indexOf(`export const ${name}`);
    const open = source.indexOf('{', source.indexOf('=', start));
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      if (source[i] === '}') depth -= 1;
      if (depth === 0) return new Function(`return (${source.slice(open, i + 1)})`)();
    }
    throw new Error(`${name} not found in looks.ts`);
  };
  const cells = Number(/export const GRAIN_CELLS = (\d+)/.exec(source)?.[1]);
  if (!cells) throw new Error('GRAIN_CELLS not found in looks.ts');
  return { recipes: literal('LOOK_RECIPES'), fringe: literal('LENS').fringe, cells };
}
const LOOKS = readLooks();

const fract = (x) => x - Math.floor(x);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function hash(px, py) {
  let x = fract(px * 0.1031);
  let y = fract(py * 0.1031);
  let z = fract(px * 0.1031);
  const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
  x += d;
  y += d;
  z += d;
  return fract((x + y) * z);
}

/** The look shader over an RGB buffer of `width` x `height`, in place. */
export function grade(pixels, width, height, look) {
  const r = LOOKS.recipes[look];
  if (!r) throw new Error(`Unknown look "${look}"`);
  const src = Buffer.from(pixels);
  const cell = Math.max(width, height) / LOOKS.cells;
  // One channel of the source at a fractional position, bilinear, clamped.
  const sample = (x, y, channel) => {
    const cx = Math.min(width - 1, Math.max(0, x));
    const cy = Math.min(height - 1, Math.max(0, y));
    const x0 = Math.floor(cx);
    const y0 = Math.floor(cy);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const fx = cx - x0;
    const fy = cy - y0;
    const at = (xx, yy) => src[(yy * width + xx) * 3 + channel];
    return (at(x0, y0) * (1 - fx) + at(x1, y0) * fx) * (1 - fy) + (at(x0, y1) * (1 - fx) + at(x1, y1) * fx) * fy;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      const ox = (x - width / 2) * LOOKS.fringe;
      const oy = (y - height / 2) * LOOKS.fringe;
      let c = [sample(x + ox, y + oy, 0) / 255, src[i + 1] / 255, sample(x - ox, y - oy, 2) / 255];

      const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      c = c.map((v, k) => ((l + (v - l) * r.saturation) * r.gain[k] - 0.5) * r.contrast + 0.5);

      const tone = Math.min(1, Math.max(0, 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]));
      const u = x / width - 0.5;
      const v = y / height - 0.5;
      const vignette = 1 - r.vignette * smoothstep(0.1, 0.5, u * u + v * v);
      const noise = (hash(Math.floor(x / cell), Math.floor(y / cell)) - 0.5) * r.grain * (1 - 0.6 * tone);
      for (let k = 0; k < 3; k += 1) {
        let value = c[k] + r.shadowTint[k] * (1 - tone) * (1 - tone) + r.highlightTint[k] * tone * tone;
        value = (r.fade + value * (1 - r.fade)) * vignette + noise;
        pixels[i + k] = Math.round(Math.min(1, Math.max(0, value)) * 255);
      }
    }
  }
}

