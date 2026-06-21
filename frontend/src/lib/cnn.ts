// CNN segmentation path — slide the lithology CNN along every channel via ONE batched onnxruntime-web call, then
// run-merge into segments (the same shape the classical baseline produces). Returns null until the model is trained,
// so the App transparently falls back to the classical baseline.
import { channelTop, extractPatch } from '../cv/tray.ts';
import { LITHOLOGIES, PATCH, type Segment, type Tray } from '../cv/types.ts';
import { runLithoCNNBatch, runOODBatch } from './ort.ts';

interface CNNOpts {
  stride?: number;
  oodThresh?: number;
  oodMseThresh?: number;
}

export async function classifyTrayCNN(tray: Tray, opts: CNNOpts = {}): Promise<Segment[] | null> {
  const stride = opts.stride ?? 6;
  const oodThresh = opts.oodThresh ?? 0.45;
  const { nChannels, chWidthPx, chHeightPx, depthFromM, depthToM } = tray.spec;
  const half = PATCH >> 1;
  const P = PATCH;

  // 1) collect every window patch across all channels into one batch
  const positions: Array<{ ch: number; x: number }> = [];
  for (let ch = 0; ch < nChannels; ch++) {
    const midY = channelTop(tray.spec, ch) + (chHeightPx >> 1);
    for (let x = half; x <= chWidthPx - half; x += stride) positions.push({ ch, x });
    void midY;
  }
  const n = positions.length;
  const flat = new Float32Array(n * 3 * P * P);
  positions.forEach((pos, k) => {
    const midY = channelTop(tray.spec, pos.ch) + (chHeightPx >> 1);
    flat.set(extractPatch(tray, pos.x, midY), k * 3 * P * P);
  });

  const probs = await runLithoCNNBatch(flat, n);
  if (!probs) return null; // model not trained → caller uses the baseline
  const K = LITHOLOGIES.length;
  const ood = await runOODBatch(flat, n); // optional; null is fine

  // 2) per channel: argmax + conf, 3-tap smoothing, run-merge
  const chDepth = (depthToM - depthFromM) / nChannels;
  const out: Segment[] = [];
  let off = 0;
  for (let ch = 0; ch < nChannels; ch++) {
    const xs: number[] = [];
    const cls: number[] = [];
    const conf: number[] = [];
    const oodScore: number[] = [];
    while (off < n && positions[off].ch === ch) {
      let best = 0;
      for (let c = 1; c < K; c++) if (probs[off * K + c] > probs[off * K + best]) best = c;
      xs.push(positions[off].x);
      cls.push(best);
      conf.push(probs[off * K + best]);
      if (ood) {
        let mse = 0;
        for (let j = 0; j < 3 * P * P; j++) {
          const d = ood[off * 3 * P * P + j] - flat[off * 3 * P * P + j];
          mse += d * d;
        }
        oodScore.push(mse / (3 * P * P));
      } else oodScore.push(0);
      off++;
    }
    const sm = cls.slice();
    for (let i = 1; i < cls.length - 1; i++) if (cls[i - 1] === cls[i + 1] && cls[i] !== cls[i - 1]) sm[i] = cls[i - 1];
    const d0 = depthFromM + ch * chDepth;
    let i = 0;
    while (i < sm.length) {
      let j = i;
      let cs = 0;
      let os = 0;
      while (j < sm.length && sm[j] === sm[i]) {
        cs += conf[j];
        os += oodScore[j];
        j++;
      }
      const x0 = i === 0 ? 0 : Math.round((xs[i - 1] + xs[i]) / 2);
      const x1 = j >= sm.length ? chWidthPx : Math.round((xs[j - 1] + xs[j]) / 2);
      const meanConf = cs / (j - i);
      const meanOod = os / (j - i);
      out.push({
        channel: ch, x0, x1, litho: LITHOLOGIES[sm[i]], conf: meanConf,
        depthFrom: d0 + (x0 / chWidthPx) * chDepth, depthTo: d0 + (x1 / chWidthPx) * chDepth,
        ood: meanConf < oodThresh || (opts.oodMseThresh != null && meanOod > opts.oodMseThresh),
      });
      i = j;
    }
  }
  return out;
}
