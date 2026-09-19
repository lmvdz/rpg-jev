# Compositional causality: the depth contract

## Decision and status

The goal is a world whose consequences follow from persistent structure, not a list
of authored outcomes. A burning tool is a temporary state of connected materials,
not a special item kind. Describing another material or assembly should open new
causal chains without adding a rule that names that assembly.

This is the accepted design direction in SPEC section 21, not a claim that the
current game implements it. It applies to material simulation whether the game
has an authored story or becomes the proposed sandbox. It does not authorize new
Jev families, change the ten constitutional rules, or start multiplayer integration.

The initial sandbox audit is pinned to `928755f673d2b18f4d893156df9499bc68340751`.
The work was authored in an older attached `poc` tree and published on
`design/compositional-causality`, based on sandbox `b94fe5c`. Publishing this
integration branch does not merge the sandbox or renderer branches or update the
Claude Doc. See `branch-validation-map.md` and the pinned held-out report.

### Audit against that revision

| Existing foundation | Gap this contract closes | Required implementation change |
| --- | --- | --- |
| Property-driven rows and a shared expression kernel | One element/state and one coating cannot represent a blade-to-grip-to-hand path | Material portions, assembly membership and typed contact channels |
| Finite fuel timer and event-aware drift | Burnout paths differ; residue can start at a fresh default amount instead of a yield | One accounted combustion transition used from every caller |
| Splitting debits its parent | Other deletion/transformation effects have no complete source/destination balance | Atomic material/energy accounts underneath all physical effects |
| Generated rows pass structural checks | Arbitrary constants and identity predicates can encode uncalibrated exceptions | Reviewed mechanics/calibration packages; restricted runtime proposal schema |
| Settled search abundance and supplied draws | No general stable latent field or refinement record | Persistent latent keys and first-class provisional-result records |
| Comments require append-only rules | Matter world/outcomes do not enforce a selected immutable mechanics bundle | World/version pins, admission/migration records and archived dependencies |
| Several old/new rule-equivalence tests | Equivalence can preserve the same wrong physics | Independent counterfactual, budget, event and unseen-assembly gates |

The kernel/data abstraction is retained. Replacing it wholesale or growing another
parallel production engine would obscure the real missing piece: a conserved,
versioned physical substrate. An identity reference used to identify an output
material is not itself a forbidden recipe; the transformation must still be an
admitted, general mechanism with yields and accounts, not a special outcome chosen
because an object is called a sword.

## What is abstracted

Three tests are different:

- **Repeatability:** the same state, mechanics version, action and sampled inputs
  produce the same effects.
- **Causality:** the effects are paid for by relevant inputs and follow modeled
  mechanisms.
- **Generality:** the mechanisms work for unfamiliar objects without identity-based
  exceptions.

A seeded outcome table establishes only repeatability. Moving that table or an
arbitrary formula into JSON does not establish causality or generality. The rule
graph is a restricted programming language, not automatically a physical model.

Keep two graphs distinct:

1. The **physical graph** holds persistent parts, material state and their contacts.
2. The **rule graph** describes code-owned quantities, constraints and transformations
   applied to that physical graph.

The event log records the causal history produced by both. It is not a stored tree
of all possible futures. Only active interactions and scheduled transitions need
execution; hypothetical futures are evaluated on copies when a planner needs them.

## Parts, materials and contact

| Concept | Responsibility |
| --- | --- |
| Material definition | Versioned baseline physical characteristics; no rule selected by its display name |
| Part | A quantity of material with geometry class, physical state and stable identity |
| Assembly | A grouping of parts for targeting, carrying and presentation; not a second inventory of their mass |
| Contact | A typed relation carrying the geometry/exposure needed by a mechanism |
| Environment | Boundary conditions and explicitly accounted sources or sinks |
| Mechanism | A code-owned transformation over compatible properties and contacts |

An assembly can start as one lumped part. Add parts when they express a distinction
that affects play: a conducting blade and tang, an insulating grip, an outer coating,
or a contained liquid. A hand may be an exposed body part; heat reaching it and
damage from accumulated exposure are separate mechanisms, not an item-specific
callback.

Membership is acyclic and a part has one material owner. Physical contacts may
form cycles. A wrap is material with an amount and coverage, not a free insulation
flag. A broken or detached part retains its material, heat and damage. Removing a
wrap changes the contact path rather than granting a new named action.

