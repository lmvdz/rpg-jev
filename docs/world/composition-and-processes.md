# Composition and processes

## Status and question

Draft module design under the [shared contract](../shared-world-contract.md).
The existing [physical depth contract](../compositional-causality.md) remains
authoritative for material accounting, uncertainty and C0–C8. This file develops
module reasoning and integration boundaries; it neither duplicates that contract
as a new authority nor claims the isolated thermal spike is production physics.

**How can one physical change enable or prevent another without a named recipe?**
The answer must include evolving structure, not just numeric properties on a
fixed object. But unrestricted generated equations are not an acceptable shortcut.

## Accepted Q018 foundation: parts and typed relationships

Material-bearing parts and typed physical relationships are the foundation.
Recognizable objects and creatures are assemblies over that substrate, not the
units that own special-case interaction rules. This accepts the representation
direction; concrete fields, geometry precision and initial channels remain
open under Q018.

| Concept | Responsibility |
| --- | --- |
| Material definition | Versioned code-calibrated properties for admitted mechanisms |
| Material portion | Actual quantity and instance state, including owned resource budgets |
| Part | Physically meaningful structure/region with placement and declared geometric detail |
| Assembly | Targeting/movement grouping of parts without duplicate mass or energy |
| Interface or coupling | Typed relationship through which supported force, heat or material exchange occurs |
| Active process | Admitted ongoing interaction with inputs, progress, accounts and stopping conditions |

These are semantic responsibilities, not six required tables or finalized types.
Membership and physical coupling are different relationships. Derived assembly
mass or capability may be cached, but cannot advance independently of its sources.
Multiple channels can share participants without sharing coefficients or creating
independent copies of the same resource.

Bodies participate through this substrate; embodiment connects physical exchange
to admitted reserves and functions. Air, water and other bulk environments may use
accounted regions/reservoirs instead of rigid-object representations. An external
boundary assumption is explicit, not a free source hidden in an object behavior.

TypeSafe/Jev interprets an attempted arrangement through admitted choices; code
determines whether it occurs and what all applicable mechanisms do. Coarse parts
remain valid within their declared support. Refinement preserves quantities and
history; missing representation/mechanics is not filled with a plausible result.
No thermal, respiratory or mechanical channel is certified by accepting this
foundation. Their schemas, calibrations and coupled evidence still need admission.

## Accepted Q018 approach: structure before approximation

Use compound simple geometry and explicit interfaces as the initial representation
direction. Store meaningful structure first, then derive cheaper physical
approximations; do not invent consequential structure only when an action needs it.
The concrete primitive palette, coordinate precision and geometric algorithms
remain open. Nesting primitives does not itself implement cavities, deformability,
cutting, fracture or joints.

Keep three linked representations:

| Representation | Responsibility |
| --- | --- |
| Structural definition and instantiated structure | Admitted parts, materials, interfaces, meaningful geometric detail and structural changes |
| Active physical representation | A declared approximation suitable for the admitted interactions being resolved |
| Visual representation | Appearance derived from structure and committed state, potentially richer than the active physical approximation |

These reference one set of identities and authoritative instance quantities,
damage, topology and history. Definition geometry describes the baseline; it
cannot restore a damaged instance when a cache is rebuilt. Approximations and
rendering are projections, not independent stores of mass, energy or capabilities.

An approximation declares its supported operations and error bounds. Changing
resolution must preserve quantities, mass-distribution constraints, contacts and
significant history within its admitted contract; fine and coarse representations
cannot evolve independently. Exact transition/transfer rules need evidence before
an approximation is used for a new channel or resolution.

Visual smoothing and texture cannot create a physical hook, opening or cutting
edge absent from the supported structure. Mechanically relevant visual features
need matching physical representation; otherwise do not imply they can be used.

Retrieving stored detail is different from inventing it. Existing one-part/coarse
objects remain valid where sufficient. If important detail was never established,
only an admitted, versioned, conserving refinement may introduce it consistently
with prior observations and events. If none exists, retain the coarse object and
report the unsupported interaction rather than create a convenient fresh interior.

Required C3/C4/C6/C7 evidence includes coarse/fine transitions around damage and
detachment, input/order invariance, retained budgets and geometry constraints, and
rendering that neither grants missing physical features nor contradicts committed
changes. Complex assemblies must work through composition, not named exceptions.

## Accepted Q018 units: SI internally

Use a consistent SI unit system for physical quantities in the new substrate.
Player-facing descriptions may be qualitative or use convenient converted units;
presentation never becomes a second physical account.

