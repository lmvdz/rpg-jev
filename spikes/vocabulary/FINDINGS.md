# Vocabulary pass: findings

2026-09-18. No engine code and no Jev calls. 210 synthetic scenarios (687 steps) were written by generative agents that were shown no vocabulary, in three batches. A closed vocabulary was derived from the first, and tested against batches its author had not read, by checkers told to find failures. Method and schema: `README.md`. The vocabulary: `VOCABULARY.md` (version 1) and `results/VOCABULARY-v0.md`.

## The numbers

| Batch | Scenarios | Role | Version 0 | Version 1 |
| --- | --- | --- | --- | --- |
| A: fire, cold, water, mixing, tools, building, food, bodies, growth, finding, creatures, people | 120 | version 0 was derived from it | 58% full, 10% fail | 88% full, 2% fail |
| B: the clever player, the careless and malicious and exploiting, the world alone, odd uses | 45 | **held out from version 0**; version 1 was fitted to it | **40% full**, 9% fail | 80% full, 2% fail |
| C: a settlement's crafts, travel and survival, fights, nonsense | 45 | **held out from version 1** | | **49% full**, 16% fail |

"Full" means every cause and effect that matters to the outcome is expressed by cited vocabulary ids with no stretch. "Fail" means it needs something the vocabulary lacks, or a rule that names a specific thing. The rest are partial: expressible, with something lost. The two figures in bold are the only honest ones; the others are fits.

Every one of version 0's 72 ids was used. Version 1 has about 95 entries: 24 material properties, 12 form tags, a body row, groups, 14 states, 8 body conditions, 10 relations, place rows and states, 10 processes, a load check, 13 effect kinds and 6 modifier rules.

## What held

- **Searching a latent world.** Of ten finding scenarios, eight were fully expressible under version 0, two were partial and none failed: grassland against quarry, a quick look against a long search, the same patch twice, gold where there can be none, finding something else. Abundance as a Score settled once per kind of place, effort and time in code, a fact written on the tile.
- **Exploits.** All five attempts to get something for nothing were fully expressible under version 0: a hundred searches of one patch, one loaf called two, a debt claimed paid, a sword asked for in a meadow, infinite weight in a pack. Bookkeeping in code and latent facts settled once are enough.
- **The burning sword.** Coating, ignition, a fuse on the fuel and heat passing to what the blade touches all derive with no reaction. The scenario's honest answer to "does it cauterize as it cuts" is no: a slicing blade sears the edges and lights cloth, and the wound still bleeds; a hot blade *held* on a wound seals it and burns. So contact time is an input to force and heat, and a reaction is a threshold on an exposure, never a yes or no between two properties.
- **The reaction pool is small.** Across all 210 scenarios, checkers found about a dozen outcomes that no general rule gives: a hard strike on hard making a spark, lye and fat becoming soap, air-starved burning making charcoal, smoke calming bees, taming by repeated feeding, a graft knitting, trapped water bursting a pot in the kiln. Batch C needed three. Nearly all of the play comes from the base rules; generated reactions are the seasoning.

## What version 0 got wrong

102 missing items came down to about a dozen root causes, which recurred across domains and across independent writers and checkers. Version 1's five principles answer them.

1. **A row is a baseline.** Version 0 called material properties fixed and was refuted four ways: iron softens hot and hardens quenched, clay hardens dry, meat turns harmful as it rots, a sapling is not the size of its tree.
2. **Everything that flows has a strength.** Wind had a direction and sound had a kind, and neither had a level. Fire spread, a snuffed lantern, a startled herd and a creaking plank all turned on the missing number.
3. **States have thresholds and rates read conditions**, by one rule, not per state.
4. **Every chosen behaviour has a routine form.** A heron empties a pool overnight with nobody there. Version 0 made what creatures do a Jev choice, and rule 10 forbids Jev where nobody is. Schedules and gap simulation were already in the spec; the vocabulary had not tied them together.
5. **How the actor acts is an input.** Effort, care and haste, and the actor's own strength, speed and senses.

