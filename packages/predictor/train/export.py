"""Export a checkpoint to the TypeScript runtime's JSON (``src/runtime.ts``) with a parity file.

    python export.py --run <runs>/jepa-17 --data <dataset> --out <runs>/jepa-17/runtime.json

The JEPA arm's synthesis (upstream pseudoinverse of the analysis basis) is a fixed matrix at
inference, so it is folded into the readout: logits = W_r (S f) + b = (W_r S) f + b. The EMA
target and the OPF losses are training-only. The parity file holds validation observations
and PyTorch's per-channel probabilities for the runtime test to reproduce.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import torch

from data import CHANNEL_SIZES, OFFSETS, load_split, observe
from model import ACT, FACTOR_DIM, FACTORS, HIDDEN, LATENT, UPSTREAM, build

RUNTIME_VERSION = "jepa-runtime-v1"


def layer(linear: torch.nn.Linear, weight: torch.Tensor | None = None) -> dict:
    w = linear.weight if weight is None else weight
    return {"weight": w.detach().double().cpu().tolist(), "bias": linear.bias.detach().double().cpu().tolist()}


def probabilities(logits: torch.Tensor) -> torch.Tensor:
    return torch.cat([torch.softmax(logits[:, o : o + s], dim=-1) for o, s in zip(OFFSETS, CHANNEL_SIZES)], dim=-1)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", type=Path, required=True)
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--parity", type=int, default=256)
    args = ap.parse_args()
    saved = torch.load(args.run / "model.pt", weights_only=True)
    summary = json.loads((args.run / "summary.json").read_text())
    model = build(saved["arm"]).double()
    model.load_state_dict(saved["state"])
    model.eval()
    enc = model.encoder
    layers = {
        "self1": layer(enc.self1),
        "self2": layer(enc.self2),
        "neighbour": layer(enc.neighbour),
        "combine1": layer(enc.combine1),
        "combine2": layer(enc.combine2),
    }
    if saved["arm"] == "jepa":
        basis = model.opf.analysis_basis().detach().double()
        synthesis = torch.linalg.pinv(basis.reshape(LATENT, LATENT))
        folded = model.readout.weight.detach().double() @ synthesis
        layers["heads1"] = [layer(h) for h in model.heads1]
        layers["heads2"] = [layer(h) for h in model.heads2]
        layers["readout"] = layer(model.readout, folded)
    else:
        layers["trunk1"] = layer(model.trunk1)
        layers["trunk2"] = layer(model.trunk2)
        layers["readout"] = layer(model.readout)
    runtime = {
        "version": RUNTIME_VERSION,
        "arm": saved["arm"],
        "observation": summary["dataset"]["observation"],
        "outcomes": summary["dataset"]["outcomes"],
        "dims": {"latent": LATENT, "hidden": HIDDEN, "act": ACT, "factors": FACTORS, "factorDim": FACTOR_DIM},
        "layers": layers,
        "provenance": {
            "checkpoint_sha256": summary["checkpoint_sha256"],
            "seed": summary["seed"],
            "best_epoch": summary["best_epoch"],
            "upstream_revision": UPSTREAM,
            "torch": summary["torch"],
            "train_rows_sha256": summary["dataset"]["train_rows"],
        },
    }
    text = json.dumps(runtime)
    runtime["id"] = hashlib.sha256(text.encode()).hexdigest()[:16]
    args.out.write_text(json.dumps(runtime))
    val = load_split(args.data, "val", "cpu")
    index = torch.arange(args.parity)
    obs = observe(val, index).double()
    with torch.no_grad():
        probs = probabilities(model.logits(obs))
    parity = {"model": runtime["id"], "observations": obs.tolist(), "probabilities": probs.tolist()}
    (args.out.parent / "parity.json").write_text(json.dumps(parity))
    print(json.dumps({"exported": str(args.out), "id": runtime["id"], "arm": saved["arm"]}))


if __name__ == "__main__":
    main()
