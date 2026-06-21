"""CONTRACT 1 (ingestion) tests: good tray descriptors validate; ill-formed ones are rejected with a reason;
unusual aspect / coarse resolution are flagged; the committed example passes."""
from pathlib import Path

from cllab.io.contract import validate_image, validate_records
from cllab.io.formats import read_csv_rows


def _row(**over):
    base = {"tray_id": "t", "n_channels": 4, "px_width": 320, "px_height": 40, "depth_from_m": 100.0,
            "depth_to_m": 101.0, "mm_per_px": 1.0, "suite": "porphyry", "quality": "clean"}
    base.update(over)
    return base


def test_good_descriptor_accepted():
    rep = validate_records([_row()])
    assert rep.ok and len(rep.accepted) == 1 and not rep.rejected
    assert rep.accepted[0].suite == "porphyry"


def test_bad_descriptors_rejected_not_coerced():
    rows = [
        _row(n_channels=0),                       # zero channels
        _row(depth_from_m=120, depth_to_m=100),   # inverted depth
        _row(px_width="lots"),                    # non-numeric
        _row(mm_per_px=99),                       # absurd resolution
        _row(suite="lava"),                       # bad suite
        {"tray_id": "m", "n_channels": 4},        # missing columns
    ]
    rep = validate_records(rows)
    assert len(rep.accepted) == 0 and len(rep.rejected) == len(rows)
    assert all("reason" in r for r in rep.rejected)


def test_coarse_resolution_flagged():
    rep = validate_records([_row(mm_per_px=3.0)])
    assert rep.ok and rep.flagged and "coarse" in " ".join(rep.flagged[0]["flags"])


def test_validate_image_gate():
    good = validate_image({"width": 1280, "height": 160, "n_channels": 4, "depth_from_m": 100, "depth_to_m": 101, "mm_per_px": 1})
    assert good.ok
    bad = validate_image({"width": 1280, "height": 160, "n_channels": 4, "depth_from_m": 101, "depth_to_m": 100, "mm_per_px": 1})
    assert not bad.ok and bad.rejected


def test_committed_example_passes_contract():
    csv = Path(__file__).resolve().parents[1] / "data" / "examples" / "trays.csv"
    rep = validate_records(read_csv_rows(csv))
    assert rep.ok and not rep.rejected, f"trays.csv should pass Contract 1: {rep.summary()}"
