# JEPA proof: report (milestone J)

2026-09-22 · branch `feat/jepa-proof` · brief: [`GOAL.md`](GOAL.md) · pre-registration: `SPEC.md` section 16, "Milestone J" · raw results: [`validation/jepa-proof/`](../../validation/jepa-proof/)

**Verdict: disproved as built, on three of the four measurable gates.**

- The learned model ranks physical outcomes that the engine carries out, inside the authority, with every draw logged and replayed.
- It composes to interaction families it never saw (91.9% top-1).
- It is not better calibrated than a plain supervised ranker, so J1 fails. Remedy R1 did not change that; R2 was still training at this commit.
- It does not fit a 100 ms tick at 2,000 things in SpacetimeDB's TypeScript runtime. The authority does not hold that load even with the model switched off, so J2 fails.
- It improved from play by 4.6 points on the gap set, not 10, so J3 fails.
- J4 (fun) needs strangers. The kit is ready.

## Gates

| Gate | Threshold (pre-registered) | Measured | Result |
| --- | --- | --- | --- |
| J1 Composition | On withheld families (b), mean of 3 seeds: JEPA top-1 ≥ 70% and above (b)'s majority rate; JEPA Brier below the supervised baseline's; envelope rejects JEPA's top choice < 5% | Top-1 91.9% (majority 76.95%); Brier 0.1354 against supervised 0.1197; rejection 0.035% | **Fail** (Brier) |
| J1 remedy R1 (capacity) | The same, both arms widened and capacity-matched | Top-1 92.9%; Brier 0.1206 against 0.1121; rejection 0.02% | **Fail** (Brier) |
| J1 remedy R2 (data diversity) | The same, twice the training scenes | Training at the time of this commit; result to follow in this file | **Pending** |
| J2 Real-time | 8 clients, ≥ 2,000 things, 100 ms tick: scoring p95 ≤ 5 ms, acknowledgement p95 ≤ 250 ms, fallback < 1% at a 10 ms deadline | Scoring p95 11 ms; acknowledgement p95 1,270 ms; fallback 100% of ticks; 1.7 ticks a second | **Fail** (all three) |
| J3 Improves from play | v2 beats v1 on (c) by ≥ 10 points of top-1, with no drop > 1 point on (a) or (b) | (c) +4.6 points (39.1% → 43.6%); (a) +0.2; (b) +2.3 | **Fail** |
| J4 Fun | ≥ 5 strangers, ≥ 3 would play again unprompted | Not run: needs people. Kit ready ([`FUN-TEST.md`](FUN-TEST.md)) | **Open** |

Raw results:

- J1: [`j1.json`](../../validation/jepa-proof/j1.json), [`j1-r1.json`](../../validation/jepa-proof/j1-r1.json)
- J2: [`j2.json`](../../validation/jepa-proof/j2.json)
- J3: [`j3.json`](../../validation/jepa-proof/j3.json)
- Play: [`play.json`](../../validation/jepa-proof/play.json)
- The sealed record: [`sealed.json`](../../validation/jepa-proof/sealed.json)
- Other evidence: [`results/`](../../validation/jepa-proof/results/)

### J1 in detail

On the original runs (mean of seeds 17, 29 and 43). Brier is the sum over candidates of (p − y)²; lower is better.

| Set | Samples | Majority | JEPA top-1 | JEPA Brier | JEPA NLL | Supervised top-1 | Supervised Brier | Supervised NLL |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| (a) familiar | 159,810 | 70.9% | 98.2% | 0.0264 | 0.048 | 98.1% | 0.0270 | 0.049 |
| (b) withheld, all | 892,054 | 77.0% | 91.9% | 0.1354 | 0.428 | 92.8% | 0.1197 | 0.464 |
| B1 heat × liquid | 350,825 | 71.1% | 86.9% | 0.2223 | 0.735 | 89.0% | 0.1839 | 0.694 |
| B2 containment × fire | 335,115 | 78.9% | 96.6% | 0.0547 | 0.189 | 96.7% | 0.0547 | 0.265 |
| B3 force × fire | 206,114 | 83.7% | 92.7% | 0.1186 | 0.297 | 93.1% | 0.1159 | 0.397 |
| (c) gap, believed labels | 1,029 | 36.6% | 39.1% | 1.1918 | 10.13 | 39.1% | 1.1906 | 15.12 |
| (c) gap, Claude-only labels | 1,102 | 38.4% | 40.9% | 1.1579 | 9.83 | 40.9% | 1.1566 | 14.70 |

