"""Stage 5 — evaluate (the TEST stage, heavy lane): the held-out metrics of the two learned models against their
baseline — the lithology CNN's accuracy + confusion vs the classical colour/texture nearest-centroid baseline, and the
OOD autoencoder's in- vs out-of-distribution AUC. Leakage-safe by a by-tray split. Metrics land in cl-learned.json;
invoked by `pipeline.retrain`."""
