# Framework — the learned models (torch → ONNX → onnxruntime-web)

Two honest learned models, trained offline and run live. The generator ground truth is always the authority; these
compete with a **classical baseline** (the CNN) or flag **out-of-distribution** core (the AE).

## Training (`science/train_litho.py`, torch, `.venv-precompute`)

| Model | Architecture | Trained on | Baseline | Export |
|---|---|---|---|---|
| `lithology-cnn` | conv(3→16)·pool·conv(16→32)·pool·fc(64)·fc(6), softmax baked in | RGB patches + ground-truth lithology (`gen_train.mjs`) | the classical colour/texture model, on the SAME held-out patches | `lithology-cnn.onnx` (x → p) |
| `core-ood` | conv autoencoder 3→16→8→…→3 (sigmoid) | in-distribution core patches | reconstruction MSE separates frame/no-recovery | `core-ood.onnx` (x → xr) |

`gen_train.mjs` bakes the classical baseline's prediction into the training table, so the CNN-vs-baseline comparison is
apples-to-apples on identical held-out patches (no moved goalpost).

## Inference (`frontend/src/lib/{ort,cnn}.ts`, onnxruntime-web)

WASM execution provider, single-threaded; the npm package and the CDN `wasmPaths` are pinned to the SAME version. The
loader is **graceful** — if a model file is absent (not yet trained) it resolves to `null` and the App falls back to
the classical baseline + shows the honest "pending training" state. `cnn.ts` batches every window patch of the tray
into ONE `run()` call, then run-merges; the OOD AE's reconstruction MSE marks uncertain segments.

## Honesty

Held-out numbers (see [model evaluation](../architecture/06_model-evaluation.md)): lithology-cnn accuracy **0.996 vs
the classical 0.939** (a real CNN win); core-ood **AUC 0.790** (a moderate frame-vs-core separation). Reported
whichever way they land; no metric is computed on training data.
