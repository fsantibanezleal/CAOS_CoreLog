"""Fetch a leakage-safe DCID-512-7 subset into data/raw/dcid (gitignored).

Bulk-downloads DCID.zip once (fast CDN stream) then extracts an even per-class subset from the dataset's
OWN train/test split (leakage-safe by construction). The noise-* (RWDA-augmented) folders are ignored.
The big zip is deleted afterwards.
"""
from __future__ import annotations

import collections
import random
import zipfile
from pathlib import Path

import requests

URL = "https://huggingface.co/datasets/168sir/drill-core-image-dataset/resolve/main/DCID.zip"
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data" / "raw" / "dcid"
ZIP = ROOT / "data" / "raw" / "DCID.zip"
N_TRAIN = 300
N_TEST = 120
SEED = 0


def download() -> None:
    if ZIP.exists() and ZIP.stat().st_size > 3_000_000_000:
        print("zip already present, skipping download", flush=True)
        return
    r = requests.get(URL, stream=True, timeout=120)
    r.raise_for_status()
    total = int(r.headers.get("content-length", 0))
    got = 0
    with ZIP.open("wb") as f:
        for chunk in r.iter_content(1 << 20):
            f.write(chunk)
            got += len(chunk)
            if got % (256 << 20) < (1 << 20):
                print(f"  downloaded {got/1e9:.2f}/{total/1e9:.2f} GB", flush=True)
    print(f"downloaded {got/1e9:.2f} GB", flush=True)


def extract() -> None:
    rng = random.Random(SEED)
    with zipfile.ZipFile(ZIP) as z:
        names = [n for n in z.namelist() if n.startswith("DCID/DCID-512-7/") and n.lower().endswith(".jpg")]
        buckets: dict[tuple[str, str], list[str]] = collections.defaultdict(list)
        for n in names:
            parts = n.split("/")
            if len(parts) < 5:
                continue
            buckets[(parts[2], parts[3])].append(n)
        total = 0
        for (split, cls), items in sorted(buckets.items()):
            k = N_TRAIN if split == "train" else N_TEST
            items = sorted(items)
            rng.shuffle(items)
            dest = OUT / split / cls
            dest.mkdir(parents=True, exist_ok=True)
            for n in items[:k]:
                (dest / n.split("/")[-1]).write_bytes(z.read(n))
                total += 1
            print(f"{split}/{cls}: wrote {min(k, len(items))} of {len(items)}", flush=True)
        print("TOTAL:", total, flush=True)


def main() -> None:
    download()
    extract()
    ZIP.unlink(missing_ok=True)
    print("done; zip removed", flush=True)


if __name__ == "__main__":
    main()
