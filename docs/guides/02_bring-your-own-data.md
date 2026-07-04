# Guide — bring your own tray

CoreLog aims to log **your** core tray, not just the synthetic cases — but in this build the app has **no tray
upload**: in-app ingestion of a real tray image is not implemented yet, and the App runs on the synthetic cases
only. What exists today is the CONTRACT 1 validation gate (`cllab/io/contract.py`, Python-side); the schema +
outlier policy are documented in [data-contracts](../architecture/08_data-contracts.md) and `data/README.md`.

## The tray-descriptor schema

A CSV (or any table) with one row per tray:

| column | unit | rule |
|---|---|---|
| `tray_id` | — | identifier |
| `n_channels` | count | 1–12; the number of parallel core channels in the photo |
| `px_width`, `px_height` | px | the per-channel pixel size (16–8000) |
| `depth_from_m`, `depth_to_m` | metres | the depth interval the tray covers; `to > from` |
| `mm_per_px` | mm/px | the image scale (0.02–5.0; > 2.0 is flagged as coarse) |
| `suite`, `quality` | — | optional (for the synthetic generator) |

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

- **Channels** — `n_channels` is how many parallel core rows the photo holds; the engine splits the height evenly.
- **Depth** — `depth_to_m` must exceed `depth_from_m`; the strip-log maps along-core x → depth within each channel's
  slice, top channel = shallowest.
- **Scale** — `mm_per_px` drives the flag for coarse imagery; below ~2 mm/px the texture is resolvable.
