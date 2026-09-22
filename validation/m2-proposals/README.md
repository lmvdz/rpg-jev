# M2 handwritten proposals: admission → consequence → replay

**The approved handwritten-proposal requirement is implemented. M2's overall
human playability gate remains open.**

## What works

```sh
pnpm play --new --handwritten --save=supper
```

The staff initially hold the bread, onion and tankard. Three checked-in proposals
use the same typed `set-out-item-1` template in two rooms, at minutes 3, 4 and 6.
You start hungry. Wait for the bread, take it and eat it: the proposal changed
the actual item location, and eating consumes it and reduces hunger.

Quit while events are pending; `pnpm play --save=supper` restores the versioned
world and queue without reading the current proposal source again. Expired,
cancelled or stale proposals do not produce the advertised effects or prose.
Changing the serving NPC's location before execution invalidates the scope and hard
preconditions rather than serving food remotely.

The default night remains unchanged. The new initial state is explicitly
`gilded-carp-1+handwritten-1`; `gilded-carp-1` saves and existing recorded demos
still load and replay. Unknown content versions fail rather than being guessed.

## Boundaries and failure rules

- **Source authority:** trusted checked-in code fills the template and supplies
  scope context. No player command, JSON `approved` field, generated prose or
  downloaded file can grant approval. There is no runtime file-import endpoint.
- **Pure core:** schema validation, scope/precondition checks, sequential batch
  preview, admission and settlement contain no I/O, wall-clock reads, RNG draws
  or model calls.
  Slots are filled entity bindings, not a string interpolation language.
- **Bounds:** version 1; at most 16 slots, effects and hard preconditions; bounded
  IDs, nested structures and prose. Unknown fields, effect/precondition kinds,
  versions and invalid references are rejected explicitly.
- **Scheduling:** one `proposal` debt kind uses the existing ledger and ordering.
  Long waits stop at pending proposal deadlines. Already-due proposals are drained
  before advancing, including a resumed boundary save. No second scheduler.
- **No partial validated batch:** preview applies dependent effects in sequence
  to an isolated copy; a failing later effect leaves the real world untouched.
  Successful synchronous execution uses the normal Store commit path.
- **Identity:** successful admission reserves `proposal:<id>` with a payload and
  context fingerprint. Identical retries before/after settlement are duplicates;
  changed payloads using the reserved ID are rejected. Rejected initial candidates
  are logged but do not reserve an admission.
- **Audit:** the admitted filled payload is saved in the debt; existing stimulus,
  dropped and effect entries record admission, execution, cancellation and causes.
  Cancellation is explicit. Replay applies logged facts and never re-asks a model.
- **Restricted mechanics:** proposals cannot advance the clock, create/settle
  debts recursively, or forge thermal settlement. These kinds fail visibly.
  Other existing effects still require normal engine validation.
- **Presentation:** only a newly fired event returns prose; the inn shows it only
  to a player in the event's room and removes terminal control characters. Text
  is not interpreted as an action, policy or model instruction.

This is not an arbitrary-untrusted-effect sandbox. Typed slots are scope-checked;
trusted code owns their correspondence to effect targets. Preview is synchronous
all-or-nothing validation, not a distributed transaction or power-loss guarantee.
The live author, automatic ratification families, networking and owner mod loading
remain unimplemented and separately gated.

## Evidence

Declared environment: Windows, Node 25.8.2. The CLI harness fixes its command
sequence before running and bounds each child process at 90 seconds. Acceptance
is exact execution minutes, unchanged replay, no duplicate admission/effects and
scope-safe output—not a throughput claim. Full-night measurements retain the
existing 160-call collection cap and $0.25/player-hour comparison convention.

| Workflow | Result |
| --- | --- |
| Offline real CLI | Three proposals persisted pending across exit, fired once at exact due minutes after resume, then remained settled after another exit/load |
| Live real CLI | Same workflow passed; one ordinary Jev dialogue decision, 835 tokens, zero fallbacks; proposal execution itself does not invoke Jev |
| Physical consequence | Served bread becomes reachable, can be taken and consumed, and reduces actual hunger |
| Knowledge boundary | Kitchen event committed while the player was elsewhere but its prose was not displayed |
| Full live evidence route with proposals | Resolved at 19:29; 13 calls, 16,569 tokens, zero fallbacks |
| Full live witness route with proposals | Resolved at 19:49; 22 calls, 26,738 tokens, zero fallbacks |
| Full live denial route with proposals | Condemned at 23:32; 29 calls, 38,106 tokens, zero fallbacks |
| Offline regression | 41 core lifecycle cases, 11 inn integration cases, plus three additional complete recorded-night replays |

The full-night cost is $0.003419346 across 64 calls and 81,413 tokens. At the
existing 360-actions/hour convention, each route extrapolates below
$0.25/player-hour. These are fixed-script observations, not human player-hours
or broad success-rate measurements. Results were retained, not rerolled.

`offline/` and `live/` contain pending/completed JSONL saves, CLI transcripts and
summaries. `nights/` contains complete live nights with request-keyed recordings;
the suite replays both these and the original standard nights offline. No keys
or credentials are stored in evidence.

Independent review found that due-now proposals could expire before a ledger
attempt. The fix drains ready work before advancing; immediate zero-width-window
and resumed-boundary regressions now pass.

Final `pnpm check` passed lint and typechecks, **1,349 Vitest passes with 331
existing expected failures**, plus **26 food/session and 43 thermal Node tests**.
The expected failures remain recorded simulation-coverage limits, not passing
capabilities added by this slice.

## Reproduce

From the worktree, use new output directories (existing evidence is not overwritten):

```sh
pnpm exec vitest run packages/core/test/proposals.test.ts packages/inn/test/proposals.test.ts packages/inn/test/m2-nights.test.ts
node validation/m2-proposals/run.mjs offline saves/proposal-offline-check
node --env-file=H:/rpg-jev/.env validation/m2-proposals/run.mjs live saves/proposal-live-check
node --env-file=H:/rpg-jev/.env validation/m2/run.mjs saves/proposal-nights-check handwritten
pnpm check
```

The `.env` path above is the owner-authorized location on this machine; use your
own process environment elsewhere. The tests need no key. Live commands do.
External Claude Doc synchronization remains outstanding.

## Next eligible work

The handwritten-proposal decision and implementation gap are no longer blockers.
Do not start M3 on that fact alone: the inn's human playability acceptance remains
open, alongside the already recorded offstage-climax and ending-narration issues.
