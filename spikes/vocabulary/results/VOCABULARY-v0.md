# Closed vocabulary, version 0

Frozen 2026-09-18 from batch A only (120 scenarios, 325 steps, which used 191 verbs, 373 property phrases and 401 effect phrases in free text). Batch B was not read before this was frozen. Nothing in this file names a specific thing, and nothing in the engine may.

Every scalar is a level from 0 to 5. The anchors make each one a Score question Jev can ratify in one hop ("how hard is pitch?"). Code compares levels and does all arithmetic. What the free text called a property turned out to be four different things, and only the first is a row in the element pool.

## 1. Material properties (the element's row; fixed for the element)

| Id | Property | 0 | 5 | Does the work in |
| --- | --- | --- | --- | --- |
| P1 | mass | a feather | a boulder | carrying, load, impact, sinking |
| P2 | size | a seed | a tree | reach, containing, visibility, spans |
| P3 | hardness | mud | steel | what cuts, dents or scratches what |
| P4 | toughness | glass, dry twig | rope, green wood, leather | whether force breaks it or it gives |
| P5 | flexibility | stone | cord, cloth | binding, wrapping, bending without breaking |
| P6 | flammability | stone, water | oil, dry tinder | whether heat lights it, and how fast it burns |
| P7 | conductivity | wool, ash | iron | how fast heat passes through it |
| P8 | melts at | never | just above a warm day (fat, ice) | softening, melting, setting when cool |
| P9 | absorbency | glazed pot | cloth, dry soil | taking up liquid, holding it, drying slowly |
| P10 | porosity | iron | loose weave | letting liquid or air through; filtering |
| P11 | buoyancy | iron | cork | float or sink |
| P12 | solubility | stone | salt | dissolving into a liquid, washing out |
| P13 | stickiness | dry sand | tar | coating, gluing, picking up dirt |
| P14 | friction | wet ice | rough stone | footing, sliding, knots holding |
| P15 | perishability | stone | raw meat | rot, mould, ferment under warmth and damp |
| P16 | corrodibility | gold, wood | bare iron | rust under wet and air |
| P17 | toxicity | clean water | deadly mushroom | harm on ingesting; carried by whatever it gets into |
| P18 | potency | none | strong drink, strong medicine | intoxication, sedation, healing help on ingesting or applying |
| P19 | scent | none | rotting meat | what a nose finds at a distance |
| P20 | serves | the needs graph (SPEC section 4), −3 to 3 per need | | nourishment, warmth, rest, coin, safety, company |

**Form** is a closed tag set, several per element: `hollow`, `flat`, `long`, `pointed`, `edged`, `round`, `sheet`, `cord`, `granular`, `liquid`, `gas`. A thing works as a tool because of its form and its scalars, never because of its name: a needle is `pointed` + `long` + small + hard.

**Kind** is one of: `material`, `thing`, `plant`, `creature`, `person`, `place`. Plants, creatures and people have a body (section 3). A plant or creature row also carries `produces` (what it yields or bears as it grows) and `eats`.

## 2. States (on the instance; quantities that change)

| Id | State | Notes |
| --- | --- | --- |
| S1 | temperature | six levels: frozen, cold, mild, warm, hot, scorching. Crossing `melts at`, the point of lighting, or the point of burning flesh is an event |
| S2 | wetness | dry to soaked; bounded by absorbency |
| S3 | burning | with fuel left; a burning thing is a heat source, gives light and smoke, and needs air |
| S4 | integrity | whole, cracked, broken, in pieces |
| S5 | edge | keenness of an `edged` or `pointed` thing; wears with use |
| S6 | phase | solid, liquid, gas; follows S1 and P8 |
| S7 | coating | a substance and an amount on the surface; its properties show through to whatever touches the surface |
| S8 | contents | for `hollow` things: substances and things inside, with amounts; open or sealed |
| S9 | freshness | from fresh to rotten, driven by P15 |
| S10 | corrosion | driven by P16 |
| S11 | preserved | dried, salted, smoked, sealed from air: a multiplier on S9's rate, not a new thing |
| S12 | growth | seed, sprout, growing, mature, bearing, dormant, dead; with vigour |
| S13 | taint | a carried dose of P17 or P18 that came from elsewhere; travels with the substance through eating, producing and mixing |
| S14 | amount | how much of a substance or a pile is left |

A **mixture** is an instance made of amounts of several substances (mud, brine, a dye bath, smoky air). A **composite** is an instance made of things joined (a raft, a wall, a splinted leg). Code derives their properties from their parts: blended for mixtures; for composites, mass summed, strength that of the weakest join. Whether a mixture or composite *is* some known element is the select-or-none question of `docs/sandbox-direction.md`.

## 3. Body (plants in part, creatures and people in full)

| Id | Condition | Notes |
| --- | --- | --- |
| B1 | needs | the needs graph: hunger, rest, warmth, money, safety, company |
| B2 | health | what is left |
| B3 | wound | a list, each with a site, a depth, and flags that are themselves quantities: bleeding, burned, broken, infected |
| B4 | sickness | from ingesting, infection or exposure; with an onset delay and a course |
| B5 | intoxication | from P18 |
| B6 | feeling | fear, anger, trust, wariness toward someone or something: the drives and stances of SPEC section 6 |
| B7 | attention | what it is attending to now; alert, distracted, asleep |

## 4. Relations (computed by code from the world, never stored as properties)

