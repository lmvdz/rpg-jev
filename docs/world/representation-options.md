# Q018 representation comparison for experimentation

## Status and decision being explored

**Recommendation for discussion, not an accepted concrete schema or mechanism.**
The user asked which representation best supports the experimentation goal and
the eventual causal world. This compares options against the
[three player journeys](experimentation-journeys.md), not only against rendering
convenience or the ability to reproduce one thermal result.

Q018 already accepts material-bearing parts, typed relationships, meaningful
stored structure with compound simple geometry, SI quantities and hierarchical
region/local/part coordinate frames. Its concrete shape palette, precision,
interfaces, physical approximations and channel calibrations remain open.
The [owning composition design](composition-and-processes.md) takes precedence;
this document does not reverse those decisions or claim production support.

No engine, renderer, numerical experiment or player study is implemented here.
The existing composition spike is evidence for a narrow thermal abstraction,
not an implementation of the representation recommended below.

**Sequencing update:** the subsequently accepted
[Q064 cross-domain interaction review](interaction-contract.md) comes before
selecting concrete geometry or a first mechanism set. This comparison is a
physical-domain contribution to that review, not a foundation inferred from the
thermal journeys. The hybrid below is a candidate physical representation;
it is not the representation of beliefs, intentions or every engine interaction.

## What makes a representation good for this goal?

It should let a player change an arrangement, form a prediction about it, obtain
limited evidence and transfer a discovery to an unfamiliar arrangement.
Evaluate candidates by:

1. **Causal distinctions:** represent a covering beside an object differently
   from a covering around it, and an exposed support path differently from a
   covered path with the same total material.
2. **Generality:** substituted materials, shapes and relationships work without
   named-object rules. A generated name cannot select a mechanism.
3. **Actionable structure:** participants can alter supported relationships,
   rather than only select an outcome from a menu.
4. **Continuity:** movement, rebuilding an index or changing visual detail does
   not restore heat, erase damage, reroll properties or duplicate material.
5. **Evidence:** the player can investigate a relevant path without an automatic
   readout of every hidden state.
6. **Bounded scope:** a supported approximation has explicit limits. Attractive
   pictures or a large geometry vocabulary do not certify new physical channels.

These are design criteria, not measured performance scores.

## Three coherent options

| Candidate | Strengths | Costs and failure modes |
| --- | --- | --- |
| **A. Authoritative relation/contact network; mostly symbolic shape** | Small, explicit causal graph; easy to inspect; economical for a constrained apparatus or relationship-centred game | Someone must establish the edges. Without spatial validation, "touches," "covers" or "supports" becomes a magic fact. Exact coverage, a missed contact or a bypass can require authored exceptions. Does not fulfil the accepted stored-geometry direction as the long-term sole substrate |
| **B. Detailed mesh/voxel geometry with a broadly geometric physics model** | Rich spatial manipulation, local shapes and deformation when their solvers actually exist; strong candidate if carving or free-form construction is the primary loop | Resolution, collision, constitutive laws, remeshing and coupled numerical work become major commitments. Geometry alone does not supply pressure, fracture, wetting, perception or causality. A detailed mesh is not automatically physical truth or a cheap offscreen model |
| **C. Stored compound geometry and explicit structure; validated relationships and derived mechanism networks** | Placement and coverage can matter while thermal/mechanical/etc. models use bounded approximations. One structural basis can support many unfamiliar assemblies and different visual forms | Requires disciplined separation of structural facts, history-bearing physical state and disposable derived caches. Contact generation, validity bounds and state transfer between approximations need evidence; this is not a free universal physics engine |

**Recommend C as the best-fitting direction to investigate.** It makes geometry
meaningful without requiring every interaction to run a detailed continuum
simulation. A remains the strongest cheaper rival for an explicitly constrained
relationship experiment; B should become a priority only if the desired player
actions require its additional spatial freedom.

This is not a ban on meshes or voxels. A bounded voxel/mesh region can be a useful
physical approximation inside C. The question is whether detailed field geometry
should be the primary representation now, not whether the engine may ever use it.
Voxel-primary deserves reconsideration if frequent arbitrary cuts, cavities,
fracture paths, granular matter or free-surface transport become the primary
player manipulations: forcing those into continually invented primitive partitions
could cost more and be less general than a material occupancy field.

Do not combine all three indiscriminately. There must be one authority for each
fact, not a symbolic contact graph and a collision world independently deciding
whether the same support exists.

## Proposed separation of responsibilities

