"""CONTRACT 2 (artifact) tests: a manifest points to a real trace with the recorded byte size, the lane verdict is
consistent with the gate, and the schema is the CoreLog one. Uses the committed case-results.json (no torch/node)."""
import json

from cllab import pipeline


def test_manifest_matches_artifact_and_gate():
    m = pipeline.precompute("S-PORPH", seed=7)
    artifact = pipeline.DERIVED / m["artifact"]["path"]
    assert artifact.exists() and artifact.stat().st_size == m["artifact"]["bytes"]
    assert m["schema"].startswith("corelog.manifest/")
    assert m["lane"] == m["gate"]["lane"] == "live", f"expected live, got {m['lane']} ({m['gate']['reasons']})"
    assert m["category"].startswith("lithology suite")


def test_oracle_case_trace_is_uniform():
    m = pipeline.precompute("C-UNIFORM", seed=7)
    trace = json.loads((pipeline.DERIVED / m["artifact"]["path"]).read_text(encoding="utf-8"))
    # the closed-form control: a single lithology, baseline near-perfect.
    assert trace["spec"]["suite"] == "uniform"
    assert trace["baseline"]["pixelAccuracy"] > 0.85
    assert all(s["litho"] == "limestone" for s in trace["truth"])
