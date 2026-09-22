"""The two arms of milestone J (SPEC section 16), sharing one relational encoder and one
factorised readout.

- Supervised: encoder -> action-conditioned trunk -> readout.
- JEPA (Gen-Verse JEPA-Anything, upstream c6e6c88): encoder -> K action-conditioned factor
  predictors q_k(z_c, act) -> upstream pseudoinverse synthesis -> readout, trained with
  ``L = CE_readout + L_OPF`` against an EMA target encoder of the thing after the transition.

Everything here is small on purpose: the TypeScript runtime runs it inside a 100 ms tick.
"""

from __future__ import annotations

import copy

import torch
from torch import nn
from jepa_anything_core import OrthogonalFactorProjection, jepa_anything_objective
from jepa_anything_core.baselines import ema_update

from data import ACT, CHANNEL_SIZES, CLASSES, N, NEIGHBOUR, OBS, OFFSETS, PLACE, THING

LATENT = 32
HIDDEN = 64
FACTORS = 4
FACTOR_DIM = LATENT // FACTORS
TRUNK = 64
FACTOR_HIDDEN = 20
# Pre-registered sizes (docs/jepa-proof/REMEDIES.md): R1 widens both arms, capacity-matched.
SIZES = {
    "base": {"latent": 32, "hidden": 64, "factors": 4, "trunk": 64, "factor_hidden": 20},
    "large": {"latent": 64, "hidden": 128, "factors": 8, "trunk": 128, "factor_hidden": 20},
}
UPSTREAM = "c6e6c88f3ef75a4ce7acd660d6fa5779d995512c"


class Encoder(nn.Module):
    """A thing, its place and the act, plus a sum over up to eight related things."""

    def __init__(self, latent: int = LATENT, hidden: int = HIDDEN) -> None:
        super().__init__()
        self.self1 = nn.Linear(THING + PLACE + ACT, hidden)
        self.self2 = nn.Linear(hidden, latent)
        self.neighbour = nn.Linear(NEIGHBOUR, latent)
        self.combine1 = nn.Linear(2 * latent, latent)
        self.combine2 = nn.Linear(latent, latent)

    def forward(self, obs: torch.Tensor) -> torch.Tensor:
        head = obs[:, : THING + PLACE + ACT]
        nb = obs[:, THING + PLACE + ACT :].reshape(-1, N, NEIGHBOUR)
        present = nb[..., :1]
        h_self = self.self2(torch.relu(self.self1(head)))
        h_nb = (torch.relu(self.neighbour(nb)) * present).sum(dim=1)
        return self.combine2(torch.relu(self.combine1(torch.cat([h_self, h_nb], dim=-1))))


def act_of(obs: torch.Tensor) -> torch.Tensor:
    return obs[:, THING + PLACE : THING + PLACE + ACT]


class Supervised(nn.Module):
    arm = "supervised"

    def __init__(self, size: str = "base") -> None:
        super().__init__()
        c = SIZES[size]
        self.size = size
        self.encoder = Encoder(c["latent"], c["hidden"])
        self.trunk1 = nn.Linear(c["latent"] + ACT, c["trunk"])
        self.trunk2 = nn.Linear(c["trunk"], c["latent"])
        self.readout = nn.Linear(c["latent"], CLASSES)

    def logits(self, obs: torch.Tensor) -> torch.Tensor:
        z = self.encoder(obs)
        h = self.trunk2(torch.relu(self.trunk1(torch.cat([z, act_of(obs)], dim=-1))))
        return self.readout(h)

    def loss(self, obs, after, label, legal):  # noqa: ARG002 - the supervised arm has no target
        logits = self.logits(obs)
        return channel_nll(logits, label, legal).mean(), {}

    def after_step(self) -> None:
        pass


class Jepa(nn.Module):
    arm = "jepa"

    def __init__(self, momentum: float = 0.996, size: str = "base") -> None:
        super().__init__()
        c = SIZES[size]
        self.size = size
        latent, factors = c["latent"], c["factors"]
        self.encoder = Encoder(latent, c["hidden"])
        self.target = copy.deepcopy(self.encoder)
        self.target.requires_grad_(False)
        self.momentum = momentum
        self.heads1 = nn.ModuleList(nn.Linear(latent + ACT, c["factor_hidden"]) for _ in range(factors))
        self.heads2 = nn.ModuleList(nn.Linear(c["factor_hidden"], latent // factors) for _ in range(factors))
        self.opf = OrthogonalFactorProjection(latent, factors, latent // factors, learnable=True)
        self.readout = nn.Linear(latent, CLASSES)

    def factors(self, z: torch.Tensor, act: torch.Tensor) -> torch.Tensor:
        x = torch.cat([z, act], dim=-1)
        return torch.stack([h2(torch.relu(h1(x))) for h1, h2 in zip(self.heads1, self.heads2)], dim=-2)

    def logits(self, obs: torch.Tensor) -> torch.Tensor:
        z = self.encoder(obs)
        predicted = self.opf.compose(self.factors(z, act_of(obs)))
        return self.readout(predicted)

    def loss(self, obs, after, label, legal):
        z = self.encoder(obs)
        predicted_factors = self.factors(z, act_of(obs))
        logits = self.readout(self.opf.compose(predicted_factors))
        ce = channel_nll(logits, label, legal).mean()
        self.target.eval()
        with torch.no_grad():
            target_state = self.target(after)
        # Stop-gradient on the target encoder's output only; the projection still learns.
        target_factors = self.opf.decompose(target_state.detach())
        opf = jepa_anything_objective(
            predicted_factors,
            target_factors,
            self.opf.analysis_basis(),
            z,
            orthogonality_weight=0.10,
            factor_activity_weight=0.05,
            encoder_variance_weight=0.02,
        )
        return ce + opf.total, {"ce": float(ce), "opf_prediction": float(opf.prediction)}

    def after_step(self) -> None:
        ema_update(self.target, self.encoder, self.momentum)


def masked(logits: torch.Tensor, legal: torch.Tensor) -> list[torch.Tensor]:
    """Per channel, log-probabilities over the legal classes only."""
    out = []
    for offset, size in zip(OFFSETS, CHANNEL_SIZES):
        part = logits[:, offset : offset + size].masked_fill(~legal[:, offset : offset + size], float("-inf"))
        out.append(torch.log_softmax(part, dim=-1))
    return out


def channel_nll(logits: torch.Tensor, label: torch.Tensor, legal: torch.Tensor) -> torch.Tensor:  # noqa: ARG001
    """Training loss: each channel's softmax over all its classes, so what is never legal is
    pushed down and the model learns the envelope. Ranking still masks (``masked``)."""
    nll = torch.zeros(logits.shape[0], device=logits.device)
    for ch, (offset, size) in enumerate(zip(OFFSETS, CHANNEL_SIZES)):
        logp = torch.log_softmax(logits[:, offset : offset + size], dim=-1)
        nll = nll - logp.gather(1, label[:, ch : ch + 1]).squeeze(1)
    return nll


def parameters(model: nn.Module) -> int:
    skip = {id(p) for p in getattr(model, "target", nn.Module()).parameters()}
    return sum(p.numel() for p in model.parameters() if p.requires_grad and id(p) not in skip)


def build(arm: str, size: str = "base") -> nn.Module:
    return Jepa(size=size) if arm == "jepa" else Supervised(size=size)


assert OBS == THING + PLACE + ACT + N * NEIGHBOUR
