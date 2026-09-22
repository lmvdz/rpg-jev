# Shared browser world — bounded integration evidence

## Outcome and gate

Two browser sessions explore the existing generated clearing against one local
SpacetimeDB authority. The host validates physical intent, records effects/RNG,
advances passive time and autonomous inhabitants, and preserves the world across
restart. This is neither the terminal inn nor the restricted food action fixture.

**Predeclared environment and budget:** Windows, Node 25.8.2, pnpm 11.15.1,
SpacetimeDB CLI/SDK 2.10.1, installed Chrome/WebGL2, loopback, two clients,
500 ms scheduled opportunities, accepted-command acknowledgement p95 <=250 ms.
Nearest-rank p95 over 24 accepted protocol commands is the latency gate.
Browser interaction timing is separately recorded; neither metric is retuned
after observing results.

No model calls, external deployment, Iroh, Matrix or JEPA inference were used.
The build is a bounded multiplayer foundation, not acceptance of M2's fun gate,
the complete M5 workload/cost gate or independent internet hosting.

Final combined `pnpm check` passed: lint/typechecking; 84 Vitest files with
1,455 passing tests and 331 existing expected failures; 26 food, 43 thermal/
terminal and 55 shared/archive/replay native tests. The production browser build
passed. Expected physical-rule failures remain visible, not relabeled as new
coverage. Independent review found no correctness blocker in the batching,
projection, heartbeat or replay changes.

## Evidence

| Check | Evidence type | Result |
| --- | --- | --- |
| Two identities see one another; keyboard movement propagates | Real Chrome/CDP, two separate profiles | Passed |
| Generic “look around for stone” menu action | Real pointer/menu workflow through host | Passed |
| Reload preserves actor and pose | Real browser/session-storage reconnect | Passed |
| Shared mode has no editor/time cheat/private world handles | Real browser workflow | Passed |
| Browser console/WebGL errors | Real browser workflow | None recorded |
| Broad subscriptions and authenticated SQL remain caller-private | Live SDK/HTTP against host | Passed |
| Forged actor, far movement, stale revision and wrong generation | Live protocol | Refused |
| Exact retry vs changed-payload same-sequence retry | Live protocol | No second movement; changed payload refused |
| Time progresses while both clients idle | Live protocol | Passed |
| Host restart with the same data directory | Live protocol, owned local process restarted | Actor, generation, position and sequence preserved |
| Initial acknowledgement p95 <=250 ms | Live protocol, 24 accepted commands | **Failed: 1,453.761 ms** |
| Final acknowledgement p95 <=250 ms | Same live protocol and budget after optimizations | **Still failed: 280.780 ms** |
| Replay archived simulation across host restarts | Offline replay of real host archive | Passed: 2,159 events / 2,158 contiguous revisions |
| Human playability, integrated GPU, internet/multi-hour load | Not exercised | Open |

Retained initial artifacts:

- `results/browser.json`, `player-a.png`, `player-b.png` and
  `generic-action-ui.txt`: real browser success, including the slow cold
  acknowledgement (1,358 ms). This is not a latency pass.
- `results/protocol-before.json`: all functional/security/restart checks passed;
  the final latency assertion failed. The full distribution is retained.

Final artifacts are `results/browser-final.json`, `player-{a,b}-final.png`,
`protocol-final.json` and `replay.json`. The final browser run reused the two
independently issued protocol identities; it passed the same keyboard/menu/
reload workflow with no console or WebGL errors. Its single cold input-to-view
measurement was **792 ms**, not a latency pass.

### Performance findings, not a closed performance gate

The initial tick repeatedly copied a 1,413-entry object table for each state
change. Pure `apply` now clones each touched table once per batch, with
old-implementation equivalence, frozen-input and copy-count tests. Drift
arithmetic, effects and cadence are unchanged.

Views use the existing `shownOf` surface vocabulary, excluding hidden material
properties. Quiet ticks may suppress identical views, with a heartbeat at least
every two scheduled ticks; receipts and meaningful presentation changes still
publish. Whole-percent meters match the existing HUD. Common element looks,
forms and baselines are transmitted once and expanded for rendering without
re-resolving simulation.

