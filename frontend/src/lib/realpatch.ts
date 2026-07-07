// The Real-sample lane. A real DCID core photograph is decoded to RGBA and the SAME sliding-window pipeline that runs
// on synthetic trays (extractPatch -> lithology-CNN + core-ood ONNX, and the classical colour/texture baseline) runs on
// its real pixels. Nothing here is faked: the CNN/OOD were trained on the synthetic generator, so a real patch is
// out-of-distribution and the results are reported honestly (indicative class + an OOD signal that is expected to fire).
import { extractPatch } from '../cv/tray.ts';
import { makeTray } from '../cv/tray.ts';
import { patchFeatures } from '../cv/features.ts';
import { LITHOLOGIES, N_LITHO, PATCH, type PatchClassifier, type RgbaImage, type TraySpec } from '../cv/types.ts';
import { runLithoCNNBatch, runOODBatch } from './ort.ts';

const base = () => import.meta.env.BASE_URL || '/';

// ---- the committed real-sample index (data/derived/real -> public/data/real via copy-data.mjs) ----
export interface RealPatch {
  id: string;
  image: string;
  dcid_class: string;   // the true DCID-7 label (7 classes)
  litho_label: string;  // nearest CoreLog enum class, the accuracy truth
  mapping_note: string;
  src_path_in_dcid: string;
  orig_px: [number, number];
  sha256_16: string;
  source: string;
  doi: string;
  license: string;
  provenance: string;
}

export interface RealDoc {
  schema: string;
  dataset: string;
  variant: string;
  citation: string;
  doi: string;
  license: string;
  license_note: string;
  source_repo: string;
  source_hf: string;
  dcid7_classes: string[];
  corelog_mapping_note: string;
  honesty: string;
  count: number;
  patches: RealPatch[];
}

export function loadRealIndex(): Promise<RealDoc> {
  return fetch(`${base()}data/real/attribution.json`).then((r) => {
    if (!r.ok) throw new Error(`real index ${r.status}`);
    return r.json() as Promise<RealDoc>;
  });
}

export const realImageUrl = (image: string) => `${base()}data/real/${image}`;

// ---- decode a real image to a bounded working RGBA (keeps the window sweep cheap; no compute bomb) ----
export const WORK = 256;
export const STRIDE = 14;

export function decodeImage(url: string, work = WORK): Promise<RgbaImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = work;
      c.height = work;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, work, work);
      const data = ctx.getImageData(0, 0, work, work).data;
      resolve({ width: work, height: work, rgba: new Uint8ClampedArray(data) });
    };
    img.onerror = () => reject(new Error(`decode ${url}`));
    img.src = url;
  });
}

// ---- per-window analysis (one batched ONNX call for the CNN, one for the OOD AE) ----
export interface WinCell {
  col: number; row: number; cx: number; cy: number;
  cnnProbs: Float32Array | null; // length N_LITHO, or null if the CNN is not loaded
  cnnCls: number; cnnConf: number;
  baseProbs: Float32Array; baseCls: number; baseConf: number;
  oodMse: number;   // reconstruction error of the OOD autoencoder (higher = more novel), -1 if unavailable
  feat: Float32Array; // 8-dim colour/texture feature (for the latent scatter)
}

export interface Aggregate { meanSoftmax: Float32Array; pred: number; conf: number; }

export interface PatchAnalysis {
  work: RgbaImage;
  cols: number; rows: number; stride: number; patch: number;
  cells: WinCell[];
  cnn: (Aggregate & { available: true }) | { available: false };
  base: Aggregate;
  ood: { available: true; meanMse: number; maxMse: number } | { available: false };
}

function argmax(p: Float32Array): number { let b = 0; for (let i = 1; i < p.length; i++) if (p[i] > p[b]) b = i; return b; }