Also: thirst and air as needs (thirst alone caused three failures), groups with a count, pressure in the load check, places that change. Two unifications did more than any single addition: **living contamination** as one quantity (food going off, wounds festering, bad water, ferment, why preserving works, and why boiling makes water safe but not a poison mushroom; it replaced five states), and **oily against watery** (waterproofing, keeping rust off, grease that water will not lift, why soap works).

## What batch C says

Version 1 fixed nearly everything it aimed at, and new domains opened a new layer anyway. Checkers found 0.62 missing items per scenario for version 0 on A and B, and 0.71 for version 1 on C. The share fully expressed rose from 40% to 49%, and what is missing is narrower (fourteen root causes, listed in `VOCABULARY.md` section 9), but the rate of surprise did not fall.

- **Crafts** (5 of 15 full) wanted contamination that weakens what it grows in and heats in bulk, a bent or warped step before cracked, and a wanted ferment racing a souring.
- **Fights** (2 of 8 full, 5 partial) found that version 1 wrote modifier rules for things and forgot bodies: a bleeding fighter weakens, a wounded animal slows. Also a contested hold, aim, and distance finer than three buckets.
- **Travel** (10 of 15 full) found two that matter for a game about walking: thin air, which is the air need met by a place's air level, the same rule as a smoky room; and **bearing**, a mind's sense of where it is, which is a claim with a credence that decays without landmarks.
- **Nonsense** (5 of 7 full) was answered sensibly: licking a sword, eating dirt, wearing a bucket. The two that failed turned on taste and on skill.

## Conclusions

1. **The vocabulary does not close, and should not be expected to.** A core of about a hundred entries carries the domains it was built on at 80 to 90%. Each new domain costs a further ten to fifteen root causes per 45 scenarios. That is the shape "introduce features slowly" should take: a domain is a feature, and this pipeline is its admission test. Write held-out scenarios for the domain, check, add root causes, check again on a fresh batch, admit it when fresh coverage is high enough.
2. **Choose the first slice by coverage.** Searching, fire and heat, water, tools and building, food and growth are where version 1 is strong. Fights and crafts are where it is weakest. The clearing should start without combat and without a forge.
3. **Additions by unification beat additions by entry.** The two that paid most replaced several entries with one. A candidate that only patches one scenario is a smell, in the same way as engine code that names a character.
4. **The engine's real content is the resolution rules**, not the list. Every property is a level on a shared scale so that code can compare; the ten processes and six modifier rules are where the comparison happens. The list is only testable on paper. The rules need code.
5. **Three questions need a person**: skill (without it a first attempt and a hundredth play the same), taste, and electricity. And two deliberate refusals stand: no price rule and no reputation number in code. Bargaining is a ladder of code-built offers with `accept_offer` asked of each rung in one call; reputation is what the claims in many minds add up to.

## Derivability: the rules as code

`packages/core/src/matter` (2026-09-18) turns version 1 into pure functions: element rows and instances, `effective()` running the modifier rules as a table, eight processes behind one entry point `resolve(world, act)` (heat, soak, coat, force, ingest, search, drift, and the load check), a change vocabulary applied by `apply()`, and a reaction table of two rows. Every change cites the vocabulary ids that caused it. Move, give and tell were not rebuilt; they exist in the inn's engine. Not built: bodies' modifier rules, groups, contents and pressure, growth (M3), signals being sensed, places that change.

`test/matter/examples.test.ts` derives the two examples the direction was argued from, from rows alone: the oiled sword lights in a fireplace, it is the coat that burns, for a time code works out, and it is a sword again afterwards; slicing with it cuts and sears and the wound still bleeds; hot iron held on a wound seals it and warm iron does not; a stone is likelier in a quarry than in grass, time buys odds, a found stone becomes real, the same patch cannot be farmed, and gold that is not there is never found.

`test/matter/batch-a.test.ts` runs 25 outcomes from 20 batch A scenarios: **15 derive, 10 do not**, each of the ten marked `it.fails` with its reason so that it turns red the day the rules can produce it. Rows were written once from the anchors and not tuned per scenario; no rule was written for one scenario.

