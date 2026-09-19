# Proposing a rule as data

You are proposing rules for a simulation of everyday matter. A rule is a row of JSON. No row may hold code. What you propose is checked as data, then judged for truth, then let in only if every test the engine already passes still passes.

## What a rule is

```json
{
  "id": "overheated",
  "says": "Held too hot for too long, what can melt takes a hidden flaw",
  "first": [
    {
      "when": { "all": [ { "a": "p.meltsAt", "is": ">", "b": 0 }, { "a": "s.temperature", "is": ">=", "b": 4.8 } ] },
      "effects": [ { "kind": "accrue", "q": "s.flaw", "rate": 0.01, "lo": 0, "hi": 5 } ],
      "because": ["M2", "S15"],
      "note": "it has been too hot for too long"
    }
  ]
}
```

- `says` is the claim in plain words, true of the everyday world in general. It is what gets judged. It must not name a particular thing (no "jerky", no "sword"): it speaks of properties and states.
- `first` is an ordered list of alternatives. The first whose `when` holds acts, and the rest are skipped. No `when` means always.
- `because` cites vocabulary ids (`P6`, `S2`, `X7`, `M4`): the properties, states, processes and modifiers the rule rests on. See `spikes/vocabulary/VOCABULARY.md`.
- `note` is what someone standing there would say happened. Optional.
- A heat rule also has `"about": "tgt"` or `"about": "src"`: whose change it is.

## Quantities: paths

Every level runs 0 to 5. A path names one quantity. In a **drift** rule (what time does to one thing) paths have no party. In a **heat** rule (a source `src` warming a target `tgt` in contact) a path starts with `src.` or `tgt.`.

| Path | What it is |
| --- | --- |
| `p.<property>` | An effective property of the thing as the act began: `mass size hardness toughness flexibility flammability conductivity meltsAt absorbency porosity buoyancy solubility stickiness friction perishability corrodibility noxiousness potency scent oiliness swell setting cleansing` |
| `now.p.<property>` | The same, worked out against the state as it is now |
| `s.<state>` | A state now: `temperature wetness surfaceAbove integrity edge contamination corrosion taint amount flaw temper set`, and `s.burning` (null or a record: `s.burning.of` is `"self"` or `"coating"`, `s.burning.fuel` is minutes), `s.coating` (null or `s.coating.element`, `.amount`, `.coverage` 0 to 1, `.bond`), `s.wetWith` (null is water) |
| `was.<state>` | The same, as it was when the act began |
| `x.<name>` | A scratch number one rule writes for a later one. Heat's `warm` rule leaves `tgt.x.surface`: how hot the target's surface got |
| `place.<field>` | `temperature moisture wind air light noise cover`, each 0 to 5. `air` 0 is sealed |
| `row.p.<property>`, `row.is.<form>`, `row.moist` | The thing's own element row, raw. Forms: `hollow flat long pointed edged round sheet cord granular liquid gas grained` |
| `coat.p.…`, `coat.is.…` | The row of what coats it (0 or false if nothing does) |
| `wetWith.p.…` | The row of what it is wet with |
| `t` | The minutes that pass (drift). In heat use `d.minutes` |
| `act.minutes`, `act.contact` | Heat only. Contact is 0 to 1: held in the flame is 1 |
| `d.<name>` | A derived quantity: a named expression, yours or one already defined |

Derived quantities already defined, which you may read: for drift, `air inside holds floor exposed film open bulk thirst tied warmth water damp kept rots loose clings`; for heat, `srcFlows liquid held holds minutes power srcSurface shared around to rate reach surfaceRate warm dried air inside keptWet given glowing own burnRate fuelCoat fuelSelf gap`. Read `packages/core/src/matter/graph/drift-rules.ts` and `heat-rules.ts` for what each means. You may define new ones. You may not redefine one.

## Arithmetic: expressions

A number, a path, `{ "op": <op>, "of": [ … ] }` with `op` one of `add mul sub div min max pow clamp` (`clamp` takes value, low, high), or `{ "if": <condition>, "then": <expr>, "else": <expr> }`.

## Conditions

`{ "a": <expr>, "is": "<" | "<=" | ">" | ">=", "b": <expr> }`, `{ "has": <path> }` (not null, not false), `{ "lacks": <path> }`, `{ "ref": <path>, "equals": <string or boolean> }`, `{ "all": [ … ] }`, `{ "any": [ … ] }`.

## Effects: four kinds

- `{ "kind": "approach", "q": <path>, "toward": <expr>, "rate": <expr>, "lo": 0, "hi": 5 }`: the quantity moves toward a target, in closed form. Prefer this for anything that settles.
- `{ "kind": "accrue", "q": <path>, "rate": <expr per minute, signed>, "lo": 0, "hi": 5 }`: it rises or falls at a rate, between bounds.
- `{ "kind": "set", "q": <path>, "to": <expr>, "lo": 0, "hi": 5 }`: it is given a value.
- `{ "kind": "put", "q": <path>, "value": true | false | null | <string> }`: a discrete state is switched.

Any effect may carry its own `"when"`. An effect may carry `"over": <expr>` for the minutes it runs, in place of `t`.

## What a proposed rule may not do

- Write anything but `s.…` and `x.…`.
- Write `s.amount`, `s.burning`, `s.coating` or `s.wetWith`: only the engine makes and unmakes matter, fire and coats.
- Move a level (`temperature wetness integrity edge contamination corrosion taint flaw`) without both `lo` and `hi`.
- Add a state, a property, a process or a kind of effect. If an outcome needs one, say so in `declined`: that is a finding, not a failure.
- Change or remove a base rule. Proposed rules run after the base rules of their process, and see the state those left.

## What makes a good proposal

A rule is worth having if it is true of many situations nobody has listed, not if it makes one scenario pass. A rule fitted to one scenario is worse than no rule: it will be scored on scenarios you have not seen, and every rule that does not help there counts against the set. Prefer few rules. Rates should be modest and their effects gradual; whatever a rule does over an hour it must do the same whether the hour is one act or sixty.
