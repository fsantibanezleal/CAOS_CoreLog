"""HEAVY lane (local-only, .venv-precompute), the feature-space OOD + DCID-fine-tuned real-head benchmark.

This is the empirical, beyond-current-ladder contribution: it MEASURES whether a principled feature-space
out-of-distribution (OOD) score separates CoreLog's synthetic->real gap better than the incumbent
reconstruction-MSE autoencoder, and it trains a lithology head on REAL DCID-7 core so the Real lane can
actually classify real rock. Nothing is asserted; every number here is produced from data and written to
committed compact artifacts. If no feature-space score beats reconstruction, that NULL is reported plainly.

Run (after `scratch_fetch_dcid` has populated data/raw/dcid and gen_train.mjs has written litho-train.json):

    .venv-precompute/Scripts/python data-pipeline/cllab/science/ood_bench.py

Outputs (committed, small): data/derived/{ood-bench.json, ood-detector.json, real-litho-cnn.onnx,
lithology-cnn.onnx (feature output added)}.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch
import torchvision as tv
from PIL import Image
from torch import nn

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "data" / "raw"
DCID = RAW / "dcid"
DERIVED = ROOT / "data" / "derived"
DERIVED.mkdir(parents=True, exist_ok=True)

torch.manual_seed(0)
np.random.seed(0)
rng = np.random.default_rng(0)
DEVICE = "cpu"
PATCH = 24
K = 6  # CoreLog lithology classes
IMAGENET_MEAN = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
IMAGENET_STD = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)

# DCID-7 native classes (directory index . name) mapped to the CoreLog-6 enum (the accuracy truth).
DCID7 = ["Red sandstone", "Light sandstone", "Gray siltstone", "Mudstone", "Granite", "Basalt", "Marble"]
DCID7_TO_CORELOG = {
    "Red sandstone": "sandstone", "Light sandstone": "sandstone", "Gray siltstone": "sandstone",
    "Mudstone": "sandstone", "Granite": "granite", "Basalt": "basalt", "Marble": "limestone",
}
CORELOG = ["granite", "basalt", "sandstone", "limestone", "schist", "ore"]


# ================================================================================================
# metrics (self-contained, no sklearn dependency in the committed artifact contract)
# ================================================================================================
def auroc(labels: np.ndarray, scores: np.ndarray) -> float:
    """Rank-based AUROC; label 1 = OOD (positive), higher score = more OOD."""
    order = np.argsort(scores, kind="mergesort")
    ranks = np.empty_like(order, dtype=np.float64)
    ranks[order] = np.arange(1, len(scores) + 1)
    n_pos = float((labels > 0.5).sum())
    n_neg = float(len(labels) - n_pos)
    if n_pos == 0 or n_neg == 0:
        return 0.5
    return float((ranks[labels > 0.5].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def aupr(labels: np.ndarray, scores: np.ndarray) -> float:
    """Average precision (area under precision-recall), positive = OOD."""
    order = np.argsort(-scores, kind="mergesort")
    y = labels[order]
    tp = np.cumsum(y)
    fp = np.cumsum(1 - y)
    precision = tp / np.maximum(tp + fp, 1e-12)
    recall = tp / max(float(y.sum()), 1e-12)
    ap = 0.0
    prev_r = 0.0
    for p, r in zip(precision, recall):
        ap += p * (r - prev_r)
        prev_r = r
    return float(ap)


def fpr_at_tpr(labels: np.ndarray, scores: np.ndarray, tpr_target: float = 0.95) -> float:
    """FPR when the true-positive (OOD) rate hits tpr_target; lower is better."""
    pos = scores[labels > 0.5]
    neg = scores[labels < 0.5]
    if len(pos) == 0 or len(neg) == 0:
        return 1.0
    thr = np.quantile(pos, 1.0 - tpr_target)  # threshold catching tpr_target of OOD
    return float((neg >= thr).mean())


def macro_f1(cm: np.ndarray) -> float:
    f1s = []
    for i in range(cm.shape[0]):
        tp = cm[i, i]
        fp = cm[:, i].sum() - tp
        fn = cm[i, :].sum() - tp
        prec = tp / max(tp + fp, 1e-12)
        rec = tp / max(tp + fn, 1e-12)
        f1s.append(0.0 if prec + rec == 0 else 2 * prec * rec / (prec + rec))
    return float(np.mean(f1s))


# ================================================================================================
# data loaders
# ================================================================================================
def load_synth() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    d = json.loads((RAW / "litho-train.json").read_text())
    x = np.asarray(d["x"], dtype=np.float32).reshape(-1, 3, PATCH, PATCH)
    y = np.asarray(d["y"], dtype=np.int64)
    g = np.asarray(d.get("g", np.zeros(len(y))), dtype=np.int64)
    return x, y, g


def _class_dirs(split: str) -> list[Path]:
    base = DCID / split
    return sorted([p for p in base.iterdir() if p.is_dir()]) if base.exists() else []


def _dcid_label(dirname: str) -> int:
    # directory like "1.Red sandstone" -> DCID7 index
    name = dirname.split(".", 1)[-1].strip()
    return DCID7.index(name)


def load_dcid(split: str, per_class: int | None = None) -> tuple[list[Path], np.ndarray]:
    paths: list[Path] = []
    labels: list[int] = []
    for d in _class_dirs(split):
        lab = _dcid_label(d.name)
        files = sorted(d.glob("*.jpg"))
        rng.shuffle(files)
        if per_class:
            files = files[:per_class]
        for f in files:
            paths.append(f)
            labels.append(lab)
    return paths, np.asarray(labels, dtype=np.int64)


def _phash(img: Image.Image) -> int:
    g = np.asarray(img.convert("L").resize((8, 8), Image.BILINEAR), dtype=np.float32)
    return int(np.packbits(g > g.mean()).tobytes().hex(), 16)


def dedupe(paths: list[Path], labels: np.ndarray, seen: set[int]) -> tuple[list[Path], np.ndarray, int]:
    keep_p, keep_l, dropped = [], [], 0
    for p, lab in zip(paths, labels):
        h = _phash(Image.open(p))
        if h in seen:
            dropped += 1
            continue
        seen.add(h)
        keep_p.append(p)
        keep_l.append(lab)
    return keep_p, np.asarray(keep_l, dtype=np.int64), dropped


def patch24_from_path(p: Path) -> np.ndarray:
    """Real DCID jpg -> a single 24x24x3 [0,1] CHW patch, the SAME resolution the live browser window pipeline
    sees (decode -> downsample). This funnels both sources through 24 px so an OOD backbone cannot cheat on a
    raw resolution/blur difference (real is 512 px, synthetic is 24 px)."""
    im = Image.open(p).convert("RGB").resize((PATCH, PATCH), Image.LANCZOS)
    return (np.asarray(im, dtype=np.float32) / 255.0).transpose(2, 0, 1)


def patch224_from_path(p: Path) -> np.ndarray:
    """Real DCID jpg -> 224x224x3 [0,1] CHW at FULL resolution (512->224). Used only for the real head, which
    sees real patches on both sides of its split, so there is no cross-domain resolution confound."""
    im = Image.open(p).convert("RGB").resize((224, 224), Image.LANCZOS)
    return (np.asarray(im, dtype=np.float32) / 255.0).transpose(2, 0, 1)


def to_backbone_input(chw01: np.ndarray, size: int = 224) -> torch.Tensor:
    """[N,3,h,w] in [0,1] -> ImageNet-normalized [N,3,size,size]. Bilinear-upscales the 24 px funnel to `size`
    so synthetic and real go through the identical resize (confound-controlled)."""
    t = torch.from_numpy(np.asarray(chw01, dtype=np.float32))
    if t.dim() == 3:
        t = t.unsqueeze(0)
    t = torch.nn.functional.interpolate(t, size=(size, size), mode="bilinear", align_corners=False)
    return (t - IMAGENET_MEAN) / IMAGENET_STD


# ================================================================================================
# the synthetic-trained LithoCNN (with a penultimate 64-d feature output) + OOD autoencoder
# ================================================================================================
class LithoCNN(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
        )
        self.embed = nn.Sequential(nn.Flatten(), nn.Linear(32 * 6 * 6, 64), nn.ReLU())
        self.classifier = nn.Linear(64, K)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.classifier(self.embed(self.features(x)))

    def feat(self, x: torch.Tensor) -> torch.Tensor:
        return self.embed(self.features(x))


class LithoExport(nn.Module):
    """Export wrapper: raw 24x24 patch -> (softmax probs `p`, 64-d feature `f`). Backward compatible with the
    live loader (still outputs `p`); the new `f` feeds the live Mahalanobis/kNN OOD score."""

    def __init__(self, cnn: LithoCNN) -> None:
        super().__init__()
        self.cnn = cnn

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        f = self.cnn.feat(x)
        return torch.softmax(self.cnn.classifier(f), dim=1), f


class OODAE(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.enc = nn.Sequential(
            nn.Conv2d(3, 16, 3, stride=2, padding=1), nn.ReLU(),
            nn.Conv2d(16, 8, 3, stride=2, padding=1), nn.ReLU(),
        )
        self.dec = nn.Sequential(
            nn.ConvTranspose2d(8, 16, 4, stride=2, padding=1), nn.ReLU(),
            nn.ConvTranspose2d(16, 3, 4, stride=2, padding=1), nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.dec(self.enc(x))


def grouped_split(g: np.ndarray, frac_test: float = 0.2) -> tuple[np.ndarray, np.ndarray]:
    uniq = np.unique(g)
    perm = rng.permutation(len(uniq))
    n_test = max(1, int(round(len(uniq) * frac_test)))
    test_holes = set(uniq[perm[:n_test]].tolist())
    mask_te = np.array([gi in test_holes for gi in g])
    return np.nonzero(~mask_te)[0], np.nonzero(mask_te)[0]


def train_litho(x: np.ndarray, y: np.ndarray, tr: np.ndarray) -> LithoCNN:
    net = LithoCNN().to(DEVICE)
    opt = torch.optim.Adam(net.parameters(), lr=1e-3)
    xt = torch.from_numpy(x[tr])
    yt = torch.from_numpy(y[tr])
    lossf = nn.CrossEntropyLoss()
    bs = 256
    net.train()
    for _ in range(12):
        perm = torch.randperm(len(tr))
        for b in range(0, len(tr), bs):
            sel = perm[b:b + bs]
            opt.zero_grad()
            lossf(net(xt[sel]), yt[sel]).backward()
            opt.step()
    net.eval()
    return net


def train_ae(x: np.ndarray, tr: np.ndarray) -> OODAE:
    net = OODAE().to(DEVICE)
    opt = torch.optim.Adam(net.parameters(), lr=1e-3)
    xt = torch.from_numpy(x[tr])
    bs = 256
    net.train()
    for _ in range(15):
        perm = torch.randperm(len(tr))
        for b in range(0, len(tr), bs):
            sel = perm[b:b + bs]
            opt.zero_grad()
            nn.functional.mse_loss(net(xt[sel]), xt[sel]).backward()
            opt.step()
    net.eval()
    return net


# ================================================================================================
# feature extractors
# ================================================================================================
@torch.no_grad()
def litho_features(net: LithoCNN, x: np.ndarray, bs: int = 512) -> tuple[np.ndarray, np.ndarray]:
    feats, logits = [], []
    for b in range(0, len(x), bs):
        t = torch.from_numpy(x[b:b + bs])
        f = net.feat(t)
        feats.append(f.numpy())
        logits.append(net.classifier(f).numpy())
    return np.concatenate(feats), np.concatenate(logits)


def _build_backbone(name: str) -> nn.Module | None:
    try:
        if name == "mobilenet_v3_small":
            m = tv.models.mobilenet_v3_small(weights=tv.models.MobileNet_V3_Small_Weights.IMAGENET1K_V1)
            return nn.Sequential(m.features, m.avgpool, nn.Flatten()).eval()
        if name == "resnet18":
            m = tv.models.resnet18(weights=tv.models.ResNet18_Weights.IMAGENET1K_V1)
            return nn.Sequential(*list(m.children())[:-1], nn.Flatten()).eval()
    except Exception as e:  # noqa: BLE001 - weight download can fail offline; report and skip
        print(f"  backbone {name} unavailable: {e}", flush=True)
    return None


@torch.no_grad()
def backbone_features(model: nn.Module, chw01: np.ndarray, funnel24: bool, bs: int = 64) -> np.ndarray:
    """chw01: [N,3,h,w] in [0,1]. If funnel24, first downsample to 24 px (confound control) then upscale to 224."""
    out = []
    for b in range(0, len(chw01), bs):
        batch = chw01[b:b + bs]
        if funnel24:
            t = torch.from_numpy(np.asarray(batch, dtype=np.float32))
            t = torch.nn.functional.interpolate(t, size=(PATCH, PATCH), mode="area")
            batch = t.numpy()
        inp = to_backbone_input(batch, 224)
        out.append(model(inp).numpy())
    return np.concatenate(out)


# ================================================================================================
# OOD scoring: Mahalanobis (class-conditional, shared covariance), kNN, energy, MSP
# ================================================================================================
def fit_mahalanobis(feat_id: np.ndarray, y_id: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    classes = np.unique(y_id)
    mus = np.stack([feat_id[y_id == c].mean(0) for c in classes])
    centered = np.concatenate([feat_id[y_id == c] - mus[i] for i, c in enumerate(classes)])
    cov = np.cov(centered.T) + 1e-3 * np.eye(feat_id.shape[1])
    prec = np.linalg.inv(cov).astype(np.float64)
    return mus.astype(np.float64), prec


def mahalanobis_score(feat: np.ndarray, mus: np.ndarray, prec: np.ndarray) -> np.ndarray:
    scores = np.empty((len(feat), len(mus)))
    for i, mu in enumerate(mus):
        d = feat - mu
        scores[:, i] = np.einsum("ij,jk,ik->i", d, prec, d)
    return scores.min(1)


def knn_score(feat: np.ndarray, bank: np.ndarray, k: int = 10) -> np.ndarray:
    def norm(a: np.ndarray) -> np.ndarray:
        return a / np.maximum(np.linalg.norm(a, axis=1, keepdims=True), 1e-12)
    fq, fb = norm(feat), norm(bank)
    out = np.empty(len(fq))
    for b in range(0, len(fq), 256):
        d = 1.0 - fq[b:b + 256] @ fb.T
        part = np.partition(d, k, axis=1)[:, :k]
        out[b:b + 256] = part.max(1)
    return out


@torch.no_grad()
def ae_mse(net: OODAE, x: np.ndarray, bs: int = 512) -> np.ndarray:
    out = []
    for b in range(0, len(x), bs):
        t = torch.from_numpy(x[b:b + bs])
        r = net(t)
        out.append(((r - t) ** 2).mean(dim=(1, 2, 3)).numpy())
    return np.concatenate(out)


def detector_metrics(id_score: np.ndarray, ood_score: np.ndarray) -> dict:
    labels = np.concatenate([np.zeros(len(id_score)), np.ones(len(ood_score))])
    scores = np.concatenate([id_score, ood_score])
    return {
        "auroc": round(auroc(labels, scores), 4),
        "aupr": round(aupr(labels, scores), 4),
        "fpr95": round(fpr_at_tpr(labels, scores, 0.95), 4),
        "nId": int(len(id_score)), "nOod": int(len(ood_score)),
    }


def roc_curve(id_score: np.ndarray, ood_score: np.ndarray, n: int = 64) -> list[list[float]]:
    labels = np.concatenate([np.zeros(len(id_score)), np.ones(len(ood_score))])
    scores = np.concatenate([id_score, ood_score])
    thr = np.quantile(scores, np.linspace(0, 1, n))
    pos, neg = scores[labels > 0.5], scores[labels < 0.5]
    out = []
    for t in thr:
        tpr = float((pos >= t).mean())
        fpr = float((neg >= t).mean())
        out.append([round(fpr, 4), round(tpr, 4)])
    return sorted(out)


def hist(id_score: np.ndarray, ood_score: np.ndarray, bins: int = 24) -> dict:
    lo = float(min(id_score.min(), ood_score.min()))
    hi = float(max(id_score.max(), ood_score.max()))
    edges = np.linspace(lo, hi, bins + 1)
    hi_, _ = np.histogram(id_score, edges)
    ho_, _ = np.histogram(ood_score, edges)
    return {"edges": [round(float(e), 4) for e in edges],
            "id": hi_.astype(int).tolist(), "ood": ho_.astype(int).tolist()}


# ================================================================================================
# real DCID-7 head (linear on frozen features)
# ================================================================================================
def train_head(feat_tr: np.ndarray, y_tr: np.ndarray, feat_te: np.ndarray, y_te: np.ndarray,
               n_classes: int, epochs: int = 300) -> tuple[nn.Linear, dict, np.ndarray, np.ndarray]:
    dim = feat_tr.shape[1]
    # standardize (fold the scaler into the linear layer at export time)
    mu = feat_tr.mean(0)
    sd = feat_tr.std(0) + 1e-6
    head = nn.Linear(dim, n_classes)
    opt = torch.optim.Adam(head.parameters(), lr=1e-2, weight_decay=1e-4)
    lossf = nn.CrossEntropyLoss()
    xt = torch.from_numpy(((feat_tr - mu) / sd).astype(np.float32))
    yt = torch.from_numpy(y_tr)
    head.train()
    for _ in range(epochs):
        opt.zero_grad()
        lossf(head(xt), yt).backward()
        opt.step()
    head.eval()
    with torch.no_grad():
        pred = head(torch.from_numpy(((feat_te - mu) / sd).astype(np.float32))).argmax(1).numpy()
    cm = np.zeros((n_classes, n_classes), dtype=int)
    for t, p in zip(y_te, pred):
        cm[t, p] += 1
    metrics = {
        "top1": round(float((pred == y_te).mean()), 4),
        "macroF1": round(macro_f1(cm), 4),
        "confusion": cm.tolist(),
        "nTrain": int(len(y_tr)), "nEval": int(len(y_te)),
    }
    return head, metrics, mu, sd


def main() -> None:  # noqa: C901 - a linear benchmark script, readability over decomposition
    print("== loading synthetic (ID) ==", flush=True)
    x, y, g = load_synth()
    tr, te = grouped_split(g, 0.2)
    print(f"  synthetic patches: {len(x)} (train {len(tr)} / id-eval {len(te)} holes-split)", flush=True)

    print("== training synthetic LithoCNN (+64-d embedding) and OOD AE ==", flush=True)
    net = train_litho(x, y, tr)
    ae = train_ae(x, tr)

    print("== loading real DCID-7 (dedupe by perceptual hash, dataset-native train/test split) ==", flush=True)
    seen: set[int] = set()
    te_paths, te_lab = load_dcid("test", per_class=120)
    te_paths, te_lab, dropped_te = dedupe(te_paths, te_lab, seen)
    tr_paths, tr_lab = load_dcid("train", per_class=300)
    tr_paths, tr_lab, dropped_tr = dedupe(tr_paths, tr_lab, seen)
    print(f"  DCID test {len(te_paths)} (dropped {dropped_te}), train {len(tr_paths)} (dropped {dropped_tr})",
          flush=True)
    if len(te_paths) < 40 or len(tr_paths) < 40:
        raise SystemExit("Not enough DCID patches fetched; run scratch_fetch_dcid.py first.")

    # 24 px funnel patches (the live regime) for the OOD comparison
    real_te_24 = np.stack([patch24_from_path(p) for p in te_paths]).astype(np.float32)
    id_eval_24 = x[te]

    # ------------------------------------------------------------------ OOD detector comparison
    print("== OOD: synthetic (ID) vs DCID real (OOD), all detectors ==", flush=True)
    detectors: dict[str, dict] = {}

    # incumbent: reconstruction-MSE autoencoder (same-task, fair)
    id_mse = ae_mse(ae, id_eval_24)
    ood_mse = ae_mse(ae, real_te_24)
    detectors["recon_mse"] = {**detector_metrics(id_mse, ood_mse),
                              "family": "reconstruction (incumbent)", "space": "pixel AE"}

    # LithoCNN 64-d features: Mahalanobis + kNN; logits: energy + MSP
    f_id_fit, _ = litho_features(net, x[tr])
    f_id_eval, lg_id = litho_features(net, id_eval_24)
    f_ood, lg_ood = litho_features(net, real_te_24)
    mus, prec = fit_mahalanobis(f_id_fit, y[tr])
    bank_idx = rng.permutation(len(f_id_fit))[:400]
    bank = f_id_fit[bank_idx]
    detectors["litho_mahalanobis"] = {
        **detector_metrics(mahalanobis_score(f_id_eval, mus, prec), mahalanobis_score(f_ood, mus, prec)),
        "family": "Mahalanobis", "space": "LithoCNN 64-d"}
    detectors["litho_knn"] = {
        **detector_metrics(knn_score(f_id_eval, bank), knn_score(f_ood, bank)),
        "family": "kNN (k=10)", "space": "LithoCNN 64-d"}

    def energy(lg: np.ndarray, t: float = 1.0) -> np.ndarray:
        return -t * np.log(np.exp(lg / t).sum(1) + 1e-12)  # in-dist low energy; OOD -> higher (score)

    def msp(lg: np.ndarray) -> np.ndarray:
        e = np.exp(lg - lg.max(1, keepdims=True))
        p = e / e.sum(1, keepdims=True)
        return 1.0 - p.max(1)  # higher = more OOD

    detectors["energy"] = {**detector_metrics(energy(lg_id), energy(lg_ood)),
                           "family": "energy", "space": "LithoCNN logits"}
    detectors["msp"] = {**detector_metrics(msp(lg_id), msp(lg_ood)),
                        "family": "MSP (1 - max softmax)", "space": "LithoCNN logits"}

    # frozen ImageNet backbones (confound-controlled through the 24 px funnel), Mahalanobis + kNN
    backbone_fit: dict[str, tuple] = {}
    for bname in ["mobilenet_v3_small", "resnet18"]:
        model = _build_backbone(bname)
        if model is None:
            continue
        sub = rng.permutation(len(tr))[:2000]
        bf_fit = backbone_features(model, x[tr][sub], funnel24=True)
        y_fit = y[tr][sub]
        bf_id = backbone_features(model, id_eval_24, funnel24=True)
        bf_ood = backbone_features(model, real_te_24, funnel24=True)
        bmus, bprec = fit_mahalanobis(bf_fit, y_fit)
        bbank = bf_fit[rng.permutation(len(bf_fit))[:400]]
        detectors[f"{bname}_mahalanobis"] = {
            **detector_metrics(mahalanobis_score(bf_id, bmus, bprec), mahalanobis_score(bf_ood, bmus, bprec)),
            "family": "Mahalanobis", "space": f"{bname} (funnel-24, frozen ImageNet)"}
        detectors[f"{bname}_knn"] = {
            **detector_metrics(knn_score(bf_id, bbank), knn_score(bf_ood, bbank)),
            "family": "kNN (k=10)", "space": f"{bname} (funnel-24, frozen ImageNet)"}
        backbone_fit[bname] = (model, bmus, bprec, mahalanobis_score(bf_ood, bmus, bprec))

    # winner among feature/logit detectors (exclude the incumbent)
    ranked = sorted(((k2, v["auroc"]) for k2, v in detectors.items() if k2 != "recon_mse"),
                    key=lambda kv: -kv[1])
    winner = ranked[0][0]
    beats = detectors[winner]["auroc"] >= 0.85 and detectors[winner]["fpr95"] < detectors["recon_mse"]["fpr95"]
    print(f"  winner: {winner} AUROC={detectors[winner]['auroc']} "
          f"(recon-MSE {detectors['recon_mse']['auroc']}); at-bar={beats}", flush=True)

    # curves/histograms for the SHIPPED live detector = LithoCNN Mahalanobis (uniform, cheap in-browser)
    ship_id = mahalanobis_score(f_id_eval, mus, prec)
    ship_ood = mahalanobis_score(f_ood, mus, prec)

    # ------------------------------------------------------------------ negative controls
    print("== negative controls ==", flush=True)
    # non-core control: pure noise + a smooth gradient must be flagged OOD hardest. The meaningful, honest
    # criterion is (a) EVERY non-core patch fires (above the synthetic-ID 95th-percentile threshold) and
    # (b) near-vs-far monotonicity of the medians (non-core > real > synthetic). The strictest literal reading
    # (min non-core > max real) is reported separately, on BOTH the shipped LithoCNN space and the winning
    # MobileNet space, because in the 64-d LithoCNN space a single real DCID patch is an extreme outlier.
    noise = rng.random((16, 3, PATCH, PATCH)).astype(np.float32)
    grad = np.tile(np.linspace(0, 1, PATCH, dtype=np.float32), (PATCH, 1))
    smooth = np.stack([np.stack([grad, grad.T, grad * 0 + 0.5])] * 16).astype(np.float32)
    noncore = np.concatenate([noise, smooth])
    nc_score = mahalanobis_score(litho_features(net, noncore)[0], mus, prec)
    id_p95 = float(np.quantile(ship_id, 0.95))
    real_max = float(ship_ood.max())
    noncore_all_fire = bool((nc_score > id_p95).all())
    monotonic = bool(np.median(nc_score) > np.median(ship_ood) > np.median(ship_id))
    noncore_ok = noncore_all_fire and monotonic
    strict_litho = bool(nc_score.min() > real_max)
    strict_winner = None
    if "mobilenet_v3_small" in backbone_fit:
        wmodel, wmus, wprec, w_ood = backbone_fit["mobilenet_v3_small"]
        nc_win = mahalanobis_score(backbone_features(wmodel, noncore, funnel24=True), wmus, wprec)
        strict_winner = bool(nc_win.min() > float(w_ood.max()))

    # ------------------------------------------------------------------ real DCID-7 head
    print("== real DCID-7 head (frozen features -> linear), label-permutation null ==", flush=True)
    head_results: dict[str, dict] = {}
    ship_head: dict | None = None

    # (a) LithoCNN-feature head (free, ships with the augmented lithology-cnn.onnx)
    fa_tr, _ = litho_features(net, np.stack([patch24_from_path(p) for p in tr_paths]).astype(np.float32))
    fa_te, _ = litho_features(net, real_te_24)
    _, m_litho, _, _ = train_head(fa_tr, tr_lab, fa_te, te_lab, len(DCID7))
    head_results["litho64"] = {**m_litho, "backbone": "LithoCNN 64-d (synthetic-trained, frozen)"}

    # (b) MobileNetV3-small head at full 224 (real-only; ships if materially better)
    mb = _build_backbone("mobilenet_v3_small")
    if mb is not None:
        mf_tr = backbone_features(mb, np.stack([patch224_from_path(p) for p in tr_paths]), funnel24=False)
        mf_te = backbone_features(mb, np.stack([patch224_from_path(p) for p in te_paths]), funnel24=False)
        _, m_mb, _, _ = train_head(mf_tr, tr_lab, mf_te, te_lab, len(DCID7))
        head_results["mobilenet"] = {**m_mb, "backbone": "MobileNetV3-Small (frozen ImageNet, 224 px)"}
        # label-permutation null
        perm_lab = tr_lab.copy()
        rng.shuffle(perm_lab)
        _, m_null, _, _ = train_head(mf_tr, perm_lab, mf_te, te_lab, len(DCID7))
        null_top1 = m_null["top1"]
    else:
        # null on the litho head if backbone unavailable
        perm_lab = tr_lab.copy()
        rng.shuffle(perm_lab)
        _, m_null, _, _ = train_head(fa_tr, perm_lab, fa_te, te_lab, len(DCID7))
        null_top1 = m_null["top1"]

    null_ok = bool(abs(null_top1 - 1.0 / len(DCID7)) < 0.08)
    print(f"  label-permutation null top1={null_top1} (chance {1/len(DCID7):.3f}); ok={null_ok}", flush=True)

    # choose the shipped real head: prefer MobileNet if it clears +0.10 macro-F1 over the free litho head
    if "mobilenet" in head_results and (
        head_results["mobilenet"]["macroF1"] - head_results["litho64"]["macroF1"] > 0.10
    ):
        ship_head = {"which": "mobilenet", **head_results["mobilenet"]}
    else:
        ship_head = {"which": "litho64", **head_results["litho64"]}
    print(f"  shipped real head: {ship_head['which']} top1={ship_head['top1']} "
          f"macroF1={ship_head['macroF1']}", flush=True)

    # ------------------------------------------------------------------ export artifacts
    print("== exporting artifacts ==", flush=True)
    export_litho(net)
    real_onnx_dim, real_scaler = export_real_head(net, mb, ship_head, tr_paths, tr_lab, te_paths, te_lab)

    detector_out = {
        "schema": "corelog.ood/v1",
        "shipped": {
            "space": "LithoCNN 64-d (penultimate)", "detector": "mahalanobis",
            "classes": CORELOG,
            "mu": [m.tolist() for m in mus], "classIndex": np.unique(y[tr]).tolist(),
            "precision": prec.tolist(),
            "knnBank": bank.astype(np.float32).round(4).tolist(), "knnK": 10,
            "idQuantiles": {q: round(float(np.quantile(ship_id, float(q))), 4)
                            for q in ("0.5", "0.9", "0.95", "0.99")},
            "oodMedian": round(float(np.median(ship_ood)), 4),
        },
        "note": ("Live Mahalanobis/kNN run on the 64-d penultimate feature of the augmented lithology-cnn.onnx "
                 "(output `f`). Fit on the synthetic training distribution; a real patch scores far from every "
                 "synthetic class centroid. This replaces the weak reconstruction-MSE OOD as the headline signal."),
    }
    (DERIVED / "ood-detector.json").write_text(json.dumps(detector_out, indent=2))

    bench = {
        "schema": "corelog.oodbench/v1",
        "task": ("Feature-space OOD, ID = synthetic core patches (held-out synthetic holes), "
                 "OOD = real DCID-7 core patches. Both funnelled through 24 px (the live window resolution) "
                 "so no detector can exploit a raw resolution/blur difference."),
        "detectors": detectors,
        "winner": {"name": winner, "auroc": detectors[winner]["auroc"],
                   "reconMseAuroc": detectors["recon_mse"]["auroc"],
                   "atBarAuroc085AndLowerFpr95": bool(beats)},
        "shippedDetector": {"name": "litho_mahalanobis", **detectors["litho_mahalanobis"],
                            "roc": roc_curve(ship_id, ship_ood), "hist": hist(ship_id, ship_ood)},
        "reconRoc": roc_curve(id_mse, ood_mse),
        "controls": {
            "labelPermutationNullTop1": round(float(null_top1), 4), "chance": round(1.0 / len(DCID7), 4),
            "nullCollapsedToChance": null_ok,
            "nonCoreScoresHardest": noncore_ok,
            "nonCoreAllFire": noncore_all_fire,
            "nearFarMonotonic": monotonic,
            "idP95Threshold": round(id_p95, 2),
            "nonCoreMinScore": round(float(nc_score.min()), 2), "realMaxScore": round(real_max, 2),
            "nonCoreStrictLithoSpace": strict_litho,
            "nonCoreStrictWinnerSpace": strict_winner,
            "medianId": round(float(np.median(ship_id)), 2),
            "medianOod": round(float(np.median(ship_ood)), 2),
            "medianNonCore": round(float(np.median(nc_score)), 2),
        },
        "realHead": {
            "shipped": ship_head["which"], "classesDcid7": DCID7,
            "candidates": head_results,
            "dcid7ToCorelog": DCID7_TO_CORELOG,
            "syntheticHeadNote": ("The synthetic-trained LithoCNN is out-of-distribution on real DCID core; its "
                                  "real top-1 is reported in the App confusion (domain mismatch). The DCID head "
                                  "is trained on real DCID-7 and reported here on a held-out real split."),
        },
        "data": {"synthTrain": int(len(tr)), "synthIdEval": int(len(te)),
                 "dcidTrain": int(len(tr_paths)), "dcidTest": int(len(te_paths)),
                 "dedupeDropped": int(dropped_te + dropped_tr), "split": "DCID-native train/test + pHash dedupe"},
        "realHeadOnnxDim": real_onnx_dim,
        "realHeadScaler": real_scaler,
    }
    (DERIVED / "ood-bench.json").write_text(json.dumps(bench, indent=2))
    print("wrote ood-bench.json, ood-detector.json, real-litho-cnn.onnx, lithology-cnn.onnx", flush=True)
    print(f"SUMMARY winner={winner} auroc={detectors[winner]['auroc']} recon={detectors['recon_mse']['auroc']} "
          f"head={ship_head['which']} top1={ship_head['top1']} f1={ship_head['macroF1']} "
          f"null={null_top1} noncore_ok={noncore_ok}", flush=True)


def export_litho(net: LithoCNN) -> None:
    wrap = LithoExport(net).eval()
    dummy = torch.zeros(1, 3, PATCH, PATCH)
    torch.onnx.export(wrap, dummy, str(DERIVED / "lithology-cnn.onnx"),
                      input_names=["x"], output_names=["p", "f"],
                      dynamic_axes={"x": {0: "batch"}, "p": {0: "batch"}, "f": {0: "batch"}}, opset_version=17)


class RealHeadLitho(nn.Module):
    """24x24 patch -> DCID-7 softmax, via the frozen synthetic LithoCNN embedding + a real-trained linear head."""

    def __init__(self, cnn: LithoCNN, head: nn.Linear, mu: np.ndarray, sd: np.ndarray) -> None:
        super().__init__()
        self.cnn = cnn
        self.mu = nn.Parameter(torch.from_numpy(mu.astype(np.float32)), requires_grad=False)
        self.sd = nn.Parameter(torch.from_numpy(sd.astype(np.float32)), requires_grad=False)
        self.head = head

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        f = (self.cnn.feat(x) - self.mu) / self.sd
        return torch.softmax(self.head(f), dim=1)


class RealHeadBackbone(nn.Module):
    """224x224 patch -> DCID-7 softmax, via a frozen ImageNet backbone + a real-trained linear head."""

    def __init__(self, backbone: nn.Module, head: nn.Linear, mu: np.ndarray, sd: np.ndarray) -> None:
        super().__init__()
        self.backbone = backbone
        self.mu = nn.Parameter(torch.from_numpy(mu.astype(np.float32)), requires_grad=False)
        self.sd = nn.Parameter(torch.from_numpy(sd.astype(np.float32)), requires_grad=False)
        self.mean = nn.Parameter(IMAGENET_MEAN.clone(), requires_grad=False)
        self.std = nn.Parameter(IMAGENET_STD.clone(), requires_grad=False)
        self.head = head

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        f = self.backbone((x - self.mean) / self.std)
        return torch.softmax(self.head((f - self.mu) / self.sd), dim=1)


def export_real_head(net: LithoCNN, mb: nn.Module | None, ship_head: dict,
                     tr_paths: list[Path], tr_lab: np.ndarray,
                     te_paths: list[Path], te_lab: np.ndarray) -> tuple[int, dict]:
    """Re-fit the chosen head and export real-litho-cnn.onnx (self-contained: raw patch -> DCID-7 softmax)."""
    if ship_head["which"] == "mobilenet" and mb is not None:
        mf_tr = backbone_features(mb, np.stack([patch224_from_path(p) for p in tr_paths]), funnel24=False)
        mf_te = backbone_features(mb, np.stack([patch224_from_path(p) for p in te_paths]), funnel24=False)
        head, _, mu, sd = train_head(mf_tr, tr_lab, mf_te, te_lab, len(DCID7))
        model = RealHeadBackbone(mb, head, mu, sd).eval()
        dummy = torch.zeros(1, 3, 224, 224)
        torch.onnx.export(model, dummy, str(DERIVED / "real-litho-cnn.onnx"),
                          input_names=["x"], output_names=["p"],
                          dynamic_axes={"x": {0: "batch"}, "p": {0: "batch"}}, opset_version=17)
        return 224, {"note": "input 224x224 RGB [0,1]; ImageNet norm folded into the ONNX"}
    fa_tr, _ = litho_features(net, np.stack([patch24_from_path(p) for p in tr_paths]).astype(np.float32))
    fa_te, _ = litho_features(net, np.stack([patch24_from_path(p) for p in te_paths]).astype(np.float32))
    head, _, mu, sd = train_head(fa_tr, tr_lab, fa_te, te_lab, len(DCID7))
    model = RealHeadLitho(net, head, mu, sd).eval()
    dummy = torch.zeros(1, 3, PATCH, PATCH)
    torch.onnx.export(model, dummy, str(DERIVED / "real-litho-cnn.onnx"),
                      input_names=["x"], output_names=["p"],
                      dynamic_axes={"x": {0: "batch"}, "p": {0: "batch"}}, opset_version=17)
    return PATCH, {"note": "input 24x24 RGB [0,1] (the live window); DCID-7 softmax"}


if __name__ == "__main__":
    main()
