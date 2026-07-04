"""Stage 2, feature_extraction (heavy lane): assemble the learned-model training patches (RGB CHW patches + their
ground-truth lithology labels) by running the SAME TS engine (`cllab/science/gen_train.mjs`). The patch contract is
the SINGLE SOURCE OF TRUTH in cllab/model/learned.py, reproduced byte-for-byte by the in-browser inference."""
