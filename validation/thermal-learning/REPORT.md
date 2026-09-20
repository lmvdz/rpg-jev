# Solid-contact learning slice: engineering evidence

This records the initial bench and corrective interface work. The current
direction is [automated mechanism validation and a selected in-world interaction](AUTOMATION.md),
not another laboratory-style player exercise. Historical UI checks below remain
valid at their scope; they are not a reason to require manual enumeration.

## Revision and claim boundary

Implementation base: `e91a8dac652d30c2d46855b669583ee0d4b4b68e`.
The combined implementation and automation are committed at
`4d2516813a020322acc30624eb79e2a3a96fd093` on `implementation/thermal-learning`.
The results below preserve the initial bench and corrective-interface validation
history; the latest automated results are in [AUTOMATION.md](AUTOMATION.md).
No external Claude Doc synchronization is claimed.

Historical interface-pass runtime fingerprint (before the automated runner was added):
`9221c29061e8e177055a31333456f74958b87342f7050f1acd72bb929cdb42ad`.
Input order: core `effects.ts`, `log.ts`, `types.ts`; all files in
`packages/core/src/thermal/` sorted by filename; terminal `inn-play.ts`, `play.ts`,
then all terminal `thermal*` files sorted by filename; finally
`validation/thermal-learning/run.mjs`. For each input, hash its repository-relative path, newline,
UTF-8 contents with carriage returns removed, then newline. This identifies the
then-uncommitted interface-pass sources, not the later combined revision above.

The [admission](../../docs/world/thermal-learning.md) fixes the four behavioral
commitments and numerical tolerances. The player-facing capability is an offline
bench with plain commands, a projected grid and a research journal: seat/rack parts,
dock a finite-capacity probe, read its limited display, record predictions/reasons
and let both actors act on one logical world through the trusted host.
The terminal uses the existing core Store, effect validation and JSONL replay.
This is not a second simulation engine or an ordinal-to-SI migration.

## Verification without installation

Verification used no package-manager command, dependency install/restore, live
model call, API credential or renderer change.

The attached checkout has no `node_modules`. Existing executables and dependencies
were found in the primary checkout, `H:/rpg-jev`, and used read-only:

- Node `25.8.2`, TypeScript `7.0.2`, Biome `2.5.14`, Vitest `5.0.1`.
- Existing zod `4.6.5`; unchanged SDK and SpacetimeDB dependencies for legacy tests/types.
- Temporary Node resolution hooks mapped only zod for the new Node tests/terminal.
- Temporary Vitest aliases mapped workspace packages to **this** worktree and
  external dependencies to existing installations. Same 72-file selection and
  four-worker bound; no assertions, tolerances or expected-failure markers changed.
- Temporary TypeScript configs extended the actual package configs, overriding
  dependency/type resolution paths only. No source/type strictness exclusions.
- Temporary configs, caches, terminal transcripts and saves stayed in the
  per-turn scratch directory. No dependency directory was created in this checkout.

Executed results:

| Check | Result |
| --- | --- |
| Full existing Vitest suite | 72 files, 1,254 ordinary passes, 331 unchanged expected failures |
| New Node tests | 37 passing: 10 physics, 10 integration, 6 journal, 7 surface, 4 workflow/save/launch |
| Full Biome check | 335 files checked, pass |
| Strict TypeScript | Core, inn, Jev, terminal, client, M0, M2, S0 and standalone composition pass |
| Real structured terminal process | Intervention/read/conflict/save/exit/reload/retry passes |
| Real human terminal process | `play --bench`, authored notes, intervention, journal, exit/reload/retry and actor separation pass without JSON |
| No-install launcher | Explicit existing dependency root works read-only; no workspace dependency directory created |
| `git diff --check` | Pass |

The literal `pnpm check` command was not invoked because its bootstrap may
restore packages. Its lint, workspace typechecks and tests were instead exercised
through the already-installed executables. `package.json` now includes the new
Node tests in the ordinary full test gate for normally provisioned checkouts.
No compatibility claim is made for Node versions not exercised here.

## What could reject the approach

Before numerical testing: absolute closed-energy error 1e-6 J, analytic error
0.1 K for declared nonstiff fixtures, integer-time partition error 1e-8 K.
These were not relaxed to pass failures. Recorded effect replay is exact and
does not numerically evolve or re-observe the world.

