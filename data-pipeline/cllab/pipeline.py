"""The offline pipeline orchestrator + CLI (ADR-0057). Per case it applies CONTRACT 1, builds the compact per-case
trace from the committed CV outputs (case-results.json) + the learned-model metrics (cl-learned.json, when present),
runs the lane gate, and writes the manifest + a flat index (CONTRACT 2). The committed case-results.json IS the TS
engine's real output (baked by the SAME engine the browser runs), so the DEFAULT path is light (numpy/stdlib, no
torch/node) and deterministic. `--retrain` regenerates the artifacts (bake the trays + segment them; train the learned
models torch → ONNX) — see cllab/science/.

    python -m cllab.pipeline                 # rebuild all replay traces + manifests from committed artifacts
    python -m cllab.pipeline S-PORPH         # one case
    python -m cllab.pipeline all --retrain   # re-bake case-results + train the learned models, then rebuild
"""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from . import registry
from .cases.core_cases import descriptor_row
from .core.manifest import build_index
from .io.contract import validate_records
from .io.formats import read_json, write_json
from .stages import export

REPO_ROOT = Path(__file__).resolve().parents[2]
DERIVED = REPO_ROOT / "data" / "derived"
MANIFESTS = DERIVED / "manifests"
SCIENCE = Path(__file__).resolve().parent / "science"


def _load_artifacts() -> tuple[dict, dict | None]:
    cr = DERIVED / "case-results.json"
    if not cr.exists():
        raise SystemExit(
            f"missing committed artifact {cr}. case-results.json is baked by the TS engine "
            f"(science/bake_cases.mjs) — run `python -m cllab.pipeline all --retrain` (or `npm run bake` in frontend/)."
        )
    learned_path = DERIVED / "cl-learned.json"
    learned = read_json(learned_path) if learned_path.exists() else None  # learned models optional until trained
    return read_json(cr), learned


def _contract_flags() -> list[dict]:
    """Apply CONTRACT 1 to the cases' tray descriptors — proves the ingestion gate, carries the flags."""
    return validate_records([descriptor_row(c) for c in registry.list_cases()]).flagged


def precompute(case_id: str, seed: int = 42,
               artifacts: tuple[dict, dict | None] | None = None, flags: list[dict] | None = None) -> dict:
    case = registry.get_case(case_id)
    case_results, learned = artifacts if artifacts is not None else _load_artifacts()
    return export.build_replay(
        case, derived_dir=str(DERIVED), manifests_dir=str(MANIFESTS),
        case_results=case_results, learned=learned,
        contract_flags=(flags if flags is not None else _contract_flags()), seed=seed,
    )


def _node(*args: str) -> None:
    subprocess.run(["node", "--import", "tsx", *args], check=True, cwd=str(REPO_ROOT))


def retrain(seed: int = 42) -> None:
    """HEAVY lane (two-language): re-bake the tray segmentation (the SAME TS engine) and train the learned models
    (torch → ONNX). The science is preserved verbatim in cllab/science/."""
    print("[retrain] bake case-results (TS tray generator + run-merge segmentation over the cases) ...", flush=True)
    _node(str(SCIENCE / "bake_cases.mjs"))
    train = SCIENCE / "train_litho.py"
    if train.exists():
        print("[retrain] generate the learned-model training patches (the SAME TS engine) ...", flush=True)
        _node(str(SCIENCE / "gen_train.mjs"))
        print("[retrain] torch train the learned models (lithology-cnn + core-ood) → ONNX ...", flush=True)
        vp = REPO_ROOT / ".venv-precompute" / "Scripts" / "python.exe"
        py = str(vp) if vp.exists() else "python"
        subprocess.run([py, str(train)], check=True, cwd=str(REPO_ROOT))
    else:
        print("[retrain] (science/train_litho.py absent — learned models pending; traces record learned=pending)",
              flush=True)
    print(f"[retrain] artifacts -> {DERIVED}", flush=True)


def run_all(seed: int = 42) -> list[dict]:
    artifacts = _load_artifacts()
    flags = _contract_flags()
    entries = []
    for c in registry.list_cases():
        precompute(c.id, seed=seed, artifacts=artifacts, flags=flags)
        entries.append({"case_id": c.id, "category": c.category, "manifest_path": f"manifests/{c.id}.json"})
    write_json(MANIFESTS / "index.json", build_index(entries))
    return entries


def main() -> None:
    ap = argparse.ArgumentParser(prog="cllab.pipeline")
    ap.add_argument("case", nargs="?", default="all", help="a case id, or 'all'")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--retrain", action="store_true",
                    help="re-bake case-results (TS engine) + train the learned models (torch) before rebuilding")
    args = ap.parse_args()
    if args.retrain:
        retrain(args.seed)
    if args.case == "all":
        entries = run_all(args.seed)
        print(f"precomputed {len(entries)} cases -> {DERIVED}")
        for e in entries:
            print(f"  {e['case_id']:10s} [{e['category']}]")
        print(f"index -> {MANIFESTS / 'index.json'}")
    else:
        m = precompute(args.case, args.seed)
        print(f"precomputed {args.case}: lane={m['lane']} bytes={m['artifact']['bytes']} "
              f"metrics={m['metrics']} -> {DERIVED / m['artifact']['path']}")


if __name__ == "__main__":
    main()
