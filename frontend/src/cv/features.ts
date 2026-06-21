// The CLASSICAL baseline classifier — hand-crafted colour + texture features + a nearest-centroid model. This is what
// the learned CNN is measured against (the honest "does ML beat hand-crafted features?" comparison). Pure TS, no
// training: the per-lithology centroids are estimated from clean synthetic patches of each rock type.

import { extractPatch } from './tray.ts';
import { LITHOLOGIES, type Lithology, N_LITHO, PATCH, type PatchClassifier, type TraySpec } from './types.ts';

export const N_FEAT = 8;

/** 8 features from a CHW patch: mean R,G,B · std of luma · mean |∇| · horizontal/vertical gradient anisotropy · mean luma. */
export function patchFeatures(patch: Float32Array): Float32Array {
  const P = PATCH;
  const n = P * P;
  let mr = 0;
  let mg = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    mr += patch[i];
    mg += patch[n + i];
    mb += patch[2 * n + i];
  }
  mr /= n;
  mg /= n;
  mb /= n;
  // luma plane + texture
  let lumaMean = 0;
  const luma = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    luma[i] = 0.299 * patch[i] + 0.587 * patch[n + i] + 0.114 * patch[2 * n + i];
    lumaMean += luma[i];
  }
  lumaMean /= n;
  let lumaVar = 0;
  let gradH = 0;
  let gradV = 0;
  let gradMag = 0;
  for (let y = 0; y < P; y++) {
    for (let x = 0; x < P; x++) {
      const c = luma[y * P + x];
      lumaVar += (c - lumaMean) ** 2;
      const gx = x < P - 1 ? Math.abs(luma[y * P + x + 1] - c) : 0;
      const gy = y < P - 1 ? Math.abs(luma[(y + 1) * P + x] - c) : 0;
      gradH += gx;
      gradV += gy;
      gradMag += Math.hypot(gx, gy);
    }
  }
  const aniso = (gradV + 1e-6) / (gradH + gradV + 1e-6); // 0.5 = isotropic; >0.5 = horizontal banding (high vertical gradient)
  return new Float32Array([mr, mg, mb, Math.sqrt(lumaVar / n), gradMag / n, aniso, lumaMean, (mr - mb)]);
}

interface Baseline {
  centroids: Float32Array[]; // per lithology, length N_FEAT (standardised)
  mean: Float32Array;
  std: Float32Array;
}

/** Estimate per-lithology feature centroids from clean synthetic patches of each rock type. */
export function fitBaseline(seed = 7): Baseline {
  const perClass: Float32Array[][] = LITHOLOGIES.map(() => []);
  LITHOLOGIES.forEach((litho, li) => {
    const spec: TraySpec = { id: `cal_${litho}`, nChannels: 1, chWidthPx: 200, chHeightPx: PATCH * 2,
      depthFromM: 0, depthToM: 1, mmPerPx: 1, seed: seed + li * 17, suite: 'uniform', quality: 'clean' };
    // a uniform tray of THIS lithology (override the layout by drawing the litho directly)
    const tray = makeUniform(spec, litho);
    for (let k = 0; k < 24; k++) {
      const cx = 12 + Math.floor((k / 24) * (tray.width - 24));
      perClass[li].push(patchFeatures(extractPatch(tray, cx, tray.height >> 1)));
    }
  });
  // standardisation stats over all samples
  const all = perClass.flat();
  const mean = new Float32Array(N_FEAT);
  const std = new Float32Array(N_FEAT);
  for (const f of all) for (let j = 0; j < N_FEAT; j++) mean[j] += f[j];
  for (let j = 0; j < N_FEAT; j++) mean[j] /= all.length;
  for (const f of all) for (let j = 0; j < N_FEAT; j++) std[j] += (f[j] - mean[j]) ** 2;
  for (let j = 0; j < N_FEAT; j++) std[j] = Math.sqrt(std[j] / all.length) + 1e-6;
  const centroids = perClass.map((fs) => {
    const c = new Float32Array(N_FEAT);
    for (const f of fs) for (let j = 0; j < N_FEAT; j++) c[j] += (f[j] - mean[j]) / std[j];
    for (let j = 0; j < N_FEAT; j++) c[j] /= fs.length;
    return c;
  });
  return { centroids, mean, std };
}

/** A baseline PatchClassifier: features → standardise → softmax over negative squared distance to each centroid. */
export function makeBaselineClassifier(seed = 7): PatchClassifier {
  const { centroids, mean, std } = fitBaseline(seed);
  return (patch: Float32Array): Float32Array => {
    const f = patchFeatures(patch);
    const z = new Float32Array(N_FEAT);
    for (let j = 0; j < N_FEAT; j++) z[j] = (f[j] - mean[j]) / std[j];
    const neg = new Float32Array(N_LITHO);
    for (let c = 0; c < N_LITHO; c++) {
      let d = 0;
      for (let j = 0; j < N_FEAT; j++) d += (z[j] - centroids[c][j]) ** 2;
      neg[c] = -d * 0.6;
    }
    const m = Math.max(...neg);
    let s = 0;
    const p = new Float32Array(N_LITHO);
    for (let c = 0; c < N_LITHO; c++) {
      p[c] = Math.exp(neg[c] - m);
      s += p[c];
    }
    for (let c = 0; c < N_LITHO; c++) p[c] /= s;
    return p;
  };
}

// a uniform tray of a specific lithology (used only for baseline calibration / tests)
import { applyQuality, lithoPixel } from './textures.ts';
import { type Tray } from './types.ts';
function makeUniform(spec: TraySpec, litho: Lithology): Tray {
  const width = spec.chWidthPx;
  const height = spec.chHeightPx;
  const rgba = new Uint8ClampedArray(width * height * 4);
  rgba.fill(255);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const rgb = applyQuality(lithoPixel(litho, x, y, x, spec.seed), spec.quality, x / width, y / height);
      const i = (y * width + x) * 4;
      rgba[i] = rgb[0];
      rgba[i + 1] = rgb[1];
      rgba[i + 2] = rgb[2];
    }
  }
  return { spec, width, height, rgba, truth: [{ channel: 0, x0: 0, x1: width, litho, conf: 1, depthFrom: spec.depthFromM, depthTo: spec.depthToM }] };
}