| Id | Relation | Replaces free-text such as |
| --- | --- | --- |
| R1 | distance | near, close, reachable, out of reach, too close |
| R2 | contains / inside | in the jar, in the pack, enclosed |
| R3 | supports / rests on / hangs from | propped, unsupported, stacked, loaded |
| R4 | joined to | tied, glued, nailed, grafted, wrapped |
| R5 | covers / sheltered by | exposed, under the roof, banked under ash, buried |
| R6 | air access | enclosed, no chimney, smothered, sealed |
| R7 | upwind / downwind / downhill / downstream | where heat, smoke, scent, water and sparks go |
| R8 | light on, line of sight to | visible, dark, hidden, lit elsewhere |
| R9 | holds / owns / guards | unguarded, unattended, the player's, not yours |

**Place** rows carry: `slope`, `footing`, `cover`, `shelter`, `enclosure`, `fertility`, `depth` and `flow` for water, a season and weather, and an **abundance** per element kind that stays latent until someone looks (a Score, settled once per kind of place).

## 5. Processes (code; each is a resolution rule over the above)

| Id | Process | Verbs it absorbs | Resolves by |
| --- | --- | --- | --- |
| X1 | move | take, drop, carry, drag, push, throw, climb, wade, fall, flee, approach | mass and size against strength and the needs of the mover; friction, slope, flow |
| X2 | force | strike, cut, pierce, split, crush, dig, gnaw, trample, the landing of a fall or throw | instrument's hardness, edge, mass and the effort against the patient's hardness and toughness; makes damage, pieces, wounds, wear, and noise. Contact time is an input |
| X3 | heat | warm, cook, boil, scorch, ignite, chill, freeze, thaw, quench, cauterize | heat flows toward balance at a rate set by conductivity, contact and time; thresholds fire events |
| X4 | soak | pour, fill, spill, leak, rain on, douse, wash, wring, drain, absorb, dissolve | liquid moves by gravity, absorbency and porosity, and takes solutes, coatings and taint with it |
| X5 | join | tie, bind, wrap, bandage, coat, smear, glue, plug, seal, graft, stack into a structure | makes an R4, R5 or S7 with a strength from stickiness, friction, flexibility and the join's state |
| X6 | ingest | eat, drink, breathe, take in through a wound or skin | the substance's serves, toxicity, potency, temperature and taint pass into a body, with delays |
| X7 | drift | burn down, rot, mould, ferment, rust, dry, evaporate, cure, set, cool, grow, ripen, heal, fester, starve, tire, silt up, erode | a state changes at a rate that is a function of conditions (warmth, wetness, air, light, season), in closed form so that unobserved time is code; thresholds fire events |
| X8 | sense | see, hear, smell, feel, notice, search, track, watch | a signal's strength against distance, cover, light, wind and the sensor's attention; search adds effort and settles latent facts |
| X9 | give | give, pay, trade, lend, steal as a taking of what R9 says is another's | possession and ownership change; a debt may be made |
| X10 | tell | say, ask, lie, accuse, promise, threaten, warn | a claim passes from one mind to another with a source; belief is the listener's judgment |

**Load** is a check, not a process: after any change, whatever bears weight, tension or pressure is compared with its strength, and what fails becomes an X2 on itself and an X1 on what it held. A rope, a rotten plank, an ice sheet and a sealed jar of fermenting fruit are one rule.

What a creature or person *chooses* to do (flee, stalk, steal, tame, help) is not a process. It is a choice among code-built options (`pick_action`), and what it chooses is carried out by the processes above.

## 6. Effect kinds

| Id | Effect | Covers free-text such as |
| --- | --- | --- |
| E1 | shift a state | gains burning, loses wholeness, wetness up, loses edge, gains rust |
| E2 | shift a body condition | hunger down, gains wound, gains sick, gains fear, loses bleeding |
| E3 | create an instance | a byproduct (smoke, ash, steam, pieces), offspring or yield, a mixture, a composite |
| E4 | consume an instance or amount | consumes oil, consumes time is not an effect: time is the clock |
| E5 | move | moves the herd to the treeline |
| E6 | make or break a relation | joins, coats, contains, covers, seals, and their undoing |
| E7 | change who holds or owns | transfers the purse |
| E8 | hold a claim | learns who took the bread; a claim is held with a credence and a source, and may be false |
| E9 | emit a signal | light, sound, scent, smoke, a trace on the ground; fades by X7 |
| E10 | set a fuse | something that will happen later unless conditions change: the oil burns out, the fever comes on |
| E11 | settle a latent fact | there is, or is not, a stone under this turf |
| E12 | make a debt or promise | SPEC section 9 |

## 7. What batch A's writers could not say, and what version 0 does about it

- **Half working** (a stain that lightens, a raft that floats until loaded): every state is a quantity, so partial is the normal case.
- **Comparison** (the beam too thin for the load, the knife too small for the oak): properties are levels on shared scales, and every process resolves by comparing them.
- **Contact time** (a slicing hot blade sears the edges and does not seal the wound; a blade pressed and held does): X2 and X3 take contact time as an input. A reaction is never a yes or no between two properties; it is a threshold on an exposure.
- **False learning** (a lie, a misidentification): E8 is holding a claim, never knowing a fact.
- **Taint passing along a chain** (plant to goat to milk to family): S13 travels with the substance under X4, X6 and `produces`.

## 8. Requests to the ontology that version 0 does not grant

- **Thirst.** Three scenarios turn on it, and the needs graph folds drink into hunger. Left folded for now; counted as a failure wherever a scenario needs them apart.
