---
name: world-design
description: How to turn a playtest snag into a change that makes the world more general, never a special case. Load before triaging or fixing anything a player bumped into.
---

# World design: from a snag to a generalisation

This game is a world that reasons from what things are for. A player bumping into a gap is
the world failing to answer a question it should be able to answer about itself: what is
this thing, what does this act cost, who can do what, what follows. The fix is never "handle
this input". The fix is to make the world able to answer the question, for this case and for
every sibling of it you did not see.

Read this whole file before triaging. Then read `SPEC.md` section 2 (the ten rules) and
section 4 ("Means and ends"). They bind every change.

## The question to ask of every snag

Not "how do I make this line work?" but:

> What general fact about the world did the player just bump into, and where does the world
> keep facts of that kind?

Walk it up the ladder until it stops being about this input:

1. **Symptom.** "tel mara she's fat" made the player accuse Mara of theft.
2. **What could not be represented.** A line was taken as an answer to a question it did not
   answer.
3. **The kind of thing.** Answer resolution: what counts as an answer to "which do you mean?"
4. **The rule.** An answer is made of the candidates' words. Anything else is a new line.
5. **The sibling it also fixes.** "wait, forget it" after any clarification.

Stop at the first rung where the fix names no specific character, item, room or sentence. If
you cannot reach that rung, you have found a design decision, not a bug. Write it up and stop.

## What "general" means here, in tests you can apply

A change is general when all of these hold. Check them before opening a pull request.

- **No proper noun in engine code.** `game.ts`, `talk.ts`, `agenda.ts`, `actions.ts`,
  `attempts.ts` must not gain a line that says `MARA`, `ODO`, `TOBIN`, `"ledger"`,
  `"table"`. Names belong in `content.ts` (data) and `prose.ts` (voice). The engine sees
  roles, predicates, needs and numbers.
- **A role is a power, a trait is a tendency.** "Only Mara can throw someone out" is wrong.
  "The innkeeper can throw someone out" is right, built into the option set by code from
  `actor.role`. Whether she does is the judge's.
- **Things are described, not programmed.** A new thing gets `serves`, `forced`,
  `consumable`, aliases and prose. It never gets a verb handler. If the verb does not exist,
  the verb table is what grows, and it grows by what need the verb reaches for or what it
  forces (`core/needs.ts`), not by what object it was tried on.
- **Acts are deeds on one path.** Anything the player does that a person would notice is a
  claim (`g.happened`) with a predicate in `content.ts`, witnessed by the room, believed,
  weighed, retold, garbled and reacted to by the machinery that already exists. A blow, an
  insult and gnawing the table travel the same road. Never write a second road.
- **Option sets are built from state and include none.** What the judge may pick is
  generated from the world as it is now: people present, things in scope, claims held,
  powers of the role, replies that are legal. Adding an option to a generator is general.
  Adding a branch that returns a fixed answer is not. Every set has a "none"; the judge is
  never forced.
- **Numbers in code, meaning in the judge.** How much trust an insult costs, how hard oak
  is, how long eating takes: numbers, in code or content. Whether a line is an insult,
  whether Mara believes it, which reply fits her: the judge. Never the other way round.
- **Prose is keyed to its cause.** A line the player reads must make sense given what caused
  it. Mara's warning about a fight must say it is about the fight. If a line reads wrong in
  context, the fix is a line keyed to the cause (`SPECIAL`, `VOICE`), not a rule about when
  to stay silent.
- **The typed line becomes a test.** Exactly as typed, in `packages/inn/test/parser.test.ts`
  or `game.test.ts`, with the world state it happened in.
- **The recording stays honest.** If a slice, a question or the content changed, re-record
  the demo once and keep what comes out. Never re-roll for a nicer transcript.

## The structures, in the order to try them

When you know the kind of thing, put the fix in the first structure below that can hold it.
Going further down the list is allowed only when the one above cannot express the fact.

