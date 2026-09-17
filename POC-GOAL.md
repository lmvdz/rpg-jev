# Goal: a playable proof of concept of the inn

This is a text-adventure TypeScript game. No lab, medical, or biological work.

You are picking up `H:\rpg-jev`, a TypeScript monorepo for an RPG whose NPCs are decided by TypeSafe's judge model (typesafe.ai; product name Jev, after Jevons — not the virus). The design is settled and one spike has run. Nothing playable exists yet. Your job is to build the first thing a person can sit down and play, and to find out whether it is any good.


## Why this matters

The whole project rests on one bet: that a small inn with three NPCs, run on typed judge calls and plain code, already feels inhabited. If it does, everything else in the spec (a persistent server, an authoring thread, a 3D glyph renderer, multiplayer) is worth building. If it does not, none of that will save it. So the proof of concept is deliberately small, and the honest answer to "is it fun, and why or why not" is as much a deliverable as the code.


## What to read first

- `SPEC.md` is the source of truth. Sections 2 (the ten project rules), 4 to 9, 13 and 14 matter most here. Section 16 defines milestones M1 and M2, which together are this goal.
- `spikes/m0-jev/FINDINGS.md` records what the judge actually does on social scenes. Design around it; do not rediscover it.
- `CLAUDE.md` has the project rules and commands.
- Use the `typesafe:typesafe-ai` skill for all judge work, and read the live docs it points to before writing a new kind of question.


## What "done" looks like

A player runs `pnpm play` in a terminal and plays a scene set in one inn, against live judge calls. All of these must be true:

1. **Free-text input works.** A deterministic matcher handles obvious commands (`go`, `take`, `look`, `talk to`). Everything else goes to the judge. An ambiguous reference ("grab the key" with two keys present) produces a question naming the candidates, not a generic "please rephrase".
2. **Three NPCs have inner state.** Each has personality tags, goals, motives, explicit beliefs as structured claims, a stance toward the player, and a four-layer schedule built only from the legal primitives in section 7. They react to incoming events, not to a clock tick.
3. **One quest has semantic guards.** The player is suspected of taking the inn's ledger. The quest advances when the judge decides that the innkeeper no longer believes it. At least three different routes must work in practice, for example real evidence, a credible witness, and exposing the real culprit, without any route being scripted as a flag.
4. **Consequences are delayed and traceable.** An action creates debts that come due later. A `why` debug command walks the cause chain for any NPC state.
5. **Gossip spreads and gets details wrong.** A claim moves between NPCs as structured data, can pick up errors in transit, and an NPC later says something to the player that rests on a stale or garbled claim. This moment is the product; make sure it happens in ordinary play.
6. **Conversation has timing.** A small scheduler in code owns turn-taking and interruption. The judge picks what is said, never when.
7. **Violence has a stub.** Code resolves outcomes; the judge only picks an NPC's response from a short closed list.
8. **The log is the save.** Quitting and resuming replays the event log with no model calls and lands in the identical state. A test proves it.
9. **The judge can fail.** With the network off or the key missing, the game still runs: routines execute, debts fire, the deterministic parser works, and decisions fall back sensibly. A test proves it.
10. **It is measured.** A `pnpm demo` script plays a fixed sequence of inputs against live judge calls and writes a transcript plus calls, tokens, cost and latency per player action. Report the cost per player-hour it implies.

Tests run offline against recorded judge answers keyed by request id. `pnpm check` passes.


## What is out of scope

Do not build SpacetimeDB integration, the Claude authoring thread, Switchyard routing, the WebGL renderer, multiplayer, or a second location. Keep the world state in process. Do shape it the way the spec's server will need: state changes only through validated effects, decisions made on a snapshot and committed with precondition checks, and tables that match section 4's shapes, so that moving to a real server later is a port and not a rewrite.

No generative model runs while the game is being played. Prose comes from templates and assembled fragments. If you want generated flavour text, produce it ahead of time through the Claude CLI on the subscription login and check it in as data. Never use an Anthropic API key.


## What is known and should shape the design

- Knowledge isolation held in every case tested, and a six-NPC batched scene cost about 1,700 tokens and 220 ms. Batch a scene into one call.
- Personality written as tags in the state moves the judge's answers strongly and predictably. It is the main lever for character. Irrelevant tags are ignored.
- The judge is more decided and more self-interested than a reference panel on contested choices, and it underweights feasibility. Prune or restate options that observed facts rule out before the judge sees them. Drop options under 0.10 before sampling. Do not power-sharpen.
- Persuadability is a code-owned value built from goals. The judge's spread is one input to it.
- The judge is not deterministic, and returns probabilities to two decimals. Every decision and RNG draw goes in the log.
- Expect about 160 ms at the median and 460 ms at the 99th percentile per call.
- Only the eight question families in section 14 may be used. Speech-act choice, distortion choice and accept-offer were not covered by the spike, so probe each one briefly (a handful of scenarios, in the style of `spikes/m0-jev`) before building on it, and write down what you find.
- Every judge state goes through a slice compiler with a token budget and a cache key. A test fails when a slice outgrows its budget.


## The hard parts

The engineering is tractable. What is hard is making the inn feel inhabited in a small space. Things most likely to go wrong: NPCs that only react and never want anything; a quest whose guard flips on the first plausible sentence, or never flips at all; gossip that moves invisibly so the player never notices; and output that reads like a log file. Spend effort there. A one-page world bible (setting, tone, the three characters, what each wants tonight) comes first, because every question and template depends on it. Write it to `docs/world-bible.md`.


## How to work

- Begin by checking `git status`. If the M0 spike is uncommitted, commit it on its own before anything else. Then work on a branch named `poc`.
- Build M1 (event log, effects with validation, slice compiler, judge client with a recorded fake, replay test) before M2, and commit at each working step with a clear message.
- Add packages only as they are needed: likely `packages/core`, `packages/jev` and `packages/terminal`.
- Keep judge spending under one US dollar in total. It should be far less.
- If a project rule seems to block something, the rule wins. Note the tension and carry on.
- If a finding contradicts the spec, update the spec in the same commit and say so in your report.
- Stop and ask only if you would otherwise have to change a decision recorded in the spec's Technology section, or spend money beyond the judge.


## What to hand back

1. The branch, with `pnpm check` passing and `pnpm play` and `pnpm demo` working.
2. `docs/poc-report.md`, written for someone who has not watched you work. It should open with whether the inn is fun and why; then cover which of the ten criteria are met, with evidence; the demo transcript; measured cost and latency per action and per player-hour; what you learned about the three untested question families; every place the spec turned out to be wrong or silent; and what you would build next.
3. Keep what you verified separate from what you believe. If a criterion is only partly met, say which part.