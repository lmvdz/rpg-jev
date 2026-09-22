# JEPA proof: P0 inventory

2026-09-22. Branch `feat/jepa-proof` from `origin/feat/open-world-browser` at
`42e6c79`, in the worktree `H:\rpg-jev.worktrees\jepa-proof`. The baseline
`pnpm check` is green: 91 vitest files, 1,534 passed plus 331 expected
failures, and every `node --test` suite passed.

Everything below was read, not changed. The Delta worktrees under
`H:\rpg-jev\.delta\worktrees\*` were opened read-only. Nothing in them was
staged, stashed, committed or cleaned.

## Baseline (what this branch starts from)

| Area | What exists | Relevance |
| --- | --- | --- |
| `packages/core/src/matter` | The ordinal matter engine. One entry point, `resolve(world, act)`, over ten processes (heat, soak, coat, force, ingest, search, drift, load, move, take). Six processes run as data rows on `graph/kernel.ts`. Sensing, bodies, intents, and `shared.ts` (`sharedAct`, `sharedMove`, `sharedTick`) | The teacher. Every label comes from it |
| `packages/core/src/matter/session.ts` | The food session: move, take, drop, eat and wait as a local step adapter over `MatterWorld` | Port target (P2) |
| `packages/core/src/thermal/*` | The SI solid-contact thermal fixture: `physics.ts`, `settlement.ts` and a `thermal_settle` effect on the inn `World` | Port target (P2) |
| `packages/server` | The SpacetimeDB 2.10.1 module. The world is one JSON row. `command`, `join` and `observe` reducers, plus the `advance` scheduled reducer every **500 ms**. It has an archive worker and compact projections | The one authority (decision 4). **It imports client sources** (`scene/clearing`, `scene/matter-seed`, `scene/steps`, `glyph/font`, `palette`, `play/shared-wire`, `play/world-link`, `view/things`) |
| `packages/client/src/scene/{clearing,matter-seed,steps}.ts`, `terrain/{grid,kinds}.ts` | World generation and the stepping rule, which live in the client today | Move to core (P2) |
| `validation/shared-world` | The protocol gate: command acknowledgement p95 188 ms over 8 admissions and 2 active clients (budget 250 ms) | The J2 baseline |

## Delta: `feat/causal-foundation` (six copies)

All six copies hold the same work caught at different stages. `packages/predictor`, the core additions
and the Python are byte-identical across them. **Newest: `ad0qx5804ddr`**
(files up to 2026-09-22 09:13); the others lack the late
`spikes/jepa-world-model/src/world-*` playtest files.

| Item | Verdict | Why |
| --- | --- | --- |
| `packages/predictor/src/{model,validation,bundle}.ts` | **Port the pattern** | JSON weights, a manifest SHA pin, strict shape and provenance checks, and an f64 MLP forward pass (p50 0.045 ms per request). Rewritten for our observation and candidate shapes; the inn-specific feature list is not reused |
| `spikes/jepa-world-model/export_runtime.py`, `src/runtime-parity.ts` | **Port the pattern** | Export from `.pt` to JSON, and a TS-versus-PyTorch parity check (max difference 6.1e-7) |
| `spikes/jepa-world-model/opf_model.py` | **Reference** | The paper-path OPF: direct factor heads, upstream pseudoinverse synthesis, stop-gradient before a trainable projection. The new model follows the same wiring |
| `OPF-RESULTS.md`, `INTERACTION-RESULTS.md`, `MULTIVIEW-RESULTS.md` | **Keep as prior evidence** | OPF worked end to end but **did not beat supervised on withheld composition** in any of the three studies. This is the honest prior for J1 |
| `packages/predictor/src/{projection,session,serve}.ts` | Discard | Specific to the inn/theft fixture. A finite 730-query catalog that abstains on anything else, which is the opposite of generalisation. One request at a time |
| Python async/GPU serving (`interaction_service.py`, `world_predictor.py`) | Discard | Out of process, and GPU gave no throughput win. J2 needs in-tick TS scoring |
| `packages/core/src/{inn,delivery,interaction}.ts` | Discard | Separate toy kernels. The teacher here is matter, not a new kernel. `interaction.ts`'s parent/contains edges informed the containment relation (below) |
| `spikes/s0-spacetimedb/forecast-{module,worker}.ts` | Reference | An out-of-module forecast worker. Decision 7 needs in-tick scoring with a deadline fallback instead |

## Delta: `renderer/rangedrifter-study` (`9kfykwc7fbkx`, ~100 files)

