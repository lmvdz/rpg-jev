# Sandbox direction (proposal)

2026-09-18. A proposal, not yet the spec. It says what changes if the game is a sandbox with no set story, in which elements evolve and generate new elements through interaction. Nothing here is built. If accepted, it replaces the inn as the first slice and rewrites sections 1, 4, 14 and 16 of `SPEC.md`.

## The premise

There is no plot, no quest and no author writing an arc. There is a world of elements: materials, things, places, creatures, people, and later the social things people make (debts, rumors, roles, customs). Elements change each other, and when an interaction produces something the world does not have yet, that thing is made, described, and added to the world for good. Story is what the log looks like afterwards.

The inn could not show this. It was one authored mystery with dialogue at the centre: `packages/inn` is about 6,700 lines against 2,300 in `packages/core`, and every playtest fix pulled toward a special case. What it proved still stands: the judge port, slices, the eight families, log and replay, effects, deeds on the witness path, dispositions, and means and ends, which was this pivot discovered from the inside.

## Open elements over a closed ontology

This is the one idea the rest hangs on.

| | Closed: code, grown by a person, slowly | Open: data, grown by play, without limit |
| --- | --- | --- |
| What | Properties (flammable, wet, hard, edible, sharp, hot, bleeding, alive…), needs, processes (take, coat, burn, wet, cut, strike, eat, mix, grow, decay, trade, tell), effect kinds | Two pools. Elements: each a description over the closed vocabulary. Reactions: templates that say what happens when two properties meet under a process, composed only of existing effect kinds |
| Who adds | A person, by the spec | Interactions, through propose, ratify, commit |
| Rule | 5: kinds are code | 1: generative models propose, Jev ratifies, code commits |

An element is a row, and a thing in the world is an instance of one that carries state: a coating, a temperature, wetness, damage, a wound. Properties come from the row and from the states, so a steel sword coated in oil is not flammable but its coating is. Most of what looks like a new thing is an old thing in a new state, and needs no generation at all.

The row says what it is made of, its properties in numbers, what it serves (the needs graph), what forcing it costs, what it becomes under each process. Interactions are never written between two elements. Code derives them from the properties of whatever meets under a process, so N elements cost N descriptions and not N squared rules.

"Introduce features slowly" is the left column: a new property, process or substrate is a feature, added by hand when the world is ready for it. "Elements generate new elements" is the right column, and it runs by itself.

A new element can never do what no property expresses. When the proposer wants a property that does not exist, that is logged as a request to a person. It is how the ontology learns what it is missing, and it is the only way the ontology grows.

## A latent world

Nothing is generated before somebody reaches for it. The world is lazy at three depths, and each is decided once, logged, and never re-inferred (rule 9).

| Latent | Decided when | By | Then |
| --- | --- | --- | --- |
| A fact: is there a loose stone on this tile | Someone looks for one | Jev scores how common the thing is in this place, from the local slice; code turns the level, the effort and a logged draw into found or not, and into minutes spent | Written on the tile. A patch searched and found bare stays bare until something changes it |
| A description: how hard is this stone, does pitch burn | The property is first needed | Proposed, then ratified by Jev one hop at a time | A row in the element pool, for every world |
| A reaction: what does heat do to a bleeding wound | Two properties first meet with no entry in the table | Proposed as a template over existing effect kinds, then ratified by Jev in one hop | A row in the reaction pool, and code from then on |

Jev judges meaning: how common, whether it burns, whether heat closes a wound. Odds, effort, durations and amounts are arithmetic, so they are code (rule 3). Identical slices hit the cache, so "how common are stones in a quarry" is asked about once.

## From a typed line to the world

The player moves by direct control, with no model involved, and acts through a prompt.

1. **Parse.** The `parse_intent` family reads the line into one or more steps, each a process from the closed list with operands from code-built sets: what is carried, what is in reach, and, for things not in sight, the element kinds code shortlisted from the pool by name. It also reads effort, a closed choice (what is at hand, a quick look, a thorough search), which is the whole difference between "pick up stone" and "looks around until finding a stone".
2. **Resolve.** Code runs each step: latent facts are settled, properties meet, reactions fire, states and fuses are set, time is charged.
3. **Holes.** A missing description or reaction resolves now with what the properties already give, and is filled in the background.

