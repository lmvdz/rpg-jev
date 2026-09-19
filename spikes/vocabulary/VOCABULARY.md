# Closed vocabulary, version 1

2026-09-18. Version 0 (`results/VOCABULARY-v0.md`) was derived from batch A alone and tested on A and on a held-out batch B: 58% of A and 40% of B were fully expressible, 10% and 9% failed outright, and every id was used. Version 1 answers the root causes behind the 102 things checkers found missing. It is fitted to A and B, so it is tested on a new held-out batch C. Ids from version 0 keep their numbers. Nothing in this file names a specific thing, and nothing in the engine may.

## 0. Five principles version 0 got wrong

1. **The row is a baseline, not a fact about the instance.** An element's row gives its properties when whole, dry, mild and full grown. An instance carries where it stands now, and the modifier rules of section 7 say how states move its effective properties. Version 0 called properties fixed, and was refuted from four directions: iron softens hot and hardens quenched, clay hardens dry, meat turns harmful as it rots, a sapling is not the size of its tree.
2. **Everything that flows or signals has a strength.** Wind, current, light, sound and scent are levels from 0 to 5, never only a direction or a kind.
3. **Every state has thresholds and every rate reads its conditions.** Crossing a threshold is an event. What speeds or slows a drift (salt on iron, oil on iron, cold on meat) is read from the instance's coating, contents, wetness, temperature and place, by one rule.
4. **Every chosen behaviour has a routine form.** What a creature chooses when someone is watching is `pick_action`. When nobody is watching, the same need is met by a rate in code (a heron takes so many fish a night). Without this, rule 10 and a living world cannot both hold.
5. **How the actor acts is an input to every process.** Effort, care and haste are closed levels read from the typed line or set by the creature's state; the actor's strength, speed and senses come from its row. A bandage tied one-handed in a hurry is a weaker join.

Every scalar is a level from 0 to 5 with anchors, so that each is a Score question Jev can ratify in one hop. Code compares levels and does all arithmetic.

## 1. Material properties (the element's baseline row)

| Id | Property | 0 | 5 | Does the work in |
| --- | --- | --- | --- | --- |
| P1 | mass | a feather | a boulder | carrying, load, impact, sinking, how much heat it holds |
| P2 | size | a seed | a tree | reach, containing, visibility, spans |
| P3 | hardness | mud | steel | what cuts, dents or scratches what; a hard strike on hard makes a spark |
| P4 | toughness | glass, dry twig | rope, green wood, leather | whether force breaks it or it gives; low toughness cracks under sudden heat or cold |
| P5 | flexibility | stone | cord, cloth | binding, wrapping, bending without breaking |
| P6 | flammability | stone, water | oil, dry tinder | whether heat lights it, and how fast it burns |
| P7 | conductivity | wool, ash | iron | how fast heat passes through it |
| P8 | melts at | never | just above a warm day | softening, melting, setting when cool |
| P9 | absorbency | glazed pot | cloth, dry soil | taking up liquid, holding it, drying slowly |
| P10 | porosity | iron | loose weave | what gets through it: liquid, air, light, small creatures; filtering |
| P11 | buoyancy | iron | cork | float or sink |
| P12 | solubility | stone | salt | dissolving into a watery liquid, washing out |
| P13 | stickiness | dry sand | tar | coating, gluing, picking up dirt |
| P14 | friction | wet ice | rough stone | footing, sliding, knots holding, rubbing |
| P15 | perishability | stone | raw meat | how well it feeds living contamination (S9) |
| P16 | corrodibility | gold, wood | bare iron | rust under wet and air |
| P17 | noxiousness | clean water | deadly mushroom, lye | harm to living tissue, by route: eaten, breathed, touched |
| P18 | potency | none | strong drink, strong medicine | intoxication, sedation, help in healing, by the same routes |
| P19 | scent | none | rotting meat | what a nose finds at a distance |
| P20 | serves | the needs graph, −3 to 3 per need | | nourishment, drink, warmth, rest, coin, safety, company |
| P21 | oiliness | water | oil, tar, wax | oily and watery do not mix: an oily coat sheds water and keeps rust off; water alone will not lift it |
| P22 | swell | none | water freezing, dry wood soaking | how much it grows on freezing or on soaking; the push goes to Load |
| P23 | setting | never | clay, glue, daub, dough | hardens for good once dried or fired past a threshold |
| P24 | cleansing | none | soap, lye, sand | lifts a bonded coat: by bridging oily and watery, or by scouring |

