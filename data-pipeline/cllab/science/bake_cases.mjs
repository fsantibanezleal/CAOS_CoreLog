// Bake the per-case tray segmentation through the SAME TypeScript CV engine the browser runs, and write
// data/derived/case-results.json — the committed, deterministic per-case outputs the LIGHT Python pipeline reshapes
// into per-case replay traces + manifests (CONTRACT 2). No Python re-port of the CV engine. The CLASSICAL baseline is
// baked here (it needs no training); the CNN results are added by --retrain once trained. Run after the SPA lives
// under frontend/:  node --import tsx data-pipeline/cllab/science/bake_cases.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES, caseSpec } from '../../../frontend/src/cv/cases.ts';
import {
  classifyTray,
  LITHO_INFO,
  LITHOLOGIES,
  makeBaselineClassifier,
  makeTray,
  scoreVsTruth,
} from '../../../frontend/src/cv/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DERIVED = resolve(HERE, '../../../data/derived');
mkdirSync(DERIVED, { recursive: true });

const baseClf = makeBaselineClassifier(7);
const r3 = (x) => Math.round(x * 1000) / 1000;
const r2 = (x) => Math.round(x * 100) / 100;

function stripLog(segments) {
  // depth-ordered bands across all channels (the strip log)
  return [...segments]
    .sort((a, b) => a.depthFrom - b.depthFrom)
    .map((s) => ({ depthFrom: r2(s.depthFrom), depthTo: r2(s.depthTo), litho: s.litho, conf: r3(s.conf), ood: !!s.ood }));
}
function compactSeg(s) {
  return { channel: s.channel, x0: s.x0, x1: s.x1, litho: s.litho, conf: r3(s.conf),
    depthFrom: r2(s.depthFrom), depthTo: r2(s.depthTo), ood: !!s.ood };
}

const cases = {};
for (const c of CASES) {
  const spec = caseSpec(c);
  const tray = makeTray(spec);
  const pred = classifyTray(tray, baseClf, { stride: 6 });
  const score = scoreVsTruth(tray, pred);
  cases[c.id] = {
    name: c.name,
    category: c.category,
    suite: c.suite,
    quality: c.quality,
    seed: c.seed,
    realOrSynthetic: c.realOrSynthetic,
    expectedBand: c.expectedBand,
    validationAnchor: c.validationAnchor,
    spec: { nChannels: spec.nChannels, chWidthPx: spec.chWidthPx, chHeightPx: spec.chHeightPx,
      depthFromM: spec.depthFromM, depthToM: spec.depthToM, mmPerPx: spec.mmPerPx, seed: spec.seed,
      suite: spec.suite, quality: spec.quality },
    truth: tray.truth.map(compactSeg),
    baseline: { segments: pred.map(compactSeg), pixelAccuracy: r3(score.pixelAccuracy), confusion: score.confusion },
    stripLog: stripLog(pred),
    lithoLegend: LITHOLOGIES.map((l) => ({ id: l, en: LITHO_INFO[l].en, es: LITHO_INFO[l].es, rgb: LITHO_INFO[l].rgb })),
  };
}

const out = { schema: 'corelog.case-results/v1', nCases: CASES.length, cases };
writeFileSync(resolve(DERIVED, 'case-results.json'), JSON.stringify(out), 'utf-8');
console.log(`baked ${CASES.length} cases -> ${resolve(DERIVED, 'case-results.json')}`);
