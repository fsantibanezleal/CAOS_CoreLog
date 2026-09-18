#!/usr/bin/env python3
"""Regenerate the figures for the CoreLog lithology-vision report from the repository artifacts (copied into
../data/cl.json from data/derived/cl-learned.json and data/derived/ood-bench.json). Two figures:

  fig-litho.pdf - (a) lithology accuracy: the CNN and the classical colour/texture baseline on synthetic core
                  (grouped-by-hole split), and two linear heads on real DCID-7 core, one over frozen ImageNet
                  MobileNetV3-Small features (224 px input) and one over the synthetic-trained CNN's 64-d features
                  (24 px input); (b) per-class recall of the CNN on synthetic core (dot plot).
  fig-ood.pdf   - the sim-to-real out-of-distribution benchmark: AUPR of nine detectors separating real DCID-7 core
                  (OOD) from held-out synthetic core (ID), with the chance level nOod / (nId + nOod).

Run:  python make_figs.py     (from repo root)
Deps: matplotlib, numpy.
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "data"

INK = "#1a1a2e"
GRID = "#d8d8e0"

plt.rcParams.update({
    "font.family": "serif", "font.size": 9.4, "axes.edgecolor": INK,
    "axes.labelcolor": INK, "text.color": INK, "xtick.color": INK, "ytick.color": INK,
    "axes.linewidth": 0.8, "figure.dpi": 200,
})

DETECTOR_NAMES = {
    "recon_mse": "autoencoder reconstruction error",
    "litho_mahalanobis": "LithoCNN 64-d, Mahalanobis",
    "litho_knn": "LithoCNN 64-d, kNN",
    "energy": "LithoCNN logits, energy",
    "msp": "LithoCNN logits, max softmax",
    "mobilenet_v3_small_mahalanobis": "MobileNetV3-S, Mahalanobis",
    "mobilenet_v3_small_knn": "MobileNetV3-S, kNN",
    "resnet18_mahalanobis": "ResNet-18, Mahalanobis",
    "resnet18_knn": "ResNet-18, kNN",
}


def _load():
    return json.loads((DATA / "cl.json").read_text(encoding="utf-8"))


def fig_litho():
    d = _load()
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.0, 3.1), gridspec_kw={"width_ratios": [1.25, 1]})

    # (a) accuracy: synthetic (CNN vs baseline) and real DCID-7 (two linear heads on frozen features)
    labels = ["synthetic core\nCNN", "synthetic core\ncolour/texture\nbaseline",
              "DCID-7\nImageNet\nMobileNetV3-S\n(224 px)", "DCID-7\nsynthetic-CNN\nfeatures\n(24 px)"]
    vals = [d["cnn_acc"], d["baseline_acc"], d["realhead_mobilenet_top1"], d["realhead_litho64_top1"]]
    cols = ["#1b6ca8", "#e07a3f", "#3fa34d", "#c99a1e"]
    a1.bar(range(4), vals, color=cols, edgecolor=INK, linewidth=0.5, width=0.62, zorder=3)
    for i, v in enumerate(vals):
        a1.annotate(f"{v:.3f}", (i, v), xytext=(0, 2), textcoords="offset points", ha="center", va="bottom",
                    fontsize=7.6, fontweight="bold")
    a1.set_ylim(0, 1.1)
    a1.set_xticks(range(4)); a1.set_xticklabels(labels, fontsize=6.6)
    a1.set_ylabel("top-1 accuracy")
    a1.set_title("(a) lithology accuracy, synthetic and real core", fontsize=8.4)
    a1.grid(axis="y", color=GRID, linewidth=0.7, zorder=0)
    a1.set_axisbelow(True)
    for s in ("top", "right"):
        a1.spines[s].set_visible(False)

    # (b) per-class recall of the synthetic CNN, as a dot plot (no truncated bars)
    rec = d["recall"]
    names = list(rec.keys()); vals = [rec[n] for n in names]
    y = np.arange(len(names))
    a2.hlines(y, 0.97, vals, color=GRID, linewidth=1.2, zorder=1)
    a2.plot(vals, y, "o", color="#1b6ca8", markeredgecolor=INK, markeredgewidth=0.5, markersize=6, zorder=3)
    for yi, v in zip(y, vals):
        a2.annotate(f"{v:.3f}", (v, yi), xytext=(0, 5), textcoords="offset points", ha="center", va="bottom",
                    fontsize=7.0)
    a2.set_yticks(y); a2.set_yticklabels(names, fontsize=7.6)
    a2.set_xlim(0.97, 1.005)
    a2.set_ylim(len(names) - 0.4, -0.8)
    a2.set_xlabel("recall on held-out synthetic holes")
    a2.set_title("(b) per-class recall of the CNN", fontsize=8.4)
    a2.grid(axis="x", color=GRID, linewidth=0.7, zorder=0)
    a2.set_axisbelow(True)
    for s in ("top", "right"):
        a2.spines[s].set_visible(False)

    fig.tight_layout()
    fig.savefig(HERE / "fig-litho.pdf", bbox_inches="tight")
    plt.close(fig)


def fig_ood():
    d = _load()
    det = sorted(d["detectors"], key=lambda x: x["aupr"] or 0)
    names = [DETECTOR_NAMES[x["name"]] for x in det]
    aupr = [x["aupr"] for x in det]
    shipped = d["shipped_ood"]["name"]
    chance = d["ood_n_ood"] / (d["ood_n_id"] + d["ood_n_ood"])
    cols = []
    for x in det:
        if x["name"] == shipped:
            cols.append("#3fa34d")
        elif x["name"] == "recon_mse":
            cols.append("#b23a48")
        elif x["name"].startswith(("mobilenet", "resnet")):
            cols.append("#1b6ca8")
        else:
            cols.append("#7d99b0")
    y = np.arange(len(det))
    fig, ax = plt.subplots(figsize=(6.4, 3.3))
    ax.barh(y, aupr, color=cols, edgecolor=INK, linewidth=0.5, height=0.66, zorder=3)
    for yi, v, x in zip(y, aupr, det):
        tag = "  (shipped)" if x["name"] == shipped else ""
        ax.annotate(f"{v:.3f}{tag}", (v, yi), xytext=(3, 0), textcoords="offset points", va="center", ha="left",
                    fontsize=6.8)
    ax.axvline(chance, color="#555", linestyle="--", linewidth=0.9, zorder=4)
    ax.annotate(f"chance level {chance:.2f}", (chance, len(det) - 0.45), xytext=(3, 0), textcoords="offset points",
                fontsize=6.8, color="#555", va="center", ha="left")
    ax.set_yticks(y); ax.set_yticklabels(names, fontsize=7.2)
    ax.set_xlim(0, 1.18)
    ax.set_ylim(-0.6, len(det) - 0.1)
    ax.set_xlabel("AUPR, real DCID-7 core (OOD) against held-out synthetic core (ID), both at 24 px")
    ax.set_title("Sim-to-real out-of-distribution detection", fontsize=8.8)
    ax.grid(axis="x", color=GRID, linewidth=0.7, zorder=0)
    ax.set_axisbelow(True)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    fig.tight_layout()
    fig.savefig(HERE / "fig-ood.pdf", bbox_inches="tight")
    plt.close(fig)


def main():
    fig_litho()
    fig_ood()
    print("wrote fig-litho.pdf, fig-ood.pdf")


if __name__ == "__main__":
    main()