| Quantity | Internal convention |
| --- | --- |
| Length, area, volume | Metres and corresponding powers |
| Mass | Kilograms |
| Physical duration | Seconds |
| Absolute temperature | Kelvin; distinguish absolute values from temperature differences |
| Energy/work, force, pressure | Joules, newtons, pascals |

Other admitted physical quantities and rates use dimensionally consistent units
derived from this convention. Unit meanings must be explicit at schema and module
boundaries, including conversions for existing game-clock minutes or displayed
temperatures. Do not confuse mass with force, energy with power, or an ordinal
material rating with a physical quantity.

Existing matter levels, body signals and historical records are not relabeled as
SI quantities. Integration requires code-owned calibration/conversion adapters or
an explicit versioned migration, with replay retaining historical semantics.
Dimensionless categories can select admitted calibrations; they cannot be added
to material or energy accounts. Stamina, belief and other aggregate game signals
are not automatically joules or oxygen quantities.

Real units do not certify realistic equations or coefficients. Numerical precision,
error tolerances, supported ranges and calibrations still need evidence. Required
checks include unit-boundary conversions, compatible cross-module exchanges and
unchanged simulation results when only display units change. This is a design
decision, not a conversion of current runtime data.

## Accepted Q018 coordinates: hierarchical frames and invariant changes

Use a region/chunk address for large-scale location, local 3D metre coordinates
for nearby physics, and part-relative positions/orientations inside assemblies,
rather than one enormous global floating-point position for every detail.
The concrete address type, cell size, numeric precision, axes and transform schema
remain open; indefinite exploration is not a promise of unbounded numeric values.

**Invariant:** changing coordinate frames alone must not change physical outcomes,
entity identity, generation history or observer knowledge. Re-express the same
physical state within declared numerical tolerances; do not teleport, introduce
impulses, reset process progress, lose contacts or alter material/energy accounts.
This is distinct from actual movement into different terrain or environmental
conditions, which can legitimately change outcomes.

World identity/context remains the authority for placement and frame references;
physical geometry and spatial indexes derive from or reference that placement.
Frames have stable identity and revisioned transforms. Hierarchical parentage is
acyclic even when physical contacts form cycles. Reparenting and moving frames
need declared position/orientation/velocity conversions before support is claimed.
Renderer origin shifts cannot mutate authoritative coordinates.

Coordinate cells organize representation, not physical laws or automatic simulation
ownership. Cross-cell contacts and observations still use shared mechanisms, with
each interaction settled once. Cell addresses, generation-region identity and
scheduling partitions need not coincide. Crossing or reindexing cannot create a
second owner, reroll population initialization or invalidate a remembered place.
Authoritative placement and index/subscription transitions must remain coherent.

Before choosing numeric types or dimensions, declare a positional/orientational
error budget tied to supported contact features and operations. Test repeated
conversions, negative addresses, representable limits and large multi-cell objects.
Bound frame depth and query fan-out; overflow or unresolved dependencies need an
explicit fallback rather than wrapped coordinates or silently omitted contacts.

C3/C4/C6 and W0/W3/W5/W6 evidence must cover equivalent frame representations,
contacts across cell boundaries, repeated crossings/reparenting, distant equivalent
setups, and save/replay. In distant-setup comparisons, hold relevant physical and
environmental inputs equivalent; do not mistake a real environmental change for
a coordinate error. Precision, concurrency and moving-frame correctness remain
evidence requirements, not capabilities established by this architecture decision.

## Ownership and interfaces

Composition owns material portions, stored physical quantities, contacts, damage
where physically defined, process progress and boundary accounts. World identity
owns stable references and placement; embodiment interprets physical changes in
organism function. Neither stores a second independent copy of a portion's energy.

| Input | Required content | Output |
| --- | --- | --- |
| Admitted physical attempt | Participants, channel, bounded work/exposure, revision | Proposed transfers and transformations |
| Environmental interval | Boundary conditions, source limits, time interval | Evolution plus reservoir debit/credit |
| Topology change | Existing parts, justified attachment/detachment, source cause | Valid membership/contact update |
| Refinement request | Coarse state, prior evidence, admitted finer representation | Conserving partition or explicit unsupported result |

Results carry resource accounts, significant event causes, validity conditions
and potential evidence sources. Emitting smoke as a physical result is distinct
from any creature observing it. Perception makes that decision.

## State design: what must not collapse

- Assembly membership groups targets; it adds no extra mass.
- A material definition supplies calibrated properties, not fresh per-instance
  fuel every time it is looked up.
- A portion owns quantity and physical state; geometry has declared resolution.
- A contact supplies mechanism-specific exposure. Thermal, mechanical and fluid
  channels can share an interface but cannot borrow each other's coefficients.
