# Vocabulary pass

A design pass with no engine code and no Jev calls. It asks: what is the smallest closed vocabulary of properties, processes and effect kinds from which the sandbox's interactions can be derived (`docs/sandbox-direction.md`)? The closed vocabulary is the ceiling on everything the world can ever do, and no loop can fix it afterwards, so it is tested before it is built.

## Method

1. **Batch A** (`results/scenarios/a-*.json`): synthetic scenarios across six domain pairs, written by generative agents that are given no vocabulary. Each says in plain words what a sensible person expects to happen, and which properties did the work.
2. **Reduce**: count the free-text properties, processes and effects in batch A, merge synonyms by hand, and cut to the smallest set that still expresses batch A. That is `VOCABULARY.md`, version 0.
3. **Batch B** (`results/scenarios/b-*.json`): held out. Written at the same time as A, not read until version 0 is frozen.
4. **Test**: every scenario in A and B is re-expressed using only version 0. A scenario fails if it needs a property, process or effect that is not in the list, or a rule that names a specific thing. The coverage on B is the number that matters.

## Scenario schema

One JSON file per writer: an array of objects.

```json
{
  "id": "fire-03",
  "domain": "fire",
  "place": "One sentence: the biome or setting, and anything about it that matters.",
  "initiator": "player | creature | world",
  "lines": ["What the player types, verbatim. One to four lines. Empty if nobody typed anything."],
  "things": ["every thing, creature and person involved, in plain words"],
  "outcome": "Two to four sentences: what a sensible person expects to happen, with side effects, failures and how long it takes.",
  "steps": [
    {
      "process": "one plain verb for what is happening in this step",
      "agent": "who or what acts (may be fire, rain, time)",
      "patient": "what it is done to",
      "instrument": "what it is done with, or null",
      "because": ["patient is flammable", "agent is hot"],
      "effects": ["patient gains burning", "patient loses coating", "creates ash", "consumes oil", "observer learns who did it"],
      "numbers": ["how long it burns, from how much oil"]
    }
  ],
  "latent": ["facts nobody knew until someone looked: is there a stone here"],
  "state_after": ["sword: coated with oil, burning for a while, hot"],
  "stress": "One phrase: the corner of the design this scenario leans on.",
  "temptation": "The special-case rule a lazy engine would write for this, naming specific things."
}
```

Rules for writers:

- The world is grounded and low-tech: wood, stone, iron, rope, animals, weather, hunger. No magic.
- `because` entries have the form `<agent|patient|instrument|place> is <property>`, the property in one or two plain words. Use whatever words are natural; do not invent a system.
- `effects` entries start with one of: `<role> gains <state>`, `<role> loses <state>`, `<role> <quantity> up`, `<role> <quantity> down`, `creates <thing>`, `consumes <role>`, `moves <role> to <where>`, `<who> learns <what>`, `transfers <thing> from <who> to <who>`.
- `numbers` lists what would have to be computed (durations, odds, amounts), never the values.
- Include things that fail or half work, delayed consequences, side effects nobody intended, and things done by creatures or by the world with nobody typing.
- No two scenarios in one file may turn on the same idea.
