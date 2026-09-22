# State-grounded ending presentation

The earlier witness transcript ends just after the innkeeper leaves for the cellar,
then stages speech and brandy across the bar. The evidence transcript narrates a
ledger handover while the saved world still assigns it to the player. Both are
instances of the same defect: terminal prose inventing scene actions from a quest
outcome.

## Decision

Two shapes were considered:

- Gate resolution on co-location and perform a staged handover. This would change
  agenda timing, available decisions and player agency, and require new route
  recordings. It would also couple a belief guard to unrelated physical acts.
- Keep belief resolution and render a clearly marked, out-of-character epilogue
  about resulting state. This keeps the simulation honest without manufacturing
  actions or requiring the player to attend an NPC's change of mind.

The second is implemented for every terminal outcome. All epilogues explicitly say
they are world-state summaries, not what the character has seen or heard. They do
not create speech, player knowledge, journal claims, transfers, movement, paid beds
or promises. Successful outcomes share one custody selector, using the existing
tracked-item owner data and current item location rather than the historical
`ledger_fate` flag. Neither player nor owner holding the item does not mean it is
lost or destroyed.

## Offline evidence

`packages/inn/test/endings.test.ts` covers both success states across three NPC
locations and six custody states (player, owner, another person, container, room,
ashes), stale return flags, actual custody without a return flag, all nine
epilogue variants, unchanged state/logs and replay, and the midnight boundary.

`packages/inn/test/m2-nights.test.ts` re-drives the evidence, witness and denial
routes in both historic collections. They use the same recorded requests with
zero misses and land on the same worlds as saved-effect replay. The witness
innkeeper remains offstage, and the evidence ledger remains player-held, with
honest summaries of both.

Run `pnpm check`; all validation is offline. No question wording, slices, content
state, effect kinds or family count changed. Historical recordings and JSONL logs
remain valid and untouched. Their text transcripts remain historical evidence of
the original defect; current presentation is covered by assertions, not rewritten
as if it had originally been recorded that way. New provider recordings are not
required for this presentation-only change.

## Limits

This fixes false staging, not cold-player agency, pacing or fun. Resolution can
still end a night offstage; it does not wait for the player to hear the verdict or
permit a final handover after the terminal outcome. A satisfying playable climax
needs separate human design and acceptance. Existing quest guards and authored
voices remain those of this inn; this is not a general quest-role refactor.
The external living SPEC document has not been synchronized from this offline task.
