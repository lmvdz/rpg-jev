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

## Sensing

Batch B's chains broke at the first step that needed something to reach something else at a distance (smoke to bees, light to a wolf, scent to a scavenger, a signal seen from a hill), and the playable clearing has the same hole: the engine emits signals and nothing receives them. This is X8's other half. It is designed here before it is built, invariants first, because the batch B run showed what happens the other way round.

**What is emitted.** Two sources, and only the second exists today.

- *Standing emissions*, read off state and never stored: a burning thing gives light and smoke by how hard it burns (`blaze`); a thing gives scent by its effective scent and how much of it there is (so a carcass smells more each day, which the rules already derive); a thing hot enough glows.
- *Event signals*, the `signal` changes an act already makes: the sound of a blow, the crack of a plank, steam.

**What carries it.** A strength from 0 to 5 on a channel (light, sound, scent, smoke), lessened by distance, by what is in the way, and by what it competes with on its own channel: a fire is seen far at night and hardly at noon; a footstep is lost in a storm; a strong smell covers a weak one. Wind carries scent and smoke and thins them. Distance needs positions, which matter does not have: a thing and a body gain an optional position in tiles, absent meaning "right here", so nothing built so far changes. Places gain an optional light and noise level.

**Who receives it.** A body, by the acuity of the sense (a body row, which bodies do not have yet: the vocabulary has it and the engine gave bodies no element) and by its attention: alert, distracted, asleep. What is received is a **percept**: this body, this channel, this source, this strength. Sensing is deterministic: no draw. A percept is either above the body's threshold or it is not.

**What it is for.** A percept is not a belief and does nothing by itself. It is what the next layer is built from: the option set for `pick_action` ("there is fire that way", "something smells of meat upwind") when someone is watching, the routine when nobody is (rule 10), and a claim held with its source when the perceiver is a person (E8: "saw it", which is how a deed gets a witness). Matter's job ends at the percept. That keeps the judge out of physics and physics out of the judge.

**Where it runs.** After an act, inside `resolve`, over what the act changed and what stands emitting in that place; and at the end of a drift. Cost is bodies times emitting things, and few things emit.

**The invariants, written before the rule:**

1. No percept without a source: every percept names a thing that emits on that channel, or an event that happened.
2. Stronger is never less noticed. Nearer is never less noticed. More in the way is never more noticed.
3. What an alert body misses, a distracted one misses, and what a distracted one misses, a sleeping one misses.
4. A louder or brighter surrounding never makes a weak signal easier to notice.
5. Sensing changes nothing but what bodies are aware of: no thing's state, no amount, no heat.
6. The same world sensed twice gives the same percepts, and cutting a wait into parts does not change what is noticed at the end of it.

**Built** (`packages/core/src/matter/sense.ts`, `test/matter/sensing.test.ts`): the six invariants were written first and the rule passed them on its first run. A fire is seen across a wood at night and hardly at noon; a carcass is smelt further each day, by a wolf long before a person; a blow is heard by who is near, and the act that made it records the hearing. A body may now name an element row for its hide, bulk and senses (the first step toward a body being a thing with needs, which three batch C runners asked for independently); a blow reads it, so a bear is no longer a man.

**The next layer exists in its first form** (`packages/core/src/matter/living.ts`): `optionsFor()` builds a creature's closed options from its percepts, `routine()` chooses by its needs when nobody watches, and a live probe had Jev choose for a wolf through the existing `pick_action` family, with every twin moving the right way (`spikes/vocabulary/FINDINGS.md`).

**What it will not do yet.** Line of sight around things (there is no geometry in matter; "what is in the way" is the place's cover as one level). Memory of what was sensed (that is the claim store's). Deciding what a creature does about it.

## Minds: many factors, no list of cases

The first creature was a list of cases: what burns may be fled, what feeds may be approached. A wolf is more than that. Another creature may be provoking it; it may be a mother with young to feed; it may be hurt, cornered, on its own ground, or remember this place. A design that adds a branch for each of those is the shape this project exists to avoid (`.claude/skills/world-design`). Two questions have to be kept apart.

**Can the judge weigh many factors at once?** Yes, measured (`spikes/vocabulary/results/mind-probe.json`, twelve live calls, the existing `pick_action` family, state written by hand on purpose). Same stones thrown, same hunger: a lone male flees (0.52) and a mother stands between the intruder and her den (0.68) and leaves the meat. A starving mother with nobody about eats, or carries meat home (0.25 to 0.46). Badly hurt, with three armed people closing, she still guards (0.78). The bond is what flips it, and the judge needed nothing new to see that.