### The typed act, as built

The client now makes the request (`packages/client/src/play/act-request.ts`, SPEC section 19): the line in one labeled field and nowhere else, the target tile, what is in reach with its visible states, and four closed questions, each with none: process, patient, instrument, effort. Nothing judges or resolves it yet. What is missing is the step between the answers and the rules, an **act compiler** in code: parse answers plus the world give a `matter` act, and `resolve(world, act)` does the rest.

What running batch A through the rules says the parse has to read, beyond those four:

- **Aim**, for force: through it, along its grain, or working its surface. Whittling and felling are the same process on the same branch, and without the aim the rules cannot tell them apart.
- **Manner as three levels, not one**: effort, care and haste (principle 5). "Wrap it tight, quick" is low care and high haste, and that is what decides whether the bandage holds. The client's effort question is the search's effort; the same closed wording serves every process.
- **How long or how much**, as closed steps: a moment, a while, until it is done; a little, some, all of it. Code turns the step into minutes and amounts.
- **Wait** is a thing a player does ("rest until dark"), so X7 belongs in the process options as letting time pass, though nobody chooses to rot.
- One process per line is right to start with. A line that names several steps parses as its first step; the rest is the open question it already was.

**Worked: "pick up stone".** Process `take`, target the kind stone, effort at hand. No stone instance is in scope, so the fact is latent. The slice says grassland; Jev scores stones as rare; code rolls low odds for a glance and the player finds nothing, in a few seconds. "Looks around until finding a stone" parses to a thorough search: better odds, many minutes, and hunger and daylight spent. In a quarry the first glance is enough.

**Worked: the burning sword.** "Pour the oil on the sword" is `coat`: the sword instance gains a coating of oil. "Put the sword in the fireplace" brings fire to a flammable coating, so the coating burns; code works out how long from how much oil there is and sets a fuse. While it burns the sword is also hot and bright and lights what it touches. It is the same sword. Cutting flesh with it: sharp meets soft and makes a bleeding wound; hot meets flesh and makes a burn. Both happen with no rule written, because each property does its own work. Whether the heat also seals the wound is a synergy, a reaction between hot and bleeding, and the vocabulary pass gave the honest answer: a slicing blade touches too briefly, so it sears the edges, lights cloth and the wound still bleeds; a hot blade held on a wound seals it and burns. Contact time is an input, and a reaction is a threshold on an exposure, not a yes or no. If the table lacks the reaction, the first player to press hot iron to a wound gets only the burn; the proposer offers a template, Jev ratifies "does searing heat held on a wound stop the bleeding?", and everyone after gets cautery.

The nearest prior art is the chemistry engine of Breath of the Wild: a few elements, a few material states, three rules, and play that multiplies. The difference here is that the tables fill themselves in, ratified.

## The closed vocabulary, tested

`spikes/vocabulary` derived the closed vocabulary from 210 synthetic scenarios and tested it on batches its author had not read (`FINDINGS.md` there). What it changes here:

- **A row is a baseline, not a fact about the instance.** States move effective properties by a few modifier rules: iron softens hot, clay sets dry, meat turns harmful as it rots, a sapling is not its tree. This draft's "properties in numbers" are where an instance starts.
- **About a hundred entries carry the domains they were built on at 80 to 90%, and a new domain fully expresses about half.** The vocabulary does not close. "Introduce features slowly" therefore means: a domain is a feature, and its admission test is a held-out batch of scenarios checked against the vocabulary, before any code.
- **The reaction pool is small.** About a dozen true reactions in 210 scenarios. Nearly all of the play comes from the base rules.
- **The clearing starts where coverage is strong**: searching, fire, water, tools, food, growth. Not fights, and not a forge.
- **The rules exist as code**: `packages/core/src/matter`, pure, one entry point, every change citing the vocabulary ids that caused it. Both worked examples above derive from element rows alone. Running batch A through it found seven rule errors no paper check could see (ignition is a surface test; cutting and breaking are different contests), all fixed by a more general rule.
- **Thirst and air join the needs graph**, and every chosen behaviour needs a routine form in code, or rule 10 and a living world cannot both hold.

