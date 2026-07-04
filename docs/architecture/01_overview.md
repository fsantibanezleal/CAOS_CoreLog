# Architecture, overview

CoreLog Vision is an instance of the **CAOS product-repo archetype** ([ADR-0057]): an offline-pipeline-heavy, backend-
optional product that deploys as a static, deterministic-replay viewer. The base is **frozen** (instantiated, never
re-litigated); per-product rework lives only in the **core**, the CV engine, the visualisations, the cases, content.

The distinctive thing about CoreLog is that the **CV pipeline is the live lane**: the tray generator + segmentation
are TypeScript that run in the browser, and the lithology CNN runs via onnxruntime-web, so the App re-segments the
tray as you change the case, the confidence threshold, or the classifier.

## The lanes (and what runs where)

| Lane | Where | Deps | Notes |
|---|---|---|---|
| **Live (client-side)** | `frontend/src/cv/` (generator + run-merge segmentation) + onnxruntime-web (the CNN) | web npm | the interactive core; re-segments on every control change |
| **Offline (precompute)** | `cllab/science/`, Node bake of the SAME TS engine + torch training | `data-pipeline/requirements-precompute.txt` | bakes `case-results.json` + the ONNX |
| **Replay (light)** | `cllab.pipeline` (numpy) | `data-pipeline/requirements.txt` | reshapes the committed bake → per-case traces + manifests |
| **API (backend)** | `app/` (FastAPI) | `requirements-api.txt` | DORMANT; activate only on an ADR-0002 trigger |

A measured **[gate](03_the-gate.md)** records the live-vs-replay verdict per case (at teaching scale every case is LIVE).

## The flow

`core-tray (synthetic or yours)` → **[CONTRACT 1](08_data-contracts.md)** (`io/contract.py`) → the TS CV engine
(bake) → `case-results.json` → **[CONTRACT 2](08_data-contracts.md)** (`core/manifest.py` + `core/trace.py`, the
compact per-case trace) → `data/derived/` (committed) → the `frontend/` App replays it **and** re-segments it live.

## Frozen base vs rework

- **Frozen:** the folder layout, the two contracts, the staged pipeline names, the gate, the manifest/trace, the
  two-venv split, the cases-by-category mechanism, CI guards.
- **Rework (the only per-product surface):** the CV engine (`frontend/src/cv/` + the stage bodies), the `frontend/`
  visualisations, and the cases + content.

## What CoreLog is and is NOT

- **Is:** a per-patch lithology classifier + run-merge segmentation + depth strip-log over synthetic core-tray
  imagery, with an honest CNN-vs-classical-baseline comparison and an OOD flag.
- **Is NOT:** a production core-logging product (no real photo ingestion pipeline, no mineralogy/assay integration, no
  geotechnical logging). The tray images are synthetic; the metrics are scored against the generator ground truth.

[ADR-0057]: ../../../conventions/architecture/0-archetype/ADR-0057-product-repo-archetype.md
