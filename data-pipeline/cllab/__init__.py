"""cllab, CoreLog Vision's offline+light engine (ADR-0057). Drill-core lithology from core-tray imagery: a
per-patch lithology CNN + run-merge segmentation + a depth strip log. The CV core (the synthetic tray generator + the
segmentation + the classical baseline) is the TypeScript engine in frontend/src/cv/ (it runs in the browser AND in the
offline Node bake, no Python re-port); this package is the two data contracts, the staged pipeline, the lane gate, the
manifest/trace, and the cases-by-category registry. The default pipeline is numpy-light (it reshapes the committed
case-results.json into replay traces); `--retrain` regenerates the learned models (torch -> ONNX), see cllab/science/.
"""

__version__ = "0.08.000"  # display X.XX.XXX; PEP 440 form in pyproject.toml (0.8.0)
