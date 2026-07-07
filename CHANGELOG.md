# Changelog

All notable changes to CAOS CoreLog Vision. Versions follow `X.XX.XXX` (display), see `cllab.__version__` and
`frontend/package.json`. The project stays in `0.x` while the synthetic core-tray images anchor the metrics.

## [0.08.000], 2026-07-07

### Added, the Synthetic | Real-sample source lane (the Faena source-selector rule)
- A first-level **Source selector** (`Synthetic | Real sample`) at the top of the App sidebar. Real mode disables the
  synthetic generator knobs and exposes a **DCID** real-core patch picker (grouped by lithology).
- Integrated **DCID** (Drill Core Image Dataset, Li et al. 2025, Petroleum Science,
  DOI 10.1016/j.petsci.2025.04.013, **CC BY-NC 4.0**): 21 verbatim 512x512 RGB sample patches (3 per DCID-7 class)
  committed under `data/derived/real/` with `attribution.json` (schema `corelog.real/v1`, the data contract + the
  DCID-7 to CoreLog class mapping) and an in-panel provenance chip (DOI + license). Samples are verbatim/unmodified so
  they satisfy both the repo's CC BY-NC and the article's CC BY-NC-ND readings.
- A real patch runs the SAME live pipeline on its real pixels: `extractPatch` sliding windows, then classical baseline
  + lithology-CNN ONNX + core-ood ONNX. `extractPatch` now accepts any `RgbaImage` (synthetic tray or real photo).
- New genuine learned-representation views (both lanes): **OOD/novelty map** (per-window reconstruction MSE),
  **class-evidence map** (per-window occlusion saliency for the predicted class, honest, not Grad-CAM), and a
  **latent scatter** (PCA of the colour/texture features: synthetic clouds + current-image windows, showing the domain
  gap). The Real lane also adds a **per-session real confusion/recall** (truth = mapped DCID label) and a genuine
  **Your image** upload path (decode + classify in-browser, nothing leaves the page).

### Removed, the 4 forbidden meta-tabs
- Deleted the App's `Learned models` metrics table, `Contract - gate` manifest tab, `Bring your own` "not implemented"
  note and `Trace` JSON dump. Learned metrics live on Benchmark; the manifest/gate metadata is documented in
  Implementation; `Bring your own` became the real upload path in the Real lane. The App now carries 10 genuine domain
  views plus the lithology legend, no meta-tabs.

### Fixed, honesty (claims vs the engine)
- Removed the stale in-App note claiming split issue #14 is "under re-evaluation"; it was fixed in 0.07.000
  (grouped-by-hole, ~0.99). Corrected the same stale claim on the Introduction page, the architecture modal and three
  docs pages, plus the OOD AUC drift (0.790 -> 0.729, matching `cl-learned.json`).
- The Real-lane OOD verdict is **measured, not asserted**: the reconstruction MSE is compared to a frame-free
  synthetic-core reference and reported as a novelty ratio; when it does not exceed the reference the UI says so
  plainly (the reconstruction-only detector is weak, AUC 0.729) and points to the low classifier confidence and the
  latent-space gap as the real out-of-distribution evidence. No blanket "always fires".

### Changed, version sync
- All version surfaces aligned to **0.08.000** (`frontend/package.json` 0.8.0, `VERSION`, `pyproject.toml`,
  `cllab.__version__`, regenerated manifests `engine_version`). The shell footer now derives the display version from
  `package.json` via a vite `define`, so the footer can no longer drift.

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
