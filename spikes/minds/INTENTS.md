# Intents and factor kinds

2026-09-19. Derived from data and measured with Jev (`README.md`). The list itself, with criteria, `not_for` and examples for every intent, is `intents.json`; this file says what it is, where it came from and what it cannot do. Nothing here names a creature or a person.

## The intents (version 1: 34)

An intent is what a creature or a person can choose to do. It is the counterpart for minds of matter's processes: a closed set in code, grown by a person. Code offers an intent when its precondition holds, ranks the offers by salience, keeps a handful with none always among them, and the judge (or the routine, when nobody is watching) chooses. A chosen intent compiles to acts the rules resolve.

| Family | Intents |
| --- | --- |
| Where it puts itself | `go_to`, `keep_away`, `hide`, `wait_watch`, `give_up`, `carry_on`, `rest` |
| What it does with things | `take`, `eat_drink`, `carry_to`, `store`, `work_on`, `examine` |
| Against another | `guard`, `warn_off`, `attack`, `demand`, `deceive` |
| Giving way and sparing | `defer`, `let_go` |
| With another | `give`, `help`, `offer_trade`, `accept`, `refuse`, `lead`, `court`, `play` |
| What is said and signalled | `ask`, `tell`, `keep_quiet`, `call`, `express` |
| For itself | `tend_self` |

Three distinctions the data forced, each of which a list guessed from one wolf had missed:

- **`defer` is not `let_go`.** Both are "lets the other have it". One gives way because it is the weaker, the lower in rank, or because custom says so; the other refrains from pressing an advantage it has. A beaten dog and a hunter who lowers his rifle are not doing the same thing.
- **`warn_off`, `demand` and `attack` are three, not one.** A threat with the body, a claim pressed in words or by standing on it, and force. Most provocation in batch A ended at the first or the second.
- **`carry_on`, `wait_watch` and `keep_quiet` are choices.** Going on grazing, staying alert, and knowing something and saying nothing were chosen in one scenario in nine. An engine that only offers things to do cannot say them.

`work_on` is the one that joins this list to matter. It is the intent that compiles to force, heat, soak and coat. Version 0 did not have it: every scenario was a choice under pressure, and nobody under pressure hammers a horseshoe.

## The factor kinds (version 0, from batch A's 594 factors in 87 phrasings)

What bears on a choice. Each is a structure the world keeps, never a branch.

| Kind | Share of batch A | Where it lives |
| --- | --- | --- |
| Custom and rank: what is done here, who goes first, who may order whom | 96 | **Missing.** A place's or a group's customs as rows (who serves whom, who feeds first, what a guest is owed), and rank as a relation between bodies |
| What it can still do: hurt, old, tired, lame, armed | 86 | `able()`, and what it holds |
| A need, its own | 61 | The needs graph |
| A bond: young, mate, kin, master, flock | 58 | **Missing.** A relation with a kind and a weight; a ward's needs count as its own |
| Risk, a threat and its size, numbers, ways of escape | 72 | The other's `able()`, how many, and the ground: **the ground is missing** (cornered, a gap, open country) |
| What it knows or has seen before | 34 | Claims it holds (E8), including of places |
| What it is owed, owes, has promised; a duty | 37 | Debts and promises (SPEC section 9) |
| What someone just did, what it just saw | 34 | Deeds, from percepts (`sense.ts` now feeds them) |
| What it fears; shame, pride, reputation, who is watching | 40 | Feelings toward someone (B6), and **witnesses: missing** as a factor, though sensing can now say who could have seen |
| Time, timing, the light, the wind | 17 | Place states |

Custom and rank together are the largest kind, and the table written from the wolf example did not have them at all.

## Measured with Jev

Two calls per scenario, kept apart so that the answer never sits in the state of the question it would answer. (a) Which intent is the act the writer described, or none of these: the none-rate is what the list cannot say. (b) Given the situation alone, which intent does this creature choose: asked in both wordings. Scenario text lives only in labeled state fields (rule 8).

| List | Batch | Role | Acts it could not say | Jev's choice among the writer's plausible acts | Top two touch them | Paraphrase shift |
| --- | --- | --- | --- | --- | --- | --- |
| Version 0 (29) | A, 120 | derived from it | 0% | 68% | 83% | 0.14 |
| Version 0 (29) | B, 45 | **held out** | **0%** | 62% | 80% | 0.14 |
| Version 0 (29) | C, 45 | held out, another frame | **18%** | 56% | 82% | 0.11 |
| Version 1 (34) | C, 45 | **held out from version 1** | **0%** | 64% | 84% | 0.14 |

About 500 live calls, 3.2 million input tokens, $0.17.

**A none-rate of 0 means something only if the judge says none when it should.** The control (`results/control-v0.json`): sixteen acts chosen to lie outside version 0, four inside it. Jev said none of these for 13 of the 16 (at 0.57 to 0.99) and named all four inside acts correctly (three of them at 1.00). So the zeros above are real.

**The control found what the scenarios could not.** Batch B was held out and version 0 said all of it, and version 0 was still missing a fifth of what creatures do: every scenario in A and B was a choice under pressure, written by the same family of model that wrote the list, and nobody under pressure hammers a horseshoe, plays, preens or weeps. A control written from another frame showed it in sixteen calls. Batch C was then written in that frame (an hour of a life, a village at work and at leisure, what is done that achieves nothing), and confirmed it: version 0 could not say 18% of it (washing itself, throwing a pot, shelling peas, packing mud into a dam, whittling on watch, scrubbing linen, rooting in mud). Version 1's five additions say all of it, on scenarios version 1 never saw, and nine of those forty-five acts are `work_on`.

