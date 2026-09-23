# Proposal: a learned world model inside a creature's mind

2026-09-22 · status: **design, pre-registered, not built** · follows [`REPORT.md`](REPORT.md)

## Why

Milestone J asked a JEPA to stand in for the physics, which the code engine
already computes exactly. The best it could be was a slower, fuzzier copy, and
the gates showed that. JEPA's real purpose is to learn a world model from
experience, when nobody hands you the rules.

In this game that describes a creature, not the engine. A wolf does not get
`resolve()`. It knows what it has seen, and a mind that learns consequences
from its own experience is what the living-world pillar and the
experimentation direction (SPEC sections 1 and 22, Q063) ask for.

The model shapes behaviour only. The engine still decides every physical
outcome (rules 1 and 3).

## What it is

- **One small predictive model per creature kind, adapted per individual.** It
  predicts what will happen to *the creature itself* (its body: hurt, hunger,
  warmth, rest) and to the things it acts on, if it takes each option open to
  it.
- **It sees only what the creature perceives.** The observation is the
  milestone J encoder (relations and distances, never tiles), restricted to
  `Body.aware`: what the creature has noticed, with the strength it noticed it
  at. It never sees world truth, so knowledge isolation holds by construction
  (SPEC section 22).
- **It learns only from what happened to it.** Its training data is its own
  logged transitions: the percepts before, its act, and what it perceived
  after. A creature that was never burned knows nothing about fire except what
  instinct gives it (below).
- **Instinct versus experience.**
  - *Instinct* is the kind's starting model, trained offline on the engine's
    transitions from the creature's point of view. That is milestone J's data,
    re-encoded.
  - *Experience* is fine-tuning on the individual's own log, in the background.
  - Two wolves with different lives diverge.

## How a creature chooses (the rules hold)

1. Code builds the closed option set it already builds (`offers`, including
   "none"; rule 4).
2. For each option the model predicts outcome classes for the creature's body
   and the patient: a latent rollout of one step, or two for "approach, then
   act".
3. **Code** turns the predicted classes into a value by the creature's needs,
   with the same needs arithmetic `routine` uses. The model never produces a
   number that matters (rule 3).
4. Code draws among the options by those values with the world RNG, logged
   (rule 9).
5. The engine resolves the chosen act as always. The creature then perceives
   the real outcome, and that transition joins its experience log.
6. **Surprise** is the gap between the predicted and the perceived outcome. It
   is logged, and it can raise the creature's attention and fear or anger
   (existing `feels`), and feed rumours.

Replay reads the logged choices and never runs a creature's model. A creature
whose model misses its budget falls back to the current `routine` (rule 2).

## Gates (to be fixed before any data is generated)

| Gate | Passes when |
| --- | --- |
| C1 Learns from harm | A creature burned once by approaching a fire avoids approaching fire in a **new place** in ≥ 80% of seeded trials. The unchanged `routine` baseline and an untrained-instinct creature are reported beside it |
| C2 Individuality | Two creatures of one kind with different histories (one burned, one fed near a fire) choose differently in the same new situation in ≥ 70% of seeded trials. Two with the same history choose the same way in ≥ 90% |
| C3 Budget | Per creature decision, including rollouts over its options, p95 ≤ 1 ms in the server module at 50 creatures; fallback < 1% |
| C4 Believability (people) | In blind pairs, observers judge the learning creature more lifelike than `routine` in ≥ 60% of ≥ 40 judgements |
| C5 No leak | A creature's decisions never change when unperceived world facts change (twin worlds that differ only in what it cannot sense), in 100% of seeded twins |

## What it reuses from milestone J

- The observation encoder, the JEPA arm and its trainer, the TypeScript runtime
  and the logged-draw seam.
- `rankedSettle`'s pattern: a model scores, code draws, and the note is logged.

## What is new

- A creature-perspective encoder over `Body.aware`.
- Body-outcome channels (hurt, hunger, warmth, rest), as classes, with the
  numbers staying code's.
- A per-individual experience log, and background fine-tuning with checkpoints
  pinned per creature and versioned like any checkpoint.
- A code utility over predicted classes.

## Open questions for the owner

1. Is learning per individual wanted, or is learning per kind (a shared culture)
   enough? Per individual costs a checkpoint per creature.
2. Should a creature's experience persist across sessions and restarts? SPEC
   rule 9 says the log holds it, so it can be replayed.
3. Should surprise events feed rumours and the author thread (section 10) now,
   or later?
4. Budget for C4's human observers.
