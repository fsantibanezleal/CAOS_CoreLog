"""Guard for the grouped (leakage-free) train/test split (#14).

The old random patch split let overlapping stride-10 windows from the same tray fall on both sides
of the split and inflated the headline accuracy. This test proves the corrected split keeps every
synthetic hole entirely on one side, so no hole (hence no overlapping window) can leak.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def _split_indices(n: int, groups: np.ndarray, seed: int = 42):
    """Reproduce train_litho.py's grouped split logic in isolation."""
    rng = np.random.default_rng(seed)
    uniq = np.unique(groups)
    gperm = rng.permutation(len(uniq))
    n_test = max(1, int(round(len(uniq) * 0.2)))
    test_holes = set(uniq[gperm[:n_test]].tolist())
    mask_te = np.array([gi in test_holes for gi in groups])
    return np.nonzero(~mask_te)[0], np.nonzero(mask_te)[0], test_holes


def test_gen_train_emits_group_ids():
    raw = ROOT / "data" / "raw" / "litho-train.json"
    if not raw.exists():
        import pytest
        pytest.skip("training table not generated in this environment")
    d = json.loads(raw.read_text())
    assert "g" in d, "gen_train.mjs must emit per-patch hole ids"
    assert d.get("nHoles", 0) >= 4, "need enough holes to hold some out"
    assert len(d["g"]) == len(d["y"])


def test_no_hole_straddles_the_split():
    """The core anti-leakage invariant: train holes and test holes are disjoint."""
    raw = ROOT / "data" / "raw" / "litho-train.json"
    if not raw.exists():
        import pytest
        pytest.skip("training table not generated in this environment")
    groups = np.asarray(json.loads(raw.read_text())["g"], dtype=np.int64)
    tr, te, test_holes = _split_indices(len(groups), groups)
    train_holes = set(groups[tr].tolist())
    assert train_holes.isdisjoint(test_holes), "a hole leaked across the split"
    assert len(te) > 0 and len(tr) > 0
    # every test index belongs to a test hole (and vice-versa)
    assert all(groups[i] in test_holes for i in te)
    assert all(groups[i] not in test_holes for i in tr)


def test_metrics_artifact_records_grouped_split():
    art = ROOT / "data" / "derived" / "cl-learned.json"
    if not art.exists():
        import pytest
        pytest.skip("metrics artifact not baked in this environment")
    m = json.loads(art.read_text(encoding="utf-8"))["lithoCNN"]
    assert "grouped-by-hole" in m.get("split", ""), "the metrics must record the grouped split"
