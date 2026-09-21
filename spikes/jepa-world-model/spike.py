"""Offline, shadow-only PyTorch experiment. No game or API integration."""

import argparse
import copy
import hashlib
import importlib.metadata
import io
import json
import platform
import random
import sys
import time
from pathlib import Path

import torch
from torch import nn
from torch.nn import functional as F
from jepa_anything_core.opf import OrthogonalFactorProjection
from jepa_anything_core.losses import jepa_anything_objective

from domain import ACTIONS, FEATURES, OUTCOMES, SCHEMA, UPSTREAM, load_jsonl, partition, synthetic, validate


class Model(nn.Module):
    def __init__(self, variant, width=32):
        super().__init__()
        self.variant = variant
        self.width = width
        self.encoder = nn.Sequential(nn.Linear(len(FEATURES), width), nn.ReLU(),
                                     nn.Linear(width, width))
        self.choice = nn.Linear(width, len(ACTIONS))
        self.predictor = nn.Sequential(nn.Linear(width + len(ACTIONS), width), nn.ReLU(),
                                       nn.Linear(width, width))
        self.outcome = nn.Linear(width, len(OUTCOMES))
        if variant == "jepa":
            self.opf = OrthogonalFactorProjection(width, 4, learnable=True)
            self.target = copy.deepcopy(self.encoder).requires_grad_(False)

    def forward(self, x, action, legal):
        z = self.encoder(x)
        predicted = self.predictor(torch.cat((z, F.one_hot(action, len(ACTIONS)).float()), -1))
        logits = self.choice(z).masked_fill(~legal, -1e9)
        return logits, self.outcome(predicted), z, predicted

    def auxiliary(self, z, predicted, future):
        with torch.no_grad():
            target = self.target(future)
        # Stop target ENCODER gradients, not projector gradients (upstream contract).
        return jepa_anything_objective(
            self.opf.decompose(predicted), self.opf.decompose(target),
            self.opf.analysis_basis(), z,
        ).total

    @torch.no_grad()
    def update_target(self, momentum=.99):
        for target, online in zip(self.target.parameters(), self.encoder.parameters()):
            target.lerp_(online, 1 - momentum)


def tensors(rows, device, labeled=False):
    result = [
        torch.tensor([[float(r["features"][k]) for k in FEATURES] for r in rows], device=device),
        torch.tensor([ACTIONS.index(r["action"]) for r in rows], device=device),
        torch.tensor([[a in r["legal_actions"] for a in ACTIONS] for r in rows], device=device),
    ]
    if labeled:
        result += [
            torch.tensor([ACTIONS.index(r["choice"]) for r in rows], device=device),
            torch.tensor([[r["outcome"][k] for k in OUTCOMES] for r in rows], device=device).float(),
            torch.tensor([[float(r["next_features"][k]) for k in FEATURES] for r in rows], device=device),
        ]
    return result


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def upstream_provenance():
    distribution = importlib.metadata.distribution("jepa-anything-core")
    provenance = json.loads(distribution.read_text("direct_url.json") or "{}")
    if provenance.get("vcs_info", {}).get("commit_id") != UPSTREAM:
        raise ValueError("install the pinned upstream Git dependency from requirements.txt")
    return provenance


def metadata(args):
    return {"schema_version": SCHEMA, "upstream_revision": UPSTREAM,
            "upstream_provenance": upstream_provenance(),
            "torch": str(torch.__version__), "core": importlib.metadata.version("jepa-anything-core"),
            "python": platform.python_version(), "platform": platform.platform(),
            "device": str(args.device),
            "device_name": torch.cuda.get_device_name(args.device) if args.device.startswith("cuda") else platform.processor(),
            "cuda_runtime": torch.version.cuda, "seed": args.seed, "threads": args.threads,
            "arguments": vars(args), "label_source": "synthetic_rules_v1",
            "shadow_only": True}


