# M2: recall earned evidence while playing

## Player outcome

Type **`journal`**, **`notes`** or **`leads`** to review the clues and accounts
your character has learned. Help now teaches the inspect → recall → show/discuss
loop. Sources and belief strength remain visible: a cook's accusation is not
silently presented as confirmed truth.

Before this change, `journal` fell into semantic parsing and failed during an
outage. Inventory showed possessions, not learned evidence. The only cause
viewer was the explicitly omniscient `why <npc>` debugger.

The implementation is a view of existing player beliefs, rather than a new
quest tracker, transcript summarizer or second knowledge store. Existing
read-only commands share a table of zero-time handlers. No question family,
content version, save format or effect kind changed.

## Acceptance and environment

Declared workflow: Windows, Node 25.8.2, fixed seed 1, 13 CLI inputs, with each
subprocess bounded at 90 seconds. Journal acceptance is **zero model calls,
zero world effects and exact world/RNG/time equality**, not a latency percentile.
No renderer, hosting or world-capacity performance claim is made.

The gameplay sequence examines the gambling markers, finds the ledger and
examines its wrapping, checking the journal as knowledge grows. It then quits
and resumes **offline**, checking the same journal and complete world state.

| Evidence | Result |
| --- | --- |
| Offline CLI workflow | Passed; 7 gameplay fallback decisions, no provider calls |
| Live CLI workflow, `jev-1.13.0` | Passed; 5 Jev decisions, 5,612 input tokens, zero fallbacks |
| Journal reads during each workflow | Three; no decisions or effects between the input and next command |
| Quit, JSONL replay and offline CLI resume | Equal journal and world |
| Live usage at the documented list price | $0.000235704; usage observation, not a performance/cost benchmark |
| Existing recorded demo | Remains valid; no re-inference or re-recording needed for unchanged game decisions |

`live/` and `offline/` contain the complete gameplay logs (including decisions
and RNG), transcripts, journal output and machine-readable summaries. The live
result is one retained run, not a selected success after rerolling.
Credentials were loaded into the subprocess environment from the owner-provided
file; no credential is copied into the repository or evidence.

Unit regressions cover deterministic aliases; actual examination and scripted
whereabouts testimony; source distinctions; current and rejected beliefs; stale
locations; private-state/rumor-lineage twins; no time/RNG/effect/inference;
save/resume; and the existing read-only commands.

Final `pnpm check` passed lint, typechecks, **1,291 Vitest passes and 331 existing
expected failures**, plus **26 food/session and 43 thermal Node tests**. The
journal adds 24 passing regressions; existing expected failures are not new
passing simulation capabilities. Independent review found no blocker within
the stored-player-knowledge scope.

An earlier full check passed the Vitest and food suites but hit `EPERM` during
replacement of a temporary save in the unchanged thermal CLI test. That test
then passed standalone, followed by the full check above. No test was skipped,
timeout raised or thermal code changed; the transient Windows rename failure
was not explained or claimed fixed by this feature.

## Reproduce

From the repository root, choose **new output directories**; the runner refuses
to overwrite evidence:

```sh
pnpm exec vitest run packages/inn/test/journal.test.ts packages/inn/test/recorded.test.ts
node validation/inn-journal/run.mjs offline saves/journal-offline-check
node --env-file=H:/rpg-jev/.env validation/inn-journal/run.mjs live saves/journal-live-check
pnpm check
```

For ordinary play on this machine:

```sh
node --env-file=H:/rpg-jev/.env packages/terminal/src/play.ts --new --save=journal-playtest
```

## Limits and next gate

This is **automated gameplay evidence, not a human fun verdict**. M2 remains open.
The next acceptance activity is a cold human playtest: can a player use evidence
and testimony to choose their next action without the debugger or a route script?

The journal recalls existing player-held claims. It does not newly record every
visible event: personal sightings and overheard NPC-to-NPC speech have existing
acquisition gaps. Location accounts addressed to the player do enter the journal.
The stored source is retained when later evidence raises credence; this is not a
complete provenance history. Reading the journal does not repair these by
consulting hidden truth. All location accounts retain their own times; the list
is ordered by belief strength, not a claim that every account is the newest.

The terminal is the existing M2 surface; this does not deliver a browser inn.
No author, hosting, networking or portability work was started. External living
Claude Doc synchronization remains outstanding.