| Concept | What it means | What it must not silently own |
| --- | --- | --- |
| Material definition | Versioned, admitted physical properties/calibration | Fresh instance mass, fuel or damage reset |
| Material portion | Owned instance quantity and physical state under a material definition | A second independently spendable account in a solver or assembly |
| Part | Persistent meaningful geometry, placement and relationships, referencing its material portions | An object-wide bonus selected by its name |
| Assembly | Grouping, targeting and relative arrangement of parts | Another copy of their material/energy |
| Boundary region | A meaningful surface or exposed region of stored structure | A new independent stock merely because it has a mesh |
| Persistent structural relationship | An admitted attachment, enclosure or constraint with a cause and lifecycle | Every possible transport channel or an unconstrained free weld |
| Active mechanism interface | A valid exchange path derived or activated from current structure/placement and admitted channel rules | A permanent edge surviving separation or a second editable wall |
| Physical approximation | A supported representation of the actual structure and its evolving state | A fresh simulation that resets when viewed or rebuilt |
| Visual representation | A presentation of structure and permitted evidence | Physical contact, openings or capabilities absent from the supported model |

### Boundary regions are more useful than one global coverage value

A single "80% covered" value cannot say whether the remaining surface is the
one touching a warm support. Covering the top and covering the bottom can use the
same material and area but enable different heat paths.

Candidate geometry should identify the relevant surfaces/regions and interfaces.
Coverage, exposed area, contact area, normal direction and layer thickness can
then be derived where the selected approximation supports them. Do not invent
more geometric precision than that model can use or imply that area alone
determines a contact's thermal resistance.

Keep three physical distinctions explicit: material conductivity describes an
admitted material path; interface resistance describes the particular contact
condition; thermal capacity describes the energy needed to change temperature.
An effective exchange coefficient may derive from these under a tested
approximation, but the concepts must not disappear into a universal "touching"
constant or an unexplained item modifier.

For the first comparison, simple solids/slabs and bounded surface regions are
plausible candidates. Whether cuboids alone suffice, or cylinders/other primitives
earn their cost, remains a shape-palette choice. A layer must have material,
thickness and placement; a visually drawn shell is not proof that a cavity,
flexible wrapping or deformation is simulated.

## Contact should be a validated result, not an action label

The proposed hybrid path is:

**attempted arrangement → admissibility/placement checks → committed structural
change → valid channel-specific interfaces → accounted evolution.**

The player or admitted interpretation proposes what to move/place/hold. Code
checks supported geometry, access, body capability, constraints and conflicting
state before committing. It does not grant a thermal edge just because a command
contains "touch" or "insulate."

Geometry supplies evidence of proximity, overlap, separation and possible contact;
the admitted mechanism supplies contact conditions and constitutive response.
Touching is not automatically welded, sealed, load-bearing or thermally perfect.
Opening/removing/moving changes the relevant relations; derived contacts must be
invalidated coherently before subsequent exchange.

An initial experiment can use declared supports or constrained placements rather
than full falling-body dynamics. That is an explicit supported apparatus, not a
general promise that arbitrary objects hover, balance or stay attached. Placement
time, costs, contact pressure and mechanical stability remain admission questions.

Reject or defer arrangements whose validity depends on unmodeled edge balance,
friction, compliant wrapping, unknown force, or sub-tolerance gaps. A supported
pose is not "stable forever": removing a support invalidates its interfaces.
Holding/pressing is an active condition with duration, body capability and
interruption, not an unlimited attachment granted by one gesture.

A persistent joint or enclosure records a structural cause and lifecycle. It may
constrain motion without supplying a calibrated thermal contact; a transient
touch can supply an admitted exchange without creating a joint. Neither relation
silently grants the other.

## Physical parts are not necessarily thermal cells

A single uniform temperature per part is a possible approximation, not the
definition of a part. It can fail when a local contact heats one region much
faster than another, or when a relevant internal path/gradient affects the probe
or an event.

A mechanism may need several thermal regions within one stored material part.
Those regions partition its physical state and energy account; the part's total
is derived from them, not extra energy available to spend again. Conversely,
several stored details may share a validated coarse approximation without losing
their identity, relationships or history.

**Separate caches from state:** derived meshes, spatial indexes, contact candidates
and solver operators may be rebuilt. Stored energy distributions, material,
damage and committed transitions are not disposable caches. Changing approximation
requires an admitted, conserving, history-consistent transfer. It cannot conjure
a past temperature distribution that the earlier state never established.

Uniform-node and subdivided models therefore need a comparison against the
observations and responses promised by the study, not only a matching total
energy. Numerical ambiguity is unresolved computation, not a new physical latent.
Uneven contact alone does not disqualify a lumped model: a sufficiently conductive
part over an appropriate interval may remain accurately represented by one
temperature. Compare supported probe sites and consequential mechanism thresholds
against a more resolved reference under predeclared error bounds. Coarse display
precision must not excuse a wrong physical event or invent a gradient later.