Coverage includes:

- Ordinary seat/contact intervention, disconnection and retained warmth.
- Independent unfamiliar U-shaped bypass versus a broken path, same inventory.
- Conductivity, mass and specific-heat substitutions; renamed/reordered parts.
- No path, zero duration, equal-temperature and finite shared-donor cases.
- Maximum-degree/minimum-capacity/high-conductance exchange without overshoot.
- Probe loading, delayed response, retained heat on redocking and inconclusive
  initial readings in hidden-state twins.
- Actor-private history, old observation provenance, conflicting attempts,
  successful and rejected retry continuity, actual disk save/reload and exact replay.
- Rejection of legacy-clock bypass, fabricated balanced heat, invented evidence,
  duplicate direct settlement and a counterfeit request fingerprint.

Independent review selected unfamiliar probes before the final regressions.
It found four real integration/admission problems: object-key-order comparisons,
Store-level duplicate request admission, rack-probe admission and fingerprints
not bound to their operations. These were corrected by general validation rules,
not identity exceptions. The old analytic sensor test used a racked target; it
was moved to a seated surface under the clarified admission, with its analytic
formula and tolerance unchanged.

Independent scratch probes also observed a five-part connected U endpoint at
311.9999999957558 K versus 290 K when broken, and fan-out energy error
−2.7284841053187847e−12 J. Those are **privileged engineering measurements**, not
player-visible displays or participant evidence.

A fresh final reviewer independently reran all 21 new tests and a two-launch
terminal subprocess check on the corrected implementation: original successful
and failed receipts survived reload and reordered request keys; no extra time
or log entries appeared, Bo's history stayed empty, and projected output exposed
no energy fields. No blockers were found in that bounded review. The reviewer
did not independently rerun the legacy suite, lint or workspace typechecks.

The final design-record reconciliation found no accepted causal-rule contradiction.
It identified a sequencing problem that was initially mischaracterized as an
authorized exception. That interpretation has been withdrawn: the assignment
did not waive the prerequisite Q064 review. The completed corrective six-probe
reconciliation and independent review support provisional retention of this
fixture for evidence-first surface work, without rewriting the chronology or
declaring Q064 closed.
The accepted eventual SpacetimeDB runtime direction remains unchanged; local
Store validation does not resolve final multiplayer authority or capacity.

## Corrective experience work

The original result was primarily an engineering bench. The corrective pass adds
an actual command sequence through the normal terminal launcher, not another
solver: apparatus orientation → visible layout → prior/prediction → intervention
→ historical probe reading → revision/transfer → further attempt.

- `play.ts` dispatches `--bench` before importing inn/model adapters. The previous
  inn entry was moved unchanged to `inn-play.ts`; normalized source equality
  against the baseline was checked.
- The surface receives only projected structure and actor history. It explains
  apparatus use without recommending a successful layout or exposing material
  calibration. Plain commands hide revision/request plumbing, not evidence limits.
- Study notes are attributed metadata with immutable authorized snapshots,
  provenance labels and optional unstated reasons—not verified beliefs. Stale
  views cannot silently acquire a newer basis; reload and retries retain the old
  snapshot. The physical action catalog and old unsupported-request replay remain
  unchanged.
- Independent workflow review found a journal C1/bidirectional-control escaping
  defect and missing apparatus orientation. The shared quoting rule now covers
  both labels and journal text; regression tests include ESC, U+009B and U+202E.
  Orientation now distinguishes the probe's historical display from cube truth,
  and `history` versus `journal` help matches their contents.

The scripted process test records an intentionally unsupported guess, obtains a
contrasting later reading, records a revision and prospective transfer note,
changes arrangement, exits and resumes. This verifies recording/order/usability
plumbing; the script already knows what to type. It does not show that a newcomer
formed or revised an explanation unaided. The [participant protocol](STUDY.md)
defines that next empirical check and stop conditions. No participant results
were collected during this corrective pass.