What this says:

- **Both arms compose.** Seen only in other combinations, fire-in-a-sealed-container reaches 96.6% (B2). Heat on a liquid is the hardest at 87–89% (B1).
- **JEPA's objective does not buy composition.** The supervised baseline matches or beats it on top-1 and Brier, seed for seed: supervised Brier on (b) runs 0.108–0.138 against JEPA's 0.127–0.147.
- **JEPA is less confidently wrong.** Its NLL on (b) is lower in aggregate (0.428 against 0.464) and much lower on (c) (10.1 against 15.1). The pre-registered Brier criterion does not credit that.
- **The gap set is where the engine is silent.** On (c) both arms sit at the majority rate. Neither has ever seen a strike on a liquid labelled, so this is expected.
- **The envelope is learned.** The unmasked top choice fell outside the envelope in 0.035% of (b) transitions once the training loss saw every class (SPEC section 16, training-loss note).
- **These match the earlier Delta studies.** `OPF-RESULTS.md` and `INTERACTION-RESULTS.md` also found OPF no better than supervised on withheld composition.

### J2 in detail

Local SpacetimeDB 2.10.1 standalone on this machine (Windows 11, loopback), with 8 Node SDK clients each sending one seeded command a second for 5 minutes. The world was 2,008 things with a 100 ms tick, in live mode, running the release checkpoint.

| Measure | Live, 5 min (the gate) | Shadow, 20 s smoke | Off, 20 s smoke |
| --- | --- | --- | --- |
| Ticks per second (asked 10) | 1.7 | 1.0 | 1.4 |
| Tick p50 / p95 | 187 / 389 ms | 365 / 397 ms | 203 / 244 ms |
| Model scoring p50 / p95 | 11 / 11 ms | 11 / 13 ms | — |
| Deadline fallbacks | 100% | 100% | — |
| Acknowledgement p50 / p95 | 1,000 / 1,270 ms | 1,044 / 1,236 ms | 714 / 1,040 ms |

What this says:

- **The authority cannot carry J2's load without the model.** Off, a tick of 2,000 things takes 203 ms. Commands queue behind ticks, so acknowledgement p95 is 1,040 ms against a 250 ms budget. The costs are the whole world as one JSON row parsed and written per reducer, eight projections of 2,000 things refreshed per commit, and a module JavaScript runtime measured about 2.5× slower than Node on the same engine code.
- **The model cannot meet 5 ms here either.**
  - In the module, scoring hits the 10 ms deadline on every tick, and each abandoned batch still costs about 11 ms.
  - The model's observation and envelope work adds about 150 ms a tick in the module.
  - The same code in Node on V8 ([`results/j2-node-reference.json`](../../validation/jepa-proof/results/j2-node-reference.json)) scores 1,999 things at p50 7.4 ms and p95 9.9 ms. That is with 99.7% of observations answered from memory; the check itself costs about 3.7 µs a thing. So J2's scoring budget fails outside SpacetimeDB too.
- **Live mode works when the tick is long enough.** In the fun-test world (1,405 things, 500 ms tick), 891 of 2,000 ticks committed the model's ranked outcomes, 1,252,980 draws in all. `validation/shared-world/replay.mjs` re-verified every draw against the world's RNG and rebuilt the world ([`results/archive-counts.json`](../../validation/jepa-proof/results/archive-counts.json), [`results/replay-fun-smoke-live.json`](../../validation/jepa-proof/results/replay-fun-smoke-live.json)).
- **The model agrees with the engine.** Over 599,705 draws it chose the engine's own class every time, in Node on 1,999 things.

### J3 in detail

- **v1** is the integrated checkpoint: JEPA seed 43, the lowest validation NLL of the three. It runs in the server as `packages/predictor/checkpoints/release`.
- **Play.** 2,000 sessions of 12 steps ran on the live settle, the code the server runs. One in five was scripted on the starting pool's elements; the rest were randomised worlds from seeds ≥ 5,000,000,000.
- **Signals.** 4,882 transitions were flagged: 103 envelope rejections, 4 broken invariants, 1,743 low-confidence draws and 3,366 gaps. None matched a sealed (c) observation.
- **Labels.**
  - The engine labelled 6,616 samples.
  - Claude proposed outcomes for 600 gap scenes, all of which validated.
  - Jev believed 2,603 of 2,775 claims, with the controls clean.
  - 467 scenes, every claim believed, were used (1,979 samples).