Contact channels are admitted deliberately: thermal exchange first, then mechanical
load/attachment and liquid transport as their gates pass. Not every relationship
must conduct everything. Coating coverage, contact area, thickness and conductivity
must not be collapsed into a material name.

**Material levels are not quantities.** A 0–5 judgment category can select a
code-authored calibration or bounded parameter set. Energy and material accounting
use quantities with declared units or a documented consistent model scale, not
sums of ordinal levels. Density, volume and mass must agree through one code rule;
heat capacity belongs to the amount and material, not to the object's label.

## Every transformation has an account

An interaction reads one versioned state and produces an atomic, validated batch:

- The source and destination of transferred material and energy are identified.
- Amount consumed is bounded by amount available. A remainder is still the same
  material unless a modeled transformation changes it.
- A reservoir outside the detailed simulation can receive heat, escaped gas or
  runoff. It is a recorded balance, not silent deletion.
- A maintained external source, such as environmental heating, explicitly records
  energy entering the modeled system. A flame is not an infinite source: its
  available fuel and reaction rate bound its energy.
- Multiple contacts read a consistent interval state. A part cannot spend its
  available resource once per neighbor. Code resolves shared budgets before commit.
- Zero amount cannot wash, feed or coat. Zero thermal exposure cannot heat or
  thermally damage. An instantaneous modeled action still accounts for its
  nonzero material/work input; this is not a blanket ban on discrete effects.
- A threshold crossing schedules or settles a transition once. It must not erase
  the interval before that crossing or apply the transition twice.

The existing closed effect vocabulary remains the only commit path. New physical
effects and schemas require a normal reviewed code change; a generated proposal
cannot acquire write access by inventing an effect kind.

### Combustion is a mechanism, not a status timer alone

The minimum model relates available combustible material, oxygen/exposure, ignition
conditions and a code-owned burn rate. Fuel consumption supplies heat, material
loss, residue and escaped products through a defined accounting rule.

A coating and its substrate are distinct possible fuels. A coating can run out
while its substrate remains hot; a combustible substrate may then sustain burning
if its own conditions are met. A noncombustible substrate gains heat without being
declared fuel. Wetness can consume energy through the admitted drying model before
ignition; moisture is not just a random penalty to an outcome roll.

Residue yield, damage and structural strength need a general material mechanism.
Do not create full residue while retaining the full consumed substrate. Exact
chemistry is not required: an honest coarse char/ash/gas balance is preferable to
unaccounted realism in prose. Oxygen can initially be a declared boundary assumption;
sealed-volume oxygen depletion is not supported until it has its own quantity model.
If a prototype omits oxidizer mass, its conservation claim must explicitly be about
fuel-derived material, not total chemical mass. The production accounting boundary
must include whatever enters from external reservoirs.

### Time and numerical approximation

Code owns integration and event ordering. Integrate the active interval up to fuel
exhaustion, detachment or another discontinuity, settle it, then advance the
remainder. Merely choosing a smaller step does not fix incorrect ordering.

An approximation must declare its error tolerance, stable step/work bound, and
supported duration. Compare one interval with partitions, including partitions at
and around event boundaries. Exact effect replay is required; numerical evolution
across different partitions may be equivalent within declared tolerance, not
bit-identical. Do not promise exact partition invariance for an approximate solver.

An unwatched region uses the same admitted mechanisms and no Jev calls. Closed-form
or coarse updates must preserve balances and significant events within their
documented approximation. If bounded work cannot produce a valid catch-up, schedule
code work or defer activation; do not silently substitute random outcomes.

## Living probabilities without rerolling reality

Probability describes a specified uncertainty or variability, not an unrestricted
choice of what the story should do.

| Kind | Resolution and persistence |
| --- | --- |
| Known physical state | Code derives the outcome; do not roll again for a preferred result |
| Hidden persistent trait, such as a flaw | Establish once for the persistent entity/property, record the sampling version, and log; later observations reveal or constrain the same value |
| Action variation, such as contact placement | Code samples a bounded input once per committed action; downstream consequences share that sample |
| An observer's belief | May differ from the world; semantic judgment changes belief, not physics |
| An unsupported mechanism | A logged design/content gap, not permission to fabricate a physical consequence |

Use existing seeded `Rng` and logged draws. Stable latent keys must make querying
one object's trait unable to change another's realization merely by consuming RNG
in a different order. Samples for correlated properties come from an admitted joint
model or shared causes, not independent outcome rolls.

The minimum persistent latent record identifies its domain/entity, property or
joint model, prior/calibration revision, realization and settling event. Observer
evidence is recorded separately. A shared regional cause may affect several objects;
sampling it once must not reveal it to an actor who has not observed its effects.

