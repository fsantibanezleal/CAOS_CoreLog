// Procedural per-lithology textures — each rock type gets a distinct, geologically-suggestive appearance built from a
// base colour + grain + speckle + banding/veining. SYNTHETIC and clearly so; the point is a set of patterns that are
// (a) visually plausible, (b) separable enough that a classical colour/texture baseline scores well, and (c) leave
// headroom for a CNN to do better on the noisy/ambiguous cases. Deterministic given (x, y, seed).

import { hashNoise, valueNoise } from './rng.ts';
import { type Lithology } from './types.ts';

type RGB = [number, number, number];
const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Colour of lithology `litho` at image pixel (x,y) given a per-tray seed. `gx` is the global x (along-core) used so
 * banding/veining flow continuously across a segment. Returns 0..255 RGB.
 */
export function lithoPixel(litho: Lithology, x: number, y: number, gx: number, seed: number): RGB {
  switch (litho) {
    case 'granite': {
      // light pinkish-grey, coarse salt-and-pepper grains (dark + light feldspar/biotite specks)
      const base: RGB = [205, 178, 182];
      const speck = hashNoise(x, y, seed);
      const grain = speck > 0.78 ? -70 : speck < -0.82 ? 55 : valueNoise(x / 2, y / 2, seed) * 14;
      return [clamp(base[0] + grain), clamp(base[1] + grain * 0.9), clamp(base[2] + grain * 0.95)];
    }
    case 'basalt': {
      // dark fine-grained grey, occasional light vesicles
      const base: RGB = [66, 69, 75];
      const v = hashNoise(x, y, seed + 7) > 0.9 ? 60 : valueNoise(x / 1.5, y / 1.5, seed) * 10;
      return [clamp(base[0] + v), clamp(base[1] + v), clamp(base[2] + v + 2)];
    }
    case 'sandstone': {
      // buff/tan with sub-horizontal bedding bands
      const base: RGB = [202, 168, 112];
      const band = Math.sin(y * 0.35 + valueNoise(gx / 30, 0, seed) * 2) * 16;
      const grain = valueNoise(x / 2, y / 2, seed + 3) * 10;
      return [clamp(base[0] + band + grain), clamp(base[1] + band * 0.9 + grain), clamp(base[2] + band * 0.6 + grain)];
    }
    case 'limestone': {
      // pale cream, smooth, faint mottling + occasional darker fossils
      const base: RGB = [224, 218, 198];
      const mott = valueNoise(x / 4, y / 4, seed + 5) * 12;
      const fossil = hashNoise(x, y, seed + 9) < -0.93 ? -45 : 0;
      return [clamp(base[0] + mott + fossil), clamp(base[1] + mott + fossil), clamp(base[2] + mott * 0.8 + fossil)];
    }
    case 'schist': {
      // greenish-grey with wavy foliation (the diagnostic banding)
      const base: RGB = [118, 134, 108];
      const fol = Math.sin(y * 0.6 + valueNoise(gx / 12, y / 20, seed) * 3) * 22;
      return [clamp(base[0] + fol * 0.6), clamp(base[1] + fol), clamp(base[2] + fol * 0.5)];
    }
    case 'ore': {
      // dark matrix with bright metallic sulphide specks + thin veins
      const base: RGB = [92, 78, 58];
      const spk = hashNoise(x, y, seed + 11);
      const metal = spk > 0.86 ? 120 : 0;
      const vein = Math.abs(Math.sin(gx * 0.08 + y * 0.05 + valueNoise(gx / 20, 0, seed) * 2)) > 0.97 ? 90 : 0;
      const g = valueNoise(x / 2, y / 2, seed + 1) * 8;
      return [clamp(base[0] + metal + vein + g), clamp(base[1] + metal + vein + g), clamp(base[2] + metal * 0.95 + vein + g)];
    }
  }
}

/** Apply a per-tray quality augmentation to a pixel (shadow gradient / wet darkening). */
export function applyQuality(rgb: RGB, quality: 'clean' | 'shadow' | 'wet', fx: number, fy: number): RGB {
  if (quality === 'shadow') {
    const k = 0.65 + 0.5 * fx; // darker on the left
    return [clamp(rgb[0] * k), clamp(rgb[1] * k), clamp(rgb[2] * k)];
  }
  if (quality === 'wet') {
    // wet core is darker + more saturated + a slight specular sheen
    const sheen = fy < 0.2 ? 18 : 0;
    return [clamp(rgb[0] * 0.78 + sheen), clamp(rgb[1] * 0.78 + sheen), clamp(rgb[2] * 0.8 + sheen)];
  }
  return rgb;
}
