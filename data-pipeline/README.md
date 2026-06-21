# data-pipeline/ — the offline engine (`cllab`)

Rename `cllab` → `<slug>lab` per product. The **single source of physics/algorithm truth**; `frontend/` and
`app/` consume it, never re-implement it. Its own venv: **`.venv-pipeline`** (heavy SOTA engines, local-only).

## Layout (the package lives directly under `data-pipeline/`)
- `cllab/pipeline.py` — orchestrator + CLI (`python -m cllab.pipeline [all|<case>] [--seed N]`)
- `cllab/registry.py` — cases grouped by CATEGORY · `cllab/live.py` — Pyodide live entrypoint
- `cllab/io/` — `contract.py` (**CONTRACT 1**) · `formats.py` (standard readers/writers) · `schema.py` (types)
- `cllab/core/` — `rng.py` (seeded determinism) · `trace.py` · `manifest.py` (**CONTRACT 2**) · `gate.py`
- `cllab/model/` — the shared pure-Python core (Pyodide-safe); EXAMPLE = SIR
- `cllab/stages/` — `preprocess → feature_extraction → train → infer → evaluate → export`
- `cllab/cases/` — documented cases

Setup + run: `scripts/setup.{sh,ps1}` then `scripts/precompute.{sh,ps1}`. See
[../docs/architecture/05_precompute-pipeline.md](../docs/architecture/05_precompute-pipeline.md).
