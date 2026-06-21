"""Feature contracts for the two learned models (the SINGLE SOURCE OF TRUTH shared by the offline trainer
science/train_litho.py and the in-browser inference). Both are honest, value-adding ML measured against a CLASSICAL
baseline — NOT bolted-on. They are trained OFFLINE (torch → ONNX) and run LIVE (onnxruntime-web). The exact
ground-truth (the generator) is the authority for scoring.

1. lithology-cnn — a per-patch lithology CLASSIFIER. Input: a PATCH×PATCH RGB patch (CHW, [1,3,P,P], values 0..1) →
   output: 6-way softmax over the lithologies. Benchmarked vs the classical colour/texture nearest-centroid baseline
   (frontend/src/cv/features.ts) on held-out patches (accuracy + confusion). The honest claim: "a small CNN beats
   hand-crafted colour/texture features on core lithology", reported whichever way it lands.

2. core-ood — a patch AUTOENCODER for out-of-distribution / no-recovery detection. Input/output: the same PATCH RGB
   patch; the reconstruction MSE is the OOD score (rubble, gaps, the tray frame reconstruct poorly → high score →
   flagged "uncertain / no recovery" instead of forced into a class). Benchmarked by its in- vs out-of-distribution
   separation (AUC).
"""
from __future__ import annotations

PATCH = 24                                  # matches frontend src/cv/types.ts PATCH
LITHO_CNN_INPUT_SHAPE = (1, 3, PATCH, PATCH)
LITHO_CNN_INPUT_NAME = "x"
LITHO_CNN_OUTPUT_NAME = "p"                  # 6-way softmax
N_CLASSES = 6

OOD_AE_INPUT_SHAPE = (1, 3, PATCH, PATCH)
OOD_AE_INPUT_NAME = "x"
OOD_AE_OUTPUT_NAME = "xr"                    # reconstruction; OOD score = MSE(x, xr)