| The fact is about | The structure | Where | Add here when |
| --- | --- | --- | --- |
| What a thing is for, or what forcing it costs | The needs graph: `serves`, `forced`, `consumable` | `content.ts` items and rooms; `core/needs.ts` for verbs | A verb on a thing gave a wrong or empty answer |
| What a body needs and what neglect does | `ENDS`, `weakened`, need rates | `core/needs.ts`, `content.ts` schedules | A consequence of hunger, cold, exhaustion is missing |
| An act a person would notice | A deed: predicate in `WRONGDOING` or the predicate list, phrase ladder in `words.ts` | `content.ts`, `words.ts`; raised with `g.happened` + `g.witness` | Something the player did left no trace in anyone's memory |
| How someone feels about a deed | Drive nudges by predicate | `game.ts afterBelief` (by predicate, never by person) | A deed changed nothing in anyone's stance |
| What can be said or done | Closed option sets: `VERBS`, `topicOptions`, `replies`, `pickAction` options | `jev/families.ts` (verbs), `talk.ts` (replies), `parser.ts` (rules) | The judge had no fitting option, or the matcher missed an obvious command |
| What a person is allowed to do | Powers from `actor.role` | `talk.ts` and `agenda.ts`, keyed on role | An outcome exists only because of who someone is |
| A consequence that comes later | A debt with a fuse | `core/debts.ts`, `content.ts` `debtKinds`, `agenda.ts fire` | A reaction should happen after a delay or once a condition holds |
| Where people are and why | Schedule layers: override, commitment, need, role | `content.ts` schedules; `apply_override` | Someone should be somewhere else because of what happened |
| How the world is described | `prose.ts` voice and special lines, `words.ts` ladders | Never the engine | A line read wrong for its cause, or a voice was missing |
| What the judge is asked | Question wording, criteria, `not_for`, examples | `jev/families.ts`; needs a paraphrase test and a re-record | The judge misread a line the option set could express |

Two things are not on the list because they are decisions for a person:

- **A new question family.** M2 is frozen at eight. If the fact needs a judgment none of the
  eight can make, write the family as a proposal (criteria, `not_for`, examples, paraphrase
  test) and stop.
- **A new effect kind.** The effect vocabulary is code versioned like a schema. Propose it;
  do not add it.

## Worked examples from the playtests, including the wrong fixes

**"shut the fuck up" got "I've nothing to say to you about that."**
Wrong: a regex for swearing that makes Mara threaten. Right: `insult` joined the closed verb
set; an insult became a deed (`insulted`) on the witness path; the insulted got real options
(retort, walk out, strike, and throw out for the innkeeper's role); an insult costs trust by a
number. Sibling handled for free: insulting Tobin in front of Odo reaches Mara as gossip.

**"eat" got "You turn the thought over and cannot see how to act on it."**
Wrong: an `edible` flag on bread and an `eat` handler that checks it. Right: things carry
what they serve toward each need; `eat` reaches for hunger; the table is too hard once and
harmful when insisted on; insistence is counted from the log. Sibling handled: `sit`,
`warm`, `hide`, `kick`, on anything, and `why stew`.

**Mara said "One more word like that and you sleep in the ford" after "hello".**
Wrong: suppress the line after greetings. Right: the line was her delayed warning about a
fight, voiced with a generic threat; the warning got a line keyed to its cause.

**"tel mara she's fat" became "Mara took the ledger".**
Wrong: recognise "tel" as "tell". Right: an answer to a clarification must be made of the
candidates' words. Sibling handled: any unrelated line typed after any question.

**The pattern to stop.** `maraActsOn`, `face_stranger`, `search_cellar`, the guard's
preconditions: each is engine code with a name in it, each added after a playtest showed a
gap, each works. They are debt, listed in `SPEC.md` section 17. Do not add to the pile; when
you touch one, try to make it lose its name.

## What to hand to a person instead of fixing

- Anything that fails the tests above after honest effort.
- Anything about whether the game is fun. Fewer unparsed lines is not fun.
- A slice that would need to grow past its budget.
- A judge answer that looks wrong on a question that is worded well: that is a finding about
  the model, and it goes in `spikes/m2-families/FINDINGS.md`, not in a patch.

## How to read what the player left

- `pnpm friction` lists the snags by rule. It cannot see a line that was understood as the
  wrong thing; those arrive only as `huh` flags or as transcripts a person pastes.
- `why <name>` and `why <thing>` in a resumed save show what the world believed and why, with
  the dice. Read them before deciding the world was wrong; often it was right and the prose
  was not.
- The log is the save: `saves/*.jsonl` holds every judge answer with its probabilities. A
  reply the judge gave 0.42 to "none" is a different finding from one it gave 0.97.