- **v2** is v1 fine-tuned for 3 epochs on train ∪ post ∪ post-gap, the post splits repeated 20 times, at lr 3e-4, as pre-registered.

| Set | v1 top-1 | v2 top-1 | Change | v1 Brier | v2 Brier |
| --- | --- | --- | --- | --- | --- |
| (a) familiar | 98.3% | 98.5% | +0.2 | 0.0248 | 0.0227 |
| (b) withheld families | 92.2% | 94.4% | +2.3 | 0.1322 | 0.0896 |
| (c) gap, believed | 39.1% | 43.6% | **+4.6** | 1.1884 | 0.8013 |
| (c) gap, Claude-only | 40.8% | 44.4% | +3.5 | 1.1545 | 0.7920 |

Two caveats:

- **(b) is no longer withheld from v2.** Randomised play worlds contain the withheld families, and their engine labels went into post-training. v2's (b) gain is therefore partly exposure, not composition. The next milestone needs families withheld from play as well.
- **467 believed gap scenes moved (c) by 4.6 points.** The ratifier believed 94% of claims (controls separate cleanly: true 0.91–0.95, false 0.11–0.21), so the labels are only as good as Claude's proposals.

## What was ported, from where, and what was discarded

The full inventory is [`inventory.md`](inventory.md).

| From | Ported | Discarded |
| --- | --- | --- |
| Delta `feat/causal-foundation` (`ad0qx5804ddr`) | The runtime pattern: JSON weights, a checkpoint and provenance check, an f64 MLP in TypeScript, and parity with PyTorch (now `packages/predictor/src/runtime.ts`, parity < 1e-5). The OPF wiring was followed in `train/model.py` | The inn/theft features and finite query catalogue, the Python async/GPU serving, and the toy `inn`/`delivery`/`interaction` kernels |
| Delta `renderer/rangedrifter-study` (`9kfykwc7fbkx`) | `packages/core/src/containment` (the flat holder module) and its tests, as the oracle for matter's `contain` process | `packages/world` (a rival authority) and the worldgen recipes |
| Delta `implementation/engine-foundation` (`p2ncw1y87czy`) | Nothing verbatim. Its session split informed `matter/food.ts` | Its `packages/server` (a rival authority) and the foundation wrapper |
| `origin/feat/jepa-world-model-spike` | The upstream pin `Gen-Verse/JEPA-Anything@c6e6c88` and the paired-training protocol | `domain.py`, `spike.py` |
| This branch's `packages/client` | World generation and the shared wire moved to `packages/core/src/world`. The server imports nothing from the client, a guard test holds it, and the generated bindings now live in `packages/server/bindings` too | Nothing |

P2's port into matter, each with an oracle:

- **Containment.** The inside of a container is a place, so a sealed pot starves a flame by the existing drift row. It agrees with the flat module on 2,000 transfers and 200 openings.
- **SI solid contact** is the `conduct` process. It is bit-equal to the thermal fixture's `evolve` on 300 fixtures.
- **The food session** compiles each command to a matter act. It is equal to the frozen command code on 3,000 commands.

### What else was built

- **The envelope.** It covered the engine's own outcome on 100% of 6.1M open transitions, with no misses left after four physics widenings on development seeds.
- **Commit.** Adversarial and garbage scorers always leave a valid world that replays byte for byte. It is the `rankedSettle` modes off, shadow and live.
- **The observation.** It is 720 features of relations and distances, and a test holds that moving the whole scene changes nothing.
- **The data.** A seeded generator produced 1.2M scenes (2.87M training samples), with (a), (b), the gap pool and (c) sealed by SHA-256 before training. The committed generator reproduces every split byte for byte.
- **The server.** The mode is set per world and changed only by the owner. Events are version 2 with compact notes, and there is a public telemetry ring.
- **Evidence that two clients see the same world.** Two real browsers saw each other's traveller move ([`results/two-browsers/`](../../validation/jepa-proof/results/two-browsers/)). Two SDK clients' projections were identical on 1,408 things across 20 samples ([`results/same-outcomes.json`](../../validation/jepa-proof/results/same-outcomes.json)).
- **Jev spend: $0.113 of the $1.00 budget**, across the (c) labels, the post-training labels and the controls ([`jev-spend.json`](../../validation/jepa-proof/jev-spend.json)).