- Structural damage is history-bearing state, not a synonym for temperature.
- An active process references inputs and progress; "burning" alone is not a
  license to produce heat indefinitely.

One-part representations remain valid where they answer the requested question.
More parts are required when a distinction is observable or mechanically relevant.
If the representation cannot support a requested interaction honestly, report
the gap rather than conjuring an independent fresh interior.

## Lifecycle across changing topology

Read a consistent interval state, find applicable admitted mechanisms and their
shared sources, allocate bounded transfers, integrate, then settle discontinuities.
Fuel exhaustion, fracture, phase change or detachment can invalidate contact
paths. Rebuild affected derived properties before advancing the remainder.

For a failing wrap, retain the consumed/detached material and its heat; update the
attachment and exposed contacts; then recompute transfer. Do not first erase the
wrap and then apply the whole past interval as bare contact. Simultaneous events
need a declared deterministic tie rule and tolerance.

Mechanical weakening and structural fracture are separate mechanisms: declining
strength can remain latent until a load exceeds supported capacity. A broken
assembly may still contain intact reusable parts. Damage to an attachment must
not automatically erase unrelated constituent material.

## Alternatives and tradeoffs

The [Q018 representation comparison](representation-options.md) examines contact
networks, detailed geometry and a hybrid stored-structure approach against the
experimentation journeys. Its recommendation and candidate boundary/measurement
models are for discussion, not accepted schemas or certified mechanisms.

**Object-level modifiers versus explicit portions/interfaces.**
Modifiers are compact but cannot account for finite coatings or distinguish hot
blade from cool handle. Recommend explicit portions only at consequential
boundaries, with coarse defaults elsewhere. This increases schema complexity
but avoids a multiplying set of oil-sword/leather-sword exceptions.

**Sequential row writes versus accounted proposals.**
Sequential writes are simple and match parts of today's kernel, but ordering can
double-spend or erase another row's heating. Recommend a shared-account proposal
boundary and declared event phases for admitted mechanisms. Do not claim existing
C0 ordering is already a general concurrent solver. Migration must compare the
active graph, preserve its admitted semantics or explicitly version changes.

**Full continuum physics versus calibrated lumped mechanisms.**
A detailed mesh could capture geometry but exceeds the intended cost envelope.
Recommend lumped parts and admitted channel approximations with explicit domains.
The compromise excludes some deformations, flows and contact phenomena. Those
exclusions should be visible in support metadata rather than narrated as realism.

## Budgets, numerical limits and fallback

Declare SI quantity semantics, accuracy targets, event tolerances,
maximum graph work and source-allocation semantics before test evaluation.
Ordinal material levels select calibrations; they are not conserved quantities.
The solver must not get a different fuel budget merely because it has more edges.

If the work bound is exceeded, subdivide/schedule bounded code work or reject the
unsupported advance according to time/persistence policy. Never silently clamp
away material, skip an exhaustion event or replace the result with a random
outcome. Exact replay and approximate partition agreement are different promises.

External oxygen assumptions must be declared. Fuel-derived mass balance is not
full chemical conservation. Injury, scent and structural strength each need their
own admitted mappings; a heat calculation does not certify them automatically.

## Worked cases and counterfactuals

**Wolf and weapon:** a finite coating heats its substrate and nearby body contact.
Changing the substrate to a combustible admitted material may permit additional
fuel use; changing its name does not. The wolf's fear cannot alter burn rate.
The wolf withdrawing can change contact/exposure through its actual movement.

**Non-wolf:** a heated cooking vessel and attached handle use the same transfer
channels. Disconnecting the handle removes that channel but preserves each part's
stored energy. A wet cloth can alter the path only after an admitted moisture
mechanism accounts for it; "wet" is not an arbitrary insulation multiplier.

## Evidence and open decisions

| Gate | Required evidence |
| --- | --- |
| C1/C3 | Distinct part temperatures, identity invariance, contact removal and geometry/property counterfactuals |
| C2/C4 | Competing transfers cannot double-spend; finite products; topology event just before/at/after a boundary |
| C6/W0 | Conserving refinement and explicit mechanics migration, including unsupported cases |
| C7/W2/W5 | Physical exposure feeds body capability/evidence once; NPC and player attempts share mechanisms |
| C8/W8 | Held-out assemblies and chains, including a useful failure rather than universal success |

Open decisions: minimum geometry vocabulary, quantity schemas/calibration adapters, allocation of
simultaneous source budgets, fracture/attachment representations, and which
processes migrate first. Require a mechanism-to-current-row compatibility map.
Keep the original thermal proof and its limitations as evidence; do not expand
its claims by attaching a more ambitious module name.
