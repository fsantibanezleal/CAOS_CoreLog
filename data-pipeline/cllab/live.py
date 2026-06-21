"""LIVE-lane note (dormant). Unlike the SIR template, CoreLog's live lane is NOT Pyodide-Python — the CV pipeline runs
in the browser as the TypeScript engine in frontend/src/cv/ (the same code the offline bake runs via tsx), and the
lithology CNN runs via onnxruntime-web. There is therefore no Python live entrypoint; the offline pipeline below
(cllab.pipeline) only reshapes the committed engine outputs into replay traces. This module is the documented
placeholder so the archetype's lane map stays explicit (offline / live / replay)."""
from __future__ import annotations

LIVE_LANE = "typescript"  # frontend/src/cv/ + onnxruntime-web — not Pyodide