**What coding the rules found that the paper pass could not.** Each of these was "fully expressible" and wrong when run:

| Found by | The rule was wrong because | The general rule now |
| --- | --- | --- |
| The oiled sword would not light | it waited for two kilos of steel to warm | A flame lights a **surface** long before it warms the bulk. Ignition is a test on the surface. The vocabulary has one temperature per thing |
| A belt knife felled an oak in five blows | one contest decided everything | **Cutting and breaking are different contests**: an edge against hardness, a blow (mass times effort) against toughness and bulk. Only a blow shatters. Bulk goes with the cube of size. Edges wear every time |
| A knife tap shattered flint | the blow ignored mass | Same split. Flint is very hard and not tough, so it shrugs off a knife and breaks sharp under a hammerstone, with a spark |
| Hot iron pressed gently cut deep | bite ignored effort | A tool goes no deeper than the arm behind it drives it |
| A wet knife never rusted | rates ran in a fixed order over a whole night, so it dried first | Long gaps are walked an hour at a time. Still closed form, still code (rule 10) |
| Rain could not wet anything | drying ran one way | Wetness moves toward what the air holds, both ways |
| Bread moulded through in a day in a cold cellar | cold was a cliff a settling temperature never reached | Cold slows contamination by degrees |

**What does not derive, and why** (the ten `it.fails`): leather stiffening and cracking when dried hot (M1's second half is not a rule); steam scalding a hand (steam is a signal, not a hot gas that meets a body); banked coals smouldering all night (no air means out); damp cloth going musty (cloth's row has no perishability, and nothing else says damp fibre moulds); ice cracking a jug (contents, swell and pressure are vocabulary only); brine rusting faster (what is dissolved in the wet does not reach the rate); a careless strike spoiling a flake (care reaches coating, not force); a stout lever moving a boulder (load compares mass with strength and knows no leverage); fish keeping in salt; a searched place renewing overnight.

### All of batch A through the engine

Six runners, one per batch A file, each read the whole engine, wrote element rows once from the anchors, and tested every scenario in reach (`packages/core/test/matter/a-*.test.ts`, `rows-*.ts`; per-scenario verdicts in `results/derive/*.json`). They were forbidden to touch the engine. Of 120 scenarios: 22 already covered, 2 derived outright, 30 derived in part, **30 produced a wrong outcome**, 36 turn on mechanisms the engine does not have (sensing, choices, groups, move, give, tell, growth, contents and pressure, places changing).

The 30 wrong outcomes traced to about twenty rules, several found by two or three runners independently. All were "fully expressible" on paper. Fixed centrally, each by a more general rule:

| Was | Now |
| --- | --- |
| Distance only delayed heating: an oil puddle across the smithy lit by itself | The balance a thing tends to is the source weighed against the place, by contact. Distance caps heat |
| Nothing at flammability 2 could ever be lit | Anything that can burn lights at a heat a fire reaches; low flammability costs time and drying |
| A quench took six minutes | A liquid carries heat many times faster than air |
| **Wetness had no substance**: tarred rope would not burn, oiled iron rusted | Wetness carries which liquid it is; what reads wetness reads that liquid's oiliness and flammability |
| A cold block of tar coated a rope; a droplet covered a quarter of a shirt; a second coat erased the first | Only what flows can coat; coverage is amount against size, care decides evenness; the same substance adds |
| Mud bonded like blood | Bond comes from the coat's stickiness and perishability, against its solubility and grain |
| Bone-dry meat rotted; seed rotted in a dry sack | Rot needs water. What is dried through keeps |
| Salt did nothing, and no property said it should | What dissolves readily, as grains, draws water out and ties up what is left |
| Fresh meat was born bone dry | An element has a natural moisture a thing is born with |
| One drying rate: steel, cloth and flesh alike | A surface film goes within hours; held water leaves through pores, against bulk |
| Every wound was fatal; a peck killed by morning | Bleeding lessens of itself, fast for a shallow wound, slowly for a deep one |
| Doses never added; a trace sickened; a wolf sickened on carrion like a person | Doses add, a trace does nothing, and an eater tolerates what it tolerates |
| A maul wrecked an iron wedge; eight blows broke a hot blade | Only what is not tough fractures. A blow on something tough is taken up, and a harder striker only mars it. A brittle striker chips |
| One blow reduced a quarry face to rubble | A small brittle thing shatters whole; a big one spalls a piece |
| A blunt knife cut 61% as well as a keen one; green willow dulled steel like oak | Keenness cuts, against toughness; hardness only decides what can be cut at all, and how the edge wears |
| A cord's bulk was its length; a sack resisted like a block | A cut crosses the thin dimension |
| Whittling broke the branch | An aim (through, along the grain, or working the surface): working the surface removes shavings |
| Eight units of snow weighed what half a unit did; a sound tree barely bore itself; thick ice broke under a walker | Weight counts amount. A steady load is borne by hardness and section; a long thing bears across its thin dimension |
| One long search beat twelve short ones; an hour's search found one mushroom; a quarry ran out after nine blocks; a new find overwrote an old one | Yield is a function of total minutes, however they are cut; depletion is in proportion to the stock a level stands for; ids come from a counter |
| A flaw was found only by a static load | A flaw is found by a blow as surely as by a load |