A final independent review of the corrected launch used the real no-install
launcher and scratch saves. Read and note retries across exit/reload preserved
save bytes; original note snapshots survived another actor's subsequent progress.
Ada could see shared time advance but not Bo's private reading or uniquely marked
note. ESC, C1 CSI, bidi override and isolate characters were escaped immediately
and after reload. The moved inn entry was independently confirmed byte-identical
to its baseline blob `751d111042811a87b38609fe9786440d56dcee16`.
No new concrete correctness/privacy defect was found in that focused review.
Input was piped; interactive-TTY behavior and participant efficacy were not tested.

## Actual terminal evidence

In one scripted session, Ada recorded a prediction/reason before waiting:
“The reading may rise after waiting” because the first reading might be delayed.
Available probe readings were:

| Observation | Display |
| --- | --- |
| Immediately docked to A, minute 0 | 290 K |
| After one minute, still on A | 324 K |
| Immediately moved to B, minute 1 | 324 K |
| After another minute on B | 314 K |

The unchanged immediate reading is retained probe state, not proof that A and B
have equal temperature. Bo's competing placement was stale and consumed nothing;
Bo's observation history remained empty. Restarting the terminal from its
23-entry save and retrying Ada's first wait returned the original minute-1,
revision-4 receipt while current world time stayed at minute 2. Save bytes
remained unchanged.

This is a scripted workflow, not a learning study. No participant has demonstrated
explanation revision or transfer. Prior physics knowledge, copying and lucky
success have not been ruled out. Fun, general physical adequacy, scalability,
embodied handling, server authentication and final multiplayer pacing are unproven.

## Use the bench

With dependencies **already available**, from the repository root:

```sh
node packages/terminal/src/play.ts --bench --provenance=participant
```

This resumes `saves/thermal-bench.jsonl`, creating a new recorded fixture only if
no save exists. Use an explicit `--save=<path>` for a separate test session or
`--ephemeral` for an unsaved test. No installation is part of this command.
For an unprovisioned checkout, the [protocol's read-only launcher](STUDY.md)
uses an explicitly selected existing dependency installation without restoration.

Type `help`, `look`, `prior`, `predict`, `seat`, `rack`, `dock`, `undock`, `read`,
`wait`, `history`, `revise`, `transfer`, `journal`, `retry` or `quit`.
Notes use `<statement> | <reason>`; a reason can be omitted without invention.
Normal play neither asks for JSON nor lets a command switch actors.

### Trusted structured driver

Run `node packages/terminal/src/thermal.ts --json --save=<path>` to retain the
two-actor engineering surface. Without a save argument, this driver is ephemeral.
It is not the participant interface. Sockets are row-major, starting at 0;
`null` means the cube's isolated rack support. One JSON object per line:

```json
{"actor":"ada","requestId":"first","expectedRevision":0,"operation":{"kind":"dock","target":"A"}}
{"actor":"ada","requestId":"second","expectedRevision":1,"operation":{"kind":"read"}}
```

Other operations:

- `{"kind":"seat","part":"C","slot":1}`; `slot:null` racks a cube.
- `{"kind":"dock","target":null}` undocks the probe.
- `{"kind":"wait"}` advances the **shared** world by one minute.
- `{"kind":"predict","prediction":"...","reason":"..."}` records an actor-authored
  explanation or revision; it does not certify it as true.
- `{"actor":"ada","view":true}` reads already-acquired evidence without a new attempt.
- `quit` exits. Reopen the same path to resume; it does not reset temperatures.

Use the returned revision for the next new attempt. Retry the identical request
with its original ID/revision; never change a payload while reusing its ID.
`bo` is the second trusted-driver identity, not an authentication feature.
Save files and operator access are privileged; do not expose them as player views.

The local host uses an exclusive `.lock` file and atomic `.pending`-then-rename
save replacement. A failed write ends the host without returning a success
response. A crash can leave a lock or pending file; verify the host is stopped
and preserve/review those files before operator recovery. This is not a
power-loss durability or hostile-save certification.

### Historical study proposal, superseded as the immediate next step

Have a participant use only the projected surface. Record prior knowledge, an
initial prediction, contradictory/inconclusive evidence, a revised explanation
and a prediction/reason before an unfamiliar arrangement. Do not show this
report's diagnostics or scripted predictions during that study.

The implementation supports recording that evidence; the assignment did not
collect it. The user's subsequent direction is to automate the bench and select
one meaningful world interaction from the results, recorded in [AUTOMATION.md](AUTOMATION.md).
The bench study is no longer the recommended next player task.
