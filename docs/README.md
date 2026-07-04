# CoreLog Vision, documentation

The navigable wiki for CoreLog Vision: drill-core **lithology** from core-tray imagery (per-patch CNN + run-merge
segmentation + a depth strip-log), with the whole CV pipeline running live in the browser. Instantiated on the CAOS
product-repo archetype (ADR-0057).

- **[Architecture](architecture.md)**, the archetype, the lanes, the gate, the two data contracts, determinism,
  deploy.
- **[Frameworks](frameworks.md)**, the CV pipeline (generator + segmentation), the viz stack, the learned models
  (torch → ONNX).
- **[Cases](cases.md)**, the 8 cases by category + their validation anchors.
- **[Guides](guides.md)**, instantiate, run the precompute/retrain lane, bring your own tray.

## One-paragraph orientation

The CV engine is the **TypeScript code** in [`frontend/src/cv/`](../frontend/src/cv/): a seeded synthetic core-tray
generator (procedural per-lithology textures), a classical colour/texture baseline classifier, and run-merge
segmentation (a sliding patch classifier merged into segments + depth stitching). It runs *live in the browser* (the
App re-segments as you change the case / threshold / classifier) **and** in the offline Node bake (no Python re-port).
The Python package [`cllab`](../data-pipeline/cllab/) is the two data contracts + the staged pipeline + the lane gate;
its default lane is numpy-light (it reshapes the committed bake into replay traces), and a `--retrain` lane re-bakes
the cases and trains the lithology CNN + the OOD autoencoder (torch → ONNX).
