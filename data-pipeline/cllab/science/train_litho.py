"""HEAVY lane (local-only) — train CoreLog's two learned models and export them to ONNX + a metrics JSON. Run inside
the .venv-precompute (torch) after gen_train.mjs has written data/raw/{litho-train,ood-patches}.json:

    python data-pipeline/cllab/science/train_litho.py

1. lithology-cnn — a small per-patch CNN classifier (PATCH×PATCH RGB → 6-way softmax), benchmarked vs the CLASSICAL
   colour/texture nearest-centroid baseline on the SAME held-out patches (the baseline's prediction is baked into the
   training table by gen_train.mjs, so the comparison is apples-to-apples). Reports held-out accuracy + confusion.
2. core-ood — a small patch autoencoder; the reconstruction MSE separates in-distribution core from out-of-distribution
   patches (the tray frame), reported as AUC.

Outputs (committed, small): data/derived/{lithology-cnn.onnx, core-ood.onnx, cl-learned.json}.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch
from torch import nn

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "data" / "raw"
DERIVED = ROOT / "data" / "derived"
DERIVED.mkdir(parents=True, exist_ok=True)
torch.manual_seed(0)
rng = np.random.default_rng(0)
PATCH = 24
K = 6


# ----------------------------------------------------------------------------------------------------------------
# lithology CNN
# ----------------------------------------------------------------------------------------------------------------
class LithoCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),   # 24 -> 12
            nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),  # 12 -> 6
        )
        self.head = nn.Sequential(nn.Flatten(), nn.Linear(32 * 6 * 6, 64), nn.ReLU(), nn.Linear(64, K))

    def forward(self, x):
        return self.head(self.features(x))


class CNNSoftmax(nn.Module):
    """Export wrapper: raw patch → softmax probabilities (the App feeds raw [N,3,P,P], gets [N,6] probs)."""

    def __init__(self, cnn: LithoCNN):
        super().__init__()
        self.cnn = cnn

    def forward(self, x):
        return torch.softmax(self.cnn(x), dim=1)


def train_cnn() -> dict:
    d = json.loads((RAW / "litho-train.json").read_text())
    X = np.asarray(d["x"], dtype=np.float32).reshape(-1, 3, PATCH, PATCH)
    y = np.asarray(d["y"], dtype=np.int64)
    base = np.asarray(d["base"], dtype=np.int64)
    n = len(y)

    # GROUPED (leakage-free) split by synthetic HOLE = (suite, seed). A random patch split let
    # overlapping stride-10 windows from the same tray fall on both sides and inflated accuracy
    # (deep-review critical finding #14). Splitting whole holes guarantees the test holes are
    # never seen in training, at any quality. Fallback to the patch split only for legacy
    # artifacts that predate the group field.
    g = d.get("g")
    if g is not None:
        groups = np.asarray(g, dtype=np.int64)
        uniq = np.unique(groups)
        gperm = rng.permutation(len(uniq))
        n_test_holes = max(1, int(round(len(uniq) * 0.2)))
        test_holes = set(uniq[gperm[:n_test_holes]].tolist())
        mask_te = np.array([gi in test_holes for gi in groups])
        te = np.nonzero(mask_te)[0]
        tr = np.nonzero(~mask_te)[0]
        split_kind = f"grouped-by-hole ({len(uniq) - n_test_holes} train / {n_test_holes} test holes)"
    else:
        idx = rng.permutation(n)
        cut = int(n * 0.8)
        tr, te = idx[:cut], idx[cut:]
        split_kind = "random-patch (legacy; leakage-prone)"

    net = LithoCNN()
    opt = torch.optim.Adam(net.parameters(), lr=1e-3)
    Xt = torch.from_numpy(X[tr])
    yt = torch.from_numpy(y[tr])
    lossf = nn.CrossEntropyLoss()
    bs = 256
    for _ in range(12):  # epochs
        perm = torch.randperm(len(tr))
        for b in range(0, len(tr), bs):
            sel = perm[b:b + bs]
            opt.zero_grad()
            loss = lossf(net(Xt[sel]), yt[sel])
            loss.backward()
            opt.step()
    net.eval()
    with torch.no_grad():
        pred = net(torch.from_numpy(X[te])).argmax(1).numpy()
    acc = float((pred == y[te]).mean())
    acc_base = float((base[te] == y[te]).mean())
    confusion = [[int(((y[te] == i) & (pred == j)).sum()) for j in range(K)] for i in range(K)]
    return {"model": CNNSoftmax(net),
            "metrics": {"acc": round(acc, 4), "acc_baseline": round(acc_base, 4),
                        "nTrain": int(len(tr)), "nEval": int(len(te)), "split": split_kind,
                        "classes": d["classes"], "confusion": confusion}}


# ----------------------------------------------------------------------------------------------------------------
# OOD autoencoder
# ----------------------------------------------------------------------------------------------------------------
class OODAE(nn.Module):
    def __init__(self):
        super().__init__()
        self.enc = nn.Sequential(
            nn.Conv2d(3, 16, 3, stride=2, padding=1), nn.ReLU(),   # 24 -> 12
            nn.Conv2d(16, 8, 3, stride=2, padding=1), nn.ReLU(),   # 12 -> 6
        )
        self.dec = nn.Sequential(
            nn.ConvTranspose2d(8, 16, 4, stride=2, padding=1), nn.ReLU(),   # 6 -> 12
            nn.ConvTranspose2d(16, 3, 4, stride=2, padding=1), nn.Sigmoid(),  # 12 -> 24
        )

    def forward(self, x):
        return self.dec(self.enc(x))


def _auc(label: np.ndarray, score: np.ndarray) -> float:
    order = np.argsort(score)
    ranks = np.empty_like(order, dtype=np.float64)
    ranks[order] = np.arange(1, len(score) + 1)
    n_pos = float((label > 0.5).sum())
    n_neg = float(len(label) - n_pos)
    if n_pos == 0 or n_neg == 0:
        return 0.5
    return float((ranks[label > 0.5].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def train_ood() -> dict:
    d = json.loads((RAW / "litho-train.json").read_text())
    o = json.loads((RAW / "ood-patches.json").read_text())
    X = np.asarray(d["x"], dtype=np.float32).reshape(-1, 3, PATCH, PATCH)
    O = np.asarray(o["x"], dtype=np.float32).reshape(-1, 3, PATCH, PATCH)
    n = len(X)
    idx = rng.permutation(n)
    cut = int(n * 0.8)
    tr, te = idx[:cut], idx[cut:]

    net = OODAE()
    opt = torch.optim.Adam(net.parameters(), lr=1e-3)
    Xt = torch.from_numpy(X[tr])
    bs = 256
    for _ in range(15):
        perm = torch.randperm(len(tr))
        for b in range(0, len(tr), bs):
            sel = perm[b:b + bs]
            opt.zero_grad()
            loss = nn.functional.mse_loss(net(Xt[sel]), Xt[sel])
            loss.backward()
            opt.step()
    net.eval()

    def mse(arr):
        with torch.no_grad():
            t = torch.from_numpy(arr)
            r = net(t)
            return ((r - t) ** 2).mean(dim=(1, 2, 3)).numpy()
    in_scores = mse(X[te])
    ood_scores = mse(O)
    labels = np.concatenate([np.zeros(len(in_scores)), np.ones(len(ood_scores))])
    scores = np.concatenate([in_scores, ood_scores])
    return {"model": net, "metrics": {"auc": round(_auc(labels, scores), 4), "nEval": int(len(scores))}}


def export(model: nn.Module, in_name: str, out_name: str, path: Path) -> None:
    model.eval()
    dummy = torch.zeros(1, 3, PATCH, PATCH)
    torch.onnx.export(model, dummy, str(path), input_names=[in_name], output_names=[out_name],
                      dynamic_axes={in_name: {0: "batch"}, out_name: {0: "batch"}}, opset_version=17)


def main() -> None:
    cnn = train_cnn()
    ood = train_ood()
    export(cnn["model"], "x", "p", DERIVED / "lithology-cnn.onnx")
    export(ood["model"], "x", "xr", DERIVED / "core-ood.onnx")
    learned = {
        "schema": "corelog.learned/v1",
        "lithoCNN": cnn["metrics"],
        "ood": ood["metrics"],
        "honesty": ("Synthetic core textures + the generator ground truth as the authority. The CNN is measured "
                    "against the classical colour/texture baseline on the SAME held-out patches; the OOD AE against "
                    "frame/no-recovery patches. Reported whichever way the numbers land — no fabricated win."),
    }
    (DERIVED / "cl-learned.json").write_text(json.dumps(learned, indent=2))
    print("lithology-cnn:", cnn["metrics"]["acc"], "vs baseline", cnn["metrics"]["acc_baseline"])
    print("core-ood AUC:", ood["metrics"]["auc"])
    print(f"wrote lithology-cnn.onnx + core-ood.onnx + cl-learned.json -> {DERIVED}")


if __name__ == "__main__":
    main()