**Form** tags, several per element: `hollow`, `flat`, `long`, `pointed`, `edged`, `round`, `sheet`, `cord`, `granular`, `liquid`, `gas`, `grained` (splits and carves along one direction, catches across it). A thing works as a tool because of its form and its levels, never its name.

**Kind**: `material`, `thing`, `plant`, `creature`, `person`, `place`. A plant or creature row also carries `produces`, `eats`, and its **body row**: strength, speed, and acuity of sight, hearing and smell.

A **group** is an instance of a plant, creature or person kind with a **count**: a warren, a shoal, a swarm, a herd, a field of wheat. It senses, startles and moves as one, is fed on and breeds as a number, and splits into individuals when one matters.

## 2. States (on the instance)

| Id | State | Notes |
| --- | --- | --- |
| S1 | temperature | frozen, cold, mild, warm, hot, scorching |
| S2 | wetness | dry to soaked; bounded by absorbency |
| S3 | burning | with fuel left; a heat source that gives light and smoke and needs air; starved of air it chars instead |
| S4 | integrity | whole, cracked, broken, in pieces |
| S5 | edge | keenness of an `edged` or `pointed` thing |
| S6 | phase | solid, liquid, gas; follows S1 and P8 |
| S7 | coating | a substance on the surface, with an amount, a coverage, and a **bond** that rises as it dries into something absorbent |
| S8 | contents | for `hollow` things: what is inside, with amounts; open or sealed; a sealed space has a **pressure** |
| S9 | contamination | a load of living rot, mould and sickness. It grows where there is warmth, damp, air and something perishable; heat, salt, dryness, smoke, strong drink and cleansing kill or slow it. Food's freshness, a wound's infection, bad water and ferment are this one quantity |
| S10 | corrosion | driven by P16 |
| S11 | retired | preserving is not a state: dried, salted, smoked and sealed are S2, S7 and S8 acting on S9's rate |
| S12 | growth | seed, sprout, growing, mature, bearing, dormant, dead; with vigour |
| S13 | taint | a carried dose of P17 or P18 that is not alive; travels with the substance through eating, producing, soaking and mixing; heat does not remove it |
| S14 | amount, or count for a group | how much, or how many |
| S15 | flaw | a hidden weakness left by bad making, overheating, a knot, a hairline crack; found by Load, not by looking |

A **mixture** is amounts of several substances; a **composite** is things joined. Code derives their properties from their parts. Whether one *is* some known element is the select-or-none question.

## 3. Body

| Id | Condition | Notes |
| --- | --- | --- |
| B1 | needs | hunger, thirst, air, rest, warmth, money, safety, company. Thirst and air are new: asked of the needs graph in `packages/core` |
| B2 | health | what is left |
| B3 | wound | a site, a depth, and quantities: bleeding, burned, broken, swollen, and S9 for infection |
| B4 | sickness | with an onset delay and a course; from S9, S13, exposure or P17 |
| B5 | intoxication | from P18 |
| B6 | feeling | fear, anger, trust, wariness toward someone or something; builds and fades with repeated experience |
| B7 | attention | attending to what; alert, distracted, asleep, dormant |
| B8 | impairment | a sense or limb working worse for a while: dazzled, deafened, numb, lame, winded |

## 4. Relations (computed by code)

