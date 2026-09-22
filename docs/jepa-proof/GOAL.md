# Goal: prove a real-time JEPA world model in the 2D rpg-jev sandbox

You are the autonomous technical lead for rpg-jev (H:\rpg-jev, github.com/lmvdz/rpg-jev).
Run this goal to completion without asking for confirmation, except at the explicit
STOP points below. Report honestly: a failed gate with evidence is a valid outcome;
a loosened gate is not.

## Why

The product vision is a real-time multiplayer sandbox where a learned JEPA world model
answers "what happens next" for any interaction, trained to a solid base on physics and
improved over time from gameplay. The eventual client may be Unreal Engine; the 2D glyph
game is the proving ground. This goal proves or disproves the model cheaply, in 2D,
with everything except rendering built to carry over unchanged.

## Decisions already made (do not reopen)

1. **JEPA ranks, code commits.** Each tick, code lists the physically legal outcomes
   for each affected thing, always including "nothing happens". JEPA scores them. Code
   draws one with the seeded Rng, applies all numbers and commits. The draw, the
   candidate set hash and the model checkpoint id are logged. Replay reads the log and
   never re-runs the model (constitutional rules 1, 3, 4, 9 hold).
2. **Engine-agnostic state.** Everything the model observes is things, states and
   relations (in, on, touching, near + distance), never grid cells or pixels. A future
   Unreal client must be able to use the same model and server unchanged.
3. **World physics vs presentation physics.** World outcomes (burns, cracks, cooks,
   flees) are decided only on the server. Clients only draw projections and never
   decide outcomes.
4. **One authority:** `packages/server` (SpacetimeDB 2.10.1). Other runtimes in
   Delta worktrees are sources to port from, not rivals to keep.
5. **Teachers for the base model:** (a) the code engine (`packages/core/src/matter` +
   graph kernel) through a seeded scenario generator; (b) offline, for combinations the
   code cannot answer: Claude proposes an outcome, Jev ratifies it, code validates it,
   and it becomes a label. Never train on the model's own outputs as ground truth.
6. **Post-training labels come from outside the model:** envelope rejections, broken
   invariants, Jev plausibility judgments, and actions the model had no confident
   answer for. Checkpoints are versioned; each world pins one; upgrades pass a gate.
7. **Rule 2 holds:** if the model misses its deadline, the tick falls back to the
   code engine's outcome and logs that it did.

## Hard constraints

- Read CLAUDE.md, AGENTS.md and SPEC.md (sections 1–4, 13, 14, 16, 19, 21–23) first.
  Their rules bind every change. `pnpm check` must pass before every push.
- Git: fetch first; work on a new branch `feat/jepa-proof` from
  `origin/feat/open-world-browser`. Commit in logical groups with the repo's
  `<emoji> type(scope): subject` style, no AI co-author footers, and push
  after each phase. Never force-push, never merge to poc/main, never delete branches
  or worktrees. Do the work in a new worktree (for example
  `H:\rpg-jev.worktrees\jepa-proof`), never in the main checkout `H:\rpg-jev`, which
  holds other sessions' uncommitted files.
- Delta worktrees under `H:\rpg-jev\.delta\worktrees\*` contain uncommitted work
  from other threads. Read them to harvest code (especially `feat/causal-foundation`:
  `packages/predictor`, the TypeScript OPF runtime port, microbatching server;
  `renderer/rangedrifter-study`: `packages/core/src/containment`, landscape recipes;
  `implementation/engine-foundation`). Never modify, commit, stash or clean them.
  Also harvest from `origin/feat/jepa-world-model-spike` (`spikes/jepa-world-model`).
- No Anthropic API key. Generative calls go through the Claude CLI on the subscription
  login. Jev is pinned to `jev-1.13.0` with `TYPESAFE_API_KEY` from `.env`. Budget:
  at most $1.00 of Jev spend for this goal; STOP and ask before exceeding it.
- No new Jev question families without approval (M2 is frozen at eight). If
  ratifying physics labels needs one, write the family (criteria, not_for, examples,
  paraphrase test) as a proposal, add it to the decision register, and use code-only
  or Claude-only labels, clearly marked, until it is approved.
- Training runs locally on the RTX 4070 Ti. Do not provision cloud GPUs.
- `packages/core` stays pure (no I/O, clock or Math.random). Lint limits are
  deliberate; restructure instead of adding biome-ignore.

