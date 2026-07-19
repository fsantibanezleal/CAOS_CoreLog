# CoreLog Vision, drill-core lithology from core-tray imagery

[![CI](https://img.shields.io/github/actions/workflow/status/fsantibanezleal/CAOS_CoreLog/ci.yml?branch=main&label=CI)](https://github.com/fsantibanezleal/CAOS_CoreLog/actions)
[![License](https://img.shields.io/github/license/fsantibanezleal/CAOS_CoreLog)](LICENSE)
[![Live demo](https://img.shields.io/badge/demo-live-2ea44f)](https://corelog.fasl-work.com)

[![CI](https://github.com/fsantibanezleal/CAOS_CoreLog/actions/workflows/ci.yml/badge.svg)](https://github.com/fsantibanezleal/CAOS_CoreLog/actions)
**Live:** https://corelog.fasl-work.com

CoreLog Vision automates drill-core lithology logging: pick a tray case and get
**per-segment lithology classification with confidence** + a **depth-stitched strip log**. The whole CV pipeline,
the synthetic tray generator, the run-merge segmentation, and the lithology CNN, runs **live in the browser**.
The App has a Synthetic / Real source selector: the synthetic lane runs on procedural tray cases, and the real
lane runs the DCID lithology head on real core-tray patches (see "Tray-descriptor contract" below).

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
  px dims, depth, mm/px}`. The App's real lane runs the DCID lithology head on indexed real core-tray patches;
  the synthetic lane runs the procedural cases.

## Honesty

The synthetic-lane tray images are **synthetic** (procedural per-lithology textures); the real lane runs on real
core-tray patches through the DCID head. The segmentation + metrics are real (scored against the generator ground
truth). `C-UNIFORM`/`C-SHARP` are closed-form analytic controls. The CNN is compared against the classical
baseline on the same test patches with a **leakage-safe grouped-by-hole split**
([issue #14](https://github.com/fsantibanezleal/CAOS_CoreLog/issues/14), fixed), so the headline accuracy is not
inflated by overlapping sliding windows leaking between train and test. The reconstruction-only OOD AE scores a
moderate **AUC 0.729** (frame-vs-core separation, stated plainly); the shipped detector is feature-space
Mahalanobis, which is why the App reports both.

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