After the fixes the matter suite is **139 derived outcomes and 64 that do not derive** (203 tests; 29 moved across in the fix pass). Of the 64, 14 are rule errors still open, mostly races between two rates that are each plausible alone (meat drying against meat rotting decides whether jerky can be made; a waterlogged clay bed against a shirt on a line) and the ferment that is eaten as rot, which waits on the vocabulary saying what contamination becomes in what. The other 50 are missing mechanisms, each named in its test.

Two things the vocabulary itself got from this. **Wetness is not one number**: it has a liquid, and it has a place (a film on the surface, or held inside), and both decide what it does. **An element has a natural moisture.** Principle 1 said a row is what the thing is like "whole, dry, mild and full grown", and fresh meat is not dry.

A caution about the method. Fixing twenty rules moved constants that other tests leaned on, and seven runner encodings had to change because a parameter's meaning changed under them (contact is now a balance, not a rate; a search yields a count; grain needs an aim). Each change is recorded where it was made, and none was made to a row. But the constants are now fitted to 203 assertions written by the same family of model that wrote the rules. Batches B and C have not been run, and should be run before any more tuning: they are the held-out test of the rules, as they were of the vocabulary.

### Batch B through the frozen engine: the held-out number

Rules frozen at `ea6a1630b5cc` (a hash of `packages/core/src/matter/*.ts`), unchanged from launch to the last report. Three runners, the same instructions as batch A plus a confidence for every verdict (`b-*.test.ts`, `rows-b-*.ts`, `results/derive/b-*.json`).

| | Derived | Not derived | Of which rule errors |
| --- | --- | --- | --- |
| The clever player | 30 | 16 | 7 |
| The careless, malicious and exploiting | 31 | 17 | 7 |
| The world alone, and odd uses | 28 | 19 | 10 |
| **Batch B, rules never fitted to it** | **89 (63%)** | **52** | **24** |

By scenario: none of the 45 derives whole; 19 derive in part, 15 hit a rule error (6 high confidence, 7 medium, 2 low), 11 turn wholly on unbuilt mechanisms. For comparison, batch A's first 25 outcomes, before any fixing, were 15 derived and 10 not (60%). So fitting twenty rules to batch A did not make the rules noticeably better on scenarios they had not seen: **the rules generalise about as well as they did before they were fixed**, and what the fix pass bought was mostly batch A.

**The worst finding is a conservation failure, and it is in code written during the fix pass.** A blow that breaks a piece off creates the piece and takes nothing from what it came from, and goes on doing so after the thing is in pieces. Twenty blows turn one loaf into eleven; eating them takes hunger from 5 to 0 where a loaf takes it to 3. The same rule knaps keen flakes from a flint without end. `docs/sandbox-direction.md` rests the whole design on "nothing is made from nothing", and no test asserted it. Two of the three bookkeeping tricks in reach succeed (the loaf, and drying a torch under water by heating it, then lighting it on the bank); two are stopped (a hundred searches of one patch yield the two stones the level stands for and then exactly nothing, however the time is cut; stacked ingots weigh what loose ones do). The search also accepts negative minutes, which refills the stock: the engine does not guard its inputs.

