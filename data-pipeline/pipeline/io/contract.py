"""CONTRACT 1, ingestion (raw core-tray → pipeline). The *bring-your-own-tray* gate.

Two entry points, one policy:

* ``validate_records``, validates TRAY-DESCRIPTOR rows (one per tray: geometry + depth interval). This is what the
  pipeline runs over the case set; it proves the gate and carries flags into the manifest.
* ``validate_image``, validates a real dropped core-tray IMAGE's metadata (dimensions, channel layout, depth). This
  is the path that lets CoreLog log a NEW tray instead of only replaying the baked cases.

A record is ACCEPTED iff it passes; ill-formed records are REJECTED with a reason (never silently coerced);
plausible-but-extreme records are FLAGGED (accepted; the flag travels into the manifest). Documented in data/README.md.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from .schema import QUALITIES, SUITES, TrayDescriptor

REQUIRED_COLUMNS: tuple[str, ...] = (
    "tray_id", "n_channels", "px_width", "px_height", "depth_from_m", "depth_to_m", "mm_per_px",
)
CHANNELS_RANGE = (1, 12)
PX_RANGE = (16, 8000)
MMPX_RANGE = (0.02, 5.0)            # mm per pixel, outside this the resolution is implausible
ASPECT_FLAG = (3.0, 60.0)          # channel width:height outside this band → FLAG (unusual tray crop)
MMPX_FLAG_HI = 2.0                 # very coarse resolution → FLAG (segmentation will be unreliable)


@dataclass
class ContractReport:
    accepted: list
    rejected: list[dict[str, Any]]
    flagged: list[dict[str, Any]]

    @property
    def ok(self) -> bool:
        return len(self.accepted) > 0

    def summary(self) -> str:
        return f"{len(self.accepted)} accepted, {len(self.rejected)} rejected, {len(self.flagged)} flagged"


def validate_records(raw_rows: list[dict[str, Any]]) -> ContractReport:
    """Apply CONTRACT 1 to raw tray-descriptor rows (e.g. from a CSV). Pure; deterministic; no I/O."""
    accepted: list[TrayDescriptor] = []
    rejected: list[dict[str, Any]] = []
    flagged: list[dict[str, Any]] = []

    for i, row in enumerate(raw_rows):
        tid = str(row.get("tray_id", f"row{i}"))
        missing = [c for c in REQUIRED_COLUMNS if c not in row or row[c] in (None, "")]
        if missing:
            rejected.append({"row": i, "tray_id": tid, "reason": f"missing/empty columns: {missing}"})
            continue
        try:
            nch = int(float(row["n_channels"]))
            pw = int(float(row["px_width"]))
            ph = int(float(row["px_height"]))
            df = float(row["depth_from_m"])
            dt = float(row["depth_to_m"])
            mmpx = float(row["mm_per_px"])
        except (TypeError, ValueError):
            rejected.append({"row": i, "tray_id": tid, "reason": "non-numeric numeric field"})
            continue
        suite = str(row.get("suite", "porphyry"))
        quality = str(row.get("quality", "clean"))

        bad: list[str] = []
        if not (CHANNELS_RANGE[0] <= nch <= CHANNELS_RANGE[1]):
            bad.append(f"n_channels={nch} out of {CHANNELS_RANGE}")
        if not (PX_RANGE[0] <= pw <= PX_RANGE[1]):
            bad.append(f"px_width={pw} out of {PX_RANGE}")
        if not (PX_RANGE[0] <= ph <= PX_RANGE[1]):
            bad.append(f"px_height={ph} out of {PX_RANGE}")
        if not (MMPX_RANGE[0] <= mmpx <= MMPX_RANGE[1]):
            bad.append(f"mm_per_px={mmpx:g} out of {MMPX_RANGE}")
        if any(math.isnan(v) or math.isinf(v) for v in (df, dt, mmpx)):
            bad.append("NaN/Inf value")
        if dt <= df:
            bad.append(f"depth interval inverted/empty: from={df:g} to={dt:g}")
        if suite not in SUITES:
            bad.append(f"suite={suite!r} not in {sorted(SUITES)}")
        if quality not in QUALITIES:
            bad.append(f"quality={quality!r} not in {sorted(QUALITIES)}")
        if bad:
            rejected.append({"row": i, "tray_id": tid, "reason": "; ".join(bad)})
            continue

        rec_flags: list[str] = []
        aspect = pw / ph if ph > 0 else math.inf
        if not (ASPECT_FLAG[0] <= aspect <= ASPECT_FLAG[1]):
            rec_flags.append(f"channel aspect {aspect:.1f} outside [{ASPECT_FLAG[0]},{ASPECT_FLAG[1]}], unusual crop")
        if mmpx > MMPX_FLAG_HI:
            rec_flags.append(f"coarse resolution {mmpx:g} mm/px (> {MMPX_FLAG_HI}), segmentation may be unreliable")
        if rec_flags:
            flagged.append({"tray_id": tid, "flags": rec_flags})
        accepted.append(TrayDescriptor(tray_id=tid, n_channels=nch, px_width=pw, px_height=ph, depth_from_m=df,
                                       depth_to_m=dt, mm_per_px=mmpx, suite=suite, quality=quality,
                                       flags=tuple(rec_flags)))
    return ContractReport(accepted=accepted, rejected=rejected, flagged=flagged)


def validate_image(meta: dict[str, Any]) -> ContractReport:
    """Apply CONTRACT 1 to a real dropped tray IMAGE's metadata: {width, height, n_channels, depth_from_m,
    depth_to_m, mm_per_px}. Rejects non-positive dims, inverted depth, zero channels; flags odd aspect / low res."""
    width = meta.get("width")
    height = meta.get("height")
    row = {
        "tray_id": str(meta.get("tray_id", "dropped")),
        "n_channels": meta.get("n_channels", 1),
        "px_width": (int(width) // max(1, int(meta.get("n_channels", 1)))) if width else 0,
        "px_height": (int(height) // max(1, int(meta.get("n_channels", 1)))) if height else 0,
        "depth_from_m": meta.get("depth_from_m", 0.0),
        "depth_to_m": meta.get("depth_to_m", 0.0),
        "mm_per_px": meta.get("mm_per_px", 1.0),
        "suite": "porphyry",
        "quality": meta.get("quality", "clean"),
    }
    return validate_records([row])