HEAD `daa9b0d` is an ancestor of the baseline, so only the uncommitted diff is new.

| Item | Verdict | Why |
| --- | --- | --- |
| `packages/core/src/containment/*` (+ `test/containment.test.ts`, 11 tests) | **Port the semantics** into matter | Holders with capacity, open/closed, conservation and a guard for each reason. It is a flat model (one material per holder, in millilitres) and not on the graph kernel. Matter gets an `in` relation on things and a `contain` process instead. The flat module's guards become an oracle test |
| `packages/client/src/worldgen/*`, `worldgen/*.json` recipes | Not ported now | Larger landscape recipes. They import client glyph and palette code. The proof needs the one clearing, and moving the seeded clearing (below) is what removes the server's client imports |
| `packages/world` (a second SpacetimeDB module) | Discard | It is a rival authority (decision 4) and imports client sources |
| Renderer work (shadows, occluders) | Out of scope | Rendering is not what this goal proves |

## Delta: `implementation/engine-foundation` (`p2ncw1y87czy`, 56 files)

HEAD `3471f17` is an ancestor of the baseline.

| Item | Verdict | Why |
| --- | --- | --- |
| `packages/core/src/foundation/*` | Reference | A multiplayer wrapper around the food session: settlement, journal replay and per-actor revisions. It ports nothing into matter as processes; its doc says the SI thermal bench "remains fixture-only" |
| `matter/session.ts` additions (`executeMatterAction`, `executeMatterAutonomous`) | Reference | The same split the food-session adapter needs |
| Its `packages/server` | Discard | A rival server (decision 4) |

## `origin/feat/jepa-world-model-spike` (`b45a0ab`, `spikes/jepa-world-model`)

| Item | Verdict | Why |
| --- | --- | --- |
| `requirements.txt` pin | **Keep** | `jepa-anything-core @ Gen-Verse/JEPA-Anything@c6e6c88f3ef75a4ce7acd660d6fa5779d995512c`, v0.3.0, Apache-2.0 |
| `spike.py` paired training | Reference | Shared initialisation, the same minibatch order and validation-selected checkpoints for the baseline and JEPA arms. The protocol is kept |
| `domain.py` | Discard | A toy theft scenario with six hand features, not the engine |
| Results | Prior | The trivial task hit 100% in both arms, and the JEPA arm's Brier was worse |

## Upstream (research, 2026-09-22)

- "JEPA-Anything: Learning Predictive Models across Different Worlds",
  arXiv:2609.20800 (v1, 2026-09-17). Repo `Gen-Verse/JEPA-Anything`, pinned at
  `c6e6c88` (2026-09-18, README-only commit; last content commit `ab3d8cc`).
- **OPF = Orthogonal Predictive Factorization.** K learned projectors with
  K·r = d. Factor targets `P_kᵀ sg(z_target)` come from an EMA target encoder
  (default momentum 0.996), with the stop-gradient on the encoder output only.
  Each factor has its own predictor `q_k(z_c, action)`. The full state is
  synthesised by the pseudoinverse. `L_train = L_base + L_OPF`, where
  `L_OPF` = factor MSE + λ_orth·Gram + λ_fac·factor-std floor +
  λ_enc·encoder-std floor. The paper's Table 10 mostly uses .10 / .05 / .02.
- The repo ships no trainer, optimiser, masking, planner or weights. It ranks
  candidates through a task-specific readout of the predicted state, not an
  energy.

## Environment

- RTX 4070 Ti (12 GB). System Python 3.11.8 has no torch. The training venv
  is `H:\rpg-jev.worktrees\jepa-venv` (outside the repo): torch 2.10.0+cu128
  and `jepa-anything-core` 0.3.0 at the pin.
- The existing Delta venv (`kwb59ftg8t02\.venv`) is not used, so nothing
  there is touched.

## Plan that follows from this

1. P1: SPEC first. Rule 1 wording, a JEPA tier, the proving-ground note, and
   milestone J with J1–J4 written down before any sealed data exists.
2. P2: `packages/core/src/world/` gets the clearing, the matter seed, the
   grid and the stepping rule, so the server stops importing the client.
   Containment becomes a matter relation and process with an oracle against
   the flat module's guards. Thermal and food become adapters with
   equivalence tests. `packages/core/src/jepa/observe.ts` is the relational
   observation encoder.
3. P3: `packages/core/src/jepa/{outcomes,envelope,commit}.ts` and property tests.
4. P4 onwards: `packages/predictor` holds the scenario generator driver, the
   Python trainer (`packages/predictor/train/`), the export and the TS runtime.