**The rule errors cluster, and the clusters are the finding:**

- **Amount is not read where it should be.** Heat never reads how much there is on either side: one hot stone boils a hide full of water as it would a cupful, a pond of 5,000 chills as fast as a cup, a spark heats like a furnace, the source never cools. Fuel ignores amount: a thousand tufts burn out in the ten minutes one does. A cupful of poison taints a well of 500 as much as a bucket of 2. Batch A's fix made *load* read amount; nothing else was made to. The general rule is one rule: **every exchange is between quantities**, level times amount on both sides, and what one side gains the other loses.
- **Outcomes depend on how time is cut, below the hour.** Thermal shock tests the drop within one act, so five minutes in water cracks a stone and five one-minute acts never do. Bleeding is charged for a whole step at the rate it began with. A burning coat is put out for the whole step in which its fuel ends. Over long gaps drift holds (one act, 47-minute acts and 7-minute acts agree within 0.05 of a level; a season agrees exactly); the fault is in events inside a step, and a step has to be cut where the event falls.
- **A process does not ask what kind of thing its source is.** Hot water lights kindling, because ignition asks only how hot the source is. Rain wets a burning tree to 3.4 and it burns on at full heat, because burning reads only air. Drying runs under water. Frozen water is liquid, because phase never reads temperature.
- **An act's roles decide what should be symmetric.** A shield driven into rock comes off untouched and chips the rock; told the other way round, the reverse. A collision falls on both.
- **A sheet is thin to a cut and wide to a load.** Seven needle holes destroy a leather pack (each stitch is charged as a cut across it); an ice sheet is stronger the wider the pond.
- **Dried clay sets like fired clay**, so a riverbank shrugs off a month of rain. The vocabulary's M5 says "dryness or heat" and shares the fault: drying should harden through M1 and come undone; only firing sets for good.
- **A second coat of a different substance still erases the first** (fixed for the same substance only, in the batch A pass).

**Where chains break** is a separate finding from where rules are wrong. Multi-step chains break at the first step that needs something to reach something else at a distance: smoke to bees, light to a wolf, scent to a scavenger, a signal seen from a hill. The engine emits signals and nothing receives them. **Sensing is the most valuable missing mechanism**, ahead of any single rule. After it: contents (a jar, a pack, a crack with water in it), and three properties the vocabulary has and no rule reads (porosity beyond drying, buoyancy, friction), which is why a shirt cannot filter, a door cannot float and a shield cannot slide.

**What this says about the method.** Fixing rules one error at a time against the batch that found them produces rules fitted to that batch. The errors that survived into batch B are not twenty more special cases; they are about four missing invariants that no scenario states and every scenario assumes: quantities are conserved across every exchange, an outcome does not depend on how time or an act is cut, a collision is symmetric, and inputs are in range. These should be **property tests over the engine**, run over every process with generated worlds, before another scenario is encoded. Batch C stays unopened until they pass.

### The invariants, as property tests

`packages/core/test/matter/invariants.test.ts`: twelve properties over every process, in worlds made from a seed with the repo's own `Rng`, so a failure names the seed and the act. Ten of the twelve failed when written. The engine was changed until all passed, and only then were the scenario tests run again.

