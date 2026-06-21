// The synthetic core-tray generator — renders the RGBA image + the ground-truth segments. This is the irreplaceable
// core: the same generator produces the App's trays, the training patches, and the oracle ground truth. Deterministic
// given the spec seed.

import { mulberry32 } from './rng.ts';
import { applyQuality, lithoPixel } from './textures.ts';
import { type Lithology, PATCH, type Segment, type Suite, type Tray, type TraySpec } from './types.ts';

// per-suite lithology palettes (the orebody/sequence each tray is drilled through)
const SUITES: Record<Suite, Lithology[]> = {
  porphyry: ['granite', 'schist', 'ore', 'granite', 'ore'],
  sedimentary: ['sandstone', 'limestone', 'sandstone', 'limestone'],
  volcanic: ['basalt', 'schist', 'basalt'],
  uniform: ['limestone'],
  sharp: ['sandstone', 'basalt'],
};

/** Build the ground-truth segment layout (along-core runs) for one channel. */
function channelLayout(suite: Suite, chW: number, rnd: () => number): Array<{ x0: number; x1: number; litho: Lithology }> {
  const pal = SUITES[suite];
  if (suite === 'uniform') return [{ x0: 0, x1: chW, litho: pal[0] }];
  if (suite === 'sharp') {
    const cut = Math.round(chW * (0.4 + rnd() * 0.2)); // a known sharp boundary near the middle
    return [{ x0: 0, x1: cut, litho: pal[0] }, { x0: cut, x1: chW, litho: pal[1] }];
  }
  const out: Array<{ x0: number; x1: number; litho: Lithology }> = [];
  let x = 0;
  let prev = -1;
  while (x < chW) {
    let li = Math.floor(rnd() * pal.length);
    if (li === prev) li = (li + 1) % pal.length; // avoid trivially-merging neighbours
    prev = li;
    const len = Math.round(chW * (0.18 + rnd() * 0.22));
    const x1 = Math.min(chW, x + len);
    out.push({ x0: x, x1, litho: pal[li] });
    x = x1;
  }
  return out;
}

export function makeTray(spec: TraySpec): Tray {
  const { nChannels, chWidthPx, chHeightPx, seed, suite, quality } = spec;
  const gap = 6; // px between channels (the tray frame)
  const width = chWidthPx;
  const height = nChannels * chHeightPx + (nChannels - 1) * gap;
  const rgba = new Uint8ClampedArray(width * height * 4);
  rgba.fill(255);
  const truth: Segment[] = [];
  const totalDepth = spec.depthToM - spec.depthFromM;
  const chDepth = totalDepth / nChannels;
  const rnd = mulberry32(seed);

  for (let ch = 0; ch < nChannels; ch++) {
    const layout = channelLayout(suite, chWidthPx, rnd);
    const yTop = ch * (chHeightPx + gap);
    // render pixels
    for (const seg of layout) {
      for (let x = seg.x0; x < seg.x1; x++) {
        for (let y = 0; y < chHeightPx; y++) {
          let rgb = lithoPixel(seg.litho, x, y, x, seed + ch * 131);
          rgb = applyQuality(rgb, quality, x / chWidthPx, y / chHeightPx);
          const py = yTop + y;
          const i = (py * width + x) * 4;
          rgba[i] = rgb[0];
          rgba[i + 1] = rgb[1];
          rgba[i + 2] = rgb[2];
        }
      }
      const depthFrom = spec.depthFromM + ch * chDepth + (seg.x0 / chWidthPx) * chDepth;
      const depthTo = spec.depthFromM + ch * chDepth + (seg.x1 / chWidthPx) * chDepth;
      truth.push({ channel: ch, x0: seg.x0, x1: seg.x1, litho: seg.litho, conf: 1, depthFrom, depthTo });
    }
    // draw the inter-channel gap as the dark tray frame
    if (ch < nChannels - 1) {
      for (let g = 0; g < gap; g++) {
        const py = yTop + chHeightPx + g;
        for (let x = 0; x < width; x++) {
          const i = (py * width + x) * 4;
          rgba[i] = 40;
          rgba[i + 1] = 42;
          rgba[i + 2] = 46;
        }
      }
    }
  }
  return { spec, width, height, rgba, truth };
}

/** y of the top of channel `ch` in the full image. */
export function channelTop(spec: TraySpec, ch: number): number {
  return ch * (spec.chHeightPx + 6);
}

/**
 * Extract a PATCH×PATCH patch centred at (cx, cy) in image space, as CHW float32 in [0,1] (the CNN input layout
 * [3,PATCH,PATCH]). Out-of-bounds is clamped to the edge.
 */
export function extractPatch(tray: Tray, cx: number, cy: number): Float32Array {
  const P = PATCH;
  const out = new Float32Array(3 * P * P);
  const half = P >> 1;
  for (let dy = 0; dy < P; dy++) {
    for (let dx = 0; dx < P; dx++) {
      const x = Math.min(tray.width - 1, Math.max(0, cx - half + dx));
      const y = Math.min(tray.height - 1, Math.max(0, cy - half + dy));
      const i = (y * tray.width + x) * 4;
      const o = dy * P + dx;
      out[o] = tray.rgba[i] / 255; // R plane
      out[P * P + o] = tray.rgba[i + 1] / 255; // G plane
      out[2 * P * P + o] = tray.rgba[i + 2] / 255; // B plane
    }
  }
  return out;
}