**Agreement is about two in three, and that is about right.** Given only the situation, Jev's first choice is one of the acts the writer called plausible 62 to 68% of the time, and one of its first two is, 80 to 84% of the time. The disagreements are diffuse (no pair of intents is confused systematically; the commonest are `go_to` against `eat_drink`, which is a question of sequence, and `help` against `carry_on`). A scenario writer's "what it does" is one reading of a situation that honestly admits several, so this is not a ceiling to push toward 100%. It is the baseline the routine has to match: when the engine scores the same options in code, its choice should be among Jev's first two about as often as a human writer's is.

## The routine against the judge (2026-09-18)

The preconditions and the salience now exist (`packages/core/src/matter/intents.ts`), so the first item below could be measured. `results/scripts/routine.ts` makes scenes from a seeded generator over engine structures only, builds the slice with `sliceFor` and the handful with `offers`, shuffles the handful, and asks Jev three things, kept apart: which of the handful (two wordings), and which of all 34 intents with no targets.

| Set | Role | Measured | Routine is Jev's first | In Jev's first two | Chance | Jev says none | Shift | Wanted intent was offered (or its first step) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A, first rules | derived from | 46 of 60 | 41% | 72% | 22 / 43% | 4% | 0.10 | 50% (67%) |
| A, four general rules added | derived from | 55 of 60 | 55% | 75% | 22 / 44% | 0% | 0.09 | 56% (75%) |
| B, engine frozen at `151151a` | **held out** | 50 of 60 | **64%** | **78%** | 23 / 46% | 2% | 0.09 | 46% (72%) |

The writer baseline above is 62 to 68% and 80 to 84%. Held out, the routine matches it on first choice and is just under on the first two. Scenes left out had one offer only. Set B was read only as its summary.

What set A taught, each written as a property before the code: what is at hand counts for more than what can be had later; what feeds it and lies right here is worth something even fed; a keeper may stay over its young with nothing menacing; a need that nothing in sight would meet offers going to look. Two faults in the words were found the same way: a smelled food was called strange, and the slice never said fed.

Where code does not offer what Jev wants, by count over both sets: `eat_drink` 24 (23 of them with `go_to` offered, which is the same want one act earlier), `guard` 7, `defer` 6, `attack` 5, `help` 4. Three structures explain most of it. **What feeds whom** does not exist: prey is not food, and a grazer would be offered meat. **Helping** is offered only to the hurt. **Guarding** is wanted more widely than a menace or a helpless ward allows.

Eleven of the 34 rows cannot be offered yet. Each names what it waits on: speech and claims (`ask`, `tell`, `deceive`, `keep_quiet`), offers made between bodies (`offer_trade`, `accept`, `refuse`), claims of ownership (`demand`), purposes for a thing (`work_on`), seasons and pairing (`court`), a group with a task (`lead`).

## Diet (2026-09-18)

What feeds whom is now a structure (`packages/core/src/matter/diet.ts`): a fare on the food's row, what the eater's row takes of each fare, one function `feeds`, and `preyTo` for food that is still alive. The generator no longer has to be told what a hind eats: it draws meat, haws or browse without regard to who is there, and adds a hare.

| Set | Role | Measured | Routine is Jev's first | In Jev's first two | Chance | Jev says none | Shift | Wanted intent was offered (or its first step) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A seeds, first diet rules | derived from | 49 of 60 (4 calls failed) | 49% | 65% | 24 / 48% | 0% | 0.09 | 41% (61%) |
| A seeds, quarry rules added | derived from | 53 of 60 | 53% | 72% | 24 / 48% | 0% | 0.08 | 38% (62%) |
| C, fresh seeds, engine frozen at `f64796b` | **held out** | 52 of 60 | **60%** | **81%** | 22 / 43% | 0% | 0.11 | **54% (85%)** |

The A seeds make other scenes than they did before diet, so the rows above are not a continuation of the table before them. Held out, first choice is 60% against 64% before diet, which at fifty scenes is within the noise; the first two are 81% against 78%; and code offers what Jev wants, or its first step, in 85% against 72%. `attack` has left the list of what is wanted and not offered.

Reading the A seeds found four faults, each fixed as a general rule with a property first. A wolf was food to a wolf: its own kind is not quarry. A wolf was said to make a meal of a bear: what is much weaker does not hunt. Beside its quarry it was offered going toward it before striking: within a rush quarry is struck at. A little hungry is hungry enough to take a hare at hand. Before that, the first property to fail found that worth ignored how well a food feeds, and a hungry wolf ranked near berries over meat.

What is still wanted and not offered, held out: `eat_drink` 16 (the first step, `go_to`, is offered), `defer` 4, `guard` 3, `help` 1. Staying over young is ranked too low against resting: on the A seeds Jev chose it at 0.72 to 0.87 where the routine lay down. That was not changed here, because it is not diet.

## What this does not show

- **The scenes of the routine measure are thin.** One creature, at most one other, one food, two young. Nothing in them has more than one menace, and no scene runs longer than one choice. The generator and the engine were written by the same hand, so a factor neither thought of is in neither.
- **A third of the rows wait on structures.** The measure says nothing about trade, speech or work, because code cannot offer them.
- **Most offers do nothing yet.** Of the 23 rows code can offer, 7 become an act the rules resolve (`go_to`, `keep_away`, `take`, `eat_drink`, `carry_to`, `attack`, `give`). Guarding, warning off, hiding, calling and the rest can be chosen and change nothing in the world. The measure is of the choice, never of what follows from it.
- **The same family of model wrote the scenarios, the list and the control.** The control shows how much that matters: a frame none of us took is invisible until someone takes it. The next frame nobody took is still out there. A person's playtest remains the only outside view.
- **34 options is a long list for one Choice.** Jev handled it here (paraphrase shift 0.14, the same as the inn's loosest family). In play the list is pruned by code first, as SPEC section 14 requires.
