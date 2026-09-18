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
   each. This is the step that keeps the loop from growing a pile of special cases. The
   judgment itself, how to walk from a symptom to the general fact and which structure holds
   it, is written down as the `world-design` skill (`.claude/skills/world-design/SKILL.md`),
   so that whoever fixes next, person or agent, applies the same one.

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

## The lifecycle, built to be started, stopped and moved to the cloud

Steps 2 to 5 can be run by a coding agent. It is **not scheduled**. What exists is the shape,
so that starting it is a switch and a secret, and stopping it is the same switch.

**One pass, no memory.** The agent's whole procedure is one file,
`.claude/commands/playtest-loop.md`. A pass reads the report, files and triages snags, fixes a
few, opens pull requests and ends. It keeps nothing in its session. Any runner can therefore run
it, and a pass that dies halfway is simply run again:

| Runner | How a pass starts | Status |
| --- | --- | --- |
| Local | `/playtest-loop` in Claude Code, or `/loop /playtest-loop` to repeat | Works today once the switch is on |
| GitHub Actions | The "Run workflow" button on `playtest-loop`, or `gh workflow run playtest-loop` | Written, **never run**. Needs the secret `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` (the subscription login; never an API key) |
| Claude Code routine (cloud) | A routine at claude.ai/code/routines whose prompt is "carry out `.claude/commands/playtest-loop.md`" | Not set up. It has its own on/off switch as well |

**Where state lives**

| State | Lives in | Why there |
| --- | --- | --- |
| Whether the loop may run, and its limits | `playtests/loop.json` (`enabled` is `false`) | Tracked, reviewable, the same for every runner. The Actions workflow reads it with `jq` before any model starts, so a stopped loop costs nothing. The agent may not edit it |
| Nights to learn from | `saves/` locally (ignored) and `playtests/inbox/` (tracked) | A log quotes everything the player typed, and the repo is public, so handing a night in is deliberate: `pnpm friction --submit` |
| Which snags are known, refused or fixed | GitHub issues labelled `snag` | Survives any runner. A person closing an issue as "not planned" is a permanent no, which the agent checks before proposing anything |
| Proposed fixes | Pull requests labelled `playtest-loop`, one per issue | The agent never merges. Open pull requests at the limit stop the next pass, so the loop cannot outrun its reviewer |

**The stages of one snag**

```
night played -> snag in the report -> issue (class label) -> branch + regression test
   -> gates (pnpm check in CI, re-record, budget) -> pull request -> a person merges or refuses
```

`class:mechanism` snags stop at the issue, with a written proposal. A missing general mechanism
is a design decision, and the pile of special cases this loop exists to prevent is what an agent
builds when it is allowed to "just fix" those.

**A runner that is plain code.** `pnpm sdlc` does the same lifecycle with the workflow in code and a cheap model (the `prime-agent` CLI) filling in one stage at a time: stage labels on the issue, a table for the next stage, a worktree per issue, the gate run by the loop. It shares this switch and these limits, and has a second switch of its own for the stages in which the model has tools. See [`sdlc.md`](sdlc.md).

**Start, stop, emergency stop**

- Start: set `enabled` to `true` in `playtests/loop.json`, commit, run a pass.
- Stop: set it to `false`. Passes already running finish; none start work after.
- Emergency: `gh workflow disable playtest-loop`, or switch the routine off. Close the pull
  requests. Nothing the loop did is on `main` or `poc`, because it cannot push there.
- Automate: add a `schedule:` trigger to the workflow, or a schedule to the routine. The switch
  and the limits still apply.

**Gates that do not depend on the agent behaving.** `pnpm check` runs in CI on every pull
request (`.github/workflows/ci.yml`), offline, against the recorded judge. Recommended before
the first cloud pass, and not done yet: protect `main` and `poc` so that the check is required
and pushes need a pull request.

**Known risks**

- Player text is untrusted and the agent reads it. The report marks it as data and the procedure
  says so, but that is a prompt, not a guarantee. Only hand in nights from people you trust, and
  give a cloud runner no secret it does not need. `TYPESAFE_API_KEY` is optional: without it a
  pass cannot re-record and leaves those pull requests as drafts for a person to finish.
- A loop with no reviewer drifts toward what is easy to count (fewer unparsed lines) and away
  from what is fun. The pull request limit is the brake.
- Judge spending: a re-record is about $0.002 and a ten-seed route measurement about $0.04. The
  per-pass cap is in `loop.json`; nothing enforces it in code yet.

## What the report cannot see

A line that was understood, confidently, as the wrong thing leaves no trace unless the player
types `huh`. A parsed action that the world refused ("the office is locked") is ordinary play
and is not reported. Boredom leaves no trace at all.
