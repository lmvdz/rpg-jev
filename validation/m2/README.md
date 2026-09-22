# M2 acceptance audit and complete live nights

**M2 is not accepted.** This audit is not another claim that a utility closes the
milestone. It identifies an unimplemented acceptance requirement and records
complete playthroughs of the existing investigation before further gameplay work.

**Follow-through:** the owner subsequently approved the person-ratified boundary.
That proposal requirement is now implemented and verified in the
[handwritten-proposal slice](../m2-proposals/README.md). The `before/` collection
and original decision analysis below are retained as historical evidence.

## Current gate inventory

| M2 requirement | Actual status |
| --- | --- |
| World bible | Implemented in `docs/world-bible.md` |
| Core effects, decisions, RNG, replay | Implemented; existing core/inn suites and recorded-night replay |
| Two-stage parser and scoped clarification | Implemented; parser/game/recorded-demo tests |
| Three NPC minds and schedules | Implemented; content, dispositions and scheduled consequences |
| Eight question families | Implemented and frozen; family tests and historical live probes |
| Semantic quest guard | Implemented; live evidence and witness routes below reach resolution |
| Debts, rumors and distorted/stale claims | Implemented; causal/game tests and recorded demo |
| Conversation scheduler and combat stub | Implemented; timing/game tests and recorded combat coda |
| Judge outage and save/resume | Implemented; offline tests and previous real CLI validation |
| **Handwritten proposals** | **Implemented after this audit.** See `validation/m2-proposals/README.md`; the prior deferral is superseded by the owner's approval |
| **Worth playing** | **Unaccepted.** Automated routes are not a cold human playtest |

## Complete live nights

The retained `before/` collection runs the existing evidence, witness and denial
routes on seed 1, then waits for an ending where necessary. It does not reroll
outcomes or pool answers across nights.

Declared environment/bounds: Windows, Node 25.8.2, `jev-1.13.0`; at most 160 live
requests in this collection, no SDK retries; compare cost against the existing
$0.25/player-hour estimate using its 360-actions/hour convention. No renderer or
hosting performance gate is claimed.

| Route | Ending | Actions | Live calls | Input tokens | Cost |
| --- | --- | ---: | ---: | ---: | ---: |
| Evidence | Resolved, 19:29 | 13 | 14 | 17,578 | $0.000738276 |
| Witness | Resolved, 19:49 | 11 | 22 | 26,738 | $0.001122996 |
| Denial without evidence | Condemned, 23:32 | 10 | 29 | 38,282 | $0.001607844 |

All three ended, with **zero fallbacks and zero unparsed commands**. Total:
65 calls, 82,598 tokens, $0.003469116. The extrapolated costs are approximately
$0.0204, $0.0368 and $0.0579/player-hour respectively, below the stated estimate.
Those are extrapolations from fixed scripts, not measured human player-hours or
proof of route reliability across seeds.

Each directory contains the transcript, complete event log, metrics and its own
request-keyed model recordings. `packages/inn/test/m2-nights.test.ts` replays all
three complete nights offline and compares the result with their saved worlds.

Final `pnpm check` passed lint, typechecks, 1,294 Vitest tests (plus 331 existing
expected failures), 26 food/session tests and 43 thermal tests. An earlier check
hit the previously observed Windows `EPERM` in the unchanged thermal save test;
the subsequent complete check passed. That intermittent failure is not claimed
fixed. No provider call is made by the three new complete-night replay tests.

The transcripts reproduce known playability weaknesses: the witness route needs
repeated questions and its climax occurs while the innkeeper is elsewhere.
Ending narration also describes handling the ledger without a corresponding
terminal transfer in the evidence-route save. These are open findings, not fixed
by the prior journal or save work.

## Historical decision that blocked handwritten proposals

SPEC §16 requires handwritten proposals, §10 specifies proposals with effects,
hard preconditions and fuses, and §14 freezes M2 to eight question families.
None of those families ratifies author canon, plausibility or soft freshness.
The later improvement-loop design says proposals are read by a person while
those ratification families remain unavailable.

**M2 boundary recommended here and subsequently approved:** proposals are person-approved,
checked-in content. Code validates the structured form and existing effect
vocabulary, records admission, schedules through one generic debt handler,
re-checks hard preconditions at execution, and logs acceptance or rejection for
inference-free replay. Prose remains display-only. This adds no generative worker,
question family, executable mod loading, hosted author service or federation.

The alternative is to explicitly defer this requirement to M3 by changing the
acceptance gate. Automatic Jev ratification requires separately approved families
and cannot honestly be slipped into one of the existing eight. Merely applying
a file at startup would not demonstrate the required fuse/revalidation path and
is not a substitute for this gate.

The implementation and its new evidence are in `validation/m2-proposals/README.md`.
The remaining work is player-facing blockers and human acceptance—not M3.

## Reproduce

```sh
pnpm exec vitest run packages/inn/test/m2-nights.test.ts
node --env-file=H:/rpg-jev/.env validation/m2/run.mjs saves/m2-new-live-collection
pnpm check
```

The live runner requires a new output directory and makes paid provider calls.
The tests use only committed recordings. No key is included in the artifacts.
External living-document synchronization remains outstanding.
