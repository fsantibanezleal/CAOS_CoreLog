# data-pipeline/ — the offline engine (`cllab`)

The two data contracts + the staged pipeline + the lane gate. **The CV engine itself is NOT here** — it is the
TypeScript code in [`frontend/src/cv/`](../frontend/src/cv/), run live in the browser and from Node in the bake (no
Python re-port). `cllab` orchestrates the bake, applies the contracts, and reshapes the committed outputs into replay
traces.

## Two venvs

- **`.venv-pipeline`** (`requirements.txt`, numpy-only) — the default light lane + CI + the contract checks.
- **`.venv-precompute`** (`requirements-precompute.txt`, + torch + onnx) — the heavy `--retrain` lane (local only).

## Layout (the package lives directly under `data-pipeline/`)

- `cllab/pipeline.py` — orchestrator + CLI (`python -m cllab.pipeline [all|<case>] [--retrain]`)
- `cllab/registry.py` — cases grouped by CATEGORY · `cllab/live.py` — dormant (the live lane is TypeScript)
- `cllab/io/` — `contract.py` (**CONTRACT 1**: tray descriptor + dropped image) · `formats.py` · `schema.py`
- `cllab/core/` — `rng.py` · `trace.py` · `manifest.py` (**CONTRACT 2**) · `gate.py` (live/precompute gate)
- `cllab/model/` — `learned.py` (the 2 learned models' patch contracts — the source of truth the SPA reproduces)
- `cllab/stages/` — `preprocess → feature_extraction → train → infer → evaluate → export` (thin over the science)
- `cllab/science/` — `bake_cases.mjs` · `gen_train.mjs` (Node + tsx, the SAME TS engine) · `train_litho.py` (torch → ONNX)

## The default lane is light

`python -m cllab.pipeline all` reshapes the committed `data/derived/case-results.json` + `cl-learned.json` into
per-case traces + manifests — numpy only, no torch, no Node. `--retrain` regenerates the heavy artifacts (bake →
gen_train → train_litho). See [the precompute guide](../docs/guides/01_precompute-pipeline.md).