| Id | Relation | Notes |
| --- | --- | --- |
| R1 | distance | near, reachable, out of reach |
| R2 | contains / inside | |
| R3 | supports / rests on / hangs from | a `long` rigid thing across a support multiplies effort by its length: a lever |
| R4 | joined to | with a strength that drifts under use, drying and wet |
| R5 | covers / sheltered by | |
| R6 | access | what can get in or out through the openings: air, water, light, a hand, a pest. Openings and P10 against the size of what is trying |
| R7 | up and down: wind, hill, stream | with the strength of the flow |
| R8 | light on, line of sight to | |
| R9 | holds / owns / guards | |
| R10 | fit | how well two forms mate: a haft in a head, a lid on a jar, a plug in a hole |

**Place** rows carry `slope`, `footing`, `cover`, `shelter`, `enclosure`, `depth`, and a latent **abundance** per element kind. Place **states** change like any other: moisture, fertility, standing water or snow, temperature, light, wind strength, flow strength, ambient sound. Plants draw moisture and fertility down; drift and force reshape a place (erosion, silting, a dug pit, a dammed stream). Variation inside a place is the map's job: finer tiles, not a richer row.

## 5. Processes

| Id | Process | Verbs it absorbs | Resolves by |
| --- | --- | --- | --- |
| X1 | move | take, drop, carry, drag, push, throw, climb, wade, swim, fall, flee, approach | mass and size against strength; friction, slope, flow; speed against speed for a chase |
| X2 | force | strike, cut, pierce, split, crush, dig, gnaw, trample, a landing | instrument's hardness, edge, mass, leverage and the actor's effort and care against hardness, toughness and `grained`; makes damage, pieces, wounds, wear, sparks and sound. Contact time is an input |
| X3 | heat | warm, cook, boil, scorch, ignite, chill, freeze, thaw, quench, cauterize | heat flows toward balance at a rate set by conductivity, contact, wetness, wind and time; mass is how much it holds; sudden change cracks what is not tough |
| X4 | soak | pour, fill, spill, leak, rain on, douse, wash, wring, drain, absorb, dissolve, filter | liquid moves by gravity, absorbency, porosity and access, and takes solutes, loose coats, S9 and S13 with it; oily and watery do not mix without P24 |
| X5 | join | tie, bind, wrap, bandage, coat, smear, glue, plug, seal, graft, build | makes R4, R5, R10 or S7 with a strength from stickiness, friction, flexibility, fit and the actor's care |
| X6 | ingest | eat, drink, breathe, take in through skin or a wound | serves, P17, P18, S1, S9 and S13 pass into a body by route, with delays |
| X7 | drift | burn down, char, rot, ferment, rust, dry, set, evaporate, cool, grow, ripen, heal, fester, starve, tire, wear by rubbing, silt, erode, breed, die off | a state or a count changes at a rate read from conditions, in closed form, so unobserved time is code |
| X8 | sense | see, hear, smell, feel, notice, search, track, remember | a signal's strength against distance, cover, ambient level, other signals on the same channel, acuity and attention; search adds effort and settles latent facts, including ones not sought |
| X9 | give | give, pay, trade, lend, steal | possession and ownership change; a debt may be made. Whether a trade is taken is a judgment (`accept_offer`) over what each thing serves the taker, never a price rule |
| X10 | tell | say, ask, lie, accuse, promise, threaten, warn | a claim passes between minds with a source. Reputation is what the claims in many minds add up to, not a number of its own |

**Load** is a check after any change: whatever bears weight, tension, or pressure (from contents, from P22, from gas made by S9 in a sealed space) against its strength and S15. What fails becomes an X2 on itself and an X1 on what it held.

## 6. Effect kinds

| Id | Effect |
| --- | --- |
| E1 | shift a state, or an effective property through section 7 |
| E2 | shift a body condition |
| E3 | create an instance: a byproduct, a yield or offspring, a mixture, a composite |
| E4 | consume an instance or an amount |
| E5 | move |
| E6 | make or break a relation |
| E7 | change who holds or owns |
| E8 | hold a claim, with a credence and a source; it may be false, it may be about a place, and it may be something seen in passing and only recalled when asked |
| E9 | emit a signal on a channel (light, sound, scent, smoke, a trace) at a strength; fades by X7 |
| E10 | set a fuse |
| E11 | settle a latent fact |
| E12 | make a debt or promise |
| E13 | change a place's row or state |

