#!/usr/bin/env python3
"""Regenerate the figures for the CoreLog lithology-vision report from the COMMITTED artifacts. Two figures:

  fig-litho.pdf - (a) lithology accuracy: the learned CNN vs a classical colour/texture baseline on synthetic
                  core (leakage-safe grouped-by-hole split), and the real-lane heads on real DCID-7 core;
                  (b) per-class recall of the CNN on synthetic core.
  fig-ood.pdf   - the sim-to-real out-of-distribution detection: nine detectors distinguishing real DCID-7 core
                  from synthetic training core, showing feature-space detectors succeed where reconstruction fails.

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


def _load():
    return json.loads((DATA / "cl.json").read_text(encoding="utf-8"))


def fig_litho():
    d = _load()
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.0, 3.0), gridspec_kw={"width_ratios": [1.05, 1]})

    # (a) accuracy: synthetic (CNN vs baseline) + real (mobilenet vs litho64 features)
    labels = ["synthetic\nCNN", "synthetic\ncolour/texture", "real DCID-7\nmobilenet head", "real DCID-7\nsynth features"]
    vals = [d["cnn_acc"], d["baseline_acc"], d.get("realhead_mobilenet_top1"), d.get("realhead_litho64_top1")]
    cols = ["#1b6ca8", "#e07a3f", "#3fa34d", "#c99a1e"]
    bars = a1.bar(range(4), vals, color=cols, edgecolor=INK, linewidth=0.5, width=0.66, zorder=3)
    for i, v in enumerate(vals):
        a1.text(i, v + 0.008, f"{v:.3f}", ha="center", va="bottom", fontsize=7.6, fontweight="bold")
    a1.set_ylim(0.85, 1.02)
    a1.set_xticks(range(4)); a1.set_xticklabels(labels, fontsize=7.0)
    a1.set_ylabel("classification accuracy (top-1)")
    a1.set_title("(a) lithology accuracy: synthetic and real", fontsize=8.4)
    a1.grid(axis="y", color=GRID, linewidth=0.7, zorder=0)
    a1.set_axisbelow(True)
    for s in ("top", "right"):
        a1.spines[s].set_visible(False)

    # (b) per-class recall (synthetic CNN)
    rec = d["recall"]
    names = list(rec.keys()); vals = [rec[n] for n in names]
    a2.barh(range(len(names)), vals, color="#1b6ca8", edgecolor=INK, linewidth=0.5, height=0.66, zorder=3)
    for i, v in enumerate(vals):
        a2.text(v - 0.003, i, f"{v:.3f}", va="center", ha="right", fontsize=7.0, color="white", fontweight="bold")
    a2.set_yticks(range(len(names))); a2.set_yticklabels(names, fontsize=7.6)
    a2.set_xlim(0.9, 1.005)
    a2.set_xlabel("per-class recall (synthetic CNN)")
    a2.set_title("(b) per-class recall", fontsize=8.4)
    a2.grid(axis="x", color=GRID, linewidth=0.7, zorder=0)
    a2.set_axisbelow(True)
    a2.invert_yaxis()
    for s in ("top", "right"):
        a2.spines[s].set_visible(False)

    fig.tight_layout()
    fig.savefig(HERE / "fig-litho.pdf", bbox_inches="tight")
    plt.close(fig)


def fig_ood():
    d = _load()
    det = sorted(d["detectors"], key=lambda x: x["aupr"] or 0)
    names = [x["name"].replace("_", " ").replace("mobilenet v3 small", "mnetv3").replace("resnet18", "rn18")
             for x in det]
    aupr = [x["aupr"] for x in det]
    shipped = d["shipped_ood"]["name"]
    cols = []
    for x in det:
        if x["name"] == shipped:
            cols.append("#3fa34d")
        elif x["aupr"] and x["aupr"] > 0.99:
            cols.append("#1b6ca8")
        elif x["name"] == "recon_mse":
            cols.append("#b23a48")
        else:
            cols.append("#7d99b0")
    y = np.arange(len(det))
    fig, ax = plt.subplots(figsize=(6.4, 3.3))
    ax.barh(y, aupr, color=cols, edgecolor=INK, linewidth=0.5, height=0.66, zorder=3)
    for yi, v, x in zip(y, aupr, det):
        tag = "  (shipped)" if x["name"] == shipped else ("  (best)" if v and v > 0.999 else "")
        ax.text(v + 0.008, yi, f"{v:.3f}{tag}", va="center", ha="left", fontsize=6.8)
    ax.set_yticks(y); ax.set_yticklabels(names, fontsize=7.2)
    ax.set_xlim(0, 1.18)
    ax.set_xlabel("AUPR (detecting real DCID-7 core vs synthetic training core)")
    ax.set_title("Sim-to-real OOD: feature-space detectors succeed,\nreconstruction fails (red)", fontsize=8.8)
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
