---
name: world-design
description: How to turn a playtest snag into a deep, general mechanism rather than a special case. Load before triaging, designing or fixing anything a player bumped into.
---

# World design: from a snag to a deep module

This game is a world that reasons from what things are for. A player bumping into a gap is
the world failing to answer a question it should be able to answer about itself: what is
this thing, what does this act cost, who can do what, what follows. The fix is never "handle
this input". The fix is to make the world able to answer that *kind* of question, for this
case and for every sibling of it nobody has seen yet.

Read this whole file before triaging. Then read `SPEC.md` section 2 (the ten rules) and
section 4 ("Means and ends"). They bind every change.

## The stance: depth over the quick fix

A quick fix handles the cause and effect that was observed. A deep module handles the class
of causes and effects the observation belongs to, behind an interface that does not grow
when the class does. This project chooses depth every time, and accepts that it costs more
on the day. The reason is arithmetic: a special case costs an hour and is paid for again by
every sibling; a deep module costs a day and is paid once.

**Deep module, simple interface** means, here:

- The interface is a few functions whose signatures could be written before the cases were
  known. `attempt(verb, thing, insistence) → Outcome` is deep: eat, kick, climb, hide and
  every future verb on every future thing go through it, and its signature will not change
  when a new verb or thing is added. A `switch` over situations with one arm per situation
  is shallow: every new situation is another arm, and the interface is the list of arms.
- The interface hides the hard part. Callers say what happened; the module decides what it
  means and what follows. If a caller has to know the rules to call the module correctly, the
  module is shallow.
- Errors are defined out of existence. "You can't eat that" is an error message. "The table
  is harder than you are" is an outcome. Design so that there is no case the module refuses;
  there are only outcomes, one of which may be "nothing".
- Complexity is pulled downward. The rule that insisting on something too hard causes harm
  lives inside `attempt`, not in each caller. Prose, callers and content stay simple because
  the module is not.
- Data grows; code does not. Adding a thing, a verb, a deed predicate, a role power or a need
  is a row in a table. If it is a branch in a function, the module is not finished.

**Design it twice.** Before building, write two shapes for the module: the smallest that
handles the observed case, and the one that handles the class. Compare their interfaces.
If the class-shaped interface is no larger than the case-shaped one, build the class. It
usually is no larger; the difference is inside.

**Name the class before you name the fix.** Every snag is an instance of a class. Insulting
Mara is an instance of "speech that is a deed". Eating the table is an instance of "a verb
tried on a thing that does not serve it". A line understood as the wrong thing is an instance
of "resolving an answer against candidates". Write the class down in the issue. If you cannot
name it, you do not yet understand the snag, and you must not fix it.

## The question to ask of every snag

Not "how do I make this line work?" but:

> What general fact about the world did the player just bump into, what class of facts is it,
> and where does the world keep facts of that class?

Walk it up the ladder until it stops being about this input:

1. **Symptom.** "tel mara she's fat" made the player accuse Mara of theft.
2. **What could not be represented.** A line was taken as an answer to a question it did not
   answer.
3. **The class.** Resolving a free-text answer against a set of candidates.
4. **The rule for the class.** An answer is made of the candidates' words. Anything else is a
   new line.
5. **Three siblings the rule also covers.** "wait, forget it" after any clarification; a
   candidate word used in a new sentence; a typo of an unrelated verb.

Stop at the first rung where the fix names no specific character, item, room or sentence
*and* you can name three siblings it covers. One sibling is a coincidence. If you cannot
reach that rung, you have found a design decision, not a bug. Write it up and stop.

## What "general" means here, in tests you can apply

A change is general when all of these hold. Check them before opening a pull request, and
say in the pull request which ones you checked and how.

- **No proper noun in engine code.** `game.ts`, `talk.ts`, `agenda.ts`, `actions.ts`,
  `attempts.ts` must not gain a line that says `MARA`, `ODO`, `TOBIN`, `"ledger"`,
  `"table"`. Names belong in `content.ts` (data) and `prose.ts` (voice). The engine sees
  roles, predicates, needs and numbers.
- **A role is a power, a trait is a tendency.** "Only Mara can throw someone out" is wrong.
  "The innkeeper can throw someone out" is right, built into the option set by code from
  `actor.role`. Whether she does is the judge's.
- **Things are described, not programmed.** A new thing gets `serves`, `forced`,
  `consumable`, aliases and prose. It never gets a verb handler. If the verb does not exist,
  the verb table is what grows, by what need the verb reaches for or what it forces
  (`core/needs.ts`), never by what object it was tried on.
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
  it. If a line reads wrong in context, the fix is a line keyed to the cause (`SPECIAL`,
  `VOICE`), not a rule about when to stay silent.
- **The interface did not grow.** Count the exported functions and their parameters in the
  module you touched, before and after. If the count went up to admit this case, the case
  was not absorbed; it was appended.
- **The test is over the class.** The regression test holds the player's exact line, and the
  unit test iterates over the class: every verb in the table against a thing that serves it,
  a thing that does not, and a thing that hurts; every role against the power. A test that
  checks one case proves the case, not the module.
- **The recording stays honest.** If a slice, a question or the content changed, re-record
  the demo once and keep what comes out. Never re-roll for a nicer transcript.

## The structures, in the order to try them

