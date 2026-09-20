# Automated thermal validation and the next world interaction

## Scope and reproduction

The bench is an **engineering fixture**, not the next player exercise. Its
mechanical possibilities should be explored by code. The prior interactive
journal/protocol remains available as historical tooling, not a requirement to
manually enumerate arrangements.

From the repository root, with dependencies already provisioned:

```sh
node validation/thermal-learning/validate.ts --out=validation/thermal-learning/runs/run-1
```

For this unprovisioned agent checkout, use the existing dependency read-only:

```sh
node validation/thermal-learning/run.mjs --dependency-root=H:/rpg-jev --validate --out=validation/thermal-learning/runs/run-1
```

This does not invoke a package manager, install, copy or link dependencies, read
player saves, request participant input or call a model. Choose a new output
directory for each run; an existing directory is refused rather than overwritten.
`cases.jsonl` contains **every** enumerated outcome, including failure details.
`report.json` contains domain, counters, maxima, contrasts, source hashes and a
SHA-256 of the full case stream. A failed assertion or incomplete enumeration
makes the command fail; an unhandled execution failure also exits unsuccessfully.
Partial output from an interrupted run is not a passing report.

## Declared finite domain and tests

The complete enumeration fixes the original bench's four named identities,
material quantities/properties, initial energies and finite probe. Each cube may
be on its own isolated rack support or one of nine sockets; occupied sockets are
exclusive. Every arrangement is evolved for 60 seconds with the probe undocked
or docked to each eligible seated cube. Names are identifiers, not rule selectors.

- Placement count: `sum(C(4,k) * P(9,k), k=0..4) = 5,509`.
- Placement/probe count: the same sum weighted by `k+1` = **24,553**.
- Independent component oracle checks total and per-component energy, initial
  temperature extrema, isolated-node constancy, nonzero exchange for connected
  gradients above roundoff tolerance, admission, input immutability and unchanged
  identity/placement/material/probe definitions. Only energy may change.
- Tolerances were declared before execution: energy **1e-6 J**; temperature
  roundoff/invariance **1e-8 K**. Tests deliberately inject balanced cross-component
  leakage and a no-op result to confirm the oracle rejects them.
- Separate contrasts test conductivity substitution, loading, absence of a path,
  isolated storage, all eight square symmetries, relabeling/reordering, zero time,
  equal temperatures, and exact `60 = 17 + 43` fixed-grid evolution.
- Numeric probes cover 243 analytic pairs: capacities `{1,20,1000}` J/K and
  conductivities `{0.01,1,100}` W/(m K), independently chosen for both parts,
  initial 400/250 K, at 1/2/60 seconds. The **0.1 K** analytic assertion is scoped
  to capacities at least 20 J/K; stiff-case error is reported, not hidden.
  A maximum-degree, minimum-capacity star and 1,440 successive minute intervals
  with probe movement challenge stability and accumulated error separately.
- Actual Store/attempt paths supply **2,010 checks in 79 named scenarios**, including 64 ordered
  two-actor operation races, private/stale evidence, successful and failed retries,
  JSONL round trips, exact replay/resume, retained heat, probe loading and direct
  duplicate/fingerprint/clock-bypass rejection.

This is exhaustive **only** over the stated placement/probe space. It is not an
exhaustive exploration of continuous properties, initial temperatures, arbitrary
operation sequences, all nine-part worlds or all approximation errors.
Fixture initialization per test is not a world respawn.

## Measured results

Implementation and automation revision:
`4d2516813a020322acc30624eb79e2a3a96fd093`, based on
`e91a8dac652d30c2d46855b669583ee0d4b4b68e`. Measurements were collected on the
working tree and reproduced unchanged before publication. Node `25.8.2`;
no physical rules or tolerances were retuned for the sweep.

| Measurement | Result |
| --- | --- |
| Complete arrangements / placement-probe cases | 5,509 / 24,553 |
| Failed enumerated cases | 0 |
| Maximum component and total energy error | 1.3460521586239338e-10 J |
| Receiver B after one minute, across enumeration | 290–328.908231321596 K |
| Maximum probe/target difference initially / after one minute | 80 / 37.78755273860264 K |
| Conductive bridge, B after one minute (probe undocked) | 310.1165713138608 K |
| Resistive bridge, same inventory, B after one minute | 290.00142357143693 K |
| Direct receiver without / with probe loading | 328.908231321596 / 326.7395416963787 K |
| Corresponding loaded probe display | 303 K—not the receiver's 326.74 K |
| Isolated rack after 60 minutes | Exactly unchanged |
| Eight transforms / relabeling, maximum error in these probes | 0 K |
| 17+43 partition | Exact equality |
| Maximum analytic error over all numeric pairs | 0.27706531008180946 K |
| Maximum analytic error with capacities >=20 J/K | 0.00614426995065287 K |
| Numeric-corner maximum component energy error | 3.0850060284137726e-9 J |
| Maximum cumulative energy error over 1,440 minutes | 1.4988472685217857e-9 J |
| Shared-settlement checks | 2,010; no failures |

