# Authority scale: holding a 100 ms tick at 2,000+ things

2026-09-22 · branch `feat/authority-scale`, worktree only, not merged · brief: hold J2's load
(`SPEC.md` section 16) · benchmark: [`validation/authority-scale/bench.mjs`](../validation/authority-scale/bench.mjs)
· prototypes: `packages/core/src/matter/drift-dirty.ts`, `sense-fast.ts`, and a direct fix in
`sense.ts`'s `attended` · tests: `packages/server/test/authority-scale.test.ts`

J2 (`docs/jepa-proof/REPORT.md`) measured the authority failing its own 100 ms tick at 2,008
things even with the learned model off: 1.4–1.7 ticks a second, tick p50 203 ms, command
acknowledgement p95 1,040 ms. This spike reproduces one tick, one command and eight projections
in pure Node — no SpacetimeDB, no module runtime — to find out where that time actually goes,
and prototypes the two changes the numbers pointed at.

**Measured under background load.** A GPU training run and other agents were active on this
machine throughout; absolute numbers here are directionally useful, not a clean-room result.
The relative before/after ratios, taken back to back on the same machine in the same run, are
the more trustworthy number.

## Breakdown (2,000 things, 8 players, 20 repeats, `--things=2000`)

Before any change in this spike (first run recorded):

| Stage | Mean ms | p50 ms | p95 ms |
| --- | ---: | ---: | ---: |
| parse world row | 2.3 | 2.2 | 3.7 |
| **tick** (drift + autonomous opportunities) | **174.5** | 144.4 | 318.0 |
| stringify world row | 3.0 | 2.9 | 5.8 |
| parse row again (command reducer) | 4.1 | 4.1 | 5.5 |
| **one command** (a single accepted move) | **78.6** | 77.0 | 99.1 |
| stringify after command | 2.9 | 2.7 | 4.6 |
| prepare projection (once) | 2.3 | 1.9 | 5.0 |
| eight per-player projections | 5.5 | 5.0 | 14.2 |
| **full cycle** | **274.9** | 243.9 | 451.0 |

After the two prototypes below (same machine, same load, `--optimized`):

| Stage | Mean ms | p50 ms | p95 ms |
| --- | ---: | ---: | ---: |
| parse world row | 2.2 | 2.1 | 2.9 |
| **tick** | **33.6** | 27.0 | 55.3 |
| stringify world row | 1.8 | 1.8 | 2.3 |
| parse row again | 2.3 | 2.1 | 3.7 |
| **one command** | **16.6** | 16.1 | 24.7 |
| stringify after command | 1.7 | 1.6 | 2.3 |
| prepare projection | 1.3 | 1.2 | 2.9 |
| eight projections | 3.0 | 2.8 | 6.1 |
| **full cycle** | **62.5** | 54.4 | 95.7 |

Full cycle: **4.4x** faster on the mean, **4.5x** on p50. Tick: **5.2x**. One command: **4.7x**.
Neither change touched the JSON round trips or the projection stages, which is why those rows
barely move: they were never the cost. `parseWorld`/`stringifyWorld`/`parseForCommand`/
`stringifyAfterCommand` sum to about 8 ms combined, both before and after — real, and the
reason a per-entity-row redesign (below) still matters, but not what made J2 fail here.

## What was actually expensive, and why

