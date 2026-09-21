# M2 slice: preserve local inn saves

## Outcome and scope

On `feat/sovereign-worlds-m2`, based on `implementation/shared-food` at
`3471f17`, the terminal inn preserves earlier nights when starting over and
does not truncate the last successful save while writing its successor.

This is a bounded M2 persistence correction. It changes neither gameplay,
content versions, Jev questions nor the event-log format. It adds no hosting,
multiplayer, portability, authoring or executable-mod machinery. The thermal
bench's separate lock/pending-file protocol and browser storage are unchanged.
**The inn's fun gate is still open.**

## Reproduced failure

Before the change, `openSession({ fresh: true })` renamed the active save to a
filename derived only from its modification timestamp. A later restart with
the same timestamp silently replaced that archive on Windows.

Reproduction: save seed 1; set the save's timestamps to 1,000 seconds after the
epoch; restart and save seed 2; set the same timestamps; restart and save seed 3.
Only seed 2's archive and seed 3's active save remained. Seed 1 was lost.

Opening a fresh session also moved the active save before the new session had
successfully saved anything. The initial regression run failed both preservation
tests; the existing save/resume comparison passed (two failures, one pass).

## Chosen boundary

The smallest collision-only fix would check whether a timestamp filename exists.
That still leaves a check/create race and the old destructive write path.
Instead, the terminal filesystem boundary owns the whole publication:

1. Serialize the existing event log and write a private, exclusively created
   sibling temporary file.
2. Flush and close that file before publishing it.
3. On the first successful save after `--new`, copy the predecessor to an archive
   using exclusive creation. Timestamp collisions receive numeric suffixes;
   existing archives are never replaced.
4. Rename the complete staged file over the active save.
5. Clean up the owned temporary file on normal completion or a caught failure.
   Propagate failures; do not claim the save succeeded.

Opening a session alone does not move its predecessor. A failed archive blocks
replacement. Failed writes, flushes or replacements leave the active save's bytes
unchanged. Retrying is allowed; a replacement failure after archival can leave an
extra identical archive, rather than risking loss or deleting evidence.

## Acceptance evidence

Declared environment: local Windows filesystem, Node `25.8.2`, pnpm `11.15.1`;
offline inn play. This slice has no throughput or latency claim. Subprocess
probes have a 10-second termination bound; the ordinary Vitest timeout is
unchanged.

| Criterion | Result and evidence |
| --- | --- |
| Timestamp collisions preserve every night | Passed: three saves with the same timestamp retain all three byte-exact logs |
| Opening `--new` alone preserves the active save | Passed: no filesystem publication until `save()` |
| Regular saves do not repeatedly archive | Passed: one archive per successful restart, subsequent saves replace only the active log |
| Resume restores state without inference | Passed: world and log equality; zero metered calls during restore |
| Corrupt saves are not silently replaced | Passed: resume throws and original bytes remain unchanged |
| Failed publication preserves last successful save | Passed: injected partial write, flush, archive and rename errors; replay of predecessor and successful retry |
| Real terminal workflow | Passed: actual `play.ts --offline --plain --fast` subprocesses move, quit, resume and restart, with preserved archived bytes |
| Existing recorded gameplay | Passed in `pnpm check`; no new provider recording required because content and questions are unchanged |
| Integrated browser remains operable | Passed: existing Chrome food-mode CDP workflow, described below |

Reproduce the focused tests and full gate:

```sh
pnpm exec vitest run packages/terminal/test/session.test.ts
pnpm check
git diff --check
```

The focused suite has 13 tests, including real filesystem work and three CLI
processes. Fault tests inject filesystem exceptions; they are **not** measured
power cuts or OS crash tests.

The full check passed lint, recursive typechecking, 73 Vitest files with **1,267
passing tests and 331 existing expected failures**, plus **26 food/session and
43 thermal Node tests**. Expected failures represent existing bounded simulation
coverage, not new passing capabilities. An earlier concurrently loaded check hit
the runner's default five-second timeout on the CLI test; a standalone full check
passed without changing any timeout or weakening a test.

### Browser baseline exercise

An independent verification ran the existing harness with installed Google
Chrome, Vite `8.3.0`, loopback only and a disposable browser profile:

```sh
node validation/integration/browser-smoke.mjs . \
  "C:\Program Files\Google\Chrome\Application\chrome.exe" \
  "<scratch-output-directory>" food
```

Actual keyboard and menu actions moved, took, carried and dropped finite food.
Starting with five portions, the workflow supplied two at camp, saved at tick
21, reloaded the page and compared the entire projected state. The satiated
creature contrast retained all five portions after three waits. Browser runtime
errors were empty; WebGL error was zero. Owned browser/server processes were
stopped. Scratch evidence is ephemeral; the harness is the reproducible record.

This is automated browser operability, **not a human playtest**, hosted
persistence or multiplayer evidence. No live model calls or new provider
measurements were made in this slice.

## Limits and handoff

- One local writer per save path remains an assumption. Separate inn processes
  using the same path are not coordinated; this is not the future world host.
- Atomic replacement was exercised on this local Windows filesystem, not Linux,
  network filesystems or removable media.
- Flushing the staged file is not a promise of full power-loss durability.
  Directory metadata and archive durability across a machine crash were not
  measured. An abruptly killed process may leave a `.tmp` file; it is not loaded
  as the active save and does not block a later save.
- This retains the existing log format and replay validation. It does not make
  arbitrary imported saves trustworthy or repair corrupt logs.
- The sovereign-world plan is now SPEC section 23 because sections 20–22 already
  describe integrated work. Visitor mode, custody, trust and transport choices
  remain gated, not implicitly approved.
- External living Claude Doc synchronization is outstanding.

**Next eligible task:** run a cold human playtest of the inn, record a concrete
player-facing failure and fix one general class of that failure. Decide whether
the inn is worth building on before starting M3. Do not treat local food/thermal
sessions or this save fix as satisfying M5 or the independent-hosting gates.
