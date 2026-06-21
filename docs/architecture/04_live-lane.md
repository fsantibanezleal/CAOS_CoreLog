# The live lane (TypeScript)

Unlike the SIR template (whose live lane is Pyodide-Python), CoreLog's live lane is **TypeScript** — the CV engine in
[`frontend/src/cv/`](../../frontend/src/cv/). The same modules run in the browser and in the offline Node bake (via
`tsx`), so there is exactly **one** implementation of the CV science — no Python re-port, no drift.

## The modules

| Module | Role |
|---|---|
| `rng.ts` | seeded mulberry32 + value noise (deterministic textures) |
| `textures.ts` | procedural per-lithology textures (granite/basalt/sandstone/limestone/schist/ore) + quality aug |
| `tray.ts` | the synthetic core-tray generator (RGBA + ground-truth segments) + CHW patch extraction |
| `features.ts` | the classical colour/texture nearest-centroid baseline classifier |
| `segment.ts` | slide a patch classifier + 3-tap smoothing + run-merge into segments + depth map + truth scoring |
| `cases.ts` | the 8 canonical cases (shared by the App and the bake) |

The lithology CNN runs via **onnxruntime-web** (`frontend/src/lib/{ort,cnn}.ts`) — WASM EP, single-threaded (GitHub
Pages has no COOP/COEP for threads); the npm package and the CDN wasmPaths are pinned to the same version. The CNN
path (`cnn.ts`) batches every window patch of the tray into ONE `run()` call, then run-merges — the same shape the
classical baseline produces. If the model is absent (not yet trained) the loader resolves to `null` and the App falls
back to the classical baseline.

## Live re-segment in the App

The App holds `(case, confidenceThreshold, classifier)` in state. On every change it re-generates the tray from the
spec and re-segments it (the baseline synchronously, or the CNN via a batched ONNX call), driving the tray overlay,
the depth strip-log, the confusion matrix and the per-channel view. This is the "interactive value-readout viz that
reacts to the controls" — a live segmentation, not a replay.
