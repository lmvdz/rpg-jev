# Compositional thermal causality: isolated executable experiment

This is **not a replacement engine, game integration, or completion of the
parent design's C0–C8 gates**. It tests one small claim: authored numeric
material rows and a contact graph can produce different thermal consequences
without identity-specific outcomes. A coating and substrate are separate parts;
a body is another part governed by exactly the same heat equations.

Only new files in this directory are required. There is no package, dependency,
model call, randomness, production import, reducer or persistence change.
SPEC sections 2, 4, 13 and 20 constrain the experiment: code performs arithmetic;
descriptions could fill a validated schema, never introduce outcome exceptions.
The experiment does **not** implement generated-content admission or ratification.

## Units and state

| Field | Unit / meaning |
| --- | --- |
| `inertMass`, `fuel`, `residue`, `escapedMass` | kg; explicit mass, not density or volume |
| `heatCapacity` | J/(kg K), constant specific heat shared by inert, fuel and residue within a part |
| `heat` | J of sensible energy relative to 0 K; temperature = heat / current capacity |
| `ignition`, environment temperature, exposure threshold | K |
| `fuelRate` | kg/s consumed while temperature is at least ignition |
| `energyYield` | J/kg of fuel; stored chemical energy is remaining fuel times yield |
| `residueFraction` | fraction of consumed fuel retained as inert solid |
| contact / ambient conductance | W/K |
| `exposure` | K s; accumulated positive excess above the supplied threshold, not injury or HP |
| `escapedHeat`, `ambientHeat` | J; cumulative escaped sensible energy and signed transfer to ambient |
| `dt` | s |

Every part must retain positive authored inert mass. This deliberately avoids a
zero-capacity/deletion/topology event; fully disappearing objects are outside this
schema. Residue retains the original specific heat, is not combustible again,
and does not change contact geometry. IDs only join edges to parts. Parallel
contacts sum conductance; self-contacts and missing endpoints are rejected.

### Budgets and oxygen assumption

When `b` kg burns, `b * residueFraction` stays and the remainder escapes.
Escaping mass carries `escaped kg * specific heat * pre-burn temperature` J.
The remaining part receives `b * energyYield` J of converted chemical energy.
Thus no vanished fuel leaves free sensible energy behind, and spent fuel
cannot release chemical energy a second time. After burnout, ordinary cooling
and conduction continue; temperature is not reset.

The tested invariants are:

```
mass = sum(inertMass + fuel + residue) + escapedMass
energy = sum(heat + fuel * energyYield) + escapedHeat + ambientHeat
```

Ambient is an infinite fixed-temperature reservoir: negative `ambientHeat`
records energy received from it, not energy invented by the simulation.
Initial sensible/chemical energy is explicitly supplied by the caller.

**This is fuel-derived material conservation, not full chemical mass balance.**
Oxidizer availability is assumed unlimited and unmodelled; no oxygen mass enters
the ledger. Escaped products are a lumped fuel-derived mass account, not gas
chemistry. There is no flame/radiation/air transport or gas heat capacity.
Yield is a toy net energy available to the part. These restrictions must be
replaced before claiming physically realistic combustion.

## Integration, events and bounded work

The method is first-order operator splitting: each substep burns locally, then
explicit Euler exchanges heat using **one shared post-burn temperature snapshot**.
No edge sees another edge's partly updated temperature. Ambient exchange uses the
same snapshot. Exposure is a left-endpoint sum after the burn stage.

For each part, let `Cmin = inertMass * heatCapacity`, and `G` be the sum of
incident plus ambient conductances. Choose
`h <= min(0.01 seconds, 0.5 * Cmin / G)` over parts with `G > 0`.
Current capacity is never below `Cmin`, so exchange alone is a convex temperature
update: no numerical overshoot or sequential-edge energy pumping. Use
`ceil(dt / h)` equal substeps, exactly covering the requested interval in real
arithmetic. Floating-point roundoff still applies.

