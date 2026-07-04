# Frameworks

The research-chosen methods + libraries CoreLog actually uses (each one is used by the code, not aspirational).

- [01, the CV pipeline](frameworks/01_pipeline.md), the synthetic generator, the classical texture baseline, and
  run-merge segmentation.
- [02, the visualisation stack](frameworks/02_viz.md), the tray canvas + overlay, the SVG strip-log, the confusion
  matrix, and the shared `@fasl-work/caos-app-shell`.
- [03, the learned models](frameworks/03_torch-onnx.md), the lithology CNN + the OOD autoencoder, torch → ONNX →
  onnxruntime-web.