## How a new element is born

1. Two or more elements meet under a process. Code computes the result from properties and bookkeeping (nothing is made from nothing: what the result serves is bounded by what went in, plus labour. Rule 3).
2. **Select before generating.** Code ranks the existing elements nearest to the computed result and Jev picks one, or none. Most interactions end here, with no generative call.
3. None is a hole. The interaction resolves at once with the generic result code already has (a charred lump, a slurry, a broken thing), so rule 2 holds: no action waits on a generative model.
4. In the background a generative model proposes the missing element as a row over the closed vocabulary. Code checks the schema, the bookkeeping, and that it is not a near-duplicate of an existing row. Jev ratifies it one property at a time, one hop each ("does pitch burn?"). Its name and look are rendering.
5. The element joins the pool, shared across saves. Processes that take world time (smelting, brewing, growth, rot) are where the wait hides: by the time the pot has boiled, the thing in it exists.
6. The pool is measured as in section 20: an element nothing ever touches again is culled.

This is section 20's content loop, no longer tooling. The improvement loop is the game.

## Evolution without a story

- **Things** change under processes: wood burns to ash, ash and fat and water make soap.
- **Living things** run on the needs graph through `pick_action` over options code built from what is in reach and what it serves. The same graph for a rat, a person and the player. Section 17 notes NPCs do not choose by the graph yet; here they must, first.
- **Populations** are code: birth, death, hunger, migration, with no Jev for regions nobody watches (rule 10).
- **Social elements** are instances of templates born from deeds: a theft seen by someone makes a claim, a claim retold makes a rumor, a rumor believed makes a grudge, a grudge and a need make a feud or a law. These substrates exist in `packages/core`. Speech arrives late, as one more process, not as the foundation.

## What a row owes the client

Asked for by the renderer session on 2026-09-18 (SPEC section 19, "The renderer under the sandbox direction"); agreed here unless it says otherwise. The principle under all of it is one this design already holds: **a decision is made once, at birth, and logged; never per occurrence.** A Jev request is about 165 ms at the median, so a judgment when an element is born is free and a judgment per frame, per blow or per particle is not.

- **An element row carries a `look`**: a glyph index into the client's atlas, an ink from the 16-entry palette, a scale, and whether it sways. Each is a choice from a closed set, so it is ratified like any property: code shortlists glyphs, Jev picks one or none. It also carries a `name`, which is generated text and therefore untrusted everywhere (rule 8): the client sets it as text content only, and it never reaches an instruction or a criterion.
- **Element and reaction rows carry an `effect`**: the client's `EffectRow` (a motion from a closed set, one to four atlas frames, three inks, an easing, and levels 0 to 5 for rate, life, spread, speed, size and glow), validated by the client's `checkEffect`. One fixed shader plays every row. **No generated shader text, ever**: effect kinds are code (rule 5), and generated GLSL has unbounded cost and runs on the player's machine.
- **What the client draws from an instance is its states as levels.** Today: burning, temperature, growth, amount. Still to come: wetness, coating, integrity, and signals (smoke, scent). Appearance of the ground (wet, scorched, snow) reaches the client per tile as a place state, one texel a tile, never as a change of geometry. That is the same split as section 4 of the vocabulary: a place has states, and variation inside a place is the map's job.
- **The body's status display takes rows** (`id`, label, level, ink) and counts. Which needs exist stays with the needs graph, so thirst and air, when they are admitted, are two more rows and no client change.
- **Movement and the right-click menu are stand-ins for X1 and for the action compiler.** When `move` exists in `packages/core/src/matter`, the client asks the world whether a step can be taken. The menu's rows are built by code from the closed set of processes that apply to the thing under the pointer (what it is like decides what can be tried on it), and are sent as intents, the same path a typed line takes after parsing.
- **Cost.** The client measured that showing change costs what changed, not how much exists. The risk is the simulation, not the renderer. `drift` is closed form over a gap for that reason: it is run when someone is there to see, or when a fuse comes due, never every frame for everything (rule 10).

