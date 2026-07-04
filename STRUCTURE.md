# CoreLog Vision, repository structure

Instantiated from the CAOS product-repo archetype ([ADR-0057](docs/architecture/01_overview.md)). The **frozen base**
(layout, the two contracts, the staged pipeline, the lane gate, the manifest/trace, CI guards) is never re-litigated;
the **per-product surface** is the CV engine + the visualisations + the cases + content.

```
CAOS_CoreLog/
├─ README.md · CHANGELOG.md · STRUCTURE.md · LICENSE · LICENSES.md · ATTRIBUTION.md
├─ pyproject.toml · .env.example · .gitignore · .gitattributes
├─ requirements*.txt · data-pipeline/requirements*.txt
├─ scripts/            setup · precompute · smoke · dev (.sh + .ps1)
├─ data-pipeline/
│  └─ cllab/                          # the two contracts + the staged pipeline (the CV engine itself is TS, below)
│     ├─ __init__.py (version) · pipeline.py (orchestrator+CLI, numpy-light + --retrain) · registry.py
│     ├─ io/     contract.py (CONTRACT 1: tray descriptor + dropped image) · schema.py · formats.py
│     ├─ core/   gate.py (live/precompute gate) · trace.py + manifest.py (CONTRACT 2) · rng.py
│     ├─ model/  learned.py (the 2 learned models' patch contracts, the SOURCE OF TRUTH the SPA reproduces)
│     ├─ stages/ preprocess · feature_extraction · train · infer · evaluate · export (thin over the science)
│     ├─ science/  bake_cases.mjs · gen_train.mjs (Node+tsx, the SAME TS engine) · train_litho.py (torch → ONNX)
│     └─ live.py  (dormant, the live lane is TypeScript, not Pyodide)
├─ data/
│  ├─ examples/  trays.csv (a tiny committed CONTRACT-1 sample)
│  ├─ derived/   case-results.json + per-case <case>/trace.json + manifests/ + the ONNX + cl-learned.json  (committed)
│  └─ raw/       (git-ignored, regenerable training patches)
├─ frontend/
│  ├─ src/cv/     THE CV ENGINE: rng · textures · tray · features (baseline) · segment · cases · index
│  ├─ src/pages/  Tool (App) · Introduction · Methodology · Implementation · Experiments · Benchmark
│  ├─ src/viz/    TrayView (canvas tray+overlay) · StripLog (depth log) · ConfusionMatrix
│  ├─ src/lib/    contract.types.ts (CONTRACT 2 mirror) · artifacts.ts · ort.ts · cnn.ts (batched CNN segmentation)
│  ├─ test/       cv.test.ts (oracles) · contract.test.ts   (node:test + tsx)
│  └─ copy-data.mjs · vite.config.ts · package.json
├─ app/           (dormant FastAPI, activate only on an ADR-0002 trigger)
├─ docs/          the navigable wiki (architecture · frameworks · cases · guides)
└─ .github/workflows/  ci.yml (python + frontend) · deploy-pages.yml
```

## The lanes

| Lane | Where | Deps |
|---|---|---|
| **Live (client)** | `frontend/src/cv/` (generator + segmentation) + onnxruntime-web (the CNN) | web npm |
| **Offline (precompute)** | `cllab/science/` (Node bake of the TS engine + torch training) | `requirements-precompute.txt` |
| **Replay (light)** | `cllab.pipeline` reshapes the committed bake → traces/manifests | `data-pipeline/requirements.txt` (numpy) |
| **API** | `app/` | dormant |
