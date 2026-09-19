# Held-out clearing rule pass

## Branch scope

**Publication note:** the historical `poc` assertions are archived under
`validation/poc-held-out/`, not installed in the active sandbox test suite.
The original uncommitted production snapshot is not part of the published branch.
Use the pinned sandbox rerun for reproducible current-branch evidence.

These results apply only to the attached `poc` working tree, based on `47d59de` plus
its uncommitted matter files. They are **not** results for the current `sandbox/matter`
or `renderer/client` branches. The added tests and this report are also uncommitted.

A subsequent branch inspection found `sandbox/matter` at local commit `e6d2422`,
with a newer graph-based rule implementation. Its heat exchange already handles
negative transfer in `drawn`, so H3 is stale relative to that implementation.
The other findings have not been revalidated there. Port the fixtures to its current
schema and rerun ordinary assertions before carrying these expected failures over.
The inspected refs were local; no remote refresh was performed.

**Follow-up completed:** the pinned sandbox rerun at `928755f` uses ordinary
assertions and reports 10 passes and five failures across these 15 cases.
H3 is confirmed fixed; H1, H2, H4 and both H5 boundaries still fail.
See [the sandbox report](../validation/sandbox-held-out-928755f-20260720/REPORT.md)
for exact revisions, the sensing-related assertion adaptation, and reproduction.
The results below remain a record of the older `poc` working-tree pass.

## Result

Five rule gaps reproduced in 15 new tests: nine assertions pass normally and six
are expected failures (zero-exposure shock has two independent boundary cases).
Only new test files and this report were added; production rules were not changed.
This is a small behavioral sample, **not an estimate of overall coverage**.

The tests live in `packages/core/test/matter/held-out-clearing.test.ts`, with independent
rows in `held-out-fixture.ts`. Each known gap is marked `it.fails`, following the existing
matter test convention. It executes the intended assertion, rather than skipping it.
When the rule is fixed, Vitest fails on the unexpectedly passing test: change that case
to ordinary `it` after confirming the behavior. A green run includes five known gaps;
it does not mean all 15 intended behaviors work. Expected failures accept any thrown
assertion, so inspect their failure cause again when editing these scenarios.

## Method and limits

- An independent agent proposed 18 qualitative clearing scenarios without reading the
  existing matter tests or vocabulary scenario batches. The parent translated a subset,
  plus boundary variants, into executable cases against the current API.
- The parent inspected implementation and existing test conventions. This is independent
  scenario design, not a double-blind evaluation. Fixtures were authored separately;
  no production rule was adjusted. Review corrected three confounds: cold water was
  frozen in the first shock test, the wet-fuel test lacked a dry control, and an oil
  coating could wash away independently of extinguishing. The corrected cases use
  liquid cold water, a shared exposure with a dry control, and self-burning fuel.
- Burn durations are authored starting states, not outputs of ignition calculations:
  these are state-transition tests, not end-to-end fuel-sizing verification.
- Scope: supplies, fire, liquid application, heat exchange, searching, waiting, and a
  coating → heating → waiting chain. Fixed inputs and logged-draw-shaped values require
  no live Jev calls, credentials, browser, or generation.
- Assertions prefer qualitative behavior. The finite rare-stock case explicitly uses
  the current code's two-item bound; it is a bookkeeping regression, not a realism claim.
- Re-executing a pure action chain is not event-log replay. Rule IDs in `because` are
  checked for presence, not validated as a complete causal graph.
- Tool cutting/wear, growth, creatures, distinct thirst, latent description generation,
  the full search time-charging path, and observed/unobserved equivalence are not certified
  by this suite. Some need additional integration or modeling before a fair test.
- The proposal says a searched-bare patch stays bare, while current search rules allow
  continued effort against diminishing finite stock. This pass tests stock exhaustion,
  not permanent absence after a single unsuccessful glance; that semantic difference
  requires a design decision, not an invented assertion.

