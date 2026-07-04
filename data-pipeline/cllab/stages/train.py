"""Stage 3, train (OFFLINE, heavy lane): fit the two learned models on the patch tables, a per-patch lithology CNN
(lithology-cnn) and a patch autoencoder for OOD/no-recovery (core-ood), and export them to ONNX. Deterministic
(seeded). Delegates to `cllab/science/train_litho.py` (torch); writes lithology-cnn.onnx, core-ood.onnx and the
metrics cl-learned.json to data/derived/."""