def splits(rows, seed):
    result = {name: [r for r in rows if partition(r["episode_id"], seed) == name]
              for name in ("train", "validation", "test")}
    if any(not group for group in result.values()):
        raise ValueError("all episode partitions must be nonempty; generate more episodes")
    return result


@torch.inference_mode()
def evaluate(model, rows, device, batch_size=256):
    model.eval()
    correct = nll = brier = 0.
    for start in range(0, len(rows), batch_size):
        batch = rows[start:start + batch_size]
        x, action, legal, choice, outcome, _ = tensors(batch, device, True)
        logits, predicted, _, _ = model(x, action, legal)
        correct += (logits.argmax(-1) == choice).sum().item()
        nll += F.cross_entropy(logits, choice, reduction="sum").item()
        brier += (predicted.sigmoid() - outcome).square().sum().item()
    return {"rows": len(rows), "episodes": len({r["episode_id"] for r in rows}),
            "choice_accuracy": correct / len(rows), "choice_nll": nll / len(rows),
            "outcome_brier": brier / (len(rows) * len(OUTCOMES))}


def train(args):
    rows = load_jsonl(args.input, True)
    groups = splits(rows, args.seed)
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    meta = metadata(args)
    meta["input_sha256"] = digest(args.input)
    meta["split_episodes"] = {k: sorted({r["episode_id"] for r in v}) for k, v in groups.items()}
    meta["configuration"] = {"width": args.width, "ema": .99, "auxiliary_weight": args.aux_weight}
    for variant in ("baseline", "jepa"):
        random.seed(args.seed)
        torch.manual_seed(args.seed)
        model = Model(variant, args.width).to(args.device)
        optimizer = torch.optim.AdamW((p for p in model.parameters() if p.requires_grad), lr=args.lr)
        rng = random.Random(args.seed)
        history, best = [], float("inf")
        for epoch in range(args.epochs):
            model.train()
            order = list(groups["train"])
            rng.shuffle(order)
            total = 0.
            for start in range(0, len(order), args.batch_size):
                batch = order[start:start + args.batch_size]
                x, action, legal, choice, outcome, future = tensors(batch, args.device, True)
                logits, predicted_outcome, z, predicted = model(x, action, legal)
                loss = F.cross_entropy(logits, choice) + F.binary_cross_entropy_with_logits(predicted_outcome, outcome)
                if variant == "jepa":
                    loss = loss + args.aux_weight * model.auxiliary(z, predicted, future)
                if not torch.isfinite(loss):
                    raise RuntimeError("nonfinite training loss")
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                if variant == "jepa":
                    model.update_target()
                total += loss.item() * len(batch)
            validation = evaluate(model, groups["validation"], args.device)
            history.append({"epoch": epoch + 1, "loss": total / len(order), "validation": validation})
            score = validation["choice_nll"] + validation["outcome_brier"]
            if score < best:
                best = score
                torch.save({"state": model.state_dict(), "variant": variant, "width": args.width,
                            "metadata": meta, "epoch": epoch + 1}, out / f"{variant}.pt")
        selected, _ = load_model(out / f"{variant}.pt", args.device)
        write_json(out / f"{variant}.metrics.json",
                   {"metadata": meta, "history": history,
                    "test": evaluate(selected, groups["test"], args.device)})
    write_json(out / "metadata.json", meta)


def load_model(path, device):
    upstream_provenance()
    # Hash exactly the byte snapshot deserialized, even if the path is replaced.
    snapshot = Path(path).read_bytes()
    # Keep the audit state_dict on CPU rather than retaining a second GPU copy.
    checkpoint = torch.load(io.BytesIO(snapshot), map_location="cpu", weights_only=True)
    checkpoint["sha256"] = hashlib.sha256(snapshot).hexdigest()
    if checkpoint["metadata"]["upstream_revision"] != UPSTREAM or checkpoint["metadata"]["schema_version"] != SCHEMA:
        raise ValueError("incompatible checkpoint")
    if checkpoint["variant"] not in ("baseline", "jepa"):
        raise ValueError("unknown checkpoint variant")
    model = Model(checkpoint["variant"], checkpoint["width"]).to(device)
    model.load_state_dict(checkpoint["state"])
    del checkpoint["state"]
    model.eval()
    return model, checkpoint