## Phases

**P0 Baseline.** Fetch, branch, `pnpm check`. Inventory each Delta worktree and the
JEPA spike: what exists, what to port, what to discard. Write
`docs/jepa-proof/inventory.md`.

**P1 SPEC first.** Amend SPEC.md before building:
- Rule 1 wording for JEPA.
- JEPA as a tier in section 3.
- Section 1: the glyph client is a proving ground, not a commitment against a
  commercial engine later.
- A new milestone "J: JEPA proof", with gates J1–J4 below and their thresholds
  written down before any sealed data is generated.

Once written, thresholds may be tightened, never loosened. Update the living Claude
Doc copy (link at the top of SPEC.md) or record in the report exactly what is out of
sync.

**P2 One substrate.** Port thermal settlement, food sessions and containment
into matter as processes and rows on the graph kernel (or as adapters with oracle
tests proving equivalence). Move world generation (`scene/clearing`, `matter-seed`,
terrain) from `packages/client` to `packages/core` so the server no longer imports
client code. Add an engine-agnostic observation encoder (relations and distances,
no grid).

**P3 The envelope.** A pure core function: (world, act or tick) → a legal candidate
outcome set including none, with invariants checked (conservation, one place per
thing, fuel for fire, legality). Then commit(draw) → changes, plus a log record with
the candidate hash and checkpoint id. Property tests: any scoring, even adversarial
or random, yields a valid world; replay from the log is byte-identical.

**P4 Teacher data.** A seeded scenario generator on the code engine producing at least
1,000,000 labelled transitions. Before training, seal held-out sets:
- (a) familiar combinations;
- (b) whole withheld families of interaction (for example heat × liquid,
  containment × fire), never seen in training;
- (c) a gap set of combinations the code cannot answer, labelled offline by
  Claude-propose / Jev-ratify / code-validate within budget.

Record hashes of every sealed set. Nobody, including you, looks at sealed outcomes
before the gate run.

**P5 Models.** Train a supervised baseline and the JEPA (OPF, faithful to the
Gen-Verse JEPA-Anything paper and code, pinned upstream commit). Export to the
TypeScript runtime. Batch per tick. Select by the validation set, then run J1 once.

**P6 Integrate.** Wire the chosen model into the `packages/server` tick:
- first in shadow mode (logged next to the code engine's outcome);
- then live behind a per-world flag, with deadline fallback to code.

Two browsers must see identical outcomes.

**P7 Post-training.** Play scripted and randomized sessions on the live flag. Collect
gap signals (decision 6). Train v2 and run J3.

**P8 Load.** Measure J2.

**P9 Fun-test kit.** A one-command build of the playable demo, a 20-minute
session script for strangers, a short questionnaire (would you play again, what did
you try, what surprised you, what broke), and session recording through the
existing archive. Then STOP: J4 needs humans.

## Gates (defaults; put them in the SPEC in P1)

- **J1 Composition.** On withheld families (b): top-1 agreement with teacher labels
  ≥ 70%, a Brier score better than the supervised baseline, and the envelope rejecting
  the model's top choice in < 5% of cases. Also report (a) and (c) separately.
- **J2 Real-time.** 8 connected players, 2,000 active things, 100 ms tick. Per-tick
  model scoring p95 ≤ 5 ms. Command acknowledgement p95 ≤ 250 ms (the existing
  budget). Fallback rate < 1%.
- **J3 Improves from play.** v2 beats v1 on the gap set (c) by ≥ 10 points of top-1
  agreement, with no regression greater than 1 point on (a) or (b).
- **J4 Fun (human, not run by you).** At least 5 strangers, at least 3 of whom would
  play again unprompted.

If J1 fails, try at most two principled remedies (more data diversity, model capacity,
relational structure), each pre-registered before running, then report the failure
with evidence. Do not tune against the sealed set.

## Done means

- Branch `feat/jepa-proof` pushed, `pnpm check` green.
- `docs/jepa-proof/REPORT.md`, containing:
  - each gate with its threshold, measured result and pass/fail, plus links to raw
    results under `validation/jepa-proof/`;
  - what was ported from where and what was discarded;
  - an updated decision register;
  - which items are still owner decisions;
  - an honest answer to "is this ready to be the world model for an Unreal client,
    and what would change?"
- The fun-test kit ready to hand to people.
