"""Milestone J dataset loading (SPEC section 16).

Reads the binary splits written by ``scripts/generate.ts`` and rebuilds observations on the
GPU exactly as ``encode.ts``'s ``assemble`` does. Sealed splits (a, b, the gap pool and the
labelled gap set) are refused unless the caller is the gate run and names the gate.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch

THING = 62
N = 8
RELATIONS = 4
ROLES = 10
PLACE = 6
ACT = 28
NEIGHBOUR = 1 + RELATIONS + 1 + ROLES + THING
OBS = THING + PLACE + ACT + N * NEIGHBOUR
CHANNEL_SIZES = (3, 3, 3, 2, 3, 3, 2, 3)
CLASSES = sum(CHANNEL_SIZES)
OFFSETS = tuple(int(x) for x in np.cumsum((0,) + CHANNEL_SIZES[:-1]))
SAME = (1, 1, 0, 0, 0, 1, 0, 0)
# The act features of a state seen at rest: process tick, role bystander, nothing else.
AT_REST_ACT = torch.zeros(ACT)
AT_REST_ACT[0] = 1.0  # process.tick
AT_REST_ACT[7] = 1.0  # role.bystander (after the seven processes)

SEALED = {"a", "b", "gap", "c", "c-claude"}


class SealedError(RuntimeError):
    pass


@dataclass
class Split:
    name: str
    rows: torch.Tensor  # [R, 125] float
    idx: torch.Tensor  # [S, 17] long
    cat: torch.Tensor  # [S, 36] long
    num: torch.Tensor  # [S, 56] float
    legal: torch.Tensor  # [S, 22] bool
    seed: torch.Tensor  # [S] long

    @property
    def size(self) -> int:
        return int(self.idx.shape[0])

    def labels(self) -> torch.Tensor:
        return self.cat[:, 24:32]

    def subset(self, index: torch.Tensor) -> "Split":
        return Split(self.name, self.rows, self.idx[index], self.cat[index], self.num[index], self.legal[index], self.seed[index])


def load_split(root: Path, name: str, device: str, gate: str | None = None) -> Split:
    """Load one split. A sealed split needs ``gate`` (the gate id), and only the gate run passes it."""
    manifest = json.loads((root / "manifest.json").read_text())
    info = manifest["splits"][name]
    if (name in SEALED or info["sealed"]) and gate is None:
        raise SealedError(f"split {name!r} is sealed; only the gate run may open it")
    folder = root / ("sealed" if info["sealed"] else "open") / name
    samples = info["samples"]
    rows = np.fromfile(folder / "rows.f16", dtype=np.float16).reshape(-1, 2 * THING + 1)
    idx = np.fromfile(folder / "idx.i32", dtype=np.int32).reshape(samples, 1 + 2 * N)
    cat = np.fromfile(folder / "cat.u8", dtype=np.uint8).reshape(samples, 4 * N + 4)
    num = np.fromfile(folder / "num.f16", dtype=np.float16).reshape(samples, 12 + ACT + 2 * N)
    meta = np.fromfile(folder / "meta.u32", dtype=np.uint32).reshape(samples, 2)
    bits = ((meta[:, 0:1] >> np.arange(CLASSES, dtype=np.uint32)) & 1).astype(bool)
    t = lambda a, dt: torch.from_numpy(np.ascontiguousarray(a)).to(device=device, dtype=dt)  # noqa: E731
    return Split(
        name,
        t(rows, torch.float32),
        t(idx, torch.long),
        t(cat, torch.long),
        t(num, torch.float32),
        t(bits, torch.bool),
        t(meta[:, 1].astype(np.int64), torch.long),
    )


def _neighbours(split: Split, rows: torch.Tensor, rel: torch.Tensor, dist: torch.Tensor, role: torch.Tensor | None, part: slice) -> torch.Tensor:
    b = rows.shape[0]
    present = (rows >= 0).float().unsqueeze(-1)
    safe = rows.clamp(min=0)
    things = split.rows[safe][..., part] * present
    rel_hot = torch.nn.functional.one_hot(rel, RELATIONS).float() * present
    if role is None:
        role_hot = torch.zeros(b, N, ROLES, device=rows.device)
        role_hot[..., 0] = 1.0
    else:
        role_hot = torch.nn.functional.one_hot(role, ROLES).float()
    role_hot = role_hot * present
    return torch.cat([present, rel_hot, dist.unsqueeze(-1) * present, role_hot, things], dim=-1).reshape(b, N * NEIGHBOUR)


def observe(split: Split, index: torch.Tensor) -> torch.Tensor:
    """The observation before the act, as ``observe`` builds it: [B, OBS]."""
    idx = split.idx[index]
    cat = split.cat[index]
    num = split.num[index]
    before = slice(0, THING)
    self_row = split.rows[idx[:, 0]][:, before]
    place = num[:, 0:6]
    act = num[:, 12 : 12 + ACT]
    dist = num[:, 12 + ACT : 12 + ACT + N]
    nb = _neighbours(split, idx[:, 1 : 1 + N], cat[:, 0:N], dist, cat[:, N : 2 * N], before)
    return torch.cat([self_row, place, act, nb], dim=-1)


def observe_after(split: Split, index: torch.Tensor) -> torch.Tensor:
    """The thing after the act, seen at rest: the JEPA target's input. [B, OBS]."""
    idx = split.idx[index]
    cat = split.cat[index]
    num = split.num[index]
    after = slice(THING, 2 * THING)
    self_row = split.rows[idx[:, 0]][:, after]
    place = num[:, 6:12]
    act = AT_REST_ACT.to(idx.device).expand(idx.shape[0], ACT)
    dist = num[:, 12 + ACT + N : 12 + ACT + 2 * N]
    nb = _neighbours(split, idx[:, 1 + N : 1 + 2 * N], cat[:, 2 * N : 3 * N], dist, None, after)
    return torch.cat([self_row, place, act, nb], dim=-1)


def concat(parts: list[tuple[Split, int]]) -> Split:
    """Several splits as one, each repeated ``times``; row indices are shifted to match."""
    rows, idx, cat, num, legal, seed = [], [], [], [], [], []
    offset = 0
    for split, times in parts:
        shifted = torch.where(split.idx >= 0, split.idx + offset, split.idx)
        rows.append(split.rows)
        for _ in range(times):
            idx.append(shifted)
            cat.append(split.cat)
            num.append(split.num)
            legal.append(split.legal)
            seed.append(split.seed)
        offset += split.rows.shape[0]
    return Split("+".join(s.name for s, _ in parts), torch.cat(rows), torch.cat(idx), torch.cat(cat), torch.cat(num), torch.cat(legal), torch.cat(seed))
