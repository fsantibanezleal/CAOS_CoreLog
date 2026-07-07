# Framework, the learned models (torch → ONNX → onnxruntime-web)

Two honest learned models, trained offline and run live. The generator ground truth is always the authority; these
compete with a **classical baseline** (the CNN) or flag **out-of-distribution** core (the AE).

## Training (`science/train_litho.py`, torch, `.venv-precompute`)

| Model | Architecture | Trained on | Baseline | Export |
|---|---|---|---|---|
| `lithology-cnn` | conv(3→16)·pool·conv(16→32)·pool·fc(64)·fc(6), softmax baked in | RGB patches + ground-truth lithology (`gen_train.mjs`) | the classical colour/texture model, on the SAME test patches | `lithology-cnn.onnx` (x → p) |
| `core-ood` | conv autoencoder 3→16→8→…→3 (sigmoid) | in-distribution core patches | reconstruction MSE separates the tray frame from core | `core-ood.onnx` (x → xr) |

`gen_train.mjs` bakes the classical baseline's prediction into the training table, so the CNN-vs-baseline comparison is
apples-to-apples on identical test patches (no moved goalpost).

## Inference (`frontend/src/lib/{ort,cnn}.ts`, onnxruntime-web)

WASM execution provider, single-threaded; the npm package and the CDN `wasmPaths` are pinned to the SAME version. The
loader is **graceful**, the trained ONNX ships committed, and if a model file is absent or fails to load it resolves
to `null` and the App falls back to the classical baseline + says so. `cnn.ts` batches every window patch of the tray
into ONE `run()` call, then run-merges; the OOD AE's reconstruction MSE marks uncertain segments.

## Honesty

The lithology-cnn accuracy vs the classical baseline uses a **leakage-safe grouped-by-hole split**
([issue #14](https://github.com/fsantibanezleal/CAOS_CoreLog/issues/14), fixed): every synthetic hole = (suite, seed)
goes ENTIRELY to train or test, so overlapping sliding windows from the same trays can no longer leak between train and
test (see [model evaluation](../architecture/06_model-evaluation.md)). Post-fix accuracy stays high (~0.99) because the
synthetic lithology classes are texturally separable. core-ood scores **AUC 0.729** (a moderate frame-vs-core
separation). Reported whichever way they land.