## 7. Modifier rules (how states move effective properties)

| Id | Rule |
| --- | --- |
| M1 | Wetness in something absorbent: heavier, softer, more flexible, weaker, a worse insulator; it swells by P22. Drying reverses it, and leaves it stiffer than before if it dried fast or hot |
| M2 | Temperature near `melts at`: softer and workable. Cooled fast from hot: harder and less tough. Held too hot: S15 |
| M3 | Growth stage scales size, mass, what it produces, and what it draws from its place |
| M4 | Contamination adds noxiousness when eaten and scent; in a sealed, sugary, watery thing it adds potency and gas |
| M5 | Setting: once P23's threshold of dryness or heat is passed, hardness goes up for good and flexibility down, and wetness no longer undoes it |
| M6 | A coat lends its surface properties to what it covers, in proportion to coverage: oiliness sheds water, stickiness gathers grit, flammability carries flame |

## 8. Asked for and not granted

- **Electricity**: lightning choosing what it strikes and what it does to it (three scenarios). A sandbox can run without it. Left for a person to decide.
- **Colour and taste**, as properties the world reasons about (two scenarios). Rendering for now.
- **Turning force, steering and balance** of odd shapes (three scenarios): a coin as a screwdriver works through R10 and hardness; how a sled veers is lost.
- **Detail inside one instance** (salt missing one fold of the meat): coverage is one number.
- **A price, and a reputation score**: deliberately not code. See X9 and X10.

## 9. Candidates for version 2, from batch C (untested)

Batch C was held out from version 1: 49% fully expressible, 16% failed, 32 missing items in 45 scenarios, from about fourteen root causes. None of these is in the tables above, because a vocabulary changed after its test has not been tested. They are listed in the order they would pay.

| Candidate | From | What it would be |
| --- | --- | --- |
| Body modifier rule | fight-01, 05, 08 | Principle 1 applied to bodies: wounds, blood loss, fatigue, sickness and drink scale effective strength, speed and senses. Version 1 wrote modifier rules for things and forgot creatures |
| Contamination does more | craft-03, 09, 11, 12 | M4 extended: it weakens what it grows in (a rotten rafter) and makes heat in bulk (a damp grain heap) |
| Deformation | craft-02, 07 | S4 gains a step between whole and cracked: bent, warped, sagging |
| Kinds of contamination | craft-04, 05 | what grows depends on what was seeded and on the conditions: a wanted ferment and a souring race each other. One quantity with a kind, not two states |
| Out cold | body-07, fight-08 | B7 gains unconscious; B8 gains concussed |
| Lasting harm | malice-05 | the body's S15: a baseline lowered for good |
| Contested hold | fight-02, silly-03 | a join whose strength is one body's against another's, re-checked each moment |
| Air as a place state | travel-02, fire-10 | thin air on a mountain, bad air in a closed room with a fire, none under water: one level, met by the air need. Smoke is a `gas` substance made by S3 that gathers where R6 is low, breathed through X6 |
| Viscosity | travel-01, cold-10 | a second sighting. Haste makes soft ground grip harder; steady effort frees. Folded into P13, or a property of its own |
| Bearing | travel-06 | the most important new gap for a game about walking: a mind's claim about where it is and which way home lies, with a credence that decays without landmarks. Fits E8 |
| Aim and distance | fight-05 | where a blow or shot lands, and distance finer than three buckets |
| Weather emits | beast-04 | a storm is a source of sound, light and wind like any other event |
| Spread within a group | clever-02 | a group's row is a baseline with a spread, so code can take the slowest tenth |
| Bargaining | folk-03 | code builds a ladder of offers at different amounts from what each side holds; `accept_offer` is asked of every rung in one call; the deal is the first rung both take. A quantity with no price rule |

Needs a person to decide, not a table entry: **skill** (silly-04: a first attempt and a hundredth play the same without it), **taste** (silly-01, world-05), **electricity** (cold-08, world-07).
