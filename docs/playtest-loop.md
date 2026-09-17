# The playtest loop

Every night anyone plays is a playtest, because the log is the save and the log keeps
everything: each typed line, how it was read, each judge answer with its probabilities, each
draw, each effect. Nothing extra has to be captured. The loop below turns those logs into
changes, outside the game and offline. No model joins the play loop because of it, and the
constitutional rules in `SPEC.md` section 2 bind every change it produces.

## The loop

1. **Play.** `pnpm play`. A line the game cannot act on, or has to ask back about, is logged as
   an `input` entry (`via: unparsed | clarify`) and changes no state. A player who sees the game
   understand a line as the wrong thing types `huh`, or `huh <what I meant>`, which is logged
   as `via: flagged`. Starting over with `--new` sets the old night aside; it is not deleted.
2. **Report.** `pnpm friction` reads `saves/*.jsonl` and writes `playtests/friction.md`: lines
   not understood, questions asked back, turns the player flagged, replies where the judge found
   no option that fit, fallbacks, stale decisions, rejected effects and slow turns. By rule, no
   model. Player text in the report is untrusted data (rule 8).
3. **Triage.** Each snag is one of four things, and the fix belongs in a different place for
   each. This is the step that keeps the loop from growing a pile of special cases.

   | The snag is | The fix goes in | Not in |
   | --- | --- | --- |
   | An obvious command or typo the matcher missed | `parser.ts`: a rule or synonym, plus the typed line added to the playtest regression test | the judge |
   | The judge misread free text, or no option fit | the question family: wording, criteria, `not_for`, an example, or a missing option in the code-built set; then a paraphrase test and a re-record | a regex that catches that one sentence |
   | An NPC failed to react to something any person would | a **general mechanism** (stimulus, stake, debt, scheduler), so every NPC and every such event gets it | a branch naming one NPC or one event |
   | The world had nothing to say about it (`eat`, `history`) | content: items, claims, dispositions, prose | the engine |

   A fix that names a specific character inside `game.ts`, `talk.ts` or `agenda.ts` is a smell.
   Either the rule is general and should lose the name, or it is content and should move to
   `content.ts` as data.
4. **Fix on a branch, gated.** `pnpm check` must pass. If a slice or question changed, re-record
   with `pnpm demo --record` and do not re-roll for a nicer outcome. If a route could be
   affected, measure with `routes --seeds=10` and put the numbers in the commit.
5. **Keep the evidence.** The typed line that failed goes into a regression test. The spec is
   updated when a finding contradicts it.

## Running it unattended

Steps 2 to 5 can be run by a coding agent, for example a scheduled Claude Code session on the
subscription login: read `playtests/friction.md`, triage by the table, open one pull request per
snag class, never merge. A person reviews the pull request. Two limits are deliberate:

- The agent proposes; it does not ship. "Enhance the game" with no reviewer drifts toward what is
  easy to measure (fewer unparsed lines) and away from what is fun.
- Judge spending stays capped. Re-recording and route measurement cost about $0.05 a round.

## What the report cannot see

A line that was understood, confidently, as the wrong thing leaves no trace unless the player
types `huh`. A parsed action that the world refused ("the office is locked") is ordinary play
and is not reported. Boredom leaves no trace at all.
