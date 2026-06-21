"""CONTRACT 2 — artifact (pipeline -> web). The manifest is the authoritative, versioned record of a baked case: its
category, seed, engine+version, the shared learned-model ONNX, the compact per-case trace pointer + byte size, the
lane/gate verdict, the CONTRACT-1 flags, and the case metrics. The web loads ONLY manifests + traces + the shared
artifacts; frontend/src/lib/contract.types.ts mirrors this schema so a drift fails the build. The committed
case-results.json (baked by the SAME TS engine the browser runs) IS the real output of the offline lane; the learned
CNN is honest — measured against the classical colour/texture baseline, never a fabricated win."""
from __future__ import annotations

from typing import Any

from .. import __version__
from .trace import TRACE_SCHEMA

MANIFEST_SCHEMA = "corelog.manifest/v2"
INDEX_SCHEMA = "corelog.index/v1"

ENGINE_NOTE = ("procedural synthetic core-tray generator + run-merge segmentation (a sliding patch classifier merged "
               "into segments) + depth stitching; the same TS engine runs live in the browser and in the offline bake. "
               "The lithology CNN (torch->ONNX) runs live via onnxruntime-web; a classical colour/texture nearest-"
               "centroid model is the baseline.")
HONESTY = ("The core-tray images are SYNTHETIC (procedural per-lithology textures), stated openly; UNIFORM/SHARP are "
           "closed-form analytic controls. The lithology CNN is measured against the classical colour/texture baseline "
           "(held-out accuracy) — a real ML-vs-features comparison, never a fabricated win. Low-confidence / "
           "out-of-distribution core is flagged, not forced into a class.")


def shared_artifacts() -> dict:
    return {
        "models": [
            {"id": "lithology-cnn", "file": "lithology-cnn.onnx", "opset": 17, "kind": "per-patch lithology CNN"},
            {"id": "core-ood", "file": "core-ood.onnx", "opset": 17, "kind": "patch autoencoder (OOD / no-recovery)"},
        ],
        "learned_metrics": "cl-learned.json",
        "case_results": "case-results.json",
    }


def build_case_manifest(*, case: Any, seed: int, artifact_rel: str, trace_bytes: int,
                        gate: dict, flags: list[dict], metrics: dict) -> dict:
    return {
        "schema": MANIFEST_SCHEMA,
        "case_id": case.id,
        "name": case.name,
        "category": case.category,
        "real_or_synthetic": case.real_or_synthetic,
        "expected_band": case.expected_band,
        "validation_anchor": case.validation_anchor,
        "engine": {"package": "cllab", "version": __version__, "model": ENGINE_NOTE},
        "seed": seed,
        "shared": shared_artifacts(),
        "artifact": {"path": artifact_rel, "format": "json", "trace_schema": TRACE_SCHEMA, "bytes": trace_bytes},
        "lane": gate["lane"],
        "gate": gate,
        "flags": flags,
        "metrics": metrics,
        "honesty": HONESTY,
    }


def build_index(entries: list[dict]) -> dict:
    return {
        "schema": INDEX_SCHEMA,
        "engine_version": __version__,
        "n_cases": len(entries),
        "cases": sorted(entries, key=lambda e: e["case_id"]),
    }
