// The canonical case set, shared by the offline bake (data-pipeline/cllab/science/bake_cases.mjs) and the SPA. Cases
// are grouped by CATEGORY (lithology suite / image quality / oracle control). The App shows ONE selected case;
// Experiments/Benchmark show cross-case summaries. All trays are SYNTHETIC (procedural textures), stated openly;
// C-UNIFORM and C-SHARP are the closed-form ORACLE controls.

import { type Quality, type Suite, type TraySpec } from './types.ts';

export interface CoreCase {
  id: string;
  name: string;
  category: string;
  suite: Suite;
  quality: Quality;
  nChannels: number;
  seed: number;
  expectedBand: string;
  validationAnchor: string;
  realOrSynthetic: string;
}

export const CAT_SUITE = 'lithology suite (the drilled sequence)';
export const CAT_QUALITY = 'image quality (lighting / wetness)';
export const CAT_ORACLE = 'oracle control (closed-form check)';

const W = 320;
const H = 40;
const MMPX = 1.0;

export const CASES: CoreCase[] = [
  { id: 'S-PORPH', name: 'Porphyry sequence (granite · schist · ore)', category: CAT_SUITE, suite: 'porphyry',
    quality: 'clean', nChannels: 4, seed: 11, realOrSynthetic: 'synthetic',
    expectedBand: 'alternating granite/schist with ore veins; the CNN should beat the colour baseline on the ore',
    validationAnchor: 'baseline pixel-accuracy > 0.6 (textures separable)' },
  { id: 'S-SED', name: 'Sedimentary sequence (sandstone · limestone)', category: CAT_SUITE, suite: 'sedimentary',
    quality: 'clean', nChannels: 4, seed: 12, realOrSynthetic: 'synthetic',
    expectedBand: 'bedded sandstone/limestone bands; high baseline accuracy',
    validationAnchor: 'segments map to monotone depth' },
  { id: 'S-VOLC', name: 'Volcanic sequence (basalt · schist)', category: CAT_SUITE, suite: 'volcanic',
    quality: 'clean', nChannels: 4, seed: 13, realOrSynthetic: 'synthetic',
    expectedBand: 'dark basalt with foliated schist; foliation is the diagnostic texture',
    validationAnchor: 'schist recovered via its foliation (texture, not just colour)' },
  { id: 'Q-CLEAN', name: 'Clean lighting', category: CAT_QUALITY, suite: 'porphyry', quality: 'clean',
    nChannels: 3, seed: 21, realOrSynthetic: 'synthetic',
    expectedBand: 'even lighting → the reference accuracy', validationAnchor: 'reference accuracy band' },
  { id: 'Q-SHADOW', name: 'Uneven lighting (shadow gradient)', category: CAT_QUALITY, suite: 'porphyry',
    quality: 'shadow', nChannels: 3, seed: 21, realOrSynthetic: 'synthetic',
    expectedBand: 'a left-right shadow gradient; colour-only baseline degrades, the CNN is more robust',
    validationAnchor: 'accuracy ≤ the clean case (a known robustness drop)' },
  { id: 'Q-WET', name: 'Wet vs dry core', category: CAT_QUALITY, suite: 'porphyry', quality: 'wet',
    nChannels: 3, seed: 21, realOrSynthetic: 'synthetic',
    expectedBand: 'wet core is darker with a slight specular sheen; the colour baseline shifts, texture helps',
    validationAnchor: 'accuracy ≤ the clean case' },
  { id: 'C-UNIFORM', name: 'Oracle, single-lithology tray', category: CAT_ORACLE, suite: 'uniform', quality: 'clean',
    nChannels: 2, seed: 31, realOrSynthetic: 'analytic control',
    expectedBand: 'one lithology (limestone) → the classifier must be ~all-correct on that class',
    validationAnchor: 'closed-form: pixel-accuracy > 0.85 on the single class' },
  { id: 'C-SHARP', name: 'Oracle, known sharp boundary', category: CAT_ORACLE, suite: 'sharp', quality: 'clean',
    nChannels: 1, seed: 33, realOrSynthetic: 'analytic control',
    expectedBand: 'two lithologies with a sharp cut → segmentation must recover the boundary',
    validationAnchor: 'closed-form: a segment boundary within 20 px of the known cut' },
];

export function caseSpec(c: CoreCase): TraySpec {
  return {
    id: c.id, nChannels: c.nChannels, chWidthPx: W, chHeightPx: H,
    depthFromM: 100, depthToM: 100 + 0.25 * c.nChannels, mmPerPx: MMPX, seed: c.seed, suite: c.suite, quality: c.quality,
  };
}
