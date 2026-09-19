# Sandbox held-out validation at 928755f

## Outcome

The pristine sandbox passes `pnpm check`. Its full test suite reports **864 passed
and 228 expected fail (1092 total), across 46 files**. This is upstream's existing
expected-failure policy, not a result for the added held-out tests.

**The 15 held-out cases now run as ordinary assertions: 10 pass and five fail,
covering four remaining rule gaps. H3 (reverse heat exchange) is fixed.**
The original nested-worktree attempt was blocked by Delta materialization; the
parent completed the run in a scratch archive of the same exact commit.

With the tests added, lint and typechecking pass. The full `pnpm check` exits 1
at tests: **874 passed, five failed, 228 expected fail (1107 total), across 47 files**.
Only the new test file fails; the pre-existing 46 files still pass. None of the
five held-out failures is marked expected, skipped, or fixed by changing production.

## Revisions and isolation

Commands run from the agent-specific isolated checkout:

```sh
git remote -v
git --no-optional-locks status --short
git branch -avv
git fetch origin
git rev-parse HEAD sandbox/matter origin/sandbox/matter
git rev-list --left-right --count origin/sandbox/matter...sandbox/matter
git merge-base origin/sandbox/matter sandbox/matter
git log --oneline origin/sandbox/matter..sandbox/matter
```

- Original `poc` HEAD: `47d59debd1dadfa518ec480d40aa39ee6a2cec99`.
- Fetched `origin/sandbox/matter`: `1c333d7fc8b6dbf7e6bd136c0cd088ecb154a7af`.
- Local `sandbox/matter`: **`928755f673d2b18f4d893156df9499bc68340751`**.
- Merge base: `1c333d7fc8b6dbf7e6bd136c0cd088ecb154a7af`.
- Left/right count (remote...local): `0 1`.
- Local-only commit: `928755f docs(graph): the round two brief: seven processes,
  factors, and what a proposal may now do`.
- Selected local tip: it contains the whole fetched branch and the additional
  graph brief/intake commit. Parent inspection also found a change to
  `spikes/graph/results/scripts/intake.ts`, so this is not strictly documentation-only;
  there is no production matter diff in that commit.
  This pin supersedes any earlier branch-tip observation;
  it is not a moving-ref claim about later changes.
- `origin` is `https://github.com/lmvdz/rpg-jev.git`.
- `local` is the primary checkout backlink `H:\rpg-jev\.git`. The parent fetched
  `sandbox/matter` from it to obtain the selected commit; nothing was published.

Created a separate detached worktree, without switching the original:

```sh
git worktree add --detach \
  validation/sandbox-held-out-928755f-20260720/snapshot \
  928755f673d2b18f4d893156df9499bc68340751
```

No production rules were patched. No commits, pushes, external checkout writes,
or external file deletions were performed. The original checkout already had
modified tracked files and untracked matter/renderer/spike work; none was edited.
The nested sandbox and installed dependencies are temporary disk-side execution
material, **not deliverables and not to be added to `poc`**. The three authored
deliverables are this report and its two sibling TypeScript files.

The successful rerun used `git archive` into the turn's scratch directory, not a
branch switch. Thus `poc` and the developer's active sandbox checkout were untouched.
Neither the sandbox production tree nor its dependencies are included in the artifacts.

## Instructions and baseline

Read the snapshot's root `CLAUDE.md`; the recursive instruction search found no
other `CLAUDE.md`, `AGENT.md`, or `AGENTS.md`. Inspected `SPEC.md`, including the ten
constitutional rules in section 2 and the representation/held-out validation
guidance in section 20. This task adds independent tests, not Jev work or a design
change; no specification change is proposed.

Environment: Node `v25.8.2`, pnpm `11.15.1`.

In the pristine detached worktree:

```sh
pnpm install --frozen-lockfile
pnpm check > ../baseline-check.log 2>&1
pnpm test > ../baseline-tests.log 2>&1
```

All exited 0. Install reused 54 packages, downloaded 0, and added 54 through pnpm.
No `node_modules` directory was copied. The gate covered lint, typechecking and
the upstream suite. The separate full test run confirmed the 864/228 count.
Baseline logs were written beside the disk-side snapshot, but are not replicated
deliverables; the complete test output is retained in this conversation.

## Adaptations

The sibling files are intended to be installed at:

```text
packages/core/test/matter/held-out-clearing.test.ts
packages/core/test/matter/held-out-fixture.ts
```

Their relative imports deliberately target those paths; they are not executable
directly from this archival directory.

1. Changed four `it.fails(...)` declarations to `it(...)`.
2. Changed the two-case `it.fails.each(...)` declaration to `it.each(...)`.
3. No schema/API/fixture/value changes were needed:
   `MatterWorld`, `ThingState`, `FRESH`, `Act`, `resolve`, and `play` remain present,
   and the original element and body shape remains accepted by the source types.
   Later diet fields are optional; absent fare/eater diet preserves ordinary
   nourishment. The added files passed sandbox typechecking.
