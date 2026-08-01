"""CoreLog cases spanning CATEGORIES (the core-tray lithology problem-type taxonomy). The App shows ONE selected case;
Experiments/Benchmark show cross-case summaries by category. The cases mirror the SPA's src/cv/cases.ts. All trays are
SYNTHETIC (procedural textures); UNIFORM and SHARP are the closed-form ORACLE controls (the classifier/segmentation
must match the generator's ground truth)."""
from __future__ import annotations

from dataclasses import dataclass

CAT_SUITE = "lithology suite (the drilled sequence)"
CAT_QUALITY = "image quality (lighting / wetness)"
CAT_ORACLE = "oracle control (closed-form check)"


@dataclass(frozen=True)
class Case:
    id: str                       # matches src/cv/cases.ts
    name: str
    category: str
    suite: str
    quality: str
    n_channels: int
    seed: int
    expected_band: str
    validation_anchor: str
    real_or_synthetic: str = "synthetic"


# the standard teaching tray geometry (mirrors src/cv/cases.ts)
_W, _H, _MMPX = 320, 40, 1.0


CASES: list[Case] = [
    Case("S-PORPH", "Porphyry sequence (granite · schist · ore)", CAT_SUITE, "porphyry", "clean", 4, 11,
         expected_band="alternating granite/schist with ore veins; the CNN should beat the colour baseline on the ore",
         validation_anchor="baseline pixel-accuracy > 0.6 (textures separable)"),
    Case("S-SED", "Sedimentary sequence (sandstone · limestone)", CAT_SUITE, "sedimentary", "clean", 4, 12,
         expected_band="bedded sandstone/limestone bands; high baseline accuracy",
         validation_anchor="segments map to monotone depth"),
    Case("S-VOLC", "Volcanic sequence (basalt · schist)", CAT_SUITE, "volcanic", "clean", 4, 13,
         expected_band="dark basalt with foliated schist; schist foliation is the diagnostic texture",
         validation_anchor="schist recovered via its foliation (texture, not just colour)"),
    Case("Q-CLEAN", "Clean lighting", CAT_QUALITY, "porphyry", "clean", 3, 21,
         expected_band="even lighting → the reference accuracy", validation_anchor="reference accuracy band"),
    Case("Q-SHADOW", "Uneven lighting (shadow gradient)", CAT_QUALITY, "porphyry", "shadow", 3, 21,
         expected_band="a left-right shadow gradient; colour-only baseline degrades, the CNN is more robust",
         validation_anchor="accuracy ≤ the clean case (a known robustness drop)"),
    Case("Q-WET", "Wet vs dry core", CAT_QUALITY, "porphyry", "wet", 3, 21,
         expected_band="wet core is darker/more saturated; the colour baseline shifts, texture helps",
         validation_anchor="accuracy ≤ the clean case"),
    Case("C-UNIFORM", "Oracle, single-lithology tray", CAT_ORACLE, "uniform", "clean", 2, 31,
         expected_band="one lithology (limestone) → the classifier must be ~all-correct on that class",
         validation_anchor="closed-form: pixel-accuracy > 0.85 on the single class", real_or_synthetic="analytic control"),
    Case("C-SHARP", "Oracle, known sharp boundary", CAT_ORACLE, "sharp", "clean", 1, 33,
         expected_band="two lithologies with a sharp cut → segmentation must recover the boundary",
         validation_anchor="closed-form: a segment boundary within 20 px of the known cut", real_or_synthetic="analytic control"),
]


def descriptor_row(c: Case) -> dict:
    """The CONTRACT-1 tray-descriptor row for a case (used by the pipeline's contract check)."""
    depth_span = 0.25 * c.n_channels  # ~0.25 m of core per channel
    return {
        "tray_id": c.id, "n_channels": c.n_channels, "px_width": _W, "px_height": _H,
        "depth_from_m": 100.0, "depth_to_m": 100.0 + depth_span, "mm_per_px": _MMPX,
        "suite": c.suite, "quality": c.quality,
    }