All attempted live distributions are retained:

| Build | Protocol p95 |
| --- | ---: |
| Original | 1,453.761 ms |
| Batched apply and visible surface projection | 261.951 ms |
| Quiet presentation suppression | 266.973 ms |
| Deduplicated element presentation | 280.780 ms |

The last three results do not establish a statistically significant ordering.
No budget was raised and no successful rerun was selected to hide failures.
The current full-snapshot publication path remains too heavy for the declared
gate. Next work should measure transaction/publication costs separately and
reduce redundant snapshot storage/transmission without weakening caller
isolation or receipt identity.

### Actual archive replay and cost

The retained report hashes a **935,804,159-byte** local archive: one initial
snapshot, eight admissions, 105 physical commands and 2,045 scheduled ticks.
It applies recorded effects and verifies recorded RNG/tick progression without
model calls or re-resolving actions. The private archive itself is not committed.

The first verifier attempt timed out because it applied patches one at a time.
After batching adjacent state patches, the next attempt exposed an incorrect
verifier assumption: SpacetimeDB reserves auto-increment ID blocks across
restart. Physical sequence IDs therefore need only increase; **commit revisions
must be contiguous**. Both failed reports are retained alongside the corrected
verifier and regressions. No archived row was rewritten to make replay pass.

Nearly 0.94 GB for this bounded test run is an explicit **storage-cost failure
for long-running hosting**, not a scaling result. Quiet drift still produces
large effect records. Checkpointing/compaction needs its own replay and crash
verification; this slice does not silently discard those events.

Browser profiles and tokens are deliberately excluded. Identity hashes in the
protocol report are public identifiers, not authentication tokens.

## Reproduce

Start the host, publish additively, and run the archive worker as described in
[`packages/server/README.md`](../../packages/server/README.md).

```sh
pnpm check
pnpm --filter @rpg-jev/client build
node validation/shared-world/browser.mjs <chrome-executable> <NEW-scratch-directory>
node validation/shared-world/protocol.mjs <NEW-output-directory>
node validation/shared-world/replay.mjs <archive.jsonl> <NEW-report.json>
```

The browser script owns a Vite process and two disposable browser profiles.
It consumes two of the eight lifetime admission slots. Never commit the profile
directories: they contain session credentials.
After the protocol has issued test identities, add
`--reuse-protocol-identities` to a browser run to reuse those two actors instead
of consuming more slots. Never run both workflows against those identities
concurrently.

The protocol script initially consumes two more slots, then retains test tokens
only in gitignored `packages/server/.stdb/protocol-{A,B}.token` to reuse those
actors on reruns. It writes a summary even on failure. The optional
`--restart-owned-host` argument is for the validation harness's own host only:
it reads `.stdb/server.pid`, stops that process tree, restarts the same data
directory, then verifies continuity. Do not use it against a manually managed
host or an unverified/stale PID.

The replay verifier streams at most 1 GiB, 1 MiB per record and one million
events, with a 60-second bound. It requires an initial snapshot and uninterrupted
commit revisions; a complete prefix does not prove it includes the latest host
commit. Recorded hashes are integrity evidence, not issuer authentication.

The test-owned host, archive worker, Vite and Chrome processes were stopped after
verification. Their ignored persistent database/archive remain intact; the
archiver's lock was released only after confirming its process had stopped.

## What the tests do not establish

- Simulation replay is not reconstruction of private admission/receipt state.
- Command receipt tests mock transport faults; the live protocol does not prove
  every possible packet-loss/crash timing.
- Restart is an ordinary persistent database restart, not disaster recovery
  after permanent disk loss or a same-generation rollback.
- The archive's fsync-before-ack ordering is tested, not a cross-file/directory
  power-loss transaction.
- Eight admissions are a bound, not an eight-player load certification. There
  is no account recovery or automatic release of an abandoned actor.
- Other worlds cannot join this world's commit authority. Nothing here
  implements character travel or trust between operators.

The linked external living SPEC document remains unsynchronized: no authorized
document-editing integration was available in this run.
