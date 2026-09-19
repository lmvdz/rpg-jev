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

## What this does not show

- **Preconditions and salience are untested.** Here the judge was offered all 34 intents at once. In play, code offers the handful whose preconditions hold. Whether code offers the right handful is the next thing to measure, and it cannot be measured until bonds, custom and rank, and the ground exist as structures.
- **Targets are untested.** An intent is toward something. The measure asked which intent, never toward what.
- **The same family of model wrote the scenarios, the list and the control.** The control shows how much that matters: a frame none of us took is invisible until someone takes it. The next frame nobody took is still out there. A person's playtest remains the only outside view.
- **34 options is a long list for one Choice.** Jev handled it here (paraphrase shift 0.14, the same as the inn's loosest family). In play the list is pruned by code first, as SPEC section 14 requires.