/** Slide PATCH-sized windows over the working image and classify each; aggregate to a whole-patch prediction. */
export async function analyzeWindows(img: RgbaImage, baselineClf: PatchClassifier, stride = STRIDE): Promise<PatchAnalysis> {
  const P = PATCH;
  const half = P >> 1;
  const cols: number[] = [];
  const rows: number[] = [];
  for (let x = half; x <= img.width - half; x += stride) cols.push(x);
  for (let y = half; y <= img.height - half; y += stride) rows.push(y);
  const n = cols.length * rows.length;

  const flat = new Float32Array(n * 3 * P * P);
  const feats: Float32Array[] = [];
  const baseProbsAll: Float32Array[] = [];
  let k = 0;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      const patch = extractPatch(img, cols[c], rows[r]);
      flat.set(patch, k * 3 * P * P);
      feats.push(patchFeatures(patch));
      baseProbsAll.push(baselineClf(patch));
      k++;
    }
  }

  const probs = await runLithoCNNBatch(flat, n); // null if the model is not loaded
  const recon = await runOODBatch(flat, n);      // null if unavailable
  const K = N_LITHO;

  const cells: WinCell[] = [];
  const cnnMean = new Float32Array(K);
  const baseMean = new Float32Array(K);
  let mseSum = 0;
  let mseMax = 0;
  let oodCount = 0;
  k = 0;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      const bP = baseProbsAll[k];
      for (let j = 0; j < K; j++) baseMean[j] += bP[j];
      const bCls = argmax(bP);

      let cnnProbs: Float32Array | null = null;
      let cnnCls = bCls;
      let cnnConf = bP[bCls];
      if (probs) {
        cnnProbs = probs.slice(k * K, k * K + K);
        for (let j = 0; j < K; j++) cnnMean[j] += cnnProbs[j];
        cnnCls = argmax(cnnProbs);
        cnnConf = cnnProbs[cnnCls];
      }

      let mse = -1;
      if (recon) {
        let s = 0;
        const off = k * 3 * P * P;
        for (let j = 0; j < 3 * P * P; j++) { const d = recon[off + j] - flat[off + j]; s += d * d; }
        mse = s / (3 * P * P);
        mseSum += mse;
        mseMax = Math.max(mseMax, mse);
        oodCount++;
      }

      cells.push({ col: c, row: r, cx: cols[c], cy: rows[r], cnnProbs, cnnCls, cnnConf, baseProbs: bP, baseCls: bCls, baseConf: bP[bCls], oodMse: mse, feat: feats[k] });
      k++;
    }
  }

  const mkAgg = (mean: Float32Array): Aggregate => {
    const m = mean.slice();
    for (let j = 0; j < K; j++) m[j] /= n;
    const pred = argmax(m);
    return { meanSoftmax: m, pred, conf: m[pred] };
  };

  return {
    work: img,
    cols: cols.length, rows: rows.length, stride, patch: P,
    cells,
    cnn: probs ? { ...mkAgg(cnnMean), available: true } : { available: false },
    base: mkAgg(baseMean),
    ood: recon ? { available: true, meanMse: mseSum / Math.max(1, oodCount), maxMse: mseMax } : { available: false },
  };
}

// ---- synthetic OOD reference (so "the real patch is out-of-distribution" is a measured claim, not an assertion) ----
let _refPromise: Promise<number | null> | null = null;

/** Mean OOD reconstruction MSE over CLEAN synthetic CORE (a single-channel tray, so no dark inter-channel frame inflates
 * the reference), cached for the session. It is a fair in-distribution core baseline the real patch's mean MSE is
 * compared against, so the novelty ratio is an honest core-vs-core number, not a frame artefact. */
export function syntheticReferenceMse(baselineClf: PatchClassifier): Promise<number | null> {
  return (_refPromise ??= (async () => {
    const spec: TraySpec = { id: 'ref', nChannels: 1, chWidthPx: 320, chHeightPx: 64, depthFromM: 100, depthToM: 101, mmPerPx: 1, seed: 11, suite: 'porphyry', quality: 'clean' };
    const tray = makeTray(spec);
    const a = await analyzeWindows(tray, baselineClf, 12);
    return a.ood.available ? a.ood.meanMse : null;
  })());
}

export const LITHO_LIST = LITHOLOGIES;
