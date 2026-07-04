# The live / precompute gate

`cllab/core/gate.py` records, per case, whether it runs **live** (client-side) or falls back to **replay** of the
committed trace (ADR-0054). It is a **measurement written into the manifest**, never a hand-wave; `scripts/
check_artifacts.py` + CI fail on a mislabelled lane.

```python
classify_lane(client_side=True,
              runtimes={"ts-cv", "onnxruntime-web"},
              run_ms=...,            # a full tray segmentation, measured
              trace_bytes=...)       # the committed per-case trace size
```

A case is **live** iff it is client-side, its runtimes are a subset of the deployed client set
`{ts-cv, onnxruntime-web}`, a full segmentation completes within the interaction budget (`RUN_MS_GATE = 1500 ms`), and
its replay trace stays small (`TRACE_BYTES_GATE = 256 KB`). At teaching scale (a few channels × ~300 px) a full
sliding-window segmentation + CNN inference is tens of milliseconds and the trace is a few KB, so **every case is
LIVE**. The verdict + budgets go into the manifest; the raw wall-clock is used for the decision but never stored (it
would dirty git on re-run, see [determinism](02_determinism-and-trace.md)).
