// CoreLog Vision CV engine — the live client-side core (also run from Node by the offline bake/train via tsx).
//
//   makeTray              — seeded synthetic core-tray generator (RGBA + ground-truth segments)
//   extractPatch          — CHW float32 patch for the classifier (CNN input layout)
//   makeBaselineClassifier — the classical colour/texture nearest-centroid baseline
//   classifyTray          — slide a PatchClassifier (CNN or baseline) + run-merge into segments
//   scoreVsTruth          — pixel accuracy + confusion vs the generator's ground truth
//
// Dependency-free (no DOM, no npm runtime deps) so the same engine runs in the browser and in the offline Node bake.

export * from './types.ts';
export { mulberry32, hashNoise, valueNoise } from './rng.ts';
export { lithoPixel, applyQuality } from './textures.ts';
export { makeTray, channelTop, extractPatch } from './tray.ts';
export { patchFeatures, fitBaseline, makeBaselineClassifier, N_FEAT } from './features.ts';
export { classifyChannel, classifyTray, scoreVsTruth, truthAt, type SegOpts, type TrayScore } from './segment.ts';