## Skills and abilities

The user raised it with the renderer session, and the vocabulary pass ran into it from the other side: "juggle the torches" failed outright because a body has nowhere to keep competence, and without it a first attempt and a hundredth play the same. The position here, which matches the renderer session's advice:

- **An ability is a row over existing closed sets**, the same guarantee an element has: which processes it composes and with what manner (effort, care, haste), what it costs the body's needs, what levels it requires, an effect row, and an actor motion from a small closed set. It can never do what no process expresses.
- **A skill is a level on the body's row**, per process or per family of processes, and it enters as principle 5 already says the actor does: it moves effective care and effort. Growth, thresholds and what a level multiplies are arithmetic, so they are code (rule 3).
- **Jev judges meaning only**: did this act count as practice of that skill, and, when an ability is born, is it plausible that a body like this could do it.
- **"Nothing is made from nothing" bounds a generated ability's power**, as it bounds a generated element's: what an ability yields is bounded by what went in, plus effort and time.
- Not decided: how many skills, and whether they are per process (ten) or finer. The vocabulary pass should answer it the way it answered the rest: write held-out scenarios where skill is what decides the outcome, and find the smallest set that expresses them.

## Admitting a feature

A property, process or substrate is admitted when:

1. It is described in the spec as an answer to "for what?".
2. Every existing element has a value for it, or a default; a coverage test says so.
3. No code names two elements or two features together.
4. Creatures can use it, not only the player.
5. It has a rule for unobserved time.
6. It ships with probes (section 20).

## Knowing whether it works

The measure is **unscripted chains**: causal chains in the log, walked by cause id, that cross two or more features and that no content row spelled out. If that count rises as features land, the world is alive. If it stays flat, features are sitting side by side. It is computed by rule from the log.

## A first slice: the clearing

Spatial from the start: the player spawns into the glyph renderer (R0 to R2 exist), walks a small map of two or three biomes, and acts through a prompt. The terminal stays as the test harness.

- Grass, a quarry face, a stream, a hearth; water, fire, wood, stone, oil, a blade, a plant that grows, something edible, weather, day and night.
- About eight properties and six processes.
- One body with needs (the player) and one creature living by the same graph.
- Done when: both worked examples above play out from typed lines with nothing about stones, swords or cautery in engine code; a chain nobody wrote happens and can be explained by `why`; one element is born from a hole, ratified, and then takes part in a second interaction; the clearing keeps changing with the player standing still.

## What it costs

- **Question families.** The clearing needs `parse_intent` (grown to read steps and effort) and `pick_action`, plus three that do not exist: how common is this here (Score, the first use of that primitive), pick the nearest element or none (Choice), and ratify one fact about the world, a property or a reaction (Noul). Section 14 freezes M2 at eight, so this is a decision, with criteria, `not_for`, examples and a paraphrase test for each.
- **Milestones.** "One inn" stops being the gate. The author thread's arc and event scales (section 10) fall away; its texture scale and the proposal inbox stay, as the element proposer.
- **The inn.** Kept as the regression suite for the social substrates and the families, not extended.
- **Risks.** Sameness: a closed vocabulary limits how different elements can be, so the property list has to be chosen for the interactions it yields. Junk: the pool needs the duplicate check and culling from the first day. Aimlessness: with no story, the needs have to bite hard enough to give a reason to act.

## Open

- How a multi-step line is parsed: one call that reads up to a few steps, or one step at a time with the rest held. The inn's parse reads one verb.
- How a searched tile recovers: what makes stones findable there again.
- Whether the pool is global from the start or per world.
- How much a player is told about what a new thing is, and how much they find out by trying.