Once realized, a latent belongs to world state, even if no actor has observed it.
Its sampling version is provenance, not permission to reroll it. Save/load,
refinement and mechanics upgrades preserve the value or apply an explicit logged
state transformation; a new version/key alone never resamples existing reality.

A latent realization must fit already observed facts and accumulated state.
If none does, retain the established facts and report the model gap. Do not rewrite
the past, mint resources or grant another search roll by renaming the sought object.
Searching resolves new coverage/effort or a changed source, not a fresh world each
time the player repeats a sentence. Exact coverage/replenishment semantics require
a code contract before replacing the current aggregate search model.

As a part burns, weakens or loses insulation, future outcome distributions change
because its state changed. Observing that part changes the observer's uncertainty,
not the part itself. The simulation need not explicitly enumerate those distributions
or all their possible end states at each tick.

## Generation boundary

The three layers in SPEC section 20 remain separate:

1. **Runtime content:** proposed material/assembly descriptions and compositions of
   admitted templates. Numeric parameters come from code-built bounded choices or
   calibration tables. Generated labels never influence physical predicates.
   Structural validation, applicable semantic ratification and code preconditions
   precede admission. Until the necessary question families are admitted, this is
   human-gated; no new live calls are implied.
2. **Offline mechanics work:** a proposed expression, rate formula, threshold,
   coupling or change to a base factor is a mechanics change even when represented
   as JSON. Code executes arithmetic; a model's plausibility judgment is not
   validation of its numbers. Such changes need versioning, numerical/invariant and
   held-out evidence, and human review before joining the mechanics package.
3. **Ontology:** new properties, contact kinds, state quantities or effect kinds are
   deliberately implemented and specified by a person.

The sandbox's arbitrary generated expressions/factors are therefore an offline
research/admission path, not an unattended runtime loophole. Existing admitted
rows are retained under their mechanics version; this decision does not silently
delete or reinterpret them.

Runtime predicates must not branch on element names, literal definition IDs or a
disguised identity lookup. IDs still identify parties, references and topology;
same-part/contact checks are legitimate. If two descriptions differ only in
identity and presentation, the physical result must be the same after renaming.
Checker restrictions must cover predicates, derived quantities and factors, not
just prose or engine source. A structural validator alone cannot prove this or
conservation; admission also runs semantic and metamorphic tests.

**Select without rewriting physics.** Nearest-element ranking is only discovery.
Code filters candidates for compatibility with the computed composition, quantities,
energy, fuel and damage before Jev chooses a definition or none. Choosing a name
must not reset the instance to that definition's pristine baseline. If no compatible
definition exists, keep the generic physical result. Existing-match, none and later
generated-admission paths must preserve the same committed balances and history.

## Versions, refinement and what the player can learn

Every world selects a mechanics package version, and admitted material/assembly
definitions have immutable versions. Events record the versions and sampled inputs
used. Saves replay committed effects, not a fresh graph evaluation.

New laws do not apply retroactively or silently halfway through a saved interaction.
An existing world adopts a mechanics update through an explicit migration event
with state preconditions; until then it uses its prior package. Culling removes
unreferenced candidates from discovery, not definitions needed to explain or replay
history.

A missing description/mechanism has a durable refinement record: canonical typed
signature, mechanics version, status (pending, rejected, admitted or unsupported),
evidence, provisional result/effect IDs, and the event/version that settles it.
These statuses are closed code choices. Repeated requests reuse that record.
A rejected mechanism is not the same fact as a search that found no resource.
This is a required schema addition, not an existing `MatterWorld` capability.

Refining a lump into parts partitions its mass, stored energy, remaining fuel and
damage consistently with history and prior observations. Refinement is versioned
and logged, idempotent on retry, and cannot create an unobserved fresh interior as
an exploit. If an aggregate representation cannot be refined honestly, keep it
coarse and mark that interaction unsupported until a migration is designed.

Depth must be observable. The client renders code-produced evidence such as a
warming grip, smoke, changed integrity or an exposed hot surface. `why` traces
actual transfers and transformations, including absent prerequisites for a no-op.
Prose cannot claim that a missing physical mechanism occurred.

## Acceptance gates and implementation order

Do not add special fire-tool cases to make these pass. Fixtures may name real
materials; production mechanisms must not.