**Can the engine produce that state and those options without a case per factor?** Not yet, and this is the work. The answer has the same shape as the answer for things: **a closed vocabulary of kinds, open rows, and code that derives.** A factor is never a branch. It is a structure the world already keeps, put into words by one function and ranked by one score.

| Kind of factor | The structure it lives in | In the example |
| --- | --- | --- |
| What it needs | The needs graph, per body, rising with time | starving; nursing takes more every day |
| What it can do now | `able()`: its row lowered by hurt, cold, tiredness | a deep wound, can barely run |
| Who it is bound to | **Bonds**: a relation from one body to another with a kind (young, mate, pack, owner, prey, rival) and a weight. A ward's needs count as its own, by that weight | four pups who cannot feed themselves, crying |
| What it holds and where it lives | Ownership (R9) and a **home**: a claim about a place | the den under the fallen tree |
| What others have done | **Deeds** on the witness path (SPEC section 9), which sensing now feeds: a percept of an act is a deed witnessed | two stones thrown, shouting, coming closer |
| How it feels toward someone | Feelings (B6) toward a specific body, moved by deeds, by predicate and never by who, fading with time | anger and fear toward the thrower |
| What the other could do to it | The other's `able()`, its size, what it holds, how many | smaller than it; or three, with spears |
| What it notices | Percepts (`sense.ts`) | the meat; the person twenty paces off |
| What it is like | Traits as levels on its row | wary of people, patient |
| What it knows | Claims it holds, including of places (E8) | meat was here yesterday |

Sex is not a factor. What matters is on the row and in the state: whether it bears young, whether it is nursing (a `produces`, and a drain on a need), whether it has wards. A design with a gender branch has misnamed a bond.

**Options come from affordances, not from a list of situations.** An option is an **intent** toward something the body is aware of. Intents are a closed set, the counterpart for minds of the ten processes: go to, keep away from, take, eat, carry to, guard, warn off, attack, follow, hide from, call, rest, and none. Code offers an intent when its precondition holds against the structures above (guard needs a ward or a home and a threat near it; carry to needs a ward that cannot come and something that serves its need; warn off needs another body within reach of a rush), and says in words what it serves and what it risks. Twelve intents over everything a body notices is too many to ask about, so code ranks by salience (how urgent the need it serves, how near the threat it answers) and keeps a handful, with none always among them (SPEC section 14: long lists are ranked in code first). An intent compiles to acts the rules already resolve. Adding an intent is a row: a precondition, a description, and how it compiles.

**One slice builder.** The state the judge sees is compiled from those structures by one function, within a token budget, most salient first: the same slice compiler the inn uses (SPEC section 13). Nothing is written by hand per creature. Every number reaches the judge as words.

**The routine is the same options, scored in code.** When nobody is watching (rule 10), the choice is the option with the best score: what it serves, weighed by how urgent that need is (a ward's need counted by the bond), less what it risks, weighed by a trait. That gives a test no list of cases could have: over many generated situations, the routine's choice should usually be among the judge's two likeliest. Where they part, either the score or the words are wrong, and section 20's representation loop is how that is found.

**Scaling in number is a different question and already has its answer** (SPEC section 11): events and not ticks, a judge call only where someone is watching, the routine everywhere else, and a group acting as one.

**Derived and measured** (`spikes/minds/INTENTS.md`, 2026-09-19). The intent list was derived from 120 scenarios written with no list given, and measured with Jev: 34 intents say every act in 90 held-out scenarios (none of these: 0%), a control proves the judge does say none when it should, and Jev's own choice is among the writer's plausible acts two times in three. The list guessed above from one wolf was missing a third of it, and the table of factor kinds was missing its largest entry: custom and rank. `work_on` is the intent that joins minds to matter.

**How to know it covers "so many other factors".** The way the vocabulary was tested. Write held-out scenarios of what a creature or a person does and why, with no vocabulary given; derive the smallest set of factor kinds and intents that says them; test on a batch its author has not read. Expect it not to close, as the vocabulary did not: a domain of behaviour (parenthood, rank in a pack, territory, trade) is a feature, admitted when held-out coverage says so. The table above is version 0 and came from one example.

**What to build, in order.** Bonds and homes as structures, with a ward's needs reaching its keeper. Deeds from percepts, moving feelings by predicate. Intents as rows, with preconditions and salience, replacing `optionsFor`. The slice builder, replacing the hand-written words of the probes. The routine as a score over the same options, with the agreement test against the judge. Properties first, each time.

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
