# The precompute pipeline (two-language)

CoreLog's offline lane is **two-language** (like ChancaDEM / DispatchLab / PitForge): the heavy science is the SAME
TypeScript engine the browser runs, driven from Node via `tsx`; Python only orchestrates + reshapes. This avoids ever
re-implementing the CV engine in Python.

## The named stages (`cllab/stages/`)

| Stage | What (heavy lane) |
|---|---|
| `preprocess` | generate the synthetic core trays (the TS generator) |
| `feature_extraction` | assemble the learned-model training patches + labels + the baseline's prediction (`science/gen_train.mjs`) |
| `train` | fit the lithology CNN + the OOD AE → ONNX (`science/train_litho.py`, torch) |
| `infer` | segment every case's tray through the SAME TS engine (`science/bake_cases.mjs`) → `case-results.json` |
| `evaluate` | the CNN accuracy vs the classical baseline on the test split (patch-level; under re-evaluation, [issue #14](https://github.com/fsantibanezleal/CAOS_CoreLog/issues/14)) + the OOD AUC |
| `export` | build the compact per-case trace + manifest (CONTRACT 2), the LIGHT, numpy-only step |

## The two lanes of `cllab.pipeline`

```bash
python -m cllab.pipeline all              # LIGHT (numpy): reshape the committed case-results.json → traces + manifests
python -m cllab.pipeline all --retrain    # HEAVY: bake → gen_train → train_litho, then reshape
```

The **default is light**: the committed `data/derived/case-results.json` + `cl-learned.json` + the two `.onnx` ARE the
heavy lane's real outputs, so CI, the contract checks and the replay never need torch or Node. `--retrain` regenerates
them (it needs the `.venv-precompute` with torch + Node `tsx`).

```
bake_cases.mjs ──► data/derived/case-results.json        (per-case segmentation, baked by the TS engine)
gen_train.mjs  ──► data/raw/{litho-train,ood-patches}.json   (git-ignored training patches)
train_litho.py ──► data/derived/{lithology-cnn.onnx, core-ood.onnx, cl-learned.json}
pipeline.export──► data/derived/<case>/trace.json + manifests/<case>.json + index.json   (CONTRACT 2)
```

Determinism: the light pipeline is a pure function of the committed artifacts, re-running it is byte-identical (the
manifest carries no wall-clock; see [02](02_determinism-and-trace.md)).
