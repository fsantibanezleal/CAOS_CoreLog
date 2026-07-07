# Guide, bring your own data

CoreLog logs **real** core, not just the synthetic cases. The App's first-level **Source selector** has two lanes:

- **Synthetic**, the procedural tray generator (sim knobs live).
- **Real sample**, real cropped core photos from the **DCID** dataset (Li et al. 2025, Petroleum Science, DOI
  10.1016/j.petsci.2025.04.013, **CC BY-NC 4.0**), committed verbatim (512x512) with attribution under
  `data/derived/real/` (served at `data/real/`). Its contract is `attribution.json` (schema `corelog.real/v1`):
  `{ id, image, dcid_class, litho_label, source, doi, license, provenance }`. DCID-7 has 7 classes
  (red/light sandstone, gray siltstone, mudstone, granite, basalt, marble) mapped to CoreLog's 6 lithologies as the
  accuracy truth (the mapping note is in `attribution.json`).

Inside the Real lane, the **Your image** tab is a genuine upload path: drop any core photo (jpg/png), it is decoded in
the browser and the SAME pipeline (sliding windows + baseline + lithology-CNN + core-ood ONNX) runs on your pixels.
Nothing is sent to a server.

**Honesty.** The learned models were trained on the synthetic generator, so real photos are out-of-distribution: the
predicted class is indicative. The domain gap shows in the low classifier confidence and the latent-space separation;
the reconstruction-based OOD signal is reported as a measured novelty ratio versus a frame-free synthetic-core reference
(and called weak when it does not exceed that reference, since the reconstruction-only detector is dominated by
frame-vs-core contrast, AUC 0.729).

For batch/offline ingestion of a real **multi-channel tray descriptor** (depth stitching, channel splitting), the
CONTRACT 1 validation gate below (`cllab/io/contract.py`, Python-side) is the entry point; the schema + outlier policy
are documented in [data-contracts](../architecture/08_data-contracts.md) and `data/README.md`.

## The tray-descriptor schema

A CSV (or any table) with one row per tray:

| column | unit | rule |
|---|---|---|
| `tray_id` | n/a | identifier |
| `n_channels` | count | 1–12; the number of parallel core channels in the photo |
| `px_width`, `px_height` | px | the per-channel pixel size (16–8000) |
| `depth_from_m`, `depth_to_m` | metres | the depth interval the tray covers; `to > from` |
| `mm_per_px` | mm/px | the image scale (0.02–5.0; > 2.0 is flagged as coarse) |
| `suite`, `quality` | n/a | optional (for the synthetic generator) |

A tiny valid example ships at `data/examples/trays.csv`.

## Validate it

```python
from cllab.io.contract import validate_records, validate_image
from cllab.io.formats import read_csv_rows

rep = validate_records(read_csv_rows("my_trays.csv"))
print(rep.summary())          # "N accepted, M rejected, K flagged"
for r in rep.rejected: print("REJECT", r["reason"])
for f in rep.flagged:  print("FLAG  ", f["flags"])

# or validate a single dropped image's metadata:
validate_image({"width": 1280, "height": 160, "n_channels": 4,
                "depth_from_m": 100, "depth_to_m": 101, "mm_per_px": 1})
```

Bad rows are **rejected with a reason** (never silently coerced); suspicious-but-usable rows are **flagged** (accepted;
the flag is recorded).

## What to check first

- **Channels**, `n_channels` is how many parallel core rows the photo holds; the engine splits the height evenly.
- **Depth**, `depth_to_m` must exceed `depth_from_m`; the strip-log maps along-core x → depth within each channel's
  slice, top channel = shallowest.
- **Scale**, `mm_per_px` drives the flag for coarse imagery; below ~2 mm/px the texture is resolvable.
