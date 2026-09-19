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

## The processes that run on rows

A rule belongs to one process. Each has its own parties (the prefixes a path may start with), its own numbers on the act, and its own base rows, which you should read before proposing anything: they show the form, and what is already said.

| Process | What it is | Parties | `act.` numbers | Base rows |
| --- | --- | --- | --- | --- |
| `drift` | What time does to one thing | none (paths have no prefix) | none; `t` is the minutes | `graph/drift-rules.ts` |
| `heat` | A source warming or cooling a target in contact | `src`, `tgt` | `minutes`, `contact` (0 to 1) | `graph/heat-rules.ts` |
| `strike` | A blow or a cut on a thing | `tool`, `tgt` | `effort`, `care`, `haste` (0 to 5), `seconds`, `surface` and `along` (1 or 0: the aim) | `graph/force-rules.ts`, `FORCE_THING_RULES` |
| `wound` | A blow or a cut on a body | `tool`, `tgt` (the body: `tgt.p` is what its flesh is like, `tgt.b.bleeding` how many of its wounds bleed), `arm` (the best thing it wears, if any) | as `strike` | `graph/force-rules.ts`, `FORCE_BODY_RULES` |
| `soak` | A liquid wetting a thing | `liq`, `tgt` | `amount` | `graph/soak-rules.ts`, `SOAK_RULES` |
| `coat` | A substance put on a thing as a coat | `sub`, `tgt` | `amount`, `care`, `haste` | `graph/soak-rules.ts`, `COAT_RULES` |
| `load` | A support bearing weight | `sup` | `borne` (the weight, on the scale of mass) | `graph/soak-rules.ts`, `LOAD_RULES` |

All under `packages/core/src/matter/`. Not on rows yet, so out of reach: eating, searching, moving, taking, sensing, and anything a body feels or chooses.

## Three ways to grow a process

```json
"drift": {
  "derived": { "<name>": <expr> },
  "factors": { "<a quantity the base rows name>": [ <expr>, ... ] },
  "rules":   [ <rule>, ... ]
}
```