Ignition/extinction are checked at substep starts. An exchange that crosses the
threshold starts/stops combustion on the **next** substep, not at an interpolated
crossing. Final fuel consumption is clamped to the remainder. Burnout mass and
released energy are accounted exactly algebraically, but the within-step time of
burnout and its heat exchange are **not** resolved exactly. A part that cools
below threshold can retain unburned fuel; there is no persistent flame flag.
No claim of exact timestep equivalence is made. Threshold discontinuities can
amplify trajectory differences; the split-interval test is evidence for its
fixture, not a universal error guarantee.

Maximum input: 32 parts, 128 contacts, interval 10 s, 10,000 substeps per call.
Stiffer/longer requests reject instead of hanging, truncating, or taking unsafe
steps. Scalar inputs must be finite in `[0, 1e9]`, except positive mass/capacity
and signed ambient ledger; IDs are nonempty strings at most 128 characters.
Derived invalid temperature is rejected. Output outside these same bounds
rejects atomically; inputs remain untouched. This is a typed numeric validator,
not an untrusted JSON schema parser. It does not certify historical ledgers.
Helpers `temperature`, `capacity` and `budgets` assume valid typed input.
Zero dt is an identity operation after validation, with no substeps.

## Evidence and predeclared tolerances

Fixtures are authored in `test/composition.test.ts`; source contains no named
material or object branches. Values are illustrative, not empirical calibration.
The initial 13 tests passed on their first run; no material fixture was tuned
after observing results. Additional event tests explicitly cover threshold
sampling, partial-step exhaustion, and substrate consumption after the coating
is already exhausted at 2 s. These also passed without fixture changes.

| Passed test evidence | Relation to target goal / limit |
| --- | --- |
| Coating burns on both substrates; combustible substrate loses fuel and produces residue | Same thermal rules, different numeric composition, not object callbacks |
| Bare versus insulating wrap heats body differently; exposure differs | Body is an ordinary graph part; no injury model or structural failure |
| Different mass changes thermal inertia | Mass is represented; density/shape are intentionally absent |
| Exhaustion, residue and escaped products; heat persists after burnout | Finite fuel and accounted products, not reset-to-cold fire flags |
| Isolated, connected and ambient heating/cooling budgets | Absolute errors < `1e-10 kg`, < `1e-6 J` for these fixtures |
| Rename/reorder parts, reverse/reorient edges | Heat equal to eight decimal places, within floating-point roundoff |
| 3 s whole versus 1.337 + 1.663 s split | Per-part difference < `5 K`, fuel < `0.0002 kg`; not exact equivalence |
| Frozen nested inputs | Pure function, no caller-state mutation |
| Zero time, conductance and fuel | No spurious heat source or transfer; existing heat may still imply exposure |
| Stiff graph | Stable 400-step result within initial temperature extrema |
| Work, interval, topology and numeric rejection | Bounded deterministic local work, not an unobserved-world performance claim |
| Partial exhaustion and threshold crossing | Documented sampled event semantics, not exact continuous event timing |

No observations are prose-dependent. A future generator could propose numeric
descriptions subject to admission constraints, but it cannot supply arbitrary
arithmetic or named exceptions here. This experiment has no cause log, version
pinning, save migration, spatial geometry, strength, oxygen depletion, latent
uncertainty, Jev, or action/renderer wiring. Integration needs separate evidence.

## Reproduce

```sh
pnpm exec vitest run spikes/composition/test/composition.test.ts
pnpm exec biome check spikes/composition
pnpm exec tsc -p spikes/composition/tsconfig.json
pnpm check
```

The root test glob discovers these tests. Root recursive package typechecking
does not include standalone spikes, so the explicit local `tsc` command matters.

Verified in the isolated working tree: **16 focused tests passed**, local Biome
and strict TypeScript checks passed, and `pnpm check` passed (40 test files;
713 passed and 108 existing expected failures). Those expected failures are
not evidence that the broader sandbox satisfies the compositional design.

Publication verification on sandbox base `b94fe5c`: standalone TypeScript and
`pnpm check` pass (50 files, 984 ordinary passes and 331 existing expected failures).
The spike remains isolated; these counts do not certify game integration.
