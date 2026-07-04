# Changelog

All notable changes to CAOS CoreLog Vision. Versions follow `X.XX.XXX` (display), see `cllab.__version__` and
`frontend/package.json`. The project stays in `0.x` while the core-tray images are synthetic.

## [0.07.001], 2026-07-04

### Changed
- Content standards (ADR-0067): removed every em-dash from tracked content (replaced with commas, or
  "n/a" in table cells). No behaviour change. Added `scripts/check_content_standards.py` + wired it
  into the CI `guards` job so the repo cannot regress on em-dashes or emojis.

## [0.07.000], 2026-07-04

### Fixed, leakage-free grouped split (#14, deep-review critical finding)
- The lithology-CNN train/test split is now **grouped by synthetic HOLE = (suite, seed)** instead
  of a random patch-level 80/20. Overlapping stride-10 sliding windows from the same tray used to
  fall on both sides of the split, inflating the headline accuracy; now every hole goes entirely
  to train OR test (test holes unseen at any quality). gen_train.mjs emits a per-patch hole id
  (`g` + `nHoles`); train_litho.py splits ~20% of holes to test and records the split kind in the
  metrics artifact; Benchmark/Implementation/docs render the honest protocol. Post-fix accuracy
  ~0.99 (vs baseline ~0.93), it stays high because the synthetic lithology classes are texturally
  separable, not through memorisation, and that is stated. +3 anti-leakage guard tests (no hole
  straddles the split; the artifact records the grouped split). 12/12 tests, build green.

## [0.06.000], 2026-06-21

First complete build of CoreLog Vision on the CAOS product-repo archetype (ADR-0057).

### Added
- **The CV engine** (`frontend/src/cv/`), a dependency-free TypeScript pipeline: a seeded synthetic core-tray
  generator with procedural per-lithology textures (granite/basalt/sandstone/limestone/schist/ore) + image-quality
  augmentation (shadow/wet), a classical colour/texture nearest-centroid baseline, run-merge segmentation (a sliding
  patch classifier merged into segments), and depth stitching. Runs **live in the browser** and in the offline Node
  bake. Verified by the UNIFORM + SHARP oracles.
- **Two data contracts**, CONTRACT 1 (`io/contract.py`: tray-descriptor + dropped-image ingestion with an outlier
  policy) and CONTRACT 2 (`core/manifest.py` `corelog.manifest/v2` + `core/trace.py` `corelog.trace/v1`), with a TS
  mirror (`frontend/src/lib/contract.types.ts`) that fails `tsc` on drift.
- **8 cases by category** (`cases/core_cases.py`): 3 lithology suites, 3 image-quality scenarios, the UNIFORM + SHARP
  oracles, mirroring `frontend/src/cv/cases.ts`.
- **numpy-light pipeline** (`cllab.pipeline`) that reshapes the committed `case-results.json` (baked by the TS engine)
  into per-case replay traces + manifests; a two-language `--retrain` lane (Node bake → torch train → ONNX).
- **The frontend SPA**, the 6 standard pages on the shared `@fasl-work/caos-app-shell`. The App re-segments live as
  you pick a case / drag the confidence threshold / toggle CNN-vs-baseline, with 10 reacting tabs (the tray canvas +
  live segmentation overlay, the depth strip-log, a per-case confusion matrix, per-lithology recall, per-channel
  segments, the lithology legend, the learned-models metrics, contract·gate, bring-your-own, raw trace).
- **Two honest learned models** (torch → ONNX, live via onnxruntime-web): a per-patch lithology CNN (held-out accuracy
  0.996 vs the classical baseline 0.939) and an OOD autoencoder (AUC 0.790 separating the tray frame from core).
- The `docs/` wiki (ADR-0056), CI (`ci.yml` Python + frontend) + `deploy-pages.yml`, the two-venv split, and the root
  `README` / `STRUCTURE` / `LICENSES` / `ATTRIBUTION`.

### Verified running
ruff clean · pytest 9/9 · `cllab.pipeline all` (8 cases) · CONTRACT 2 OK · byte-identical re-run · npm test 9/9
(cv 4 + contract 5) · `npm run build` green.
