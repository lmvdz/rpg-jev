# C0: physical exposure and drift boundaries

## Result and branch scope

The C0 correction is implemented on `design/compositional-causality`, starting
from `c31901a3efc940eaada4b575e8ee85623ca7c43b` and sandbox ancestor `b94fe5c`.
It is not a merge into the developer's active sandbox or renderer branch.
The older attached `poc` snapshot is not the production implementation of this patch.

All 15 formerly archived ordinary assertions now pass as installed regressions.
There are also 32 exposure regressions and 38 phase regressions. The full gate
passes: **1,070 ordinary passes and 331 unchanged expected failures across 53 files**.
The isolated composition spike's standalone TypeScript check also passes.

This closes the specific H1/H2/H4/H5 regressions, not the full compositional physics
goal. Reverse heat exchange (H3) was already fixed on this base.

## Changes to the physical contract

| Case | General correction |
| --- | --- |
| Zero supplied soak dose | No wetting, washing, dousing, steam, consumption or appended physical rows run |
| Aqueous versus oily liquid | Dousing uses supplied amount multiplied by the existing bounded aqueous-fraction proxy, not the material name or requested dose |
| Zero heat duration/contact | The whole physical heat process is a no-op, including threshold effects, fuel use and appended rows |
| Fuel exhaustion | Integrate the active interval through base and generated rows before settling exhausted fuel |

Soak still uses `clamp(1 - oiliness / 5, 0, 1)` as a coarse aqueous fraction.
That is not a complete chemical composition model. Positive washing and thermal
shock remain threshold effects, not dose-calibrated transport or damage.
`resolve` remains the numeric-normalization boundary for caller input.
Perception may update observers when physical state is unchanged.

## Why the first burnout patch was rejected

Moving the base temperature row before the old burnout row was not sufficient.
An existing generated cooling row then saw the extinguished flame and recomputed
temperature from the interval-start snapshot. For bulk or wind conditions, it
erased the heat just delivered. The original one-unit, still-air tests missed it.

The accepted correction is an explicit drift sequence:

1. **Before:** settle already-due exhaustion and suppress initial flames that
   cannot burn because of air or combustibility.
2. **During:** run base interval evolution, then the existing generated rows,
   while endpoint fuel exhaustion has not yet cleared the flame or coating.
3. **After:** account fuel from the true start-of-interval snapshot and settle
   exhaustion. Never restore a flame that an extension extinguished.

The next scheduler interval rebuilds properties from the settled state. Cooling
therefore starts from the hot substrate, not its earlier temperature or spent
coating. There are ten base rows instead of nine because suppression and settlement
are separate rules. The implementation contains no generated-row-ID exception.

Generated rules themselves remain ordered and execute sequentially. Existing
weather extinction is sampled at the interval endpoint; this patch does not
implement deferred writes for every possible generated effect or prove that
arbitrary future conflicting extensions compose. The regression evidence covers
the pinned generated rows, including their bulk, wind and weather conditions.

## Reference changes and independent evidence

Three procedural oracles were deliberately amended:

- Heat: require positive exposure before any physical transformation.
- Soak: require supplied dose and use aqueous dose for dousing.
- Drift: use the new before/during/after contract, preserving `was` as the true
  interval-start state.

These are revised reference semantics, not claims that buggy historical behavior
is unchanged. No seeded sample count, comparison tolerance or equivalence assertion
was relaxed. The validator's rejected-row inventory names `burning-start` and
`burning-end` in place of `burning`; its production restrictions are unchanged.
Generated rows, model recordings, probe batches and the archived fixtures are
unchanged. No expected-failure cases were promoted.

Independent regressions cover:

- Positive washing, dousing thresholds and available-stock limits.
- Entire physical state at zero amount, time or contact.
- Admitted bounded extension rows excluded by zero exposure.
- Analytic heating and cooling before, at and after fuel exhaustion.
- Amount 2, wind 2 and both together, with non-grid exhaustion partitions.
- Initial zero fuel, missing air and noncombustibility with positive initial heat.
- Immutable interval-start state and endpoint weather with remaining or exhausted
  fuel, including self-substrate exhaustion after a generated extinction.

The first delivery passed its original tests but failed composition review.
The phase revision passed source review against the actual generated sequence,
and the parent independently ran the combined gate before publication.

## Reproduce

On the task branch:

```sh
pnpm exec vitest run packages/core/test/matter/held-out-clearing.test.ts \
  packages/core/test/matter/c0-exposure.test.ts \
  packages/core/test/matter/c0-drift-phases.test.ts \
  packages/core/test/matter/graph/drift-rules.test.ts \
  packages/core/test/matter/graph/heat-rules.test.ts \
  packages/core/test/matter/graph/soak-rules.test.ts \
  packages/core/test/matter/graph/validate.test.ts
pnpm exec tsc -p spikes/composition/tsconfig.json
pnpm check
```

The focused selection passes 123 ordinary tests. Remaining work includes physical
parts/contacts, conserved multi-recipient transfers, unified heat/drift combustion,
residue and energy accounts, latent state and mechanics migrations. Existing tiny
time tolerances and sampled weather timing are not universal partition-invariance
guarantees. The linked Claude Doc remains unsynchronized.
