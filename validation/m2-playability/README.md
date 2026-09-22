# M2 investigation affordance and truthful endings

**Historical inn slice:** the owner has since moved the active M2 target to the
browser open world (SPEC §16). The evidence below remains valid for the inn, but
its human playtest is no longer a prerequisite for open-world development.

**M2 remains unaccepted pending human playability feedback.** This change closes
specific investigation and presentation defects, not the sovereign-world roadmap.
See [the playtest](PLAYTEST.md) for the next required evidence.

## What changed

- The journal exposes stable, player-local note numbers, assigned in first
  acquisition order. Confidence changes, new accounts and replay do not retarget
  an existing number. Closed accounts reserve their numbers; reacquiring the
  same claim reuses its original number.
- `tell <present person> about note <number>` and
  `ask <present person> about note <number>` resolve only current player beliefs.
  Invalid references fail without a model call or advancing time. Successful
  conversation uses the existing social decisions and scheduler; it costs
  ordinary conversation time and can be disbelieved.
- Asking is not asserting: questions use the question reply pool and do not turn
  their topic into a witnessed/reportable deed for bystanders. Narration uses
  the player's perspective.
- Endings no longer invent dialogue, movement, service or handovers. The
  [ending audit](../m2/ENDINGS.md) describes the custody-based, explicitly
  out-of-scene epilogues and their limitations.

No effect kind, Jev family, provider, content version, host package, live author,
transport or portability mechanism was added.

The actual CLI also now exits naturally after closing readline, rather than
forcing `process.exit(0)` while I/O handles are still being cleaned up.

## Alternatives and boundaries

Numbering the confidence-sorted list would silently retarget commands when a
belief changed. Parsing arbitrary clue prose would reintroduce inference and
ambiguity. The local first-acquisition projection provides a small deterministic
interface over already earned structured claims.

This inn retains all belief edges. A future archival/migration implementation
must preserve the reference mapping; this is not an archival design or a portable
character format. Sightings and overheard speech still have the previously
documented acquisition limitations; note commands do not invent missing beliefs.

Semantic quest resolution may still occur offstage. A truthful epilogue fixes
false staging, not the possible desire for a playable final conversation. That
is a question for the human playtest, not proof that the inn is fun.

## Verification protocol

Declared before running: Windows, Node 25.8.2, current pnpm workspace, pinned
`jev-1.13.0`; 90-second bound per CLI process, at most 40 live decisions and
$0.01 measured input-token cost for this short workflow. These are workflow
budgets, not hosted latency or player-hour performance claims.
Decision and cost limits are checked after the run, not enforced as hard spending
caps; the subprocess timeout is the runtime bound.

`run.mjs` drives the real terminal in a disposable save:

1. Begin the scheduled-supper night, eat, explore and earn evidence.
2. Save/quit, resume, tell and ask about the numbered account.
3. Save/quit again, then resume offline and compare the full world and journal.

Output directories are exclusive. Failed attempts are not overwritten or counted
as passes. Text transcripts normalize trailing blank lines; saved JSONL bytes
are preserved. Logs retain the input's deterministic `via: "parsed"` and structured
claim reference. Provider acceptance of the claim is not an assertion in the
workflow.

The first live attempt crashed with Windows exit `0xC0000409`. Its initial
harness lost the child output and disposable save, so its provider usage is
unknown and **no live gameplay result is claimed for that attempt**. The failure
is recorded in `live/failure.json`; failure capture was corrected before any
diagnostic retry.

## Evidence and recovered failures

- The actual offline CLI workflow passed with eight fallback decisions and no
  provider calls; its full world and journal matched after resume.
- The diagnostic retry also failed, but retained a complete discovery save and
  stderr: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` from libuv's
  Windows async-handle cleanup. It had printed “Saved” before the native crash.
- Removing the CLI's forced `process.exit(0)` allowed a live continuation to
  exit normally. `live-recovered/` uses the failed discovery save byte-for-byte:
  it does not rerun or replace those provider decisions.
- The complete recovered workflow contains **7 live decisions, 7,507 input
  tokens, zero fallbacks and $0.000315294 list-price input-token cost**. The
  total includes discovery decisions retained from the failed process; it does
  not include the first attempt whose output was lost. It passes the declared
  40-decision/$0.01 workflow budgets. Mara refused the asserted account; that
  result was retained, not rerolled.
- A new subprocess test verifies natural event-loop shutdown after saving.
  Five artifact tests restore the actual offline/live saves without a judge,
  validate both recorded note commands against the player state at that time,
  and verify that recovery retained the failed process's exact log prefix.
- Independent review found no blocking correctness, privacy, replay or scope
  issue. The observed successful live shutdown plus offline drainage regression
  are evidence for this fix, not a guarantee that every native runtime failure
  is eliminated. Recovery checks the exact discovery input sequence and version;
  it is a local validation workflow, not an untrusted-save import protocol.
- There are 27 note-conversation tests, 47 ending regressions and six complete
  historical-night replay tests. Final combined check results are recorded below.

### Delta checkout recovery

Delta temporarily refused workspace commands with “the requested worktree
version was not materialized because the checkout kept changing.” Its local
log reported `UntrackedDirectory` for generated validation folders. A diagnostic
shell outside the materialization step could access this same managed checkout;
staging only the intended evidence files restored ordinary workspace commands.
No edits were discarded, no process was killed, and the primary checkout was
not changed. Generated evidence directories are now staged promptly after a run.

This recovery is distinct from the native Node shutdown fix. Neither failure
was a gameplay pass, and the first native failure's usage remains unknown.

### Final combined verification

`pnpm check` passed lint and all typechecks, **80 Vitest files / 1,429 passing
tests**, 331 pre-existing expected failures, 26 food/session Node tests and
43 thermal/terminal Node tests. The expected-failure inventory is existing
physical-model coverage, not a claim that those cases now work.

Reproduce with new output directories:

```sh
node validation/m2-playability/run.mjs offline saves/m2-playability-offline
node --env-file=H:/rpg-jev/.env validation/m2-playability/run.mjs live saves/m2-playability-live
node --env-file=H:/rpg-jev/.env validation/m2-playability/run.mjs live saves/m2-playability-recovered validation/m2-playability/live-retry
pnpm check
```

Offline scripted tests and recorded-provider replay are not cold human playtests.
External living-SPEC synchronization remains outstanding.