The whole-world-as-one-JSON-row story from `docs/jepa-proof/REPORT.md` is real (~2-6 ms a
reducer here, more inside SpacetimeDB's slower runtime) but it was not the dominant cost.
Two things were, found by isolating stages with `performance.now()` and confirmed by targeted
micro-benchmarks (kept as scratch, not committed):

1. **`drift` (X7, `packages/core/src/matter/drift.ts`) walks every thing and every body on
   every tick, unconditionally.** `resolve.ts` and `drift.ts`'s `step` call `driftThing`/
   `driftBody` for all 2,000+ things regardless of whether anything about them is still
   moving. Each call resolves a `Kernel` of ~19 data rows (`graph/drift-rules.ts`) through
   `envOf`/`partyOf`. That is the 174 ms tick.
2. **`sense.ts`'s `attended()` recomputed each candidate's sort weight inside the comparator.**
   `sensed`/`perceive` run after *every* act, including every autonomous opportunity inside a
   tick and every player command, because rule 4 ("unobserved time is code") and the sensing
   design require a body's awareness to be current before anything reads it. On this world,
   every thing sits at full daylight in one 96x96-tile place (`clearing`), so nearly every
   one of 2,000+ sources reaches every body — the "attend to a handful" cap almost always
   triggers, and its `Array.sort` comparator called `feeds()` (a lookup and a loop) on both
   sides of *every* comparison, about `n·log(n)` times per body, 9 bodies a call. Isolated:
   the reach loop itself costs about 1 ms for one body; the sort with a live comparator cost
   about 3.6 ms for the same body under this load, times 9. That is the bulk of the 78.6 ms
   "one command" line (a single move still calls `resolve` -> `perceive` once), and it also
   runs once per autonomous opportunity inside `advance`, which is why it inflated the tick
   line too. `sourcesOf`, by contrast (the `Object.values(world.things)` sweep that builds the
   candidate list `emits()` from), cost about 2 ms — not the bottleneck it looked like at
   first.

Neither of these needed the module runtime or SpacetimeDB to reproduce or fix: both are pure
`packages/core` behaviour, which is why the prototypes live there.

## The two prototypes

**1. `driftDirty` — a dirty set over drift (`packages/core/src/matter/drift-dirty.ts`).**
Every drift rule reads only its own party (thing or body) and that party's place
(`graph/kernel.ts`'s `partyOf`/`envOf`); no rule reads another thing (confirmed by grep: no
`world.things`/`world.bodies` access inside `graph/drift-rules.ts` or `graph/grown.ts`). So a
thing left out of one call's rule evaluation keeps exactly the state it had, and `drift.ts`'s
own `report()` already treats an unevaluated, unchanged thing as a no-op — this is not a new
invariant, just an existing one this cache relies on. A thing is marked "settled" only after
its own drift call is *observed* to produce no change, fingerprinted on its exact state, place
and element; every drift rule is closed-form over `minutes` (rule 10), so a rate that is
exactly zero at a state stays zero until the fingerprint moves, which the cache checks before
ever trusting a mark. `drift.ts`'s `step()` gained one optional parameter (`active`) so the
dirty set never duplicates its rule logic; with no set given, behaviour is byte-identical to
before (every existing test still passes unchanged).

Measured ceiling on the J2 load: after warm-up, 760 of 2,000 things (38%) settle and stay
settled, because the rest keep a nonzero rate forever (for example wetness chasing a nonzero
place moisture — it approaches, never exactly equals, so it never reports zero). That is a
property of this content mix, not a bug in the cache, and it caps this specific technique's
win on this world at roughly the fraction of tick cost 38% of things represent. A steeper
future win needs either less content that never truly rests, or a tolerance-based "close
enough" settle (see owner decisions).

**2. The `attended()` fix (`packages/core/src/matter/sense.ts`), plus `sense-fast.ts`'s
`sensedDirty` dirty set over `sourcesOf`.** The higher-value fix was algorithmic, not a cache:
`attended()` now computes each candidate's weight once (a Schwartzian transform) instead of
inside the sort comparator, which is a pure equivalence — same ordering, same tie-break, same
output — proven by the existing 733 `packages/core/test/matter` tests passing unchanged and by
`authority-scale.test.ts`'s direct comparisons. This fix applies to the production path
(`sensed`, `perceive`, `resolve`) directly, not just an opt-in prototype. `sensedDirty` is an
additional, smaller, opt-in cache over `sourcesOf` (the O(things) sweep, ~2 ms here) for a
world where sensing is called from a caller that can carry a cache across acts; it is not yet
wired into `resolve()`/`sharedAct` (see below), so its win is not in the before/after table.

## Tests: the invariant that matters

Every prototype is checked against the unmodified path on the same seeded world
(`packages/server/test/authority-scale.test.ts`, 6 tests, all passing):

- `sensedDirty` matches `sensed` byte for byte across a run of ticks that mixes reused and
  rebuilt cache entries (movement, drift, and both).
- `driftDirty` matches `drift` byte for byte across 8 ticks on a 400-thing world.
- The dirty set settles at least 30% of a real 2,000-thing populated world within 5 ticks
  (regression guard on the measured 38%, not a promise of more).
- **Projections built from the dirty-set path equal projections built from the plain path**,
  for all 8 players, on the same world — this is the actual deliverable rule 9 cares about:
  not that internal state matches, but that what a player is shown does not change.
- The full existing `packages/core/test/matter` suite (733 tests, 331 expected failures,
  unchanged) still passes with `attended()` rewritten in place.

## What stays true, and what would have to change

**Stays true, unmodified:**

- **Rule 1** (only code writes world state) and **rule 9** (decisions logged and replayed):
  neither prototype's cache is part of `SharedState`. It is never serialized, never logged,
  and a world replayed with a cold cache reaches the exact same changes as one replayed with a
  warm one — the tests above are that proof, not a claim.
- **Rule 10** (unobserved time is code): `drift`'s closed-form nature is what makes the dirty
  set provably safe; nothing about *how much* time passed changed, only which things' rules get
  re-evaluated to find out that nothing moved.
- **Receipts and the archive**: untouched. This spike never reached `packages/server/src` or
  the module's reducers; the caches are pure functions the module could call, not a change to
  what it commits or logs.

**Would have to change if either prototype is adopted past this spike:**

- **S0's settled design item "the whole world is one JSON row."** The dirty caches make the
  *rule evaluation* skip settled things, but `commit()` still parses and stringifies the
  entire world every reducer call (measured here at ~2–6 ms combined, more inside
  SpacetimeDB's slower TypeScript runtime per the J2 report). Per-entity rows are the next
  lever, and they are a genuine S0 redesign: reducers, subscriptions and the archive's
  event shape all currently assume one row.
- **The module would need its own `active`/cache plumbing.** `drift-dirty.ts` and
  `sense-fast.ts` are pure `packages/core`/Node prototypes, deliberately not wired into
  `packages/server/module/src/index.ts`'s `advance`/`command` reducers yet. Carrying a cache
  across reducer calls inside SpacetimeDB (which has no shared process memory guarantee
  documented, and whose module is reconstructed per publish) is an open question, not solved
  here — see decisions below.
- **`sensedDirty` is not wired into `resolve()`/`sharedAct`/`sharedTick`.** The `attended()`
  fix already helps every caller for free; `sensedDirty`'s cache would need `commit()` in
  `shared.ts` to thread a cache parameter through, which changes `Settle`'s or a new
  function's signature — a small but real API change to a heavily tested file.

## Owner decisions

1. **Adopt the `attended()` fix as-is.** It is a pure equivalence, already proven against the
   full existing test suite, already in the production path, and the single largest win
   measured here. Recommend landing it independent of everything else in this doc.
2. **Adopt `driftDirty`, and decide where its cache lives.** Two shapes: (a) module-local
   in-memory state next to the reducers, rebuilt from scratch (cold) on every publish/restart
   — cheap, always correct, loses its warm-up benefit on every deploy; (b) persisted
   alongside the world row — faster after a restart, but now something the archive and
   replay must agree is non-authoritative, which needs its own test the way rule 9 needs one
   here.
3. **Whether to pursue per-entity rows now, or measure the JSON cost first inside
   SpacetimeDB.** This spike's ~2–6 ms JSON figures are from Node; the J2 report's own
   measurement in the module runtime found the same operations several times slower there.
   A follow-up should isolate that gap the same way this doc isolated drift and sense, before
   committing to a schema redesign.
4. **Whether 38% settlement is enough to re-run J2**, or whether J2 needs the per-entity/S0
   redesign as well before another full gate attempt. This spike did not re-run J2 itself
   (that requires the module and SpacetimeDB, which this deliverable was scoped to avoid);
   the honest next step is wiring both prototypes into `packages/server/module` and
   re-measuring J2's actual three thresholds (scoring p95, acknowledgement p95, fallback
   rate), not assuming the Node ratios carry over unchanged.
5. **Whether a tolerance-based settle** (treat "close enough to ambient" as settled, not only
   "exactly zero change") is worth the correctness risk. It would raise the 38% ceiling, but
   it turns an exact invariant ("byte-identical") into an approximate one, which is a
   different, larger conversation with rule 9 than this spike wants to start unilaterally.

## What was not done

- Not re-run against SpacetimeDB/the module: this was scoped as a pure core/Node prototype,
  and the benchmark says so in its own header.
- `sensedDirty` is not wired into any caller; only `attended()`'s in-place fix is on the
  production path.
- Per-entity rows, native (Rust) module, and an out-of-module scorer (the three options J2's
  report already named) were not prototyped here; this doc's numbers should inform, not
  pre-empt, that choice.
- `pnpm check` was run in this worktree before finishing; see the handback report for its
  result.