| Gate | Evidence required before claiming support |
| --- | --- |
| C0: zero input and events | Fix H1/H2/H4/H5 on the current sandbox; confirm ordinary assertions, not expected-failure counts |
| C1: parts and thermal contact | Bare and wrapped grips, coating and substrate; different temperatures arise on different parts without item-specific logic |
| C2: finite transformations | Coating exhaustion, combustible-substrate damage, residue/escaped-product balance and residual heat; sources cannot double-spend |
| C3: counterfactual generality | Rename all identities; replace equal-property definitions; remove contacts/inputs; vary mass, moisture and conductance; permute edge storage |
| C4: numerical consistency | Whole/split time within declared tolerance, event-boundary probes, energy/material budgets, input immutability and bounded work |
| C5: persistent uncertainty | Stable latent keys, shared action samples, no observation-order or repeated-search reroll; save/load preserves realized unobserved traits without model calls |
| C6: refinement and versions | Existing match, none and delayed admission preserve balances; refinement and upgrades preserve realized unobserved traits and history; no dangling definitions after culling |
| C7: player integration | Same physical graph feeds renderer, inventory/body effects and why; hot-grip cues and consequences; offscreen catch-up uses code |
| C8: unseen assemblies | Held-out material families and assembly topologies, plus multi-mechanism chains not present in authored content |

First proof: one generic thermal/material model applied to bare metal, insulated
metal, combustible material, and wet combustible material, with and without finite
coating. A hand is another exposed part. Vary density/amount, contact and remaining
fuel independently; do not tune a separate formula for each assembly.

Freeze tolerances and work bounds before running the directional counterfactuals:

- Fixed geometry and material-specific heat: higher density means greater mass and
  heat capacity; identical deposited energy gives a smaller temperature increase.
- Fixed heat source and initial state: an intact insulating wrap delays a specified
  hand-exposure threshold compared with the same bare contact. Removing the wrap
  changes the path without resetting any part's heat.
- A finite coating on metal and on combustible substrate stops supplying its own
  heat when exhausted in either case. Continued burning needs and consumes actual
  substrate fuel; the metal cannot become that fuel merely by being hot.
- For the wet/dry comparison, keep material, geometry and external heat equal.
  Moisture handling must account for drying energy and delay the admitted ignition
  condition where evaporation is the limiting mechanism. State the supported range;
  do not assert a universal monotonic rule for every possible wet substance.

`spikes/composition` is the isolated execution experiment for the tractable thermal
and finite-material subset. Its README must state what it actually demonstrates,
units, numerical assumptions and omitted mechanisms. A passing spike is evidence
for the design, not completion of C0–C8 or a production replacement.

### Evidence from the isolated proof

The first implementation has **16 passing ordinary tests**, a standalone strict
TypeScript check, and a passing root `pnpm check`. See
[`spikes/composition/README.md`](../spikes/composition/README.md) for the exact method.
Only its explicit part state and numeric material/contact parameters determine
outcomes; the source has no material-name or object-name branches.

| Gate | Evidence obtained | Still not established |
| --- | --- | --- |
| C0 | Zero time, contact conductance and fuel in the spike | Fixing active sandbox H1/H2/H4/H5 |
| C1 | Separate coating/substrate, bare/wrapped contact paths, ordinary thermal body part | Geometry-derived contacts, real wrapping degradation, game targeting |
| C2 | Finite fuel, substrate consumption, retained residue, escaped fuel-derived mass/heat and signed ambient account | Oxidizer/full chemical mass, moisture evaporation, structural damage and disappearing parts |
| C3 | Rename/reorder parts and contacts, change thermal inertia through mass, remove conductance | Density/geometry derivation, wet/dry cases and independently authored material families |
| C4 | Declared stable/work bounds, budget checks, input immutability and one split-time tolerance test | Universal trajectory error bound, exact threshold/event timing or whole-world catch-up |
| C5–C8 | Design contracts and required tests specified | Persistence, latent fields, refinement, version migration, renderer and held-out assembly admission |

The solver uses approximate sampled ignition and bounded substeps. It keeps
fuel/energy accounts through exhaustion but does not locate every continuous
threshold crossing exactly. Its fixed positive inert mass deliberately avoids
zero-capacity topology changes. Those limitations are reasons to test the next
abstraction, not to present this experiment as complete physics.

Integrate only after comparing its abstractions with the active sandbox graph.
First land budget/exposure/event guarantees, then the minimal parts schema and
thermal channels, then actor/refinement/version integration. New domains must
pass held-out admission tests; more generated rule rows alone are not progress.
