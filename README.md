# CoreLog Vision, drill-core lithology from core-tray imagery

[![CI](https://img.shields.io/github/actions/workflow/status/fsantibanezleal/CAOS_CoreLog/ci.yml?branch=main&label=CI)](https://github.com/fsantibanezleal/CAOS_CoreLog/actions)
[![License](https://img.shields.io/github/license/fsantibanezleal/CAOS_CoreLog)](LICENSE)
[![Live demo](https://img.shields.io/badge/demo-live-2ea44f)](https://corelog.fasl-work.com)

[![CI](https://github.com/fsantibanezleal/CAOS_CoreLog/actions/workflows/ci.yml/badge.svg)](https://github.com/fsantibanezleal/CAOS_CoreLog/actions)
**Live:** https://corelog.fasl-work.com

CoreLog Vision automates drill-core lithology logging: pick a synthetic tray case and get
**per-segment lithology classification with confidence** + a **depth-stitched strip log**. The whole CV pipeline , 
the synthetic tray generator, the run-merge segmentation, and the lithology CNN, runs **live in your browser**.
In-app upload of your own tray image is **not implemented yet** (see "Tray-descriptor contract" below).

A CAOS/Faena mining web-app instantiated on the **product-repo archetype** ([ADR-0057](docs/architecture/01_overview.md)).

## What it does

- **Per-patch lithology CNN**, a small CNN classifies a sliding window along each core channel into one of 6
  lithologies (granite · basalt · sandstone · limestone · schist · ore) with a softmax confidence. Trained offline
  (torch → ONNX), run **live** (onnxruntime-web). Benchmarked vs a classical colour/texture baseline.
- **Run-merge segmentation**, adjacent same-class patches merge into segments; the segmentation emerges from the
  classifier, so there is no separate heavy segmenter.
- **Depth strip log**, segments map to depth → a vertical lithology log with confidence shading; low-confidence /
  out-of-distribution core is flagged (an OOD autoencoder), not forced into a class.
- **Tray-descriptor contract**, Contract 1 (Python pipeline) validates a tray descriptor `{tray_id, n_channels,
  px dims, depth, mm/px}`. There is no in-app ingestion of a real tray image yet, the app runs on the synthetic
  cases only.

## Honesty

The tray images are **synthetic** (procedural per-lithology textures), there are no real core photos. The
segmentation + metrics are real (scored against the generator ground truth). `C-UNIFORM`/`C-SHARP` are closed-form
analytic controls. The CNN is compared against the classical baseline on the same test patches, but the current
split is a random patch-level 80/20, overlapping sliding windows from the same trays leak between train and test , 
so the headline CNN accuracy is **under re-evaluation with a grouped split**
([issue #14](https://github.com/fsantibanezleal/CAOS_CoreLog/issues/14)). The OOD AE scores **AUC 0.790** (a
moderate frame-vs-core separation, and we say so).

## Quickstart

```bash
# light lane (numpy only), rebuild the replay artifacts + run the checks
python -m venv .venv-pipeline && .venv-pipeline/Scripts/pip install -r data-pipeline/requirements.txt -r requirements-dev.txt -e .
.venv-pipeline/Scripts/python -m cllab.pipeline all      # 8 cases → traces + manifests
.venv-pipeline/Scripts/python scripts/check_artifacts.py # CONTRACT 2 OK

# the SPA (the CV engine + CNN run live in the browser)
cd frontend && npm ci && npm run dev                     # http://localhost:5173
npm test                                                 # cv 4 + contract 5

# heavy lane (local only), re-bake + retrain the learned models (torch → ONNX)
python -m venv .venv-precompute && .venv-precompute/Scripts/pip install -r data-pipeline/requirements-precompute.txt
.venv-pipeline/Scripts/python -m cllab.pipeline all --retrain
```

## Layout

See [STRUCTURE.md](STRUCTURE.md) and the wiki in [docs/](docs/README.md). The CV engine is the TypeScript code in
[`frontend/src/cv/`](frontend/src/cv/) (it runs in the browser **and** in the offline Node bake, no Python re-port);
`data-pipeline/cllab/` is the two contracts + the staged pipeline + the lane gate.

## License

MIT, see [LICENSE](LICENSE). Third-party components in [LICENSES.md](LICENSES.md); attributions in
[ATTRIBUTION.md](ATTRIBUTION.md).
