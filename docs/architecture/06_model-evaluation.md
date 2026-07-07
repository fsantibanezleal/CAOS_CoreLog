# Model evaluation

CoreLog has two kinds of "model": the **deterministic CV pipeline** (the generator + segmentation, checked against the
generator's own ground truth) and **two learned models** (a CNN + an OOD autoencoder, measured against a baseline).

## The pipeline, oracles, not accuracy-on-faith

The generator emits the ground-truth segments for free, so the segmentation is checked for **correctness**:

- **The UNIFORM oracle**, a single-lithology tray (limestone) must classify as that lithology with > 0.85 pixel
  accuracy (`frontend/test/cv.test.ts`).
- **The SHARP oracle**, a tray with a known sharp boundary between two lithologies: the run-merge segmentation must
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
| `core-ood` | patch → reconstruction (MSE = OOD score) |, (separates frame vs core) | **AUC 0.729** |

**Honesty.** The CNN is compared against the SAME classical baseline on the SAME test patches (gen_train.mjs bakes
the baseline's prediction into the training table), so the comparison itself is apples-to-apples. The split is
**grouped by synthetic HOLE = (suite, seed)** (`science/train_litho.py`): every hole goes ENTIRELY to train or to
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
feeds the pipeline as one interval: decode, then the classical baseline + the lithology-CNN + the core-ood all run live
on the real pixels. Because both learned models were trained on the SYNTHETIC generator, real DCID pixels are
**out-of-distribution**: the predicted class is indicative only. The domain gap shows in three honest signals: the low
classifier confidence, the latent-space separation, and the OOD reconstruction ratio (mean reconstruction MSE measured
against a frame-free synthetic-core reference). The reconstruction-only OOD is a weak detector (AUC 0.729, dominated by
frame-vs-core contrast), so the novelty ratio is reported with its measured value and called weak when it does not
exceed the reference, rather than asserting a blanket "always fires". The real confusion
matrix accumulates per session and measures domain mismatch, not model skill. See `docs/guides/02_bring-your-own-data.md`
and `data/derived/real/attribution.json` for the data contract and the DCID-7 to CoreLog class mapping.
