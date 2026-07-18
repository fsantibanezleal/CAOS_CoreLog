// Run-merge segmentation, slide the patch classifier along each channel, then merge adjacent same-class positions
// into segments (a confidence-weighted majority run). The segmentation emerges from the patch classifier, so there is
// no separate heavy segmenter ONNX, browser-fast + honest. Plus truth-scoring for the oracle + the benchmark.

import { channelTop, extractPatch } from './tray.ts';
import { LITHOLOGIES, type Lithology, type PatchClassifier, PATCH, type Segment, type Tray } from './types.ts';

export interface SegOpts {
  stride?: number;
  oodThresh?: number; // mean confidence below this → segment flagged uncertain (ood)
}

/** The ground-truth lithology at along-core x in channel ch (or null in a gap). */
export function truthAt(tray: Tray, ch: number, x: number): Lithology | null {
  for (const s of tray.truth) {
    if (s.channel === ch && x >= s.x0 && x < s.x1) return s.litho;
  }
  return null;
}

export function classifyChannel(tray: Tray, ch: number, clf: PatchClassifier, opts: SegOpts = {}): Segment[] {
  const stride = opts.stride ?? 6;
  const oodThresh = opts.oodThresh ?? 0.45;
  const { chWidthPx, chHeightPx, depthFromM, depthToM, nChannels } = tray.spec;
  const midY = channelTop(tray.spec, ch) + (chHeightPx >> 1);
  const half = PATCH >> 1;

  // 1) classify each window position
  const xs: number[] = [];
  const cls: number[] = [];
  const conf: number[] = [];
  for (let x = half; x <= chWidthPx - half; x += stride) {
    const p = clf(extractPatch(tray, x, midY));
    let best = 0;
    for (let c = 1; c < p.length; c++) if (p[c] > p[best]) best = c;
    xs.push(x);
    cls.push(best);
    conf.push(p[best]);
  }
  // 2) 3-tap majority smoothing to kill single-position flips before merging
  const sm = cls.slice();
  for (let i = 1; i < cls.length - 1; i++) {
    if (cls[i - 1] === cls[i + 1] && cls[i] !== cls[i - 1]) sm[i] = cls[i - 1];
  }
  // 3) merge runs → segments
  const chDepth = (depthToM - depthFromM) / nChannels;
  const d0 = depthFromM + ch * chDepth;
  const segs: Segment[] = [];
  let i = 0;
  while (i < sm.length) {
    let j = i;
    let cs = 0;
    while (j < sm.length && sm[j] === sm[i]) {
      cs += conf[j];
      j++;
    }
    const x0 = i === 0 ? 0 : Math.round((xs[i - 1] + xs[i]) / 2);
    const x1 = j >= sm.length ? chWidthPx : Math.round((xs[j - 1] + xs[j]) / 2);
    const meanConf = cs / (j - i);
    segs.push({
      channel: ch, x0, x1, litho: LITHOLOGIES[sm[i]], conf: meanConf,
      depthFrom: d0 + (x0 / chWidthPx) * chDepth, depthTo: d0 + (x1 / chWidthPx) * chDepth,
      ood: meanConf < oodThresh,
    });
    i = j;
  }
  return segs;
}

export function classifyTray(tray: Tray, clf: PatchClassifier, opts: SegOpts = {}): Segment[] {
  const out: Segment[] = [];
  for (let ch = 0; ch < tray.spec.nChannels; ch++) out.push(...classifyChannel(tray, ch, clf, opts));
  return out;
}

export interface TrayScore {
  pixelAccuracy: number;
  nEval: number;
  confusion: number[][]; // [truth][pred]
}

/** Score predicted segments against the ground truth at a grid of along-core positions. */
export function scoreVsTruth(tray: Tray, pred: Segment[], step = 4): TrayScore {
  const K = LITHOLOGIES.length;
  const confusion = Array.from({ length: K }, () => new Array(K).fill(0));
  let correct = 0;
  let total = 0;
  const lithoIdx = (l: Lithology) => LITHOLOGIES.indexOf(l);
  const predAt = (ch: number, x: number): Lithology | null => {
    for (const s of pred) if (s.channel === ch && x >= s.x0 && x < s.x1) return s.litho;
    return null;
  };
  for (let ch = 0; ch < tray.spec.nChannels; ch++) {
    for (let x = 0; x < tray.spec.chWidthPx; x += step) {
      const t = truthAt(tray, ch, x);
      const p = predAt(ch, x);
      if (!t || !p) continue;
      confusion[lithoIdx(t)][lithoIdx(p)]++;
      total++;
      if (t === p) correct++;
    }
  }
  return { pixelAccuracy: total ? correct / total : 0, nEval: total, confusion };
}