## Worked traces through the proposed representation

| Arrangement | Structural facts | Mechanism consequence to evaluate | Player evidence |
| --- | --- | --- | --- |
| **Uncovered warm block** | Finite thermal state; exposed boundaries; probe site and support contacts | Exchange with admitted environment/support/probe paths; no continuing source assumed | Comparable change at the accessible site over time |
| **Covered warm block** | Same block identity plus actual covering material and changed boundary/interface topology | Exchange through covering, remaining exposed paths and support; covering capacity and initial transients included | Whether the measured cooling differs in the validated comparison window |
| **Covered cold block with bypass** | Covering exists, but a warmer support still reaches an uncovered or otherwise admitted path | Heat can enter through that path; changing an unrelated covering region need not remove it | Prediction about altering the relevant interface, not a generic "wrap it" gesture |

The same account and channel rules evaluate all three. There is no "warm
preservation" or "cold preservation" effect selected by a task label. Equal
aggregate material/energy does not erase differences in geometry/contact.

A contact measurement must use an accessible site and a declared sensor model.
Latency, uncertainty and loading are either accounted or explicitly approximated
inside a tested range. Reading a hidden core directly because its value exists
in memory is not a player measurement. The proposed probe need not simulate
its entire electronics, but its causal access and validity must be explained.

## Evidence needed before choosing the concrete model

- **Topology counterexample:** equal materials/quantities, different covering
  placement or support path. The model must distinguish promised observations
  without item-name branches.
- **Contact lifecycle:** separate and reconnect participants, or move a supported
  fixture across coordinate cells. No stale edge, duplicate transfer or reset.
- **Approximation comparison:** compare a uniform-part model with a more resolved
  reference near localized heating and observation sites. State where the cheap
  model is adequate and where it must not be used.
- **Measurement counterexample:** moving or removing a probe changes available
  evidence and, where material, loading. Hidden-state access is not substituted
  for an unsupported instrument.
- **Generality and learning:** rename objects, substitute admitted materials and
  use an unfamiliar supported arrangement. Test both physical invariants and
  whether the player predicts a useful consequence rather than repeats a recipe.

These are proposed tests, not results. Passing one family would not establish
arbitrary geometry, deformation, fracture, phase change, fluid flow, chemistry
or long-horizon catch-up.

## Remaining decisions

First complete Q064's cross-domain responsibility review. A subsequent physical
choice is how much **arrangement freedom** an eventual study offers:
validated relations/poses with explicit supports, or free placement whose contact
and stability need a more general geometric/mechanical model. Recommend the former
for initial evidence, while retaining meaningful 3D structure rather than
encoding a named puzzle.

This restriction has a product cost: validated poses can preserve causal honesty
while restricting the very improvisation we want players to discover. If novel
supports, free wrapping or pressure-sensitive handling are necessary for the
learning goal, the answer is to reassess the admitted spatial/mechanical model,
not to claim the constrained fixture already supports them.

Then compare concrete primitive/boundary palettes, contact conditions, measurement
sites, and thermal-state resolution together. Calibration, error/work limits and
legacy-state migration remain separate obligations. The best representation is
the smallest one that preserves the distinctions the player can learn and exploit,
not the one with the fewest fields or the richest-looking mesh.

## Boundary with the common interaction contract

The best physical candidate is not a universal engine record. Share stable
references, authority, state revisions, causal time, commit and evidence handoffs;
retain separately validated domain meanings:

- Physical exchange uses actual parts, interfaces and resource accounts.
- Bodily capability reads admitted physical/physiological state; stamina or pain
  cannot become another independently spendable copy of thermal energy.
- Measurement produces eligible evidence from an event-time sensor situation,
  not an unrestricted physical-state snapshot for every observer.
- Knowledge retains the evidence available to an actor; it does not move a
  remembered object to its hidden current location.
- Intention authorizes an attempted intervention. It cannot create contact or
  grant the requested physical benefit.

As a combined probe, trace a participant measuring a covered object, learning
something and changing a support contact. The physical result, detection,
belief update and later attempt must use coherent references and causal order
without collapsing into one thermal operation or an unbounded same-transaction
decision loop. A missed observation cannot stop physical evolution; a retry
cannot duplicate a transfer or supply a new observation draw by accident.

This is one contribution to Q064, not completion of its six cross-domain probes.
Their review may change the needed physical scope or replace the thermal study;
do not select a shape palette merely because it can render these examples.