| Invariant | What failed | The rule now |
| --- | --- | --- |
| Nothing is made from nothing | Striking water broke a piece off it; a piece took nothing from its parent; a piece of a coated thing came away with a second coat; a hot stone never cooled; fuel ignored amount; a dose ignored amount | A piece's amount comes out of its parent, and a thing in pieces gives no more. Heat is exchanged between quantities (level times mass times amount), and what one gains the other loses. What burns gives by its size and for as long as its fuel lasts. A carried dose is spread over what it lands in. A second substance does not erase the coat that is there |
| An outcome does not depend on how time is cut | Drift differed by 0.22 of a level between one act and forty; a thing held in a flame in one-second acts never lit; five minutes in water cracked a stone and five one-minute acts did not; bleeding and a burning coat were charged for a whole step | Time is walked in short steps cut where something happens, and in longer strides across long gaps. The surface's lead over the bulk is carried as state. Shock is decided by the gap at the moment of the plunge. Bleeding is the area under a falling line. A search's yield is a stretch of one curve over all the minutes spent |
| A collision falls on both | Only the thing called the patient could break | The striker meets the same rule under the same momentum; a careful blow spares it |
| Every level stays a level | Negative minutes refilled a searched place; not-a-number spread | The one entry point brings every number an act carries into range before any rule sees it |

Also fixed in the same pass, as rules about what kind of thing a source is: only what is burning or glowing can light a thing (hot water could); a fire goes out when what burns is too wet to burn (rain did not put one out); what flows freezes at the bottom of the scale; nothing dries below what its place keeps in it, whatever heats it (a torch dried under water); smothered wood is still there (it turned to ash).

**After the invariants**, with no scenario-by-scenario tuning: batch B went from 89 derived and 52 not (63%), to **102 derived and 39 not (72%)**, counted by the test runner, and its open rule errors from 24 to 11. Batch A stands at 128 derived and 63 not (67%). Sixteen outcomes crossed over and thirteen of them were batch B rule errors, none of which the fix pass was aimed at by name; two went the other way and one test was split. That is the difference between the two ways of working: twenty rules fitted to batch A bought nothing on batch B; four invariants bought nine points. It is a measurement on a batch the fixes had already been shown, so it says the invariants were the right diagnosis, not what the engine will do on scenarios it has not seen. Batch C says that.

Two tests went the other way and are recorded as open, because the invariant is right and the scenario disagrees with it:

- **The poisoned well.** Now that a dose is a quantity, a handful of berries in a well of 500 is diluted to nothing at once. The scenario has the poison mix through gradually, so that the first households to draw get the worst of it. That needs a well that is not one instance, and levels that are not linear in dose.
- **Wood on rock.** Now that a collision falls on both, a rock outcrop chips when a wooden shield is driven into it. One level of hardness separates wood from rock and also a hammerstone from flint, so hardness and toughness alone cannot tell "cannot harm it" from "knaps it". Something about how a blow is placed (an edge, a platform, care) is doing work the vocabulary does not name.

**The cost of the time invariant.** Drift now takes steps of five minutes near at hand and a five-hundredth of what is left across a long gap, so a year unwatched is a few thousand steps per region, not a hundred thousand. That is affordable for rule 10 and it is not closed form: it is a bounded integration. Whether it is fast enough for a village of regions is unmeasured.

Batch C is still unopened. It is now the held-out test of the engine as it stands.

### Batch C through the frozen engine: the number that was owed

Rules frozen at `8e309bdcc284` (a hash of `packages/core/src/matter/*.ts`; git `701600d`), unchanged from launch to the last report. Batch C had never been run through the engine, and its author had read it only through checker verdicts (`c-*.test.ts`, `rows-c-*.ts`, `results/derive/c-*.json`).

| | Derived | Not derived | Of which rule errors |
| --- | --- | --- | --- |
| Travel and survival | 26 | 11 | 2 |
| Fights and nonsense | 17 | 10 | 3 |
| A settlement's crafts | 37 | 31 | 15 |
| **Batch C, never seen** | **80 (61%)** | **52** | **20** |

By scenario: 1 of 45 derives whole, 24 in part, 13 hit a rule error (7 high confidence, 6 medium), 7 are wholly unbuilt. No scenario contradicted an invariant.

**The honest reading.** Batch A before any fixing was 60%. Batch B against a frozen engine was 63%. Batch C against a frozen engine, after twenty rule fixes and four invariants, is 61%. **The engine derives about three outcomes in five of a domain it has not seen, and nothing done so far has moved that.** The invariants raised batch B from 63% to 72%, and that was real, but it was batch B. What they bought shows elsewhere: no scenario in batch C contradicted an invariant, none of the 20 rule errors is a conservation failure, a cut-dependence or a bad input, and the exploit scenarios that batch B broke stay closed. The invariants made the engine *sound*; they did not make it *complete*. Coverage is a function of how many mechanisms exist, and crafts (54%) needs more of them than travel (70%).

