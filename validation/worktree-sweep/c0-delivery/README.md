# C0 patch artifacts — H1/H2/H4/H5

## Result and provenance

All 15 archived ordinary assertions pass on the assembled published base. Reverse
heat (H3) already passed before this patch. The new 70 ordinary regressions pass:
32 exposure cases plus 38 base/extension phase cases. Twenty of the original 32
exposure cases fail on the unmodified published base.

**This revision supersedes the initial delivery.** Parent review found that the
unchanged generated cooling row erased burnout heat for amount > 1 or wind > 1.
The initial tests missed that interaction. The revised explicit three-phase
contract was discussed with and approved by the parent before implementation.

Base: `c31901a3efc940eaada4b575e8ee85623ca7c43b`, branch
`origin/design/compositional-causality`, sandbox ancestor
`b94fe5c8f5377fda5e697406f1e445ab2faed78f`.
`git fetch origin` found no newer task-branch revision. Nothing was merged.
Read the base's SPEC section 21, constitutional rules and compositional-causality
contract; this implements the narrow H1–H5 C0 gate, not the parts/accounting gates.

This directory is a patch delivery area, **not a second application checkout**.
`manifest.json` identifies thirteen target paths and the nine existing-file baseline
blob hashes. Strip `validation/c0-work/` when integrating those files.
The two held-out files are unchanged copies from the archived ordinary suite;
the archive itself was not edited. The other new files are `c0-exposure.test.ts`
and `c0-drift-phases.test.ts`.

The inherited dirty root was neither switched nor reset. Production/test edits
were authored here through `apply_patch`; only the manifest-listed staged files
were overlaid onto a `git archive` in `$DELTA_SCRATCH_DIR/c0`. Dependencies were
installed there with `pnpm install --frozen-lockfile --offline --ignore-scripts`.
No commits, pushes, API calls, new question families, named production cases,
nested Git repositories, dependencies or full branch copies were added here.
Only this staging directory received `git add -N` for Delta visibility.

## Intended physical changes

| Defect | General rule | Observable effect |
| --- | --- | --- |
| H1 | Dousing counts `used * clamp(1 - oiliness / 5, 0, 1)`, reusing the existing aqueous-fraction convention in effective wetness | Fully oily liquid no longer clears burning, clamps temperature or emits steam. Intermediate oiliness needs proportionally more supplied liquid. Wetting/washing/consumption still occur for a positive dose. |
| H2 | Soak admission requires positive **supplied** dose, bounded by available stock | Zero dose/zero stock does not run wetting, washing, cooling, steam, consumption or generated rows. Negative requests normalized by `resolve` behave like zero. |
| H5 | The whole heat process requires positive time and contact | Zero exposure cannot crack, temper, set, cleanse, dry, ignite, spend fuel or run generated rows. Default contact remains one; positive shock/tempering remain active. |
| H4 | Thermal integration runs before the burning settlement row | Heat approaches flame temperature for the air-fed, combustible, fueled interval, then ambient temperature for any remainder. Exhaustion still clears the coating/flame and leaves the surviving substrate's residual heat. No air, no fuel or no combustibility contributes no flame heating. |

The drift graph is now **ten** base rows, splitting the old burning row:

1. `DRIFT_BEFORE`: already-due exhaustion (fuel <= 0) settles first. Otherwise,
   no air or no combustibility suppresses remaining flame immediately, preserving
   unspent coating rather than consuming it.
2. `DRIFT_DURING`, then unchanged generated rows: thermal and other interval
   evolution see the still-active flame/coating through the fueled interval.
   `was` remains the true start snapshot; it is never rebound to a partly evolved
   state. Existing grown bulk/wind cooling still applies to nonburning intervals.
3. `DRIFT_AFTER`: spend start-of-interval fuel and settle exhaustion. A temporary
   `x.fuelLeft` lets the existing `accrue`/`spends` mechanism account that interval
   even when a generated endpoint extinction has cleared `s.burning`. Copy a
   remaining fuel value only if the flame still exists; never reignite it.

The phase ordering is code-owned arrays, not generated row-name matching,
rewritten rows or new kernel read/write semantics. End consumption uses
`was.burning.of`, so a boundary weather extinction cannot evade exhausted coating
removal or self-substrate consumption.

This fixes event order rather than decreasing the existing drift step. The
normal caller already cuts at fuel exhaustion; the remainder starts a new step
from the hot, settled state with freshly computed effective properties. The
thermal row retains its active-duration limit for standalone reference testing.

Effect kinds and causal IDs remain unchanged. Zero heat reports `nothing` with
`X3`; zero soak uses the existing `nothing`/`S6` admission result. Physical
changes retain their existing causal IDs. Tests require deterministic outcomes,
input immutability, nonempty causal references and replayed physical state.
Perception may still update observers for a no-op physical act; the contract here
is unchanged physical things, not frozen observer state.

## Historical oracle contract changes — review explicitly at integration

The old oracles encoded the defects. They are not immutable historical evidence
after this amendment; the pinned base remains that evidence.

* `graph/soak-oracle.ts`: positive supplied-dose admission; the same aqueous
  fraction for douse capacity; no douse/steam at zero aqueous dose.