## Prioritized findings

### H2 — Zero input can still wash away material

**Hard invariant; fix first.** Applying zero washing liquid removes a 0.5-unit oil
coating and changes `wetWith` to soap, while the supply remains unchanged.

`soak` clamps consumption to available supply but runs `wash` and state changes even when
the used amount is zero. The general rule should be that zero effective input cannot
cause a material transformation. Audit related boundary paths, rather than adding a
soap-specific exception.

### H4 — Wait boundaries change whether a burning coating heats its tool

**Time-simulation invariant.** A mild metal tool has an oil coating with five minutes
of fuel. After ten minutes in one action it is still exactly temperature level **2**.
After ten one-minute waits it reaches **2.2255990787859727**. Both paths correctly
remove the coating, end the fire, and preserve the tool.

The burning drift clears an expired fire before the temperature drift accounts for its
active interval. Integrate up to internal transitions, then the remainder; a fixed
outer step size alone does not account for a fuse ending within that step. The test only
requires both paths to retain some heat, not exact numeric equality.
The one-minute result is not asserted to be numerically correct: it also omits heating
during its final burning interval, but retains heat from earlier intervals.

### H5 — Thermal shock occurs with no time or no contact

**Exposure invariant; two tests.** A hot brittle pebble falls from integrity 5 to 3
when the cold liquid is applied for zero minutes with full contact, or for one minute
with zero contact. `shock` checks the temperature gap and liquid state but not exposure.
Gate transformations on the effective contact/time, not only the presence of operands.
The original test used temperature-zero water (ice), masking this defect; review
caught it and the corrected tests use temperature-one liquid water.

### H3 — Heat exchange works in only one operand direction

**Energy-accounting invariant.** Two identical metal objects start at levels 1 and 4.
With the cold object named as source, five minutes of contact lowers the hot target to
**3.018386128865462**, but leaves the source at **1**. Their combined temperature falls
from 5 to about 4.018 despite full contact and no separate ambient drift.

`heat` computes the target's exchange, but `drawn` returns no source update for negative
transfer. Equal-capacity fixtures make the assertion independent of mass conversion.
The general rule is symmetric signed exchange, regardless of which operand the action
calls its source.

### H1 — Flammable oil is treated as extinguishing water

**Material-behavior gap with explicit assumptions.** Pouring one unit of oil onto an
exposed, air-fed burning reed with ten minutes of fuel sets `burning` to null. No sealed
container, immersion, or oxygen-starvation process is involved.

`soak` applies `douse` to every liquid; that helper uses only amount and remaining fuel.
Extinguishing should depend on the liquid's relevant properties and exposure, rather
than the action's generic “liquid” role. This is a qualitative model expectation, not a
claim that real oil can never suppress any flame under any circumstances.

## Behaviors that worked

1. Exhausted food cannot nourish the player a second time.
2. Repeated coatings cannot spend more oil than exists.
3. Exhausted water cannot wet a second target.
4. Completely burned food cannot be eaten later.
5. Wet reeds resist an exposure that ignites the otherwise identical dry control.
6. Enough water ends a coating fire; waiting does not restart it.
7. Zero-time searches and resources with zero abundance create nothing.
8. Repeated perfect search draws cannot exceed finite rare stock.
9. A cross-process chain is deterministic, preserves its input world, and emits rule
    citations for non-noop changes.

## Reproduction

```sh
pnpm exec vitest run packages/core/test/matter/held-out-clearing.test.ts
pnpm check
```

The initial ordinary-assertion run produced 10 passes and four failures. Independent
review exposed a false-positive pass in the shock case; splitting and correcting it
adds two expected failures. Production fixes are left to the matter implementation owner.

Final verification: `pnpm check` passed lint, typechecking, and all 39 test files:
697 ordinary passes and 108 expected failures across the repository. This suite
contributes nine ordinary passes and six of those expected failures.