4. H2 now compares `after.things` with `world.things`, rather than whole-world
   equality. Newer `resolve` also updates observers' awareness. The first run
   showed that difference alongside the actual zero-dose material changes.
   Restricting the comparison removes that unrelated failure mode; the oil
   coating still disappears and `wetWith` still becomes soap without consumption.
5. H3's comment and the file header now reflect this report and the confirmed fix.

The files were authored with `apply_patch`, moved into the detached snapshot
with `apply_patch`, then moved back into this archival directory when materialization
failed. The parent copied the preserved files into the scratch archive, then made
the sensing-related assertion adjustment above with `apply_patch` and recopied it.
No changed doses, missing-target fallback, or expected-failure marking was introduced.

## Per-case status

The prior `poc` numbers are supplied baseline information, **not re-run here**.
Every target result below comes from executing the assertions, not source inspection.

| Case | Prior poc baseline | Pinned sandbox target |
| --- | --- | --- |
| Exhausted edible portion cannot nourish again | Pass | Pass |
| Repeated coating cannot overspend oil | Pass | Pass |
| Exhausted water cannot wet another object | Pass | Pass |
| Burnt food cannot nourish later | Pass | Pass |
| Wet reeds resist the exposure that ignites dry reeds | Pass | Pass |
| Water ends coating fire without restart | Pass | Pass |
| H1 oil must not extinguish exposed burning fuel | Expected fail | Fail: burning becomes null |
| H2 zero washing dose leaves physical objects unchanged | Expected fail | Fail: coating removed and wetWith changed |
| H5 zero duration cannot crack hot brittle object | Expected fail | Fail: integrity 3 instead of 5 |
| H5 zero contact cannot crack hot brittle object | Expected fail | Fail: integrity 3 instead of 5 |
| H3 reverse heat exchange conserves heat | Expected fail | Pass: fixed |
| H4 long wait and small steps both retain burn heat | Expected fail | Fail: long wait stays at temperature 2 |
| Zero-time/impossible-resource search creates nothing | Pass | Pass |
| Repeated perfect search respects finite rare stock | Pass | Pass |
| Cross-process execution is deterministic, immutable, and cites rules | Pass | Pass |

## Where the remaining rules live

- **H1/H2:** `packages/core/src/matter/graph/soak-rules.ts` now holds wetting,
  dousing, and washing as data. The same material/exposure guards remain missing:
  dousing treats flammable oil as water, and washing runs with zero used liquid.
- **H5:** `packages/core/src/matter/graph/heat-rules.ts` applies the shock
  transformation despite zero duration or contact.
- **H4:** `packages/core/src/matter/graph/drift-rules.ts` runs burning before
  temperature. The exhaustion interval clears burning before temperature sees
  its active portion. `drift.ts` now splits at events, but splitting alone does
  not recover heating lost at the end of the event interval.

These are current graph-rule findings, not claims about the old procedural
implementation. They test the physical rules, not the quality or safety of
generated proposals. No live model calls or generative-pool mutations were made.

## Recovery and reproduction

The worker's nested detached worktree stopped materializing after test edits:

> the requested worktree version was not materialized because the checkout kept changing

Moving the two authored files back out of the nested checkout did not restore
terminal access. The cause may be nested-worktree replication; that is a
hypothesis, not a confirmed diagnosis. No further destructive recovery was tried.

The parent fetched the exact commit and used a clean archive outside the replicated
tree. Run the following from the repository, with a fresh scratch directory:

```sh
repo="$PWD"
target="$DELTA_SCRATCH_DIR/sandbox-validation"
mkdir -p "$target"
git archive 928755f673d2b18f4d893156df9499bc68340751 | tar -x -C "$target"
cd "$target"
pnpm install --frozen-lockfile --offline --ignore-scripts
pnpm check # pristine: exit 0, 864 normal passes + 228 expected failures
cp "$repo/validation/sandbox-held-out-928755f-20260720/held-out-clearing.test.ts" \
   "$repo/validation/sandbox-held-out-928755f-20260720/held-out-fixture.ts" \
   packages/core/test/matter/
pnpm exec vitest run packages/core/test/matter/held-out-clearing.test.ts --reporter=verbose
# exit 1: 10 pass, 5 fail
pnpm check
# lint/types pass; exit 1 at tests: 874 pass, 5 fail, 228 expected fail
```

Offline install succeeded using 54 cached packages with no downloads. If that cache
is unavailable, a regular frozen-lockfile install is needed. The archive contains
the tracked generated-rule data at the pin; no fresh proposals are generated.

The artifacts are deliberately outside root Vitest's test glob and core's typecheck
scope. Do not run their relative imports from the archival location, and do not merge
the sandbox production tree into `poc` as part of reproducing these results.
Renderer integration and browser behavior remain untested by this pass.