* `graph/heat-oracle.ts`: whole-process positive-time/contact admission.
* `graph/drift-oracle.ts`: initial exhaustion/suppression first; finite thermal
  interval; fuel settlement last, using start fuel even after endpoint extinction.
  The split burning function increases the reference from nine to ten rows.
* `graph/drift-rules.test.ts`: names/count now describe the ten-row phase
  reference. Each row still gets 3,000 seeded cases, now 30,000 in total.
* `graph/validate.test.ts`: the exact rejected engine-row inventory replaces
  `burning` with `burning-start` and `burning-end`. All validation checks and
  rejection assertions remain intact; both new rows remain forbidden proposals.

No equivalence assertion, comparison tolerance, generated row, per-row seeded
sample count, frozen probe batch or recording was weakened or changed. Their references
were deliberately corrected, not silently declared historically equivalent.
The drift equivalence test now explicitly names the revised reference order.

Independent evidence is the archived ordinary suite plus the new regressions:
aqueous threshold/stock controls with an arbitrary definition ID; complete-state
zero-exposure checks; positive washing, cracking and tempering; a synthetic
unconditional appended row to prove process admission also gates extensions;
an analytic drift solution and partitions before/at/after exhaustion.
The analytic case uses mass 2, conductivity 4, ambient 2, one minute of fuel;
it checks temperature to 10 decimal places. Phase tests add amount 2, wind 2 and
their combination, non-grid fuel of 1.3 minutes, partitions before/at/after
exhaustion, positive-temperature no-air/no-fuel/noncombustible cooling, a
start-snapshot identity assertion, and exact/partial exhaustion at weather
endpoints. That is a local regression tolerance, not a universal trajectory bound
for the coupled engine.

## Verification

Environment: Node `v25.8.2`, pnpm `11.15.1`, Vitest `5.0.1`.

| Execution | Result |
| --- | --- |
| Archived suite copied unchanged onto pinned base, before edits | 10 passed, 5 failed: H1, H2, H5 twice, H4; H3 passed |
| Initial 32-case regression suite against unmodified base | 12 passed, 20 failed |
| Archived suite after patch | 15 ordinary passes |
| New `c0-exposure.test.ts` after patch | 32 ordinary passes |
| New `c0-drift-phases.test.ts` after phase correction | 38 ordinary passes |
| Focused new + archived + heat/soak/drift equivalence + validator suites | 7 files, 123 ordinary passes |
| `pnpm check` on assembled snapshot | Lint: 226 files clean; all 7 package typechecks pass; 53 test files pass, 1,070 ordinary passes + 331 expected failures = 1,401 tests |
| Baseline integrity check | All 397 archived tracked files compared by raw Git blob hash: only the 9 manifest-listed existing files differ |
| Diff checks | Each changed target checked against `git show c31901a:<path>` with `git diff --no-index --check`; staging `git diff --check` clean |

The 331 expected failures remain expected failures. None was promoted: the full
suite found no newly passing expected-failure case, and this patch does not
pretend their larger behaviors are implemented.

Reproduce from a clean archive of the pinned base:

```sh
pnpm install --frozen-lockfile --offline --ignore-scripts
# Overlay only the thirteen manifest targets from this directory at their target paths.
pnpm exec vitest run packages/core/test/matter/held-out-clearing.test.ts \
  packages/core/test/matter/c0-exposure.test.ts \
  packages/core/test/matter/c0-drift-phases.test.ts \
  packages/core/test/matter/graph/heat-rules.test.ts \
  packages/core/test/matter/graph/soak-rules.test.ts \
  packages/core/test/matter/graph/drift-rules.test.ts \
  packages/core/test/matter/graph/validate.test.ts
pnpm check
```

## Scope and remaining gaps

This is the first production exposure/event slice, not completed compositional
physics. It does not add parts, thermal channels, atomic multi-recipient budgets,
oxidizer/energy/residue accounting, latent state, mechanics migrations or renderer
integration. No SPEC design decision changed; implementation status is recorded
here. Parent integration should link this evidence from the C0 status in the
design documentation. The linked Claude Doc has not been synchronized.

The existing `1 - oiliness/5` convention is a coarse aqueous proxy, not a
chemical composition schema: it cannot distinguish all nonaqueous liquids.
Washing remains a threshold effect for a positive dose rather than a conserved
dissolution model; steam remains the existing qualitative signal, not steam mass.
Positive thermal shock likewise remains threshold-based, not dose-calibrated.
These limits were not hidden by adding material-name exceptions.

The drift scheduler's existing tiny-time floor/tolerances and coupled rates
remain; this does not claim whole-world exact partition invariance. Generated
weather extinctions are sampled endpoint effects, not root-found continuous
events: they do not erase heat already delivered during the interval. Their
observed time can depend on step partition. Generated rows retain their original
sequential ordering; the phase fix establishes base/extension ordering around
fuel exhaustion, not a new semantics for arbitrary conflicting extension writes.
Future admitted extensions still need interaction tests. Self-burning
residue creation still has its old amount/temperature conventions, and heat
versus drift still lacks a unified accounted combustion transition (including
residual heat after source burnout). Those belong in the next general mechanism
slice, not additional named recipes.

Suggested integration grouping: (1) soak/heat admission and their references;
(2) drift active-interval ordering and its reference; (3) independent ordinary
regressions/archived suite plus this review evidence. Parent owns review,
integration, commits and publication.
