"""Train one arm on the open splits and keep the epoch with the lowest validation NLL.

    python train.py --data <dataset> --arm jepa --seed 17 --out <runs>/jepa-17

Both arms with the same seed start from the same encoder weights and see the same minibatch
order, so they differ only in what the arm adds. Sealed splits are never opened here.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import time
from pathlib import Path

import torch

from data import concat, load_split, observe, observe_after
from metrics import evaluate
from model import UPSTREAM, build, parameters


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--arm", choices=["supervised", "jepa"], required=True)
    ap.add_argument("--seed", type=int, required=True)
    ap.add_argument("--epochs", type=int, default=20)
    ap.add_argument("--batch", type=int, default=1024)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--extra", nargs="*", default=[], help="extra open splits to train on (post-training)")
    ap.add_argument("--repeat", type=int, default=1, help="how many times each extra split is repeated")
    ap.add_argument("--size", choices=["base", "large"], default="base")
    ap.add_argument("--init", type=Path, default=None, help="start from this run's checkpoint (post-training)")
    args = ap.parse_args()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch.manual_seed(args.seed)
    train = load_split(args.data, "train", device)
    if args.extra:
        extras = [(load_split(args.data, name, device), args.repeat) for name in args.extra]
        train = concat([(train, 1), *extras])
    val = load_split(args.data, "val", device)
    model = build(args.arm, args.size).to(device)
    if args.init is not None:
        model.load_state_dict(torch.load(args.init / "model.pt", weights_only=True)["state"])
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr)
    order = torch.Generator(device="cpu").manual_seed(args.seed)
    history = []
    best = (float("inf"), None, -1)
    started = time.time()
    for epoch in range(args.epochs):
        perm = torch.randperm(train.size, generator=order).to(device)
        running = 0.0
        for step, start in enumerate(range(0, train.size, args.batch)):
            index = perm[start : start + args.batch]
            obs = observe(train, index)
            after = observe_after(train, index)
            loss, _ = model.loss(obs, after, train.labels()[index], train.legal[index])
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            model.after_step()
            running += float(loss)
        metrics = evaluate(model, val)
        metrics.update(epoch=epoch, train_loss=running / (step + 1), seconds=time.time() - started)
        history.append(metrics)
        print(json.dumps({k: round(v, 5) if isinstance(v, float) else v for k, v in metrics.items()}), flush=True)
        if metrics["nll"] < best[0]:
            best = (metrics["nll"], copy.deepcopy(model.state_dict()), epoch)
    args.out.mkdir(parents=True, exist_ok=True)
    checkpoint = args.out / "model.pt"
    torch.save({"arm": args.arm, "seed": args.seed, "size": args.size, "state": best[1]}, checkpoint)
    digest = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
    manifest = json.loads((args.data / "manifest.json").read_text())
    summary = {
        "arm": args.arm,
        "seed": args.seed,
        "size": args.size,
        "best_epoch": best[2],
        "val": history[best[2]],
        "history": history,
        "parameters": parameters(model),
        "checkpoint_sha256": digest,
        "upstream_revision": UPSTREAM,
        "torch": torch.__version__,
        "dataset": {"observation": manifest["observation"], "outcomes": manifest["outcomes"], "train_rows": manifest["splits"]["train"]["files"]["rows.f16"]},
        "hyper": {"epochs": args.epochs, "batch": args.batch, "lr": args.lr, "extra": args.extra, "repeat": args.repeat, "init": str(args.init) if args.init else None},
    }
    (args.out / "summary.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps({"done": args.arm, "seed": args.seed, "best_epoch": best[2], "val_nll": best[0], "params": summary["parameters"]}))


if __name__ == "__main__":
    main()