The full case-stream SHA-256 is
`ada292465d02bcc7c0fa0dbb2780cd938a55b14d07eb7cb5c32576aa4ee80e3f`.
Reports identify the exact source-file hashes used; the combined code revision
is pinned above.
The test environment reused existing zod `4.6.5`, Biome `2.5.14`, TypeScript
`7.0.2` and Vitest `5.0.1`. These are environment provenance, not new dependencies.

Independent review reproduced the complete row count, unique case keys and case
digest, and ran the physics/sweep/settlement tests. It found missing checks for
non-energy-field mutation and incomplete source provenance; both were strengthened.
Settlement scenario counts are asserted so silently dropping most scenarios
cannot leave only a vacuous positive-check-count gate.

The component oracle is deliberately an **endpoint** oracle. For example, an
invented within-component transfer that conserves energy can satisfy its bounds
while using the wrong internal path. Analytic-pair and arrangement/property
contrasts complement it; neither this enumeration nor its zero-failure count
proves every edge trajectory correct. No solver was added to serve as its own oracle.

After the review corrections, the parent reran the full enumeration and obtained
the same case-stream digest. It also independently checked row uniqueness, the
on-disk digest, and refusal to overwrite an existing run without changing its
files. Final output is retained locally under `runs/verified-1/` (ignored generated
data; regenerate it on other checkouts).

Combined verification: 43 Node thermal/automation/workflow tests pass; the legacy
72-file suite retains 1,254 ordinary passes and 331 unchanged expected failures;
Biome and workspace, composition and validation TypeScript checks pass.
These were run through existing executables with read-only dependency resolution,
not `pnpm check` or any install/restore command. The ordinary test/typecheck scripts
now include the new probe tests and validation-driver typecheck in provisioned
checkouts. The full case enumeration is the separate command above.

The stiff worst case has capacities 1/1000 J/K, both conductivities 100 W/(m K),
at one second: analytic hot temperature 305.221540301003 K versus computed
304.9444749909212 K. **Stability is not universal 0.1 K accuracy.**
No tolerance was relaxed to hide this result.

Two outcome limitations affect the next product choice:

1. A 290 K rounded reading can conceal small real transfer; even a one-minute
   probe reading is not target truth. Do not award success based on treating the
   instrument as an oracle.
2. Isolated stored heat never disappears in this admitted model. A permanent
   temperature threshold must not silently award unlimited comfort or service.
   There is no ambient, weather or body heat-loss mechanism here.

The low-level Store retains direct effect arguments by reference. Probes clone
drafts before deliberately crafting later direct submissions; this run does not
certify hostile mutation of privileged in-memory objects or hostile save files.

## Selection: prepare an inn sleeping place with a finite bed warmer

**Choose this one next interaction:** while ordinary inn activity continues, the
player helps prepare a guest's sleeping place by allocating an already-warm,
reusable solid heat store to a persistent solid warming insert in the furnishing.
There may be another demand for that same store. Leaving it, moving it elsewhere,
or interrupting the job changes where its remaining energy goes.

The purpose is preparing a place for someone, not “raise B's number,” enumerate
sockets, or complete a prediction worksheet. No prescribed arrangement,
temperature-achievement quest flag, testing reset or replenishment is part of
the interaction. The same properties, contact paths and accounts determine
outcomes under renaming, substitution, interruption and another actor's use.

Why this wins:

- The sweep supports finite allocation, differing contact paths, persistent
  receivers, donor depletion and meaningful consequences while time passes.
- Warming a serving piece is narrower but risks another thermometer task; cooking,
  food safety and fluids would introduce unproved mechanisms.
- Heating a lock/tool to open or transform something requires expansion, softening,
  friction or phase behavior that this evidence does not establish.

Independent review first proposed these alternatives, then recommended this
selection after receiving the measured results. **This selects the next
interaction; it does not implement or prove bed warming, body comfort or rest.**

### Small implementation admission still required

1. Ordinary inn actions must advance this exchange through the same authoritative
   timeline as needs/schedules. `Game.pass` currently uses `advance_clock`, which
   thermal worlds deliberately reject. Simply attaching thermal state would break
   progression; a separate player `wait` or private clock is not a solution.
2. A world item and a furnishing's solid insert need explicit identity/contact
   bindings. Bench sockets are not a general inventory or furniture model.
   The 1 cm cube approximation cannot be relabeled as an entire isothermal bed.
   Only a bounded insert/contact geometry and its capacity need admission—not a
   general geometry engine. Legacy ordinal material values remain untouched.
3. A meaningful preparation/service consequence must be explicit and property-
   based. Conduction alone does not establish comfort, rest relief or safety.
   Until that rule is admitted, claim only warming the solid insert; do not award
   recurring benefits from an unchanged temperature or invent physiology.

Acceptance should use ordinary inn commands and an ongoing reason to act, not
expose fixture sockets or require experimental bookkeeping. It must demonstrate
finite donor depletion, persistent receiver state, competing use, interruption,
eligible cues and ordinary time progression. If accomplishing that requires
several unmodeled mechanisms, stop rather than disguising the bench with furniture
names. No new physics, world framework or player-facing interaction was added in
this automation assignment.
