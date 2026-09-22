"""J1's measures (SPEC section 16), computed per split.

- top1: every channel's argmax among the legal classes equals the label.
- brier: sum over the envelope's candidates of (p - y)^2. The candidate set is the product of
  each channel's legal classes and the model's distribution over it factorises, so this is
  prod_ch(sum_k p_k^2) - 2 * prod_ch p_label + 1, exact, without listing the candidates.
- nll: minus the log probability of the label.
- rejected: the model's top choice over the full vocabulary (argmax per channel, no mask)
  falls outside the envelope.
- coverage: the label is inside the envelope. majority: the commonest label's share.
"""

from __future__ import annotations

import torch

from data import CHANNEL_SIZES, OFFSETS, SAME, Split, observe


@torch.no_grad()
def evaluate(model: torch.nn.Module, split: Split, batch: int = 16384) -> dict[str, float]:
    model.eval()
    totals = {"nll": 0.0, "top1": 0.0, "brier": 0.0, "rejected": 0.0, "coverage": 0.0, "changed_top1": 0.0, "changed": 0.0}
    labels_all = split.labels()
    for start in range(0, split.size, batch):
        index = torch.arange(start, min(start + batch, split.size), device=split.idx.device)
        logits = model.logits(observe(split, index))
        legal = split.legal[index]
        label = labels_all[index]
        n = index.shape[0]
        sum_sq = torch.ones(n, device=logits.device)
        p_label = torch.ones(n, device=logits.device)
        correct = torch.ones(n, dtype=torch.bool, device=logits.device)
        inside = torch.ones(n, dtype=torch.bool, device=logits.device)
        covered = torch.ones(n, dtype=torch.bool, device=logits.device)
        for ch, (offset, size) in enumerate(zip(OFFSETS, CHANNEL_SIZES)):
            part = logits[:, offset : offset + size]
            mask = legal[:, offset : offset + size]
            probs = torch.softmax(part.masked_fill(~mask, float("-inf")), dim=-1)
            y = label[:, ch]
            sum_sq *= (probs**2).sum(dim=-1)
            p_label *= probs.gather(1, y[:, None]).squeeze(1)
            correct &= probs.argmax(dim=-1) == y
            inside &= mask.gather(1, part.argmax(dim=-1, keepdim=True)).squeeze(1)
            covered &= mask.gather(1, y[:, None]).squeeze(1)
        changed = (label != torch.tensor(SAME, device=label.device)).any(dim=1)
        totals["nll"] += float(-torch.log(p_label.clamp_min(1e-12)).sum())
        totals["top1"] += float(correct.sum())
        totals["brier"] += float((sum_sq - 2 * p_label + 1).sum())
        totals["rejected"] += float((~inside).sum())
        totals["coverage"] += float(covered.sum())
        totals["changed_top1"] += float((correct & changed).sum())
        totals["changed"] += float(changed.sum())
    n = max(1, split.size)
    out = {k: v / n for k, v in totals.items() if k not in ("changed_top1", "changed")}
    out["changed_top1"] = totals["changed_top1"] / max(1.0, totals["changed"])
    out["changed_share"] = totals["changed"] / n
    out["majority"] = majority(labels_all)
    out["n"] = float(split.size)
    model.train()
    return out


def majority(labels: torch.Tensor) -> float:
    if labels.shape[0] == 0:
        return 0.0
    _, counts = torch.unique(labels, dim=0, return_counts=True)
    return float(counts.max()) / labels.shape[0]
