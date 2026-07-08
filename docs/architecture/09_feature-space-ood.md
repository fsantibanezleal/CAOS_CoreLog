# Feature-space OOD and the DCID-fine-tuned real head

This unit documents CoreLog's beyond-current-ladder step: replacing the weak reconstruction-MSE novelty score
with a principled **feature-space** out-of-distribution (OOD) detector, and training a lithology head on **real**
DCID-7 core so the Real lane can actually classify real rock. It is an empirical, real-data contribution, not a
new algorithm. Mahalanobis (Lee et al. 2018), kNN-OOD (Sun et al. 2022), energy (Liu et al. 2020) and MSP
(Hendrycks and Gimpel 2017) are established; the work here is selecting and MEASURING the score that separates
CoreLog's synthetic to real gap, with rigorous controls, and reporting the honest numbers including any null.

The offline benchmark is `data-pipeline/cllab/science/ood_bench.py` (run in `.venv-precompute`, torch). Its outputs
ship as compact artifacts: `data/derived/ood-bench.json` (the full table for the Benchmark page),
`data/derived/ood-detector.json` (the shipped live statistics), the augmented `lithology-cnn.onnx` (a new 64-d
feature output `f`) and `real-litho-cnn.onnx` (the DCID-7 head).

## 1. Why reconstruction-MSE is the wrong score

The incumbent OOD is a small patch autoencoder; its reconstruction MSE is the novelty score. A small AE trained
on simple synthetic textures reconstructs ANY smooth patch well, so real core photos reconstruct MORE easily than
some synthetic patches. On the honest same-task test (in-distribution = synthetic, OOD = real DCID), the
reconstruction score reaches only **AUROC 0.308** (below chance, because the ordering inverts) with
**FPR@95TPR 1.000**. This is the gap the feature-space score closes.

## 2. The scores (equations)

Softmax and predictive entropy over the classifier logits `z`:

```
p_c = e^{z_c} / sum_j e^{z_j},   H(x) = - sum_c p_c log p_c
```

- **MSP** (Hendrycks and Gimpel 2017): novelty = `1 - max_c p_c`.
- **Energy** (Liu et al. 2020): `E(x) = -T * log sum_c e^{z_c/T}`; in-distribution core has low energy.
- **Mahalanobis** (Lee et al. 2018), a class-conditional Gaussian with shared covariance fit on the training
  embeddings `f(x)`: `M(x) = min_c (f(x) - mu_c)^T Sigma^{-1} (f(x) - mu_c)`.
- **kNN-OOD** (Sun et al. 2022): the distance to the k-th nearest neighbour in an L2-normalized in-distribution
  embedding bank (k = 10 here).

## 3. Leakage-safe protocol

- **Split.** The dataset's OWN DCID-512-7 train/test split (distinct source images), plus a perceptual-hash
  dedupe across the two sides to drop near-duplicates. The RWDA augmentation folders (`noise-*`) are excluded
  entirely, so no augmented copy of a test image leaks into training.
- **Native DCID-7 space.** The real head is evaluated on DCID's 7 native classes (no mapping to CoreLog's 6),
  so confusion is not an artefact of the mapping.
- **Controlled resolution.** For the OOD comparison, both synthetic and real are funnelled through 24 px (the live
  window resolution) then upsampled identically, so a backbone cannot separate the two on raw blur instead of
  domain.
- **Data.** synthetic 6048 (4704 train holes / 1344 held-out holes), DCID train 2062, DCID test 829, dedupe
  dropped 49.

## 4. Measured results (this build)

OOD detection, in-distribution = synthetic held-out, OOD = real DCID-7 (higher AUROC and lower FPR@95 are better):

| Detector | Feature / logit space | AUROC | FPR@95 |
|---|---|---:|---:|
| MobileNetV3-Small, Mahalanobis | frozen ImageNet, funnel-24 | **0.9995** | 0.002 |
| MobileNetV3-Small, kNN | frozen ImageNet, funnel-24 | 0.9985 | 0.009 |
| ResNet18, kNN | frozen ImageNet, funnel-24 | 0.9876 | 0.050 |
| ResNet18, Mahalanobis | frozen ImageNet, funnel-24 | 0.9851 | 0.083 |
| LithoCNN, kNN | 64-d penultimate | 0.9554 | 0.164 |
| **LithoCNN, Mahalanobis (shipped live)** | 64-d penultimate | **0.9463** | 0.282 |
| MSP | LithoCNN logits | 0.8875 | 0.481 |
| Energy | LithoCNN logits | 0.8542 | 0.574 |
| Reconstruction-MSE (incumbent) | pixel AE | 0.3078 | 1.000 |

**Reading.** Every feature-space and logit-space score beats the reconstruction incumbent. The offline ceiling is
MobileNetV3-Small Mahalanobis (AUROC 0.9995). The detector shipped LIVE per window is LithoCNN Mahalanobis
(AUROC 0.9463, FPR@95 0.282), chosen because it reuses the classifier's own embedding and runs on every sliding
window in the browser at no extra model download. It clears the at-bar threshold: AUROC >= 0.85 AND a lower
FPR@95 than reconstruction.

**Real DCID-7 head.** A frozen MobileNetV3-Small backbone plus a linear head, trained on the real DCID-7 train
split, reaches **top-1 99.2%, macro-F1 99.2%** on the held-out real split (829 patches). A free head on the
synthetic LithoCNN's own 64-d embedding reaches top-1 88.8%; the MobileNet head is shipped as `real-litho-cnn.onnx`
(input 224 px, ~3.7 MB). The synthetic-trained CoreLog CNN, by contrast, is out-of-distribution on real core;
its real accuracy is the domain-mismatch confusion shown in the App.

## 5. Negative controls

- **Label-permutation null.** Shuffling the DCID-7 training labels and retraining the head collapses accuracy to
  **13.9%**, at chance (1/7 = 14.3%). No leakage.
- **Non-core control.** Pure noise and a smooth gradient are flagged OOD: every non-core patch exceeds the
  synthetic-ID 95th-percentile threshold, and the medians are monotone (non-core 3799 > real 202 > synthetic 21).
  Honest caveat: the strictest reading (every non-core patch above the single most extreme real patch) does NOT
  hold, in either the LithoCNN or the MobileNet space, because an extreme real DCID patch is as far from the
  synthetic distribution as noise is. That is a genuine property of a synthetic-trained model, not a defect.
- **Near-vs-far monotonicity.** Holds on the medians as above.

## 6. Honest scope

This closes the synthetic to one-real-dataset (DCID) gap with a principled score and a real-trained head. It does
not prove field readiness on other core datasets; a second dataset would test transfer. Domain-adaptation methods
that would CLOSE (not just detect) the gap, Deep CORAL (Sun and Saenko 2016) and DANN (Ganin et al. 2016), and
foundation backbones DINOv2 (Oquab et al. 2023) and MAE (He et al. 2022), are documented on the Methodology page
as the SOTA map but are not run here (too heavy for the browser).

### References

Lee et al. 2018 (arXiv:1807.03888); Sun et al. 2022 (PMLR 162); Liu et al. 2020 (arXiv:2010.03759); Hendrycks and
Gimpel 2017 (arXiv:1610.02136); Howard et al. 2019 MobileNetV3 (arXiv:1905.02244); He et al. 2016 ResNet
(DOI 10.1109/CVPR.2016.90); Sun and Saenko 2016 (arXiv:1607.01719); Ganin et al. 2016 (arXiv:1505.07818);
Li et al. 2025 DCID (DOI 10.1016/j.petsci.2025.04.013).
