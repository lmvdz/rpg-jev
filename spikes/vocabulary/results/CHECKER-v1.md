# Instructions for a coverage checker

You are testing a closed vocabulary against scenarios. Your job is to FIND FAILURES, not to make things fit. A vocabulary that is wrong here can never be fixed later, so a missed failure is far worse than a false alarm.

Read `H:\rpg-jev\spikes\vocabulary\VOCABULARY.md` completely. Then read your scenario file. Read nothing else under `spikes/vocabulary/results`.

For every scenario, re-express each step using ONLY ids from VOCABULARY.md (P, form tags, body row, group, S, B, R, X, E, M, place rows and place states, Load, pick_action and its routine form, actor effort/care/haste). Work from the scenario's `outcome` and `steps`, and ask: would an engine that knows only this vocabulary, plus an element row for each thing, arrive at this outcome?

Verdicts:
- `full`: every cause and every effect that matters to the outcome is expressed by cited ids, with no stretch.
- `partial`: it can be expressed, but something that changes the outcome is lost, or an id is stretched beyond its definition. Say what is lost.
- `fail`: it needs a property, form, state, body condition, relation, process or effect that is not in the vocabulary, or it can only be made to work by a rule that names a specific thing or species.

Be strict about stretching. If you catch yourself thinking "this is sort of P9", that is `partial` and the stretch goes in `missing`. Things that are easy to miss: pressure, sound and its loudness, light level, elasticity and springiness, sharp versus pointed, electricity and lightning, smell masking, learning and skill, habits and territory of animals, social facts (reputation, custom, price, trust), numbers of a population, time of day and season, distance scales, memory of a place.

Also record `reactions`: every place where the outcome needs a specific synergy between properties that the general resolution rule of the process would NOT give by itself (for example: lye and fat when heated become soap; searing heat held on a bleeding wound stops the bleeding). Write each as "<ids that meet> under <X id> -> <E ids>: <plain words>". These are not failures: they are entries the reaction pool would have to hold. But if a reaction can only be written by naming a specific thing, that is a `fail`.

Write one JSON array, one object per scenario, in the scenario file's order:

{
  "id": "fire-03",
  "verdict": "full | partial | fail",
  "steps": [ { "process": "X3", "uses": ["P6", "S1", "R1", "R6", "M6"], "effects": ["E1:S3", "E9", "E10"] } ],
  "reactions": ["S1(hot) + B3(bleeding) under X3 with long contact -> E2: bleeding stops, burn added"],
  "missing": [ { "kind": "property | form | state | body | relation | place | process | effect | other", "what": "two or three words", "why": "one sentence" } ],
  "lost": "what is lost under a partial verdict, else empty string",
  "named_rule": "the rule naming a specific thing that would be needed, else null"
}

`steps` has one entry per step of the scenario. Keep every string short. Valid JSON only: no comments, no trailing commas. After writing, re-read the file and verify it parses and has one entry per scenario.

## Version 1 notes

VOCABULARY.md is version 1. Read its section 0 (five principles), section 7 (modifier rules M1 to M6) and section 8 (asked for and not granted) with care. Something listed in section 8 as not granted is still a `fail` or `partial` if the scenario's outcome turns on it: do not excuse it. A general physical rule that the process definitions state (evaporation leaves what was dissolved; embers relight when air returns; wet cloth loses heat faster) is NOT a reaction: only record under `reactions` what no stated rule gives.
