# A coverage map of the physics engine

A spike toward milestone J: before more model machinery, know which kinds of situation the
engine already answers, which its own domain gates decline, which it only ever says "nothing"
to, and which nobody has sampled at all — so the next fix is a general rule or a new state, not
a patch found by accident in a playtest.

## Method

`packages/core/src/jepa/coverage.ts` is a pure function, `situationCell(world, act)`, from a
world and an act to a coarse **situation cell**. It is not the model's own observation
(`observe.ts` reads a thing's full effective state); it is a handful of bands built from exactly
what the rules the engine actually runs read to decide anything:

- **process** — the act's process, in the seven the model ranks outcomes for (`observe.ts`'s
  `PROCESSES`; `search`, `move`, `take`, `ingest` and `conduct` are not modelled, so they bin to
  no cell at all).
- **a, b** — the material class of the act's two named parties (source/target, liquid/target,
  substance/target, instrument/patient, container/content, support/content), one of `burning`,
  `liquid`, `gas`, `powder`, `hollow`, `plant`, `flammable`, `inert`. The order mirrors the
  priority the rules themselves use: `state.burning` overrides everything (`envelope.ts`'s
  `flammable`/`RULES.fire`), then whether it flows (`effective.ts`'s `isLiquid`, the same read
  `families.ts`'s `flows` and `FORCE_STRIKES` use), then form (`granular`, `hollow`), then
  `kind === "plant"`, then effective flammability. A tick names no party, so both are absent.
- **heat, wet, whole** — the more extreme of the two parties' temperature, wetness and integrity,
  each collapsed to the same thresholds `words.ts` already renders in plain language (a thing is
  "wet" past 0.5, "damaged" below 4.5 integrity), heat collapsed from six words to four.
- **relation** — `in`, `contains`, `touching` or `near`, read the same way `observe.ts`'s
  `relatedTo` reads it: bound first, then by tile distance, and an act's own two parties are
  never simply unrelated (`relatedTo`'s own rule: "An act brings its parties into contact").

`packages/core/test/jepa/coverage.test.ts` holds the function to determinism and to the specific
bandings above.

## Sampling

`packages/predictor/scripts/coverage.ts` draws scenarios from seeds starting at
6,000,000,000 — disjoint from every training, validation, play and development seed range named
in SPEC section 16 — through the teacher's own generator (`jepa.scenario`), resolves each on the
engine (`matter.resolve`), and puts it in its cell. A **main pass** of 150,000 scenarios samples
the generator as it always runs. A **stratified pass** of up to 300,000 further seeds keeps only
what lands in a cell still short of five sightings (capped at 25 extra per cell), so a rare cell
gets more looks without inflating a common one further; neither pass steers the generator's own
choices, every kept scenario is one it could have drawn unassisted. `--generator v3` runs the same
two passes through a second generator, `scenarioV3` (`## A stratified generator`, below), from its
own seed range.

Each cell is classified from every scenario that reached it:

- **answered** — at least one scenario produced a change other than `"nothing"`.
- **declined** — never answered, but at least one scenario tripped the engine's own domain gate
  (`families.ts`'s `isGap`: a strike where a party flows, a soak whose liquid does not wet, a
  coat whose substance does not spread).
- **only-nothing** — every scenario that reached it produced only `"nothing"`, and never through
  a domain gate.
- **never-sampled** — not reached by either pass, out of the 24,577 cells the two-party processes'
  material classes, bands and relations can combine into (`coverage.ts`'s `universeOf`; `tick`
  has exactly one cell, since it names no party).

## Totals

Of the 24,577 cells the raw combinatorics of process × material classes × bands × relation can
name, only 12,769 are cells the engine could ever actually reach (`## Impossible cells`, below);
the rest were never a gap, only arithmetic that did not know the engine's own shape. Against that
honest denominator, the original sampler (`scenario()`, unchanged) reached 7,345 of 12,769
possible cells (5,424 never sampled): 5,469 answered, 1,677 declined, 199 only-nothing.

| process | answered | declined | only-nothing | never-sampled | possible |
| --- | --- | --- | --- | --- | --- |
| tick | 1 | 0 | 0 | 0 | 1 |
| heat | 1,444 | 0 | 0 | 684 | 2,128 |
| soak | 307 | 1,078 | 0 | 743 | 2,128 |
| coat | 922 | 414 | 0 | 792 | 2,128 |
| force | 1,222 | 185 | 6 | 715 | 2,128 |
| contain | 405 | 0 | 73 | 1,650 | 2,128 |
| load | 1,168 | 0 | 120 | 840 | 2,128 |

`only-nothing` is a weaker signal than it looks: `load`'s own `bear` rule answers "it holds" as
a real, code-built `"nothing"` outcome whenever a load has not exceeded a support's strength, and
SPEC section 16 is explicit that a weak blow that "barely marks it" is a physical answer, not a
gap. `contain` has no domain gate at all (`families.ts`'s `isGap` only covers `force`, `soak` and
`coat`), so most of its `"nothing"` cells are the container correctly doing nothing, not a rule
that is missing. `declined` is the reliable signal: it only fires where the engine's own gate said
so.

Full detail: `validation/physics-coverage/coverage.json` (every cell, its counts, `v1`'s
generator) and `validation/physics-coverage/gaps.json` (the ranked list below, with examples).
`coverage-v3.json`/`gaps-v3.json` are the same, for the stratified generator (`## A stratified
generator`, below).

## Impossible cells

`packages/core/src/jepa/coverage.ts`'s `possible(cell)` says whether a situation cell could ever
be reached by the engine as it stands, so "never-sampled" stops mixing genuine gaps with cells
nothing could ever produce. `packages/core/test/jepa/coverage.test.ts` holds it to these rules,
each checked against 450,000 real sampled scenarios (`coverage.json`/`coverage-v3.json`) as well
as constructed cases:

1. **No element the engine ever builds takes the `"gas"` form.** `matter/pool.ts`'s `POOL` and
   `scenario.ts`'s `ELEMENT_SHAPES` never set it, though the vocabulary and `MATERIAL_CLASSES`
   both still name it, for when a birth eventually can. A cell naming `"gas"` on either party is
   impossible until that changes. This alone removes 8 of the vocabulary's 9 material classes'
   worth of combinations on each of two roles, for every process — most of the gap between the
   raw 24,577 and the honest 12,769.
2. **Whichever party structurally contains the other must be `hollow`, `liquid` or `burning`.**
   `relation` is `"contains"` or `"in"` exactly when one thing's `place` ends in
   `<other>.inside` — and only a `forms`-hollow element is ever bound in there (`contain.ts`'s own
   gate, `hollow()`, and `scenario.ts`'s own `contained()`, which never encloses anything in what
   is not hollow-form). That party's *material class*, though, can still read `"liquid"` (melted,
   `effective.ts`'s `isLiquid`) or `"burning"` (alight), since `materialClass` checks those before
   it checks form — a melted or burning pot is still, underneath, the same hollow pot. If that
   party reads `"liquid"`, its `heat` band must also be `"hot"` or `"scorching"`: `meltingPoint`
   never goes below 3.5 even at the highest `meltsAt` level (5), and `heat` is the more extreme of
   the two parties' rounded temperatures, so nothing melted ever reads `"cold"` or `"mild"`.
   Confirmed against the full 450,000-scenario dataset: every `contains`/`in` cell's
   container-side class is one of the three, and every such `"liquid"` cell is `"hot"` or
   `"scorching"`, with zero exceptions.

What this does *not* exclude, because it is not impossible, only never generated:

- `contain`'s own container role sitting outside those three classes when the two parties merely
  `touch` or stand `near` (not yet enclosed): the process's own `hollow()` gate declines it at
  resolve time, a real, sampleable `"only-nothing"` cell (SPEC section 16(c) is explicit that a
  correct "nothing" is a physical answer). `scenario()` only ever draws a hollow-form thing into
  the container role to begin with, so it never reaches this cell; `scenarioV3` does not carry
  that restriction, and reaches it (`contain`'s only-nothing count rises from 73 cells to 1,417
  below).
- A `"burning"` party paired with a `heat` band other than `"scorching"`. `pool.ts`'s `alight`
  happens to always set `temperature` to 5 for its own convenience when a scene is built, but
  nothing in `ThingState` or `apply.ts` ties the two fields together — over the 450,000-scenario
  `v1` dataset every burning cell reads `"scorching"`, a generator artefact, not an engine rule.
  `scenarioV3` deliberately decouples them (`## Wider-sampling failures`, below, reports what
  that turned up: nothing).

## The top gaps

The ranked list (`validation/physics-coverage/gaps.md`) scores every declined or only-nothing
cell by a plausibility heuristic — a burning party (+2), a liquid or powder party (+1 each), hot
or scorching heat (+1), a wet party (+1), a damaged party (+1) — times the log of how often the
sampler actually reached it, so a one-off draw cannot outrank a cell the generator visits
constantly. The formula and its reasoning are in `coverage.ts`'s `plausibility` function.

All 30 of the top-ranked cells collapse into exactly three root causes, and they are, by
construction, the same three examples SPEC section 16(c) already names as the engine's sanctioned
gap set:

1. **`soak`, the poured substance does not flow** (23 of 30 entries, e.g. "soak: powder ×
   burning" — someone pours a granular or solid substance over something, most often something on
   fire). `SOAK_WETS` (`matter/graph/soak-rules.ts`) declines because what is poured is not liquid
   and has not melted. Example (seed 6000001352): *"Someone pours t1 over t0 (3 portions). t0: a
   material (cord; ... very flammable ...), scorching, on fire ...; t1: a material (granular; ...
   very flammable ...), hot, wet, cracked, one portion."*
2. **`coat`, the spread substance does not flow** (2 of 30, "coat: plant × burning"). `COAT_SPREADS`
   (`matter/graph/soak-rules.ts`) declines because what is spread is neither liquid, granular nor
   softened near its melting point.
3. **`force`, either party flows** (5 of 30, "force: powder × liquid" — a strike where the
   instrument or patient is a liquid). `FORCE_STRIKES` (`matter/graph/force-rules.ts`) declines
   because a blow has nothing solid to land on or swing.

Almost every one of these has a burning party in its cell, but that is a property of the
heuristic, not of the gate: `SOAK_WETS`, `COAT_SPREADS` and `FORCE_STRIKES` all read only whether
the poured, spread or struck substance itself flows, never whether anything nearby is on fire.
A burning party scores plausibility highest (steam, quenching and smothering are all real physics
a flowing liquid would trigger there), so the ranking surfaces the on-fire cases first within each
root cause, not because fire is what the code actually declined on.

Because these three are already the sanctioned (c) set, milestone J already has a remedy for
them that is not a new engine rule: Claude proposes an outcome from the envelope, code validates
it, and Jev ratifies it through `believe_claim` (SPEC section 16(c)). This coverage pass is
useful here mainly as a check that the sampler and `isGap` wiring find exactly what the spec says
they should, not as a new discovery.

Two candidates below the top 30 look more like a genuine missing general rule:

- **`force` on a liquid could still do something physical** rather than `"nothing comes of it"`:
  a strike could displace the liquid, splash it onto what is nearby and wet the instrument, all
  from state and quantities the engine already has (`amount`, `wetness`, `containerOf`) — "force
  on a liquid displaces it and wets what touches it" is one general rule, not a recipe.
- **`soak`/`coat` with what does not flow could leave a mess rather than nothing**: pouring a
  powder or resting a plant's own fibre against a target could still deposit a small, loose
  amount (falling off rather than bonding, the way `COAT_RULES`' own `laid` already distinguishes
  a bonded coat from one that has not "gone on over" anything) instead of a flat decline.

The contain/load `only-nothing` cells with a burning or liquid party (below the top 30; see
`gaps.json` for `label: "only-nothing"` entries) are the harder kind: closing them needs a new
state or quantity, not one rule. `contain` has no notion of a sealed container's air running out
over the act itself (only over a stretch of time, in `drift.ts`), and `load` has no notion of
heat or wet weakening a support's strength over the course of one load rather than only through
its already-tracked `flaw`/`corrosion`. Both are extensions of state that already exists, not a
new mechanism, but they are not a single rule either.

## A stratified generator (`scenarioV3`)

`packages/core/src/jepa/scenario-v3.ts` adds `scenarioV3(seed)`, a second generator for
`packages/predictor/scripts/coverage.ts --generator v3`. `scenario()` itself is untouched:
`packages/core/test/jepa/scenario-pin.test.ts` hashes its output over a seed from every named
range in SPEC section 16 plus this spike's own, pinned before `scenario-v3.ts` existed, and it has
not moved.

`scenario()` draws two parties mostly from a `fit` bias (`two`'s 85–90% preference) over whatever
a randomly built world happens to contain, so its reach over the 12,769-cell possible universe is
a side effect of six element archetypes and a handful of chances. `scenarioV3` instead takes
`coverage.ts`'s own `possibleCells()` as its target space: one seed picks one possible cell
uniformly, and the world is built backwards from it — the two named parties first, in whatever
shape reaches that class and band (an element shape per material class, `BASE_SHAPES`, plus a
melted or lit variant for a structural container), related the way the cell's `relation` asks
(`apply`'s own `"room"`/`"enclose"` changes for `contains`/`in`, tile distance for `touching`/
`near`), then zero to two ordinarily drawn bystanders. Every world is still built only through the
engine's own types, elements and `apply`; nothing here writes a `Change` or a `ThingState` field
the engine could not otherwise reach.

Run on the same budget as the `v1` rerun above (150,000 main, 300,000 stratified, seeds
6,500,000,000 to 6,500,450,000, disjoint from `v1`'s own 6,000,000,000 range and from every other
named range in SPEC section 16):

| generator | possible cells reached | never-sampled | answered | declined | only-nothing |
| --- | --- | --- | --- | --- | --- |
| `v1` (`scenario`) | 7,345 of 12,769 (57.5%) | 5,424 | 5,469 | 1,677 | 199 |
| `v3` (`scenarioV3`) | 12,769 of 12,769 (100%) | 0 | 7,178 | 3,596 | 1,995 |

`v3` reaches every possible cell at least once inside the same budget `v1` has always used; a
smaller, 4,000-scene run reaches 3,400 of 12,769 (26.6%) against `v1`'s 1,963 (15.4%) at the same
size, so the gain is the stratification, not only the larger `only-nothing` count `contain`'s
freed container role adds (`## Impossible cells`, above). Full detail:
`validation/physics-coverage/coverage-v3.json` and `gaps-v3.json`/`gaps-v3.md`.

`declined` more than doubles (1,677 to 3,596) and `only-nothing` grows tenfold (199 to 1,995):
most of the latter is `contain`'s container role no longer being restricted to a hollow-form
thing before an act is drawn (its own only-nothing count rises from 73 to 1,417, three quarters
of the 1,796-cell rise), and most of `declined`'s growth is `soak` and `coat` reaching far more of
`SOAK_WETS`/`COAT_SPREADS`'s own declines (1,078 to 1,808, 414 to 1,292) by targeting a
non-flowing-substance cell directly rather than waiting for `two`'s 15% off-fit draw to land
there.

## Wider-sampling failures

None found. The full 450,000-scenario `v3` run above, plus a dedicated pass re-checking every
thing's state after every act (temperature, wetness, integrity, contamination, corrosion, amount,
flaw and taint finite and in range) and the envelope-containment property `envelope.test.ts` holds
`scenario()` to (`packages/core/src/jepa/envelope.ts`'s `legal`/`isLegal`, skipped only for
(c)-gap transitions, same as that test): zero crashes, zero non-finite or out-of-range state, zero
envelope rejections of the engine's own outcome, across 1,083,673 thing-transitions checked. This
is not a guarantee nothing is wrong outside what was checked (an invariant beyond the ones listed,
or a channel besides the ones `commit.ts` already checks, could still fail); it is what this pass
looked for and did not find.

## `pnpm check`

Lint, typecheck and the full test suite pass on `feat/physics-coverage`, including
`packages/core/test/jepa/coverage.test.ts`, `scenario-pin.test.ts` and `scenario-v3.test.ts`.
