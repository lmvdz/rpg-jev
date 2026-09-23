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
choices, every kept scenario is one it could have drawn unassisted.

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

7,345 of 24,577 possible cells were reached (17,232 never sampled): 5,469 answered, 1,677
declined, 199 only-nothing.

| process | answered | declined | only-nothing | never-sampled | possible |
| --- | --- | --- | --- | --- | --- |
| tick | 1 | 0 | 0 | 0 | 1 |
| heat | 1,444 | 0 | 0 | 2,652 | 4,096 |
| soak | 307 | 1,078 | 0 | 2,711 | 4,096 |
| coat | 922 | 414 | 0 | 2,760 | 4,096 |
| force | 1,222 | 185 | 6 | 2,683 | 4,096 |
| contain | 405 | 0 | 73 | 3,618 | 4,096 |
| load | 1,168 | 0 | 120 | 2,808 | 4,096 |

`only-nothing` is a weaker signal than it looks: `load`'s own `bear` rule answers "it holds" as
a real, code-built `"nothing"` outcome whenever a load has not exceeded a support's strength, and
SPEC section 16 is explicit that a weak blow that "barely marks it" is a physical answer, not a
gap. `contain` has no domain gate at all (`families.ts`'s `isGap` only covers `force`, `soak` and
`coat`), so most of its `"nothing"` cells are the container correctly doing nothing, not a rule
that is missing. `declined` is the reliable signal: it only fires where the engine's own gate said
so.

Full detail: `validation/physics-coverage/coverage.json` (every cell, its counts) and
`validation/physics-coverage/gaps.json` (the ranked list below, with examples).

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

## `pnpm check`

Lint, typecheck and the full test suite pass on `feat/physics-coverage`, including the new
`packages/core/test/jepa/coverage.test.ts`.