- **`rules`** run after the base rules of the process and see the state those left.
- **`derived`** are new named quantities your rules read.
- **`factors`** multiply a quantity the base rows already name (a rate, a threshold, a share: any `d.<name>` in that process's base rows). This is how you slow, speed or stop something a base rule does, without editing it: dryness stopping rot is a factor on drift's `rots`; wind speeding how fast a surface comes up to a flame is a factor on heat's `surfaceRate`. A factor of 1 changes nothing, 0 stops it. Prefer a factor to a rule that undoes what a base rule did.

## Quantities: paths

Every level runs 0 to 5. A path names one quantity. In a **drift** rule (what time does to one thing) paths have no party. In a **heat** rule (a source `src` warming a target `tgt` in contact) a path starts with `src.` or `tgt.`.

| Path | What it is |
| --- | --- |
| `p.<property>` | An effective property of the thing as the act began: `mass size hardness toughness flexibility flammability conductivity meltsAt absorbency porosity buoyancy solubility stickiness friction perishability corrodibility noxiousness potency scent oiliness swell setting cleansing` |
| `now.p.<property>` | The same, worked out against the state as it is now |
| `s.<state>` | A state now: `temperature wetness surfaceAbove integrity edge contamination corrosion taint amount flaw temper set`, and `s.burning` (null or a record: `s.burning.of` is `"self"` or `"coating"`, `s.burning.fuel` is minutes), `s.coating` (null or `s.coating.element`, `.amount`, `.coverage` 0 to 1, `.bond`), `s.wetWith` (null is water) |
| `was.<state>` | The same, as it was when the act began |
| `x.<name>` | A scratch number one rule writes for a later one. Heat's `warm` rule leaves `tgt.x.surface`: how hot the target's surface got |
| `b.<name>` | A number about a party that is a body (`tgt.b.bleeding` in `wound`) |
| `place.<field>` | `temperature moisture wind air light noise cover`, each 0 to 5. `air` 0 is sealed |
| `row.p.<property>`, `row.is.<form>`, `row.moist`, `row.id` | The thing's own element row, raw. Forms: `hollow flat long pointed edged round sheet cord granular liquid gas grained` |
| `coat.p.…`, `coat.is.…` | The row of what coats it (0 or false if nothing does) |
| `wetWith.p.…` | The row of what it is wet with. Wet with nothing in particular is wet with water, so water's own row is read |
| `t` | The minutes that pass (drift). In heat use `d.minutes` |
| `act.minutes`, `act.contact` | Heat only. Contact is 0 to 1: held in the flame is 1 |
| `d.<name>` | A derived quantity: a named expression, yours or one already defined |

Derived quantities already defined, which you may read (and factor): read the base rows of the process for the full list and what each means. For drift, `air inside holds floor exposed film open bulk thirst tied warmth water damp kept rots loose clings`; for heat, `srcFlows liquid held holds minutes power srcSurface shared around to rate reach surfaceRate warm dried air inside keptWet given glowing own burnRate fuelCoat fuelSelf gap`. Read `packages/core/src/matter/graph/drift-rules.ts` and `heat-rules.ts` for what each means. You may define new ones. You may not redefine one.

## Arithmetic: expressions

A number, a path, `{ "op": <op>, "of": [ … ] }` with `op` one of `add mul sub div min max pow clamp abs floor exp ln at` (`clamp` takes value, low, high; `ln` of nothing or less is 0; `at` reads a table by level: the first argument is the index, floored and kept in range, the rest are the rows), or `{ "if": <condition>, "then": <expr>, "else": <expr> }`.

## Conditions

`{ "a": <expr>, "is": "<" | "<=" | ">" | ">=", "b": <expr> }`, `{ "has": <path> }` (not null, not false), `{ "lacks": <path> }`, `{ "ref": <path>, "equals": <string or boolean> }`, `{ "same": [<path>, <path>] }` (both hold the same word or number), `{ "all": [ … ] }`, `{ "any": [ … ] }`.

## Effects

- `{ "kind": "approach", "q": <path>, "toward": <expr>, "rate": <expr>, "lo": 0, "hi": 5 }`: the quantity moves toward a target, in closed form. Prefer this for anything that settles.
- `{ "kind": "accrue", "q": <path>, "rate": <expr per minute, signed>, "lo": 0, "hi": 5 }`: it rises or falls at a rate, between bounds.
- `{ "kind": "set", "q": <path>, "to": <expr>, "lo": 0, "hi": 5 }`: it is given a value.
- `{ "kind": "put", "q": <path>, "value": true | false | null | <string> }`: a discrete state is switched.

- `{ "kind": "copy", "q": <path>, "of": <path> }`: a state is given whatever another path holds.
- `{ "kind": "emit", "from": <party>, "channel": "light" | "sound" | "scent" | "smoke" | "sight", "strength": <expr 0 to 5>, "because": [...], "note": "..." }`: something is given off that others may notice. It changes nothing.
- `{ "kind": "use", "from": <party>, "amount": <expr>, "because": [...], "note": "..." }`: so much of a thing is used up. It can only lessen.
- `{ "kind": "split", "from": <party>, "suffix": "piece", "amount": <expr>, "state": { "integrity": 5, "coating": { "value": null } }, "because": [...], "note": "...", "less": { "because": [...], "note": "..." } }`: part of a thing comes away as a thing of its own. Its amount is taken from the parent, so nothing is made from nothing. The piece inherits the parent's state as it was, but for what `state` says.

In a drift rule, where paths have no party, the thing itself is the party `self` for `from`.

`lo` and `hi` bound the value that is written, whatever it was before: a cap of 3 on something already at 5 brings it to 3. To cap only what you add, write `min(3, <what it was>)` into the value, or guard with `when`.

Any effect may carry its own `"when"`. An effect may carry `"over": <expr>` for the minutes it runs, in place of `t`.

## What a proposed rule may not do

- Write anything but `s.…` and `x.…`.
- Make matter, fire or a coat. `s.amount` and `s.wetWith` may not be written at all (use `use` to lessen a thing). `s.burning` may only be `put` to `null`: a rule may put a fire out and never light one. Of a coat, only `s.coating.bond` (0 to 5) and `s.coating.coverage` (0 to 1) may be moved, with bounds.
- Wound or heal a body.
- Move a level (`temperature wetness integrity edge contamination corrosion taint flaw`, and a coat's `bond` and `coverage`) without both `lo` and `hi`.
- Add a state, a property, a process or a kind of effect. If an outcome needs one, say so in `declined`: that is a finding, not a failure.
- Change or remove a base rule. Proposed rules run after the base rules of their process, and see the state those left. To change how strongly a base rule acts, factor the quantity it reads.

## What makes a good proposal

A rule is worth having if it is true of many situations nobody has listed, not if it makes one scenario pass. A rule fitted to one scenario is worse than no rule: it will be scored on scenarios you have not seen, and every rule that does not help there counts against the set. Prefer few rules. Rates should be modest and their effects gradual; whatever a rule does over an hour it must do the same whether the hour is one act or sixty.
