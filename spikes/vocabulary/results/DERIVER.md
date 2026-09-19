# Instructions for a derivability runner

`packages/core/src/matter` turns the closed vocabulary (`spikes/vocabulary/VOCABULARY.md`) into pure rules. Your job is to run one file of scenarios through it and report honestly what the rules produce. You are testing the rules, not making tests pass.

## Read first

1. `spikes/vocabulary/VOCABULARY.md` (version 1), sections 0 to 7.
2. Every file in `packages/core/src/matter/` (about 1,300 lines). The entry point is `resolve(world, act)` in `resolve.ts`; `play(world, acts)` runs several.
3. `packages/core/test/matter/elements.ts`, `examples.test.ts` and `batch-a.test.ts`: the idiom, the shared rows, and which scenarios are already covered (skip those ids).
4. Your scenario file.

## Hard rules

- **Do not edit anything in `packages/core/src/`**, nor `elements.ts`, `examples.test.ts` or `batch-a.test.ts`, nor any file another runner owns. You write exactly three files (named below).
- **Rows are written once, from the vocabulary's anchors, before you run anything.** A row describes what the thing is like (levels 0 to 5). You may correct a row only if it contradicts an anchor, never to make a test pass. If an outcome only derives with an implausible row, that is a finding, not a fix.
- **A test asserts what the scenario's `outcome` says a sensible person expects**, as a direction or a threshold with some slack, not an exact number.
- The lint is strict: no `any`, no non-null assertions (`!`), nothing unused, no nested ternaries, `.ts` extensions in relative imports. Use optional chaining as the existing tests do.

## Classify every scenario in your file (except those already covered)

- `derives`: the rules produce the outcome. Write `it(...)`.
- `partly`: the rules produce part of it. Write `it(...)` for what derives and `it.fails(...)` for what does not, with the reason in the test name in brackets.
- `rule_error`: the engine is in reach of the scenario and produces a WRONG outcome (not a missing one): something happens that should not, or the direction is wrong, or a magnitude is absurd. Write `it.fails(...)` whose name starts with `RULE ERROR:` and says what the engine did instead. These are the most valuable thing you can find.
- `unbuilt`: the outcome turns on a mechanism the engine does not have (move, give, tell, sensing, creature choices, groups, growth, contents and pressure, places changing, bodies' modifier rules). Do NOT write a test. Record it in the report with the mechanisms it needs.

`it.fails` passes while the assertion fails and turns red when the rules can produce the outcome. Never use it to hide a test you wrote wrongly: if you are unsure whether your encoding or the engine is at fault, say so in the report.

## Your three files (replace NAME with your file's name, e.g. `fire-cold`)

1. `packages/core/test/matter/rows-NAME.ts`: `export const EXTRA: Extra = { elements: [...], places: [...] }` with any rows and places your scenarios need beyond the shared ones (import `Extra` and `placeRow` from `./elements.ts`). Reuse shared rows where they fit.
2. `packages/core/test/matter/a-NAME.test.ts`: the tests. Build worlds with `world(things, bodies, EXTRA)`.
3. `spikes/vocabulary/results/derive/NAME.json`: a JSON array, one object per scenario in your file including the already-covered ones (mark those `"status": "covered"`):
   `{ "id", "status": "derives|partly|rule_error|unbuilt|covered", "needs": ["mechanisms or rules it is missing"], "note": "one or two sentences: what the engine did, and for rule_error exactly which rule in which file is wrong and what the general rule should be" }`

## Before you finish

- `pnpm exec biome check --write packages/core/test/matter/rows-NAME.ts packages/core/test/matter/a-NAME.test.ts` must end clean.
- `pnpm exec vitest run packages/core/test/matter/a-NAME.test.ts` must pass (with expected fails).
- `pnpm exec tsc --noEmit -p packages/core/tsconfig.json` must pass for your files (other runners' files may be mid-edit; ignore errors that are not in yours).
- Verify the JSON parses.

Report back only: counts by status, and each rule error in one line (scenario, which rule, what it did, what the general rule should be).


## Held-out run (batch B), rules frozen at `ea6a1630b5cc`

This run measures the rules; it does not improve them. The engine was fitted to batch A and **nobody will change it during or because of your run until every runner has reported**. So:

- There are no already-covered scenarios in your file. Classify all of them.
- File names use your batch letter: `rows-b-NAME.ts`, `b-NAME.test.ts`, and `spikes/vocabulary/results/derive/b-NAME.json`.
- Read `a-*.test.ts` and `rows-*.ts` only for idiom and for shared rows worth reusing. Do not copy their thresholds.
- The engine's API has grown since the first instructions were written. Things to know before encoding: a force act takes an `aim` (`through`, `along`, `surface`); `contact` in a heat act sets the balance a thing tends to, not only the rate; wetness carries `wetWith` (null is water); an element may carry `moist`, and the test helper `world()` gives a thing its element's moisture at birth when you leave `wetness` at 0 (say `wetness: 0.05` if you mean dried); `search` yields a count in one thing's `amount`, and `searchYield` is exported beside `searchOdds`; a body may carry `tolerates`.
- Be especially careful to separate **your encoding** from **the engine**. When an outcome fails to derive, print the engine's numbers before deciding why, and say in the report which assertions you changed after a first run and why.
- In the JSON, add a field `"confidence": "high|medium|low"` for how sure you are that the status is about the engine and not about your encoding.

## Held-out run (batch C), rules frozen at `8e309bdcc284` (a content hash of `packages/core/src/matter/*.ts`, not a git commit; git was `701600d`)

Batch C has never been run through the engine, and the vocabulary's author has read it only through checker verdicts. The engine has changed a great deal since batch B (twelve property tests now hold four invariants), and **nobody will change it during or because of your run until every runner has reported**. Everything in the batch B section applies, with these differences:

- The repository for this run is the worktree `H:
pg-jev.worktrees\sandbox-matter`. Work only there. Do not touch `H:
pg-jev`.
- File names: `rows-c-NAME.ts`, `c-NAME.test.ts`, `spikes/vocabulary/results/derive/c-NAME.json`.
- What the engine does now that it did not when the first instructions were written, so that you encode against what is there: heat is an exchange between quantities (mass level times `amount` on both sides; the source cools unless it is burning; what burns gives by its size and only while its fuel lasts); only a burning or glowing source can light a thing; a fire goes out when what burns is too wet, or has no air, and what had not burned is still there; what flows freezes at the bottom of the temperature scale; nothing dries below what its place keeps in it; `surfaceAbove` carries a surface's lead over the bulk; a broken-off piece takes its amount out of its parent; a collision falls on both things; every number an act carries is brought into range at the entry point; a drift is reported once, as one change per thing that is different (with `quiet` when nobody would notice); a place may carry `extent`; `alight(world, thing)` sets fuel burning; `blaze(world, thing)` says how hard a thing burns; a fire is burning fuel, there is no fire element in `POOL` (the test helper `elements.ts` still has a `fire` row with no flammability: it works as a heat source in a `heat` act and goes out in a `drift`, so build a hearth from fuel with `alight` when time must pass).
- Read `invariants.test.ts` before writing anything: if a scenario's outcome contradicts an invariant, that is a finding about the scenario or about the invariant, and it goes in the report as such, not as a rule error.
