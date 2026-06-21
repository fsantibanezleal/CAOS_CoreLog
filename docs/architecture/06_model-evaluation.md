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

## The learned models — held-out, vs a classical baseline

Both are trained offline (`science/train_litho.py`, torch) and reported next to the baseline they would replace. The
metrics live in `data/derived/cl-learned.json` and show in the App's Learned-models tab + Benchmark.

| Model | Task | Baseline | Held-out metric (this build) |
|---|---|---|---|
| `lithology-cnn` | RGB patch → 6-way lithology | classical colour/texture nearest-centroid | **accuracy 0.996** vs 0.939 |
| `core-ood` | patch → reconstruction (MSE = OOD score) | — (separates frame vs core) | **AUC 0.790** |

**Honesty.** The CNN is compared against the SAME classical baseline on the SAME held-out patches (gen_train.mjs bakes
the baseline's prediction into the training table), so the ~6-point win is real, not a moved goalpost. The OOD AUC
(0.79) is moderate — the autoencoder separates the dark uniform tray frame from textured core only partially, and we
say so. No metric is computed on training data; the split is a held-out fraction. The generator ground truth is always
the authority.
