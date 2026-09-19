# Minds pass

What is the smallest closed set of **intents** (what a creature or a person can choose to do) and of **factor kinds** (what bears on the choice) from which behaviour can be built without a list of cases (`docs/sandbox-direction.md`, "Minds")? The intent list is the ceiling on what anything in the world can ever choose, and no loop can fix it afterwards, so it is derived from data and measured before it is built.

## Method

1. **Batch A** (`results/scenarios/a-*.json`): scenarios of what a creature or a person does and why, written by agents that are given no list of intents or factors.
2. **Reduce**: count the free-text verbs and factor kinds in batch A, merge synonyms by hand, and cut to the smallest set that says batch A. That is `INTENTS.md`, version 0, with criteria, `not_for` and examples for every intent (SPEC section 14).
3. **Batch B** (`results/scenarios/b-*.json`): held out, written at the same time, not read until version 0 is frozen.
4. **Measure with Jev**, not with checker opinions. For every scenario, one live call: (a) which intent is the act the writer described, or none of these; (b) given the situation alone, which intent does this creature choose, or none of these. The rate of "none of these" on (a) is how much the list cannot say. Agreement between (a) and (b) is how often the judge, offered the list, does what the writer said it would. Batch B's numbers are the ones that count.

Scenario text is generated, so it is untrusted (SPEC rule 8): it goes into labeled state fields and never into instructions or criteria.

## Scenario schema

One JSON file per writer: an array of objects.

```json
{
  "id": "young-03",
  "domain": "young",
  "who": "One phrase: what it is, as a stranger would describe it. No name.",
  "place": "One sentence: where and when, and what about it matters.",
  "present": ["every other creature, person and notable thing on the scene, in plain words"],
  "factors": [
    { "kind": "two or three plain words for what SORT of fact this is", "fact": "One sentence: a fact that bears on what it does." }
  ],
  "does": { "verb": "a plain verb phrase for what it does", "toward": "who or what, from `present`, or nothing", "how": "one or two words for the manner, or empty" },
  "could_also": [ { "verb": "...", "toward": "..." } ],
  "would_not": [ { "verb": "...", "toward": "...", "why": "one sentence" } ],
  "then": "One or two sentences: what follows in the next minutes or hours.",
  "why": "Two or three sentences: why this and not the alternatives, in terms of the factors.",
  "turns_on": "One phrase: the single factor that, changed, would change what it does."
}
```

Rules for writers:

- A grounded, low-tech world: animals, people, weather, hunger, tools. No magic, no named characters.
- Four to eight `factors` each. Give each a `kind` in your own plain words (for example: a need, a bond, what someone just did, what it can still do, where it is at home, what it fears, what it is owed, what it knows, custom, rank). Use whatever kinds are natural. Do not invent a system and do not reuse a fixed list.
- `does.verb` is what it does in one plain verb phrase (for example: goes to, carries back, stands over, backs away from, offers, refuses, lies to, waits, follows). Two to four `could_also` that are genuinely plausible, and one to three `would_not` that a lazy engine might wrongly pick.
- Be honest about animals and about people: what it would do, not what would make a good story. Include doing nothing, giving up, mistakes, and choices that are bad for the one who makes them.
- Half of each file should be scenarios where two factors pull in different directions.
- No two scenarios in one file may turn on the same factor.