**Two of the twenty rule errors were in code one day old**, written for the renderer: `extent` multiplies the stock of everything, which is right for a density such as stones and wrong for a single thing (a rumoured cache is likelier found in a big mine than in one chamber, and a long search turns up two and a half of them); and a long rope is stronger than a short one, because load takes only `long` things across their thin dimension while force already treats a cord as having no thickness. Both are the same fault, and it is the next invariant:

- **One concept, one function.** A form means the same to every rule that reads it (a cord is thin to a cut and to a load; a sheet likewise). Whatever comes into being is born by one path (a found thing ignored its element's moisture, because search built its own state). A level is the same size of step everywhere it is used (mass adds as doublings in load, so thirty pots outweigh a boulder; drying is linear in bulk levels, so an oak timber dries in three days).
- **Conservation, extended.** What force removes should become a thing (a spade stroke consumes a share of a clay bank and creates nothing; scraping a hide takes the hide and leaves the fat on it). The minutes a fire gives should come out of its fuel (two eight-hour firings leave the woodpile untouched). What a hot thing loses, the thing that cooled it gains (a quench trough never warms).
- **Surface against bulk, a third time.** A source is weighted by its whole heat capacity at its surface temperature, so an oven fifteen minutes in the flame bakes like one fired for hours. Cooking and kindling sit at the same threshold, so a loaf is either raw or alight. Soaked thatch keeps a flammability of 1.3 and burns through an hour of rain: wetness should be read against saturation, and a wet surface has to dry before it lights.

**Bodies are the largest missing piece, from three independent runners.** A body has no row, so a cudgel wounds a bear as it wounds a man and a paw does what a hand axe does; no temperature, wetness, mass or strength, so nothing of cold, wet or tired can happen to it; armour worn does nothing, because a blow at a body always meets one constant for flesh; a failed load does nothing to what it held, so a man in a pit trap is unhurt; nothing can be bound onto a body; hunger does not drift. A body should be a thing with needs, not a separate kind of record.

**What derived that nobody had tested:** a hide shield holds the first thrust and parts on the second; a cuirass as a thing takes one axe swing and parts on the third; a lick of a cold edge does nothing and a lick of a scorching blade burns without cutting; eating dirt feeds nothing and sickens mildly hours later; an unsalted hide rots in two warm days and a salted one keeps; grain binned dry keeps and grain in a damp undercroft moulds in six weeks; sea water sickens where fresh does not and boiling does not help; pots smash on a hard fall and survive a gentle one, the same whichever is called the striker.

**What there is no held-out batch for now.** A, B and C have all been shown to the engine's author. Any further claim about generalisation needs a batch D, written fresh, before the next round of fixes and not after.

### After batch C: two more invariants, bodies, and the first creature

**One concept, one function; conservation extended** (`invariants-2.test.ts`, seven properties, all failing when written). `scale.ts` is where whatever two rules need to know lives once: a level of mass is a step of four, for weight and for heat alike (thirty pots no longer outweigh a boulder); a cord or a sheet is thin to a load as it is to a cut; a thing is born as wet as its element is moist by whatever path. What force takes off a thing becomes a thing, the minutes a fire gives come out of its fuel, a quench trough warms, and a rare thing is a couple in the whole place however big it is. Ten scenario outcomes crossed over, among them both of batch C's day-old rule errors. Eight assertions whose magnitudes had been set against the old scale went the other way and are marked `RECALIBRATE`: changing what a level means is the most expensive kind of change, and the cost shows up as other people's thresholds. One thing the vocabulary cannot say came out of it: a thread and a hawser have the same toughness and differ only in thickness, and a cord has no thickness (its size is its length).

**Bodies** (`bodies.test.ts`, properties first): a body grows cold by how cold the place is, faster wet and in wind, slower for what it wears (a soaked coat is worth less, which the modifier rules already said) and by a fire; hunger and tiredness come with the hours; what is worn meets a blow first; what a load held falls when it gives way; `able()` lowers what a body can do by hurt, cold, tiredness and sickness. Five batch B and C outcomes crossed over. A body is still a record beside things, not a thing with needs: that refactor is owed.

**The first creature, and the first time Jev met this engine** (`results/creature-probe.json`, ten live calls, about $0.0003). `optionsFor()` builds a wolf's closed options from what it has noticed (it cannot be offered a kill it has not smelt), code puts its needs and percepts into words, and the `pick_action` family chooses; `routine()` chooses by its needs when nobody is watching. Paired twins, direction fixed beforehand, both wordings:

| The wolf | Goes to the kill | Flees the fire | Rests |
| --- | --- | --- | --- |
| Starving, no fire | 0.95 / 0.93 | | 0.01 / 0.02 |
| Fed, no fire | 0.27 / 0.16 | | 0.68 / 0.80 |
| Starving, a fire far off | 0.87 / 0.71 | 0.10 / 0.26 | |
| Starving, a fire by the kill | 0.77 / 0.56 | 0.20 / 0.40 | |
| Fed, a fire by the kill | 0.10 / 0.07 | 0.74 / 0.76 | 0.15 / 0.16 |

Every twin moves the right way: hunger moves it to the kill, a fire moves it off, and a nearer fire moves it more. The largest paraphrase shift is 0.20, on the one case that is a real contest (starving, with a fire by the kill), which is where a spread is a coin flip to take and not a failure (SPEC section 14). The whole path is the constitution in miniature: the world's state is code, the options are a closed set built by code with nothing among them, every number reached the judge as words, the judge chose, and code would carry the choice out as a `move` act. No new question family was needed: this is `pick_action`.

**Batch D is written and unread** (`results/scenarios/d-*.json`, 45 scenarios: a homestead through a hard winter, a river and what people do with one, noticing and being noticed). It is the held-out test of the engine as it now stands, and should be run before the next round of fixes, not after.

The salt one matters most. Version 1 says salt, smoke, dryness and strong drink slow contamination, and **no property of salt says so**: the vocabulary states the effect and gives the engine nothing to read. It wants a property (what it does to living contamination), which would also be why smoke and strong drink work. That is a version 2 candidate the paper pass missed, and it was only visible from the row.

**What this says about method.** Seven rule errors in the first forty assertions, none of them visible on paper, and all of them fixed by a more general rule rather than a case. Expressibility is cheap and necessary; derivability is where the design is actually tested, and the scenarios are a test suite that already exists for it: 190 scenarios have not been run yet.

## Limits of this pass

- Writers, checkers and the vocabulary's author are all the same family of generative model. They share blind spots: what none of them thinks of is not in the data. A person's playtest is still the only outside view.
- Checkers were told to err strict and did (partials for a sled that veers, salt missing one fold). They were not audited step by step; the recurrence of the same gaps across independent checkers is the evidence that the gaps are real, and it says nothing about gaps all of them missed.
- "Expressible" is not "derivable". A scenario is full when the vocabulary can *say* what happened. The section above is the first test of whether rules *produce* it, on 20 of 210 scenarios; the constants in those rules (rates per minute, the exponent on bulk) are first guesses held only by those tests.
- Version 2's candidates are untested by construction.

## Files

- `VOCABULARY.md`: version 1, with version 2 candidates in section 9. `results/VOCABULARY-v0.md`: version 0.
- `results/scenarios/`: 210 scenarios in nine files. `a-` and `b-` have been used to fit; `c-` has been read only through checker verdicts.
- `results/coverage/`: version 0 verdicts on A and B. `results/coverage-v1/`: version 1 verdicts on what version 0 did not fully express, and on all of C.
- `results/counts-a.txt`, `results/tally-v0.txt`, `results/v1-summary.txt`: the tables.
- `results/CHECKER.md`, `results/CHECKER-v1.md`: the checkers' instructions. `results/scripts/`: throwaway counting scripts, not linted.
