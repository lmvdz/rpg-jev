"""The gate run: the only code that opens sealed splits (SPEC section 16, milestone J).

    python gate.py --gate J1 --data <dataset> --runs <runs> --out validation/jepa-proof/j1.json

J1 is decided on (b), averaged over the three seeds, by the thresholds written before any
sealed data existed: JEPA top-1 >= 0.70 and above (b)'s majority-outcome rate, JEPA Brier below
the supervised baseline's, and the envelope rejecting JEPA's top choice in < 5% of transitions.
(a), (c) and the Claude-only (c) are reported beside it. For J3 the same measures compare two
named runs on (a), (b) and (c).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch

from data import load_split
from metrics import evaluate
from model import build

SEEDS = (17, 29, 43)
FAMILIES = {1: "B1", 2: "B2", 3: "B3"}


def load_run(run: Path, device: str) -> torch.nn.Module:
    saved = torch.load(run / "model.pt", weights_only=True, map_location=device)
    model = build(saved["arm"]).to(device)
    model.load_state_dict(saved["state"])
    return model


def measure(model: torch.nn.Module, splits: dict) -> dict:
    out = {}
    for name, split in splits.items():
        out[name] = evaluate(model, split)
    b = splits["b"]
    for code, family in FAMILIES.items():
        index = torch.nonzero(b.cat[:, 34] == code).squeeze(1)
        out[f"b.{family}"] = evaluate(model, b.subset(index))
    return out


def mean(results: list[dict], split: str, key: str) -> float:
    return sum(r[split][key] for r in results) / len(results)


def j1(data: Path, runs: Path, device: str) -> dict:
    splits = {name: load_split(data, name, device, gate="J1") for name in ("a", "b", "c", "c-claude")}
    per_run = {}
    for arm in ("supervised", "jepa"):
        for seed in SEEDS:
            per_run[f"{arm}-{seed}"] = measure(load_run(runs / f"{arm}-{seed}", device), splits)
    jepa = [per_run[f"jepa-{s}"] for s in SEEDS]
    sup = [per_run[f"supervised-{s}"] for s in SEEDS]
    keys = ("top1", "brier", "nll", "rejected", "coverage", "majority", "changed_top1", "n")
    means = {
        arm: {split: {k: mean(rs, split, k) for k in keys} for split in per_run[f"{arm}-17"]}
        for arm, rs in (("jepa", jepa), ("supervised", sup))
    }
    b_j, b_s = means["jepa"]["b"], means["supervised"]["b"]
    checks = {
        "top1 >= 0.70": b_j["top1"] >= 0.70,
        "top1 > majority": b_j["top1"] > b_j["majority"],
        "brier < supervised": b_j["brier"] < b_s["brier"],
        "rejected < 0.05": b_j["rejected"] < 0.05,
    }
    return {"gate": "J1", "pass": all(checks.values()), "checks": checks, "means": means, "runs": per_run}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gate", choices=["J1"], required=True)
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--runs", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    result = j1(args.data, args.runs, device)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2))
    print(json.dumps({"gate": result["gate"], "pass": result["pass"], "checks": result["checks"]}))
    for arm in ("jepa", "supervised"):
        for split, m in result["means"][arm].items():
            print(arm, split, {k: round(v, 4) for k, v in m.items()})


if __name__ == "__main__":
    main()
