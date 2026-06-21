"""Typed objects passed between pipeline stages — the inter-stage contract. Plain dataclasses (no heavy deps)."""
from __future__ import annotations

from dataclasses import dataclass

LITHOLOGIES = ("granite", "basalt", "sandstone", "limestone", "schist", "ore")  # matches frontend src/cv/types.ts
SUITES = ("porphyry", "sedimentary", "volcanic", "uniform", "sharp")
QUALITIES = ("clean", "shadow", "wet")


@dataclass(frozen=True)
class TrayDescriptor:
    """One validated core-tray descriptor (CONTRACT 1 output) — the tray geometry + the depth interval it covers.

    The per-PIXEL image of a real dropped tray is validated by the same module (io.contract.validate_image) against
    the image schema documented in data/README.md. For the synthetic cases the tray is regenerated from this
    descriptor + a seed by the TypeScript engine (frontend/src/cv/).
    """

    tray_id: str
    n_channels: int
    px_width: int            # along-core pixels per channel
    px_height: int           # pixels per channel (y)
    depth_from_m: float
    depth_to_m: float
    mm_per_px: float
    suite: str = "porphyry"  # one of SUITES (synthetic cases)
    quality: str = "clean"   # one of QUALITIES
    flags: tuple[str, ...] = ()