@torch.inference_mode()
def response(model, row, device, checkpoint_info):
    logits, outcome, _, _ = model(*tensors([row], device))
    probabilities = logits.softmax(-1)[0].tolist()
    return {"schema_version": SCHEMA, "request_id": row["request_id"], "episode_id": row["episode_id"],
            "shadow_only": True, "action": row["action"],
            "choice_probabilities": {a: probabilities[i] for i, a in enumerate(ACTIONS) if a in row["legal_actions"]},
            "predicted_outcome": dict(zip(OUTCOMES, outcome.sigmoid()[0].tolist())),
            "checkpoint": checkpoint_info}


def inference(args):
    model, checkpoint = load_model(args.checkpoint, args.device)
    rows = load_jsonl(args.input)
    info = {"sha256": checkpoint["sha256"], "variant": checkpoint["variant"], "upstream_revision": UPSTREAM}
    stream = sys.stdout if args.output == "-" else open(args.output, "w", encoding="utf-8")
    try:
        for row in rows:
            stream.write(json.dumps(response(model, row, args.device, info), allow_nan=False) + "\n")
    finally:
        if stream is not sys.stdout:
            stream.close()


def sync(device):
    if device.startswith("cuda"):
        torch.cuda.synchronize(device)


def process_peak_memory():
    """Process-lifetime peak RSS/working set, including imports and checkpoint load."""
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes

        class Counters(ctypes.Structure):
            _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD)] + [
                (name, ctypes.c_size_t) for name in (
                    "PeakWorkingSetSize", "WorkingSetSize", "QuotaPeakPagedPoolUsage",
                    "QuotaPagedPoolUsage", "QuotaPeakNonPagedPoolUsage", "QuotaNonPagedPoolUsage",
                    "PagefileUsage", "PeakPagefileUsage",
                )
            ]

        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        psapi = ctypes.WinDLL("psapi", use_last_error=True)
        kernel.GetCurrentProcess.restype = wintypes.HANDLE
        psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
        psapi.GetProcessMemoryInfo.restype = wintypes.BOOL
        counters = Counters()
        counters.cb = ctypes.sizeof(counters)
        if not psapi.GetProcessMemoryInfo(kernel.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
            raise ctypes.WinError(ctypes.get_last_error())
        return counters.PeakWorkingSetSize
    import resource
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return peak if sys.platform == "darwin" else peak * 1024


@torch.inference_mode()
def benchmark(args):
    model, checkpoint = load_model(args.checkpoint, args.device)
    row = load_jsonl(args.input)[0]
    batch = tensors([row], args.device)
    info = {"sha256": checkpoint["sha256"], "variant": checkpoint["variant"], "upstream_revision": UPSTREAM}
    # Benchmark a clean inference request, never training-label serialization.
    encoded = json.dumps({key: row[key] for key in (
        "schema_version", "request_id", "episode_id", "features", "legal_actions", "action",
    )})
    def request_roundtrip():
        decoded = validate(json.loads(encoded))
        return json.dumps(response(model, decoded, args.device, info), allow_nan=False)

    for _ in range(args.warmup):
        model(*batch)
        request_roundtrip()
    sync(args.device)
    if args.device.startswith("cuda"):
        torch.cuda.reset_peak_memory_stats(args.device)
    timings = []
    for _ in range(args.iterations):
        sync(args.device)
        start = time.perf_counter_ns()
        model(*batch)
        sync(args.device)
        timings.append((time.perf_counter_ns() - start) / 1e6)
    ordered = sorted(timings)
    request_timings = []
    for _ in range(args.iterations):
        sync(args.device)
        start = time.perf_counter_ns()
        request_roundtrip()
        sync(args.device)
        request_timings.append((time.perf_counter_ns() - start) / 1e6)
    request_ordered = sorted(request_timings)
    write_json(args.output, {
        "metadata": metadata(args), "checkpoint_sha256": checkpoint["sha256"],
        "variant": checkpoint["variant"], "batch_size": 1,
        "scope": "resident tensor forward only; excludes JSON, transfer, softmax, checkpoint load",
        "warmup": args.warmup, "iterations": args.iterations,
        "p50_ms": ordered[(len(ordered) - 1) // 2],
        "p95_ms": ordered[min(len(ordered) - 1, int(.95 * len(ordered)))],
        "samples_ms": timings,
        "request_scope": "resident model: JSON parse, validation, tensor creation/transfer, forward, probabilities, response JSON; excludes process startup, checkpoint load, transport",
        "request_p50_ms": request_ordered[(len(request_ordered) - 1) // 2],
        "request_p95_ms": request_ordered[min(len(request_ordered) - 1, int(.95 * len(request_ordered)))],
        "request_samples_ms": request_timings,
        "parameter_bytes": sum(p.numel() * p.element_size() for p in model.parameters()),
        "cuda_peak_allocated_bytes": torch.cuda.max_memory_allocated(args.device) if args.device.startswith("cuda") else None,
        "cuda_peak_reserved_bytes": torch.cuda.max_memory_reserved(args.device) if args.device.startswith("cuda") else None,
        "process_peak_memory_bytes": process_peak_memory(),
        "process_memory_scope": "process-lifetime peak RSS/Windows working set; includes imports and checkpoint load",
    })


def positive(value):
    value = int(value)
    if value < 1:
        raise argparse.ArgumentTypeError("must be positive")
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest="command", required=True)
    for command in ("generate", "train", "evaluate", "infer", "benchmark"):
        sub = subs.add_parser(command)
        sub.add_argument("--output", required=True)
        sub.add_argument("--seed", type=int, default=17)
        sub.add_argument("--device", default="cpu")
        sub.add_argument("--threads", type=positive, default=1)
        if command != "generate":
            sub.add_argument("--input", required=True)
        if command in ("evaluate", "infer", "benchmark"):
            sub.add_argument("--checkpoint", required=True)
        if command == "generate":
            sub.add_argument("--episodes", type=positive, default=500)
        if command == "train":
            sub.add_argument("--epochs", type=positive, default=20)
            sub.add_argument("--batch-size", type=positive, default=64)
            sub.add_argument("--width", type=positive, default=32)
            sub.add_argument("--lr", type=float, default=.001)
            sub.add_argument("--aux-weight", type=float, default=.1)
        if command == "evaluate":
            sub.add_argument("--split", choices=("train", "validation", "test"), default="test")
        if command == "benchmark":
            sub.add_argument("--warmup", type=positive, default=20)
            sub.add_argument("--iterations", type=positive, default=200)
    args = parser.parse_args()
    torch.set_num_threads(args.threads)
    random.seed(args.seed)
    torch.manual_seed(args.seed)
    if args.command == "generate":
        Path(args.output).write_text("".join(json.dumps(r) + "\n" for r in synthetic(args.episodes, args.seed)), encoding="utf-8")
    elif args.command == "train":
        if args.width % 4 or not 0 <= args.aux_weight < float("inf") or not 0 < args.lr < float("inf"):
            parser.error("width must be divisible by four; lr positive finite; aux-weight nonnegative finite")
        train(args)
    elif args.command == "infer":
        inference(args)
    elif args.command == "benchmark":
        benchmark(args)
    else:
        model, checkpoint = load_model(args.checkpoint, args.device)
        if digest(args.input) != checkpoint["metadata"]["input_sha256"]:
            raise ValueError("evaluate requires original training JSONL; use infer for new data")
        # Split seed is checkpoint-owned, never changed by evaluation arguments.
        rows = splits(load_jsonl(args.input, True), checkpoint["metadata"]["seed"])[args.split]
        write_json(args.output, {"checkpoint_sha256": checkpoint["sha256"],
                                "split": args.split, "metrics": evaluate(model, rows, args.device)})


if __name__ == "__main__":
    main()
