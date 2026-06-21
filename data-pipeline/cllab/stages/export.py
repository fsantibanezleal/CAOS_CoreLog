"""Stage 6 — export (CONTRACT 2): build the compact per-case trace from the committed CV outputs (case-results.json,
baked by the SAME TS engine the browser runs) + the learned-model metrics (cl-learned.json, when trained), run the
lane gate, and write the manifest. No torch/node — so the contract + replay regenerate deterministically anywhere, and
CI stays fast. The HEAVY export (baking case-results.json + training the ONNX) is done by the preserved science
(cllab/science/bake_cases.mjs + train_litho.py), invoked by pipeline.retrain."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from ..core.gate import classify_lane
from ..core.manifest import build_case_manifest
from ..core.trace import build_trace
from ..io.formats import write_json

_RUN_MS = 80.0   # a teaching-scale tray segmentation — tens of ms; deterministic gate budget
_RUNTIMES = {"ts-cv", "onnxruntime-web"}


def _case_metrics(case_result: dict, learned: dict | None) -> dict:
    base = case_result.get("baseline", {}) or {}
    m = {
        "baseline_pixel_accuracy": float(base.get("pixelAccuracy", 0.0)),
        "n_segments": float(len(case_result.get("baseline", {}).get("segments", []))),
        "n_truth_segments": float(len(case_result.get("truth", []))),
    }
    if learned:
        cnn = (learned.get("lithoCNN") or {})
        m["cnn_accuracy"] = float(cnn.get("acc", 0.0))
        m["cnn_vs_baseline"] = float(cnn.get("acc", 0.0)) - float(cnn.get("acc_baseline", 0.0))
    return m


def build_replay(case: Any, *, derived_dir: str, manifests_dir: str,
                 case_results: dict, learned: dict | None, contract_flags: list[dict], seed: int) -> dict:
    cr = case_results["cases"][case.id]
    trace = build_trace(case, case_result=cr, learned=learned)
    artifact_rel = f"{case.id}/trace.json"
    trace_bytes = write_json(Path(derived_dir) / artifact_rel, trace)
    gate = classify_lane(client_side=True, runtimes=_RUNTIMES, run_ms=_RUN_MS, trace_bytes=trace_bytes)
    manifest = build_case_manifest(
        case=case, seed=seed, artifact_rel=artifact_rel, trace_bytes=trace_bytes,
        gate=gate, flags=contract_flags, metrics=_case_metrics(cr, learned),
    )
    write_json(Path(manifests_dir) / f"{case.id}.json", manifest)
    return manifest