## Decision register

These rows are now in `SPEC.md` section 23.5.

| Decision | Status |
| --- | --- |
| JEPA ranks, code commits | Closed (owner's brief). Built and replay-verified |
| Engine-agnostic observation | Closed (owner's brief). Built; translation-invariance test |
| One authority: `packages/server` | Closed (owner's brief). The server imports nothing from the client |
| Base-model teachers (engine, and Claude plus Jev for gaps) | Closed (owner's brief) |
| `ratify_physical_outcome` family | Proposal, awaiting the owner ([`family-proposal.md`](family-proposal.md)) |
| JEPA live in a world | Open. Every world defaults to off |

Made during the milestone and recorded in `SPEC.md` section 16, each dated and each before the data it touches:

1. J1 was tightened: top-1 must also beat (b)'s majority rate.
2. Set (c) was narrowed to the engine's domain gates.
3. The ratifying listener hears the claim from a trusted eyewitness, not a traveller, which had measured distrust rather than physics.
4. The generator added 100 ms and 0.5 s ticks (scenario v2).
5. The readout's training loss is the full per-channel softmax.
6. The J3 procedure was pre-registered.
7. The J1 remedies were pre-registered ([`REMEDIES.md`](REMEDIES.md)).

## Still owner decisions

1. **Keep JEPA, or rank with a supervised model?** On this evidence the supervised ranker is as accurate and better calibrated. The ranks-then-commits architecture works with either.
2. **Admit `ratify_physical_outcome`?** Without it, physics labels lean on `believe_claim` with a code-built listener, which believed 94% of plausible-sounding claims.
3. **The authority's performance path.** J2 fails with the model off. The options are:
   - per-entity rows and incremental ticks instead of one world JSON row;
   - a native (Rust) module;
   - an out-of-module scorer with asynchronous scores.

   Each changes S0's settled design.
4. **Which worlds may turn live mode on, and the upgrade gate a new checkpoint must pass.**
5. **Run J4 with at least five strangers**, using the kit.
6. **Sealed families that play cannot reach**, for any future J3-style measurement.
7. **Merging `feat/jepa-proof`.** It has not been merged into `poc` or `main`.
8. **Syncing the living Claude Doc with the other branches' sections** (below).

## Is this ready to be the world model for an Unreal client, and what would change?

**No.** The contract is ready, but the model and the authority are not.

What carries over unchanged:

- The model sees things, states and relations with distances, never cells or pixels, and a test proves moving the scene changes nothing.
- The envelope, commit and replay are pure core code.
- The server decides every outcome, and clients only draw projections.

An Unreal client could subscribe to the same projections and never know which renderer the rules were proven with.

What would have to change:

1. **The authority's data model.** A 100 ms tick over 2,000+ things needs per-entity rows, a dirty set that re-observes only what changed, and projection by interest. The current shape (one world row, every thing re-observed every tick, eight full projections per commit) fails with the model off.
2. **Where the model runs.** In SpacetimeDB's TS runtime, scoring and observation cost several times their Node figures (with the model off, 1,405 things take 65–94 ms a tick in the module; the engine's drift of the same world takes 24 ms in Node, plus 2.7 ms of JSON round-trip). A native module, or a scoring sidecar with batching and asynchronous results that the tick uses when fresh, is needed before any 3D-scale world.
3. **What the model adds.** It must beat a supervised ranker on calibration, or be replaced by one. It must improve from play faster than 4.6 points per 467 labelled gap scenes. Both need better gap labels (a stronger ratifier) and families that stay withheld.
4. **The vocabulary.** Eight sign channels over ordinal levels suit a glyph world. A 3D client wants continuous positions and contact geometry as observations, while outcomes stay classes the code realises. The envelope and commit do not need to change for that; the observation encoder and the outcome channels do.

## Documentation sync

The living Claude Doc gained a milestone J summary at rev 78: rule 1 for a learned model, tier W, the proving-ground note, the vocabulary and the gate table. It points to `SPEC.md` for the full text.

The doc remains out of sync, as it already was before this milestone, with:

- the repository's section 16 browser-world priority correction;
- sections 20–23 (added on other branches);
- the dated notes and results inside milestone J.
