# Model evaluation

CoreLog has two kinds of "model": the **deterministic CV pipeline** (the generator + segmentation, checked against the
generator's own ground truth) and **two learned models** (a CNN + an OOD autoencoder, measured against a baseline).

## The pipeline, oracles, not accuracy-on-faith

The generator emits the ground-truth segments for free, so the segmentation is checked for **correctness**:

- **The uniform oracle**, a single-lithology tray (limestone) must classify as that lithology with > 0.85 pixel
  accuracy (`frontend/test/cv.test.ts`).
- **The sharp oracle**, a tray with a known sharp boundary between two lithologies: the run-merge segmentation must
  recover a segment boundary within 20 px of the known cut, and both lithologies must be predicted.
- **Image-quality robustness**, clean ≥ shadow ≥ wet (a monotone accuracy drop as the lighting degrades), a sanity
  property of the whole pipeline, checked in the bake.

## The learned models, vs a classical baseline (leakage-safe grouped split)

Both are trained offline (`science/train_litho.py`, torch) and reported next to the baseline they would replace. The
metrics live in `data/derived/cl-learned.json` and show on the Benchmark page (the App has no meta "learned-models" tab;
learned tools appear as genuine views: the OOD map, the class-evidence map and the latent scatter).

| Model | Task | Baseline | Metric (this build) |
|---|---|---|---|
| `lithology-cnn` | RGB patch → 6-way lithology | classical colour/texture nearest-centroid | accuracy **~0.99** on held-out holes (grouped-by-hole split, [issue #14](https://github.com/fsantibanezleal/CAOS_CoreLog/issues/14) fixed) |
| `core-ood` | patch → reconstruction (MSE = OOD score), separates frame vs core | reconstruction-MSE baseline | **AUC 0.729** |

**Honesty.** The CNN is compared against the same classical baseline on the same test patches (gen_train.mjs bakes
the baseline's prediction into the training table), so the comparison itself is apples-to-apples. The split is
**grouped by synthetic hole = (suite, seed)** (`science/train_litho.py`): every hole goes entirely to train or to
test, so the overlapping stride-10 sliding windows of a tray can never straddle the split, and a hole's lithology
sequence photographed at another quality cannot leak either. This replaces the earlier random patch-level 80/20 that
inflated the accuracy ([issue #14](https://github.com/fsantibanezleal/CAOS_CoreLog/issues/14)). The gen_train table
carries a per-patch hole id (`g`); the trainer splits ~20% of holes to test and records the split kind in the
metrics artifact. The headline accuracy stays high after the fix (~0.99) because the synthetic lithology classes are
texturally separable, not because of memorisation, held-out holes are genuinely unseen. The OOD AUC (0.729) is
moderate, the autoencoder separates the dark uniform tray frame from textured core only partially, and we say so.
The generator ground truth is always the authority.

## Real-sample lane (DCID), out-of-distribution by design

The App's Source selector adds a **Real sample** lane over the **DCID** drill-core image dataset (Li et al. 2025,
Petroleum Science, DOI 10.1016/j.petsci.2025.04.013, CC BY-NC 4.0). A real patch is a single cropped rock photo, so it
feeds the pipeline as one interval: decode, then the classical baseline + the lithology-CNN + the OOD detectors run
live on the real pixels. The synthetic-trained CoreLog CNN is **out-of-distribution** on real core, so its class
prediction is indicative only; the App exposes a **synthetic vs DCID-7 head** toggle so a real patch can also be
classified by a head trained on real rock (see below).

**Feature-space OOD (the beyond-current-ladder step, v0.09.000).** The reconstruction-MSE novelty score is weak: on
the honest same-task test (in-distribution = synthetic, OOD = real DCID) it reaches only AUROC 0.308 (real core
reconstructs more easily than synthetic). The replacement is a **feature-space Mahalanobis** score (Lee et al. 2018)
over the lithology CNN's 64-d penultimate embedding, fit on the synthetic training distribution and shipped as
`data/derived/ood-detector.json`; it runs live on every sliding window (the augmented `lithology-cnn.onnx` now emits
the feature `f`). Measured AUROC 0.946, FPR@95 0.282, clearing the at-bar threshold (>= 0.85 and a lower FPR@95 than
reconstruction). The offline benchmark also reports a frozen MobileNetV3-Small Mahalanobis ceiling (AUROC 0.9995) and
kNN, energy and MSP scores; the full table, the ROC overlay, the score histograms and the negative controls are on
the Benchmark page and in `docs/architecture/09_feature-space-ood.md`.

**DCID-fine-tuned real head.** A frozen MobileNetV3-Small backbone plus a linear head, trained on the real DCID-7
train split, classifies real core at **top-1 99.2% / macro-F1 99.2%** on a held-out real split (829 patches), shipped
as `real-litho-cnn.onnx`. The label-permutation null collapses to chance (13.9% vs 14.3%), confirming no leakage.
This is an empirical, real-data contribution, not a new algorithm. See `docs/architecture/09_feature-space-ood.md`,
`docs/guides/02_bring-your-own-data.md` and `data/derived/real/attribution.json` for the protocol, the data contract
and the DCID-7 to CoreLog class mapping.
