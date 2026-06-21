# data/ — the data contract + layout

Governed by the **two data contracts** of ADR-0057 (see [docs/architecture/08_data-contracts.md](../docs/architecture/08_data-contracts.md)).

## Layout

| Path | What | Git |
|---|---|---|
| `raw/` | regenerable training patches (`gen_train.mjs`) | **git-ignored** |
| `examples/` | a tiny standard-format sample that PASSES Contract 1 (`trays.csv`) | committed |
| `derived/<case>/trace.json` | the compact per-case replay artifact (Contract 2) | committed |
| `derived/manifests/` | per-case `<case>.json` + the flat `index.json` inventory | committed |
| `derived/case-results.json` | the per-case segmentation, baked by the TS engine | committed |
| `derived/{lithology-cnn,core-ood}.onnx`, `cl-learned.json` | the trained learned models + metrics | committed |

## CONTRACT 1 — ingestion (the *bring-your-own-tray* gate)

Defined in `data-pipeline/cllab/io/contract.py`; full schema in
[the data-contracts doc](../docs/architecture/08_data-contracts.md) and the
[bring-your-own guide](../docs/guides/02_bring-your-own-data.md).

- **Tray descriptors** (`validate_records`): `tray_id, n_channels, px_width, px_height, depth_from_m, depth_to_m,
  mm_per_px` (+ optional `suite, quality`). Ranges enforced; an inverted depth interval or zero channels is rejected;
  an unusual aspect or coarse resolution is flagged.
- **Dropped images** (`validate_image`): the same policy over a real tray photo's metadata `{width, height,
  n_channels, depth_from_m, depth_to_m, mm_per_px}`.

A record is accepted iff it passes; bad records are rejected (never silently coerced); plausible-but-suspicious ones
are flagged (accepted; the flag travels into the manifest). The committed `examples/trays.csv` must pass (a CI test
asserts it).

## CONTRACT 2 — artifact (pipeline → web)

`data-pipeline/cllab/core/{trace.py, manifest.py}` (`corelog.trace/v1` + `manifest/v2`). The web loads only manifests
+ traces + the shared artifacts; `frontend/src/lib/contract.types.ts` mirrors the shapes so a drift fails `tsc`. **No
raw/heavy data is committed** — only the compact derived artifacts (the CI guards reject `.parquet/.h5/.mat/.npy`,
venvs, and native binaries; the synthetic tray images are generated procedurally, never stored as files).
