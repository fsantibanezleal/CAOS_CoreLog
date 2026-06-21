# The two data contracts

## CONTRACT 1 — ingestion (`io/contract.py`)

The *bring-your-own-tray* gate. Two entry points, one policy: a record is **accepted** iff it passes; ill-formed
records are **rejected** with a reason (never silently coerced); plausible-but-extreme records are **flagged**
(accepted; the flag travels into the manifest).

### Tray descriptors (`validate_records`) — one row per tray

| column | unit / range | on violation |
|---|---|---|
| `n_channels` | 1–12 | reject (zero/too many) |
| `px_width`, `px_height` | 16–8000 px | reject |
| `depth_from_m`, `depth_to_m` | metres; `to > from` | reject (inverted/empty interval) |
| `mm_per_px` | 0.02–5.0 mm/px (flag > 2.0) | reject / flag (coarse → unreliable segmentation) |
| `suite`, `quality` | ∈ the known sets | reject |
| channel aspect | flag outside 3–60 | flag (unusual crop) |

### Dropped images (`validate_image`) — a real tray photo's metadata

`{width, height, n_channels, depth_from_m, depth_to_m, mm_per_px}` → the same policy (per-channel px = width /
n_channels). Rejects non-positive dims, inverted depth, zero channels.

Committed sample that must pass: `data/examples/trays.csv` (a CI test asserts it).

## CONTRACT 2 — artifact (`core/{trace,manifest}.py`)

The pipeline → web contract. The web loads ONLY manifests + traces + the shared artifacts.

- **`corelog.trace/v1`** (per case): the tray spec, the **ground-truth** segments, the **baseline** segments +
  pixel-accuracy + confusion, the depth **strip-log**, the lithology legend, and the learned-model metrics
  (`status: trained | pending-training`).
- **`corelog.manifest/v2`** (per case): category, seed, engine + version, the **shared artifacts** (the two ONNX +
  `cl-learned.json` + `case-results.json`), the trace pointer + byte size, the lane/gate verdict, the CONTRACT-1
  flags, the metrics, and an honesty note.
- **`corelog.index/v1`**: the flat inventory of all 8 cases.

A TS mirror — `frontend/src/lib/contract.types.ts` — declares these shapes so a drift **fails `tsc`**.
`scripts/check_artifacts.py` enforces manifest ↔ artifact consistency (existence, byte size, lane == gate verdict).
