"""The compact per-case TRACE = the web-replay artifact. Part of CONTRACT 2: its shape is mirrored by
frontend/src/lib/contract.types.ts, so a drift fails the web build. Each trace is built deterministically from the
committed CV outputs (case-results.json, produced by the SAME TS engine the browser runs) + the learned-model metrics
(cl-learned.json, when present). It carries the tray SPEC so the browser can re-segment LIVE, the ground-truth + the
baseline segments, the depth strip-log, and the model metrics. It references the shared ONNX, never copies it."""
from __future__ import annotations

from typing import Any


TRACE_SCHEMA = "corelog.trace/v1"


def _learned_block(learned: dict | None) -> dict:
    if not learned:
        return {"status": "pending-training", "lithoCNN": None, "ood": None}
    return {
        "status": "trained",
        "lithoCNN": learned.get("lithoCNN"),   # {acc, acc_baseline, nEval, classes}
        "ood": learned.get("ood"),             # {auc, nEval}
    }


def build_trace(case: Any, *, case_result: dict, learned: dict | None) -> dict:
    return {
        "schema": TRACE_SCHEMA,
        "case_id": case.id,
        "name": case.name,
        "category": case.category,
        "real_or_synthetic": case.real_or_synthetic,
        "expected_band": case.expected_band,
        "spec": case_result.get("spec"),                 # {nChannels, chWidthPx, chHeightPx, depthFromM, depthToM, mmPerPx, seed, suite, quality}
        "truth": case_result.get("truth", []),           # ground-truth segments
        "baseline": case_result.get("baseline", {}),     # {segments, pixelAccuracy, confusion} — the classical classifier
        "strip_log": case_result.get("stripLog", []),    # depth-ordered lithology bands
        "grade_legend": case_result.get("lithoLegend"),  # the lithology palette used
        "learned": _learned_block(learned),
    }