When you know the class, put the fix in the first structure below that can hold it. Going
further down the list is allowed only when the one above cannot express the fact. Each row
is a deep module or a table it reads; the "add here" column is a row in a table, not a
branch in a function. If the structure cannot hold the class without a branch, the structure
needs deepening, and that is a design proposal (see "What to hand to a person").

| The fact is about | The structure | Where | Add here when |
| --- | --- | --- | --- |
| What a thing is for, or what forcing it costs | The needs graph: `serves`, `forced`, `consumable`; `attempt()` | `content.ts` items and rooms; `core/needs.ts` for verbs | A verb on a thing gave a wrong or empty answer |
| What a body needs and what neglect does | `ENDS`, `weakened`, need rates | `core/needs.ts`, `content.ts` schedules | A consequence of hunger, cold, exhaustion is missing |
| An act a person would notice | A deed: predicate in `WRONGDOING` or the predicate list, phrase ladder in `words.ts` | `content.ts`, `words.ts`; raised with `g.happened` + `g.witness` | Something the player did left no trace in anyone's memory |
| How someone feels about a deed | Drive nudges by predicate | `game.ts afterBelief` (by predicate, never by person) | A deed changed nothing in anyone's stance |
| What can be said or done | Closed option sets: `VERBS`, `topicOptions`, `replies`, `pickAction` options | `jev/families.ts` (verbs), `talk.ts` (replies), `parser.ts` (rules) | The judge had no fitting option, or the matcher missed an obvious command |
| What a person is allowed to do | `POWERS` by role | `content.ts`; read by `talk.ts` and `reactions.ts` | An outcome exists only because of who someone is |
| What someone does about a belief | A disposition: who, which beliefs, the closed set of reactions, delays, why it matters | `content.ts` `DISPOSITIONS`; a new kind of reaction is a row in `reactions.ts` `REACTIONS` | Someone came to believe something and did nothing, or only one named person would have |
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

## Where the current code is shallow, so you do not copy it

Knowing the anti-pattern matters as much as the pattern. These exist, they work, and they are
the shape to stop:

- **`replies()` in `talk.ts`** is a `switch` over situations with hand-built option lists per
  arm. The deep version builds the option list from what the deed cost the listener (the
  needs graph: an insult costs company, a blow costs safety) and what the listener's role
  permits. When you touch `replies()`, do not add an arm; propose the generator.
- **A debt handler with a name in it.** `agenda.ts` used to hold one function per thing a
  character did (Mara's searches, confrontations, verdict and answer to a brawl; Odo's
  checking, burning and panic; Tobin's conscience), each added after a playtest showed a gap.
  They are gone. The class is "someone does something about what they believe or intend", and
  its deep version is `reactions.ts` (the pipeline) over `repertoire.ts` (what a person can
  do, one row each) over `DISPOSITIONS` in content. If an NPC should do something new: first
  try a new disposition using existing reactions; then a new reaction row that names nobody;
  never a new debt kind with a handler. Rows work from what the person believes, not from
  what is true, and a row that cannot be done returns no offer instead of refusing.
- **A fix that only works because the old code cheated.** The named handlers let someone
  "tell" a person in another room and let one function do three things in one instant. Made
  honest, the same behaviour took three agenda passes and a walk, and two quest routes stopped
  working until the general rules were fixed (what comes due now fires now; a new errand
  supersedes the old one). When a generalisation changes timing, measure the routes before
  believing it.
- **`SPECIAL` lines keyed by request id** in `prose.ts` are fine as content but the keys are
  invented one at a time. The class is "prose keyed to cause"; a deep version keys on the
  cause's predicate and the speaker's role.

## Worked examples from the playtests, including the wrong fixes

**"shut the fuck up" got "I've nothing to say to you about that."**
Class: speech that is a deed. Wrong: a regex for swearing that makes Mara threaten. Right:
`insult` joined the closed verb set; an insult became a deed (`insulted`) on the witness path;
the insulted got options generated from their powers (retort, walk out, strike, and throw out
for the innkeeper's role); an insult costs trust by a number. Siblings handled for free:
insulting Tobin in front of Odo reaches Mara as gossip; a mocking remark; a slur at a guest
who is not in the plot.

**"eat" got "You turn the thought over and cannot see how to act on it."**
Class: a verb tried on a thing. Wrong: an `edible` flag on bread and an `eat` handler that
checks it. Right: things carry what they serve toward each need; verbs reach for a need or
force; the table is too hard once and harmful when insisted on; insistence is counted from
the log. Siblings: `sit`, `warm`, `hide`, `kick`, `climb`, on anything; `why stew`.

**Mara said "One more word like that and you sleep in the ford" after "hello".**
Class: prose keyed to cause. Wrong: suppress the line after greetings. Right: the line was her
delayed warning about a fight, voiced with a generic threat; the warning got a line keyed to
its cause.

**"tel mara she's fat" became "Mara took the ledger".**
Class: resolving an answer against candidates. Wrong: recognise "tel" as "tell". Right: an
answer to a clarification must be made of the candidates' words. Siblings: any unrelated line
typed after any question.

## What to hand to a person instead of fixing

- A class whose structure does not exist yet, or exists only as a shallow switch. Write the
  proposal: the class, the interface (a few signatures), three siblings, what it replaces, and
  what it costs. Do not build it in the loop.
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
- Several snags in one report often share a class. Triage them together; one deep module
  closes them all, and one issue should say so.
