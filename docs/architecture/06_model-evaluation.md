# Model evaluation

CoreLog has two kinds of "model": the **deterministic CV pipeline** (the generator + segmentation, checked against the
generator's own ground truth) and **two learned models** (a CNN + an OOD autoencoder, measured against a baseline).

## The pipeline — oracles, not accuracy-on-faith

The generator emits the ground-truth segments for free, so the segmentation is checked for **correctness**:

- **The UNIFORM oracle** — a single-lithology tray (limestone) must classify as that lithology with > 0.85 pixel
  accuracy (`frontend/test/cv.test.ts`).
- **The SHARP oracle** — a tray with a known sharp boundary between two lithologies: the run-merge segmentation must
  recover a segment boundary within 20 px of the known cut, and both lithologies must be predicted.
- **Image-quality robustness** — clean ≥ shadow ≥ wet (a monotone accuracy drop as the lighting degrades) — a sanity
  property of the whole pipeline, checked in the bake.

## The learned models — vs a classical baseline (protocol under re-evaluation)

Both are trained offline (`science/train_litho.py`, torch) and reported next to the baseline they would replace. The
metrics live in `data/derived/cl-learned.json` and show in the App's Learned-models tab + Benchmark.

| Model | Task | Baseline | Metric (this build) |
|---|---|---|---|
| `lithology-cnn` | RGB patch → 6-way lithology | classical colour/texture nearest-centroid | accuracy **under re-evaluation** ([issue #14](https://github.com/fsantibanezleal/CAOS_CoreLog/issues/14)) |
| `core-ood` | patch → reconstruction (MSE = OOD score) | — (separates frame vs core) | **AUC 0.790** |

**Honesty.** The CNN is compared against the SAME classical baseline on the SAME test patches (gen_train.mjs bakes
the baseline's prediction into the training table), so the comparison itself is apples-to-apples. The split is
**grouped by synthetic HOLE = (suite, seed)** (`science/train_litho.py`): every hole goes ENTIRELY to train or to
test, so the overlapping stride-10 sliding windows of a tray can never straddle the split, and a hole's lithology
sequence photographed at another quality cannot leak either. This replaces the earlier random patch-level 80/20 that
inflated the accuracy ([issue #14](https://github.com/fsantibanezleal/CAOS_CoreLog/issues/14)). The gen_train table
carries a per-patch hole id (`g`); the trainer splits ~20% of holes to test and records the split kind in the
metrics artifact. The headline accuracy stays high after the fix (~0.99) because the synthetic lithology classes are
texturally separable, not because of memorisation — held-out holes are genuinely unseen. The OOD AUC (0.79) is
moderate — the autoencoder separates the dark uniform tray frame from textured core only partially, and we say so.
The generator ground truth is always the authority.
