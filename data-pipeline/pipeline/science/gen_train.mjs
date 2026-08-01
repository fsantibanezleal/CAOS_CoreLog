// Generate the learned-model training patches by running the SAME TypeScript CV engine the browser runs, so the CNN
// trains on EXACTLY the textures the App shows, and is compared against the SAME classical baseline. Writes to
// data/raw/ (git-ignored, regenerable). Invoked by pipeline.retrain before train_litho.py. Run:
//   node --import tsx data-pipeline/cllab/science/gen_train.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  channelTop,
  extractPatch,
  LITHOLOGIES,
  makeBaselineClassifier,
  makeTray,
  PATCH,
  truthAt,
} from '../../../frontend/src/cv/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = resolve(HERE, '../../../data/raw');
mkdirSync(RAW, { recursive: true });

const baseClf = makeBaselineClassifier(7);
const lithoIdx = (l) => LITHOLOGIES.indexOf(l);
const D = 3 * PATCH * PATCH;

// a varied training set: every suite × quality × several seeds (kept separate from the App's case seeds where possible)
const SUITES = ['porphyry', 'sedimentary', 'volcanic'];
const QUAL = ['clean', 'shadow', 'wet'];
const SEEDS = [201, 211, 223, 233, 241, 251];

const X = []; // in-distribution patches (flat CHW)
const Y = []; // lithology label index
const B = []; // the classical baseline's prediction index (for a fair held-out comparison)
const OOD = []; // out-of-distribution patches (the tray frame + noise)

let trayId = 0;
// GROUP by synthetic HOLE = (suite, seed): the same lithology sequence photographed at different
// qualities is one hole. A grouped split (train_litho.py) keeps every hole entirely in train OR
// test, so overlapping stride-10 patches from the same tray can never leak across the split
// (the deep-review critical finding, a random patch split inflated the headline accuracy).
const G = []; // per-patch hole id (integer)
const holeIndex = new Map();
const holeId = (suite, seed) => {
  const key = `${suite}:${seed}`;
  if (!holeIndex.has(key)) holeIndex.set(key, holeIndex.size);
  return holeIndex.get(key);
};
for (const suite of SUITES) {
  for (const quality of QUAL) {
    for (const seed of SEEDS) {
      const spec = { id: `tr${trayId++}`, nChannels: 4, chWidthPx: 320, chHeightPx: 40, depthFromM: 0, depthToM: 1,
        mmPerPx: 1, seed, suite, quality };
      const hole = holeId(suite, seed);
      const tray = makeTray(spec);
      for (let ch = 0; ch < spec.nChannels; ch++) {
        const midY = channelTop(spec, ch) + (spec.chHeightPx >> 1);
        for (let x = PATCH; x <= spec.chWidthPx - PATCH; x += 10) {
          const litho = truthAt(tray, ch, x);
          if (!litho) continue;
          const patch = extractPatch(tray, x, midY);
          X.push(Array.from(patch, (v) => Math.round(v * 1000) / 1000));
          Y.push(lithoIdx(litho));
          G.push(hole);
          const p = baseClf(patch);
          let best = 0;
          for (let c = 1; c < p.length; c++) if (p[c] > p[best]) best = c;
          B.push(best);
        }
        // OOD: a patch centred on the dark inter-channel frame (below the channel)
        if (ch < spec.nChannels - 1) {
          const frameY = channelTop(spec, ch) + spec.chHeightPx + 3;
          OOD.push(Array.from(extractPatch(tray, spec.chWidthPx >> 1, frameY), (v) => Math.round(v * 1000) / 1000));
        }
      }
    }
  }
}

writeFileSync(resolve(RAW, 'litho-train.json'), JSON.stringify({ x: X, y: Y, base: B, g: G, nHoles: holeIndex.size, dim: D, classes: LITHOLOGIES }));
writeFileSync(resolve(RAW, 'ood-patches.json'), JSON.stringify({ x: OOD, dim: D }));
console.log(`gen_train: ${Y.length} labelled patches · ${OOD.length} OOD patches -> ${RAW}`);
