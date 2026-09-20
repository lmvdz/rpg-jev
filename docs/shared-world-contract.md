# Shared world contract: physics, bodies and minds

## 1. Status, scope and precedence

This is the accepted architectural direction in SPEC section 22, with a draft
module contract and acceptance plan. It is not a claim of implemented support.
It extends the existing compositional design; it does not replace it with an
NPC system, a behavior tree, or an alternative physics engine.

[`compositional-causality.md`](compositional-causality.md) remains authoritative
for the physical substrate and C0–C8 gates. SPEC sections 2, 5–7, 13 and 14 retain
their constitutional, action, mind, schedule, replay and judgment boundaries.
This document specifies the interfaces those systems need to share. It does not
silently replace M2's existing claims, drives, schedules or combat stub.

No new Jev family, model call, runtime formula generation, package or milestone
is authorized here. Behavior policy details and quantitative calibrations need
separate evidence and admission. The linked Claude Doc has not been updated;
the repository specification is updated together with this document.

**Goal:** reusable mechanisms should produce consequences that were not authored
as encounters. A finite simulation represents the important causes; it does not
enumerate infinite futures or promise human-level intelligence or full biology.
Depth means meaningful interventions, persistent consequences and learnable
evidence, not maximizing the number of hidden variables.

## 2. Shared invariants

1. There is one authoritative world. Players, NPCs and environmental processes
   use the same admitted physical effects and resource accounts.
2. An agent's body is in that world. Its beliefs are not a second world and cannot
   change world truth merely by being believed.
3. Intentions authorize attempts, never guaranteed outcomes. Choosing to eat does
   not create food; choosing to attack does not grant damage.
4. Every mutation has a typed effect, cause and mechanics revision. A module
   proposes a transaction; the code-owned commit boundary validates and applies
   it. Direct cross-module mutation is forbidden.
5. Numeric state, costs, bounds, probability arithmetic and time are code-owned.
   Models may judge admitted qualitative choices, never invent physical laws.
6. Names are presentation, not outcome selectors. Behavior may depend on actual
   identity relationships, such as recognizing an offspring, but not a literal
   name test or a wolf/fire-sword encounter branch.
7. Refinement preserves established quantities, identities, realized latent
   facts and history. Looking closer never rerolls reality.
8. All work has explicit bounds and an honest fallback. Unsupported interactions
   are not filled in with plausible-sounding success.

## 3. Modules and authority

These are logical boundaries, not a requirement for one package per row.
Concrete TypeScript schemas and effect kinds must be designed before integration;
the records below describe required information, not already available APIs.

| Module | Authoritative state / responsibility | Reads and produces |
| --- | --- | --- |
| [World identity and context](world/world-identity-and-context.md) | Stable entities, placement, environmental context and relationship records; references clock/version authority | Supplies scoped contexts and lifecycle events |
| [Composition and processes](world/composition-and-processes.md) | Material portions, parts, contacts, resource accounts, geometry approximations, active processes and structural change | Consumes physical attempts/exposures; produces accounted effects and evidence sources |
| [Embodiment](world/embodiment.md) | Physiological condition, reserves and development; references composition-owned physical damage | Derives needs/capabilities under admitted mappings and proposes physiological effects |
| [Perception and evidence](world/perception-and-evidence.md) | Admitted observation opportunities, detection and provenance | Reads scoped signals and sensor capabilities; produces agent-specific observations |
| [Knowledge and memory](world/knowledge-and-memory.md) | Observations, claims, remembered places, uncertainty and source attribution | Consumes evidence; supplies a bounded subjective context |
| [Motivation and intention](world/motivation-and-intention.md) | Active commitments, reasons, current activity and interruption state | Consumes subjective context and own needs; proposes choices from code-built options |
| [Action execution](world/action-execution.md) | Attempt lifecycle, shared-resource admission, progress and cancellation | Validates actions against current truth; invokes admitted physical/social mechanisms |
| [Time and persistence](world/time-and-persistence.md) | Clock, version pins, scheduling, replay, atomic commits, offscreen catch-up and migration | Coordinates every module without becoming a second outcome engine |
| [Presentation and explanation](world/presentation-and-explanation.md) | Observer-authorized views of committed state and causes | Renders cues and feedback; never feeds invented facts back into simulation |

Each linked file develops that module's reasoning, state boundaries, lifecycle,
alternatives, failure modes and acceptance evidence. The
[module design index](world/README.md) records the cross-module questions to resolve
together. These are draft recommendations, not nine new implemented systems;
this document remains the shared agreement.

Each handoff must carry stable references, simulation time or interval, cause IDs,
relevant revision and an explicit status. Observation time and commit time must
not be conflated. Module dependencies are declared rather than obtained by handing
every subsystem unrestricted world state.

**Accepted execution model:** each entity is persistent structured state with
event-driven work in a shared SpacetimeDB runtime, not a dedicated VM, thread,
connection or perpetual tick. A bounded scheduler dispatches eligible work and
the common commit authority resolves interactions. See the
[runtime decision](world/time-and-persistence.md#accepted-decision-logical-entity-runtimes).
Execution is separate from the population-entry decision below; neither decision
claims measured capacity for the full entity model.

## 4. World construction and persistent identity

Generate a consistent situation, not independent random attributes.

**Accepted population-entry model:** use rule-driven spawning from an accounted,
potentially coarse regional population source, not mandatory eager creation of
every individual. Initial population, arrivals/births and activation are separate
operations. Materializing individuals transfers source allocation atomically;
activation never spawns, and migration retains identity. Dormant individuals still
count. Replenishment requires admitted events, not automatic replacement of deaths.
Population allocation is not a substitute for physical/body resource accounts.

Persist spawn opportunities and their resolution so revisiting, extra players
or repeated evaluation cannot mint independent chances. Proximity may schedule
work but cannot reset reality. Placement and initialization respect established
observations. Once created, individuals persist across absence; retirement is
explicit rather than distance-based erasure. Source calibration and lifecycle
details remain open in the
[population-entry contract](world/world-identity-and-context.md#accepted-decision-accounted-population-entry).

**Accepted local-recovery rule:** a locally extinct population with no reachable
source stays absent indefinitely until an admitted process changes the situation.
Time, habitat capacity and player return alone cannot replenish it; no hidden
floor or guaranteed respawn timer applies. Migration and reintroduction debit
real sources; reproduction requires surviving eligible sources. Restoring a
route or habitat enables recovery only when its other prerequisites exist.
Count dormant and coarse populations too: unseen does not mean extinct.
Global-extinction safeguards remain undecided. See the
[local-extinction decision](world/world-identity-and-context.md#accepted-decision-local-extinction-and-causal-recovery).

A creature's creation record establishes its identity, organism definition,
developmental stage, admitted biological attributes, body and initial context.
Pack membership, offspring, territory, recent activity and current needs must
satisfy cross-record constraints. Sex, reproductive condition, parental relation
and caregiving behavior are distinct facts. Sex is not a universal aggression or
protection switch; it matters only through admitted mechanisms.

Code owns distributions and constraints. Generated descriptions can propose
admitted structured content; prose cannot establish an unvalidated pregnancy,
relationship, reserve of food or past injury. Invalid proposals are rejected or
replaced by a declared valid fallback, not repaired through undocumented magic.

Initial history may be summarized rather than simulated minute by minute. Mark
it as initialization provenance, not a fictitious log of witnessed events. Its
resulting body, resources and relationships must agree. Creating offspring or
shared stock cannot be repeated independently by each related entity.

Seeded construction is reproducible under a pinned construction revision. Once
committed, the creature persists; revisiting a region loads or advances it rather
than reconstructing it from its seed. SPEC's logged world RNG remains the owner
of randomness. Any later keyed sampling scheme needs explicit versioned semantics;
this document does not introduce an independent hidden RNG per module.

## 5. Composition, environment and changing structure

Retain the distinction between the physical graph and rule graph. Assemblies
contain actual material; coatings, wraps and joints are not free modifiers.
Contacts expose admitted channels such as thermal transfer or force transmission.
Channels share structure without assuming that thermal conductance implies
mechanical strength or visibility.

Geometry may be coarse, but every approximation declares what it supports:
orientation, exposed area, enclosure or a contact path cannot be consulted if the
representation does not contain it. Density, dimensions and material quantity
must not become independent contradictory ways to set mass.

Processes can change their substrate. Charring, cracking, wetting or a failed
attachment can change capabilities, exposed surfaces and contact topology.
Removing a wrap transfers or retains its material and heat; it does not reset
the underlying grip. Structural failure depends on admitted damage and applied
loads, not just a label saying "damaged."

The environment is a participant: airflow, heat sources, water and supporting
surfaces supply boundary conditions or explicit reservoirs. Finite reservoirs are
debited; modeled external reservoirs record exchange. More detail does not require
full fluid dynamics, but a coarse environmental modifier must have declared
meaning, units and limits.

Admission tests couple mechanisms: weakening followed by impact, coating loss
followed by altered contact, and finite combustion followed by residual cooling.
Adding rows alone does not establish these capabilities.

## 6. Embodiment and capability

A body connects physiology to physical state. Needs are derived from or updated
consistently with declared reserves and processes; hunger must not be a second,
independent food account that grants energy when a decision says "eat."

Metabolism, exertion, rest, temperature and injury have code-owned costs and
effects. Current temperature, accumulated damage, immediate load and remaining
capability are separate quantities. Unsupported injury biology stays unsupported;
a thermal-exposure observation is not yet a certified burn or pain model.

Capabilities constrain attempts: locomotion, sensing, manipulation and feeding
depend on the organism and its current body. An injured limb may change available
movement or its cost. A dead or incapacitated creature cannot continue an activity
merely because its old intention remains stored.

Species/organism definitions compose admitted capabilities and calibrated
parameters. They do not select entire encounters. Players use the same bodily
constraints for capabilities they share with NPCs.

## 7. Perception, knowledge and memory

World truth is distinct from an observation, a belief and a remembered location.
Only admitted sensory/contact mechanisms or communicated evidence can cross that
boundary. The mind cannot read a hidden object's current coordinates or contents.

An observation records observer, source event, modality, time, available location
precision and detected features. Detecting a scent does not automatically identify
its source, owner or exact position. Detection depends on admitted environmental
and sensor conditions; absence of detection is not automatically evidence of
absence. No scent propagation model is claimed by this specification.

Memory records what was observed or reported, including source and time. A last
known position stays a past position after the target moves. Beliefs may be wrong,
conflicting or stale without making the world inconsistent. Forgetting can reduce
accessibility or confidence; it never changes the original event or realized truth.

Preserve M2's structured claims and recorded belief judgments. Richer spatial and
sensory evidence needs an explicit mapping rather than silently overloading those
claims. Code ranks bounded memory candidates. Numeric confidence updates and
forgetting are admitted code rules; no unbounded inference loop is introduced.

Agents can investigate to gain evidence. An exploratory attempt is legal even if
the hidden fact it seeks is absent. Candidate construction must not reveal hidden
truth by offering "investigate" only when something is actually there.

## 8. Motivation, intentions and choice

Needs, dispositions, relationships, knowledge and commitments supply distinct
reasons for behavior. Hunger is not an intention; fear is not evidence; a goal is
not proof that the goal is achievable.

An intention records its goal, relevant target or remembered place, reasons,
admitted next activities, a reference to execution-owned progress, start cause, and completion/interruption
conditions. An activity is its current execution, not the entire intention.
Commitment and hysteresis prevent repeated reconsideration from producing rapid
oscillation between near-equal options. New evidence, physical failure or an
urgent condition can invalidate a commitment; persistence must not become blindness.

Code builds bounded options from actor-authorized capability information, subjective opportunities and
observable constraints, including none. It does not advertise secret state by
pruning every attempt that will fail. Execution separately checks actual truth:
a remembered route may be blocked, and an attempted search may find nothing.
Unperceived bodily impairment is also hidden truth. Actual execution capability
can constrain an attempt before the actor knows why; it must not silently update
subjective options or reasons without an admitted own-body signal or feedback.

Existing admitted Jev action choices and deterministic routines keep their current
roles. This contract does not replace them with an unvalidated numeric utility
optimizer or add animal judgment families. Selecting a future animal policy is an
explicit design/admission task. Model-backed choices use only the subjective
slice plus authorized own-body context, are logged, and cannot invent actions.

Routine progress does not require a new choice each frame. Reconsideration is
event-driven and bounded. No-player regions use code-owned routines and catch-up,
subject to SPEC's existing debt exception, not background model cognition.

## 9. Attempts, transactions and feedback

Preserve the shared `Action{actor, verb, args}` entry point. Separate requested
intent, admitted attempt, ongoing execution and committed result.

1. Construct an attempt from the actor's available options and references.
2. At execution, validate revision, capabilities, reach and actual resources.
3. Admit an interval of work; reserve or atomically debit shared resources under
   declared concurrency rules. Two actors cannot both eat the same portion.
4. Evolve applicable physical/body processes and settle boundaries in a declared
   order, revalidating changed contacts or targets as required.
5. Commit effects, progress and evidence opportunities together through the single
   time/persistence commit authority. Persist enough event-time context and
   pending-delivery identity for observer-specific detection to resume durably.
   Observations are separately detected and committed, not inferred from later
   conditions after a crash; retries cannot duplicate detection draws or learning.
6. Update eligible memories and interruption triggers for subsequent decisions.

Rejection, partial progress, interruption and success are distinct statuses.
Charge only the declared attempted/completed costs: cancellation neither refunds
already spent energy nor charges it twice. A retry ID prevents duplicate commits,
while a genuinely repeated attempt is a new event with its own costs.

Feedback enters later decisions; it must not recurse indefinitely inside one
transaction. Ties and simultaneous conflicts use documented code ordering.
Movement, eating and physical attacks have no privileged NPC outcome path.
The current combat stub remains a stub until replacement mechanisms pass gates.

## 10. Uncertainty, time and replay

| Kind | Example | Required treatment |
| --- | --- | --- |
| Realized but unknown truth | Concealed flaw, established offspring relation | Persist truth; observations change knowledge, not the fact |
| Evolving physical propensity | Increasing failure risk under accumulating damage | Evolve causal state; derive risk with code-owned mechanics |
| Deliberately unresolved fine detail | Variation in an admitted exposure process | Log sampled causal inputs; correlated consequences reuse shared causes |
| Subjective uncertainty | Remembered prey may have moved | Belief may change independently of world truth |
| Choice distribution | Several plausible admitted actions | Keep distinct from physical probabilities and epistemic confidence |

Repeated checks must not mint independent chances. If a process uses a hazard
model, its probability derives from elapsed exposure and conditions, not update
count. No particular hazard formula is admitted here. Freeze domain assumptions,
numerical tolerances and bounded-work policies before evaluating it.

Save/load pins mechanics, definitions, construction and policy revisions and
preserves bodies, topology, knowledge, intentions, in-flight attempts and realized
latent values. Replay consumes committed decisions, draws and effects without
calling a model. Upgrades explicitly transform state or reject incompatibility;
changing a sampler version cannot reroll an unseen trait.

Observed simulation and offscreen summaries share accounts and boundary rules.
Do not run expensive microsteps for every absent creature. Coarse catch-up must
declare supported interactions, conserve shared resources, retain commitments and
avoid impossible double occupancy/consumption. Simple schedules can remain pure
time functions; coupled predation or contested resources need admitted summary
mechanisms, not an unsupported claim that schedules alone simulate an ecosystem.

On activation, reconcile elapsed time once. Unsupported offscreen mechanisms use
a documented conservative fallback, not a freshly invented encounter. Refinement
cannot manufacture food, new interior material or a changed personal history.
SPEC section 11's freeze/degradation ordering still applies. Offline gaps are
reconciled in code at login; overload freeze/resume clock semantics and safe entry
across unresolved dependencies require an explicit admission decision, not merely
a pending-work queue claimed to satisfy uninterrupted play.

## 11. Presentation and explanation

The player receives evidence available to the player character: movement, smoke,
visible wounds, sounds or perceived warmth where modeled. Do not display an NPC's
private exact intention or hidden flaw merely because the debugger can read it.

Maintain two explanation views: a privileged causal trace for verification and a
player-facing account filtered by perception and knowledge. Each references actual
committed causes. Generated prose can render those facts but cannot invent a scent,
emotion, injury or successful physical mechanism.

Legibility is an acceptance criterion: consequences should have available cues
where the admitted senses support them, without promising that every danger is
observable or that an observer's interpretation is correct.

## 12. Proving scenario: one persistent wolf

The wolf is a fixture, never a production outcome selector. Establish a consistent
body, developmental and reproductive state, pack/offspring relations, location,
recent-history summary and remembered evidence. Place a player and a finite-fuel
assembly in the same world.

Exercise: notice evidence, investigate, encounter the player, maintain or revise
an intention, attempt an action, incur real costs, leave observation, return and
replay. Vary hunger, injury, knowledge, relationships and physical contacts
independently where biologically consistent.

Do not assert that every hungry wolf attacks or every parent defends. Assert the
causal inputs, lawful available attempts, logged choice, body/resource effects and
knowledge boundary. Under fixed conditions, greater injury must affect the
declared capability as calibrated; a changed choice distribution needs its own
policy evidence, not an invented universal behavioral law.

The burning assembly evolves regardless of the wolf's interpretation. Dropping it
changes physical contacts and potentially observable evidence; it does not advance
a scripted encounter stage. Swap names and use another admitted organism/assembly
combination to demonstrate that the mechanism survives outside the fixture.

## 13. Acceptance gates

These W gates supplement, not replace or renumber, physical C0–C8. All W gates
remain open for the shared integrated contract; existing subsystems provide partial
evidence, not blanket completion.

| Gate | Required ordinary-test evidence |
| --- | --- |
| W0: ownership and versions | Schema rejects unauthorized mutations; replay uses archived revisions and no model calls; stale/retried effects cannot double-commit |
| W1: coherent construction | Same pinned input reproduces initialization; cross-entity constraints hold; viewing/spawn order does not reroll an existing creature |
| W2: embodied causality | Eating spends actual food; activity spends declared reserves; injury changes admitted capability; interruption preserves spent costs |
| W3: knowledge isolation | Changing an undetected fact alone leaves subjective context/options unchanged; sensed differences can change evidence; hidden target movement does not update memory |
| W4: intention continuity | Irrelevant ticks do not reroll choices; meaningful evidence can interrupt; save/load preserves commitment; near-equal priorities do not cause unbounded oscillation |
| W5: shared execution | Player/NPC equivalent attempts use the same resolver; two consumers cannot double-spend; blocked routes and missing targets produce lawful failure |
| W6: uncertainty and time | Realized hidden traits survive refinement/upgrades; shared causes stay correlated; whole/split exposure and catch-up meet predeclared tolerances |
| W7: legibility and privacy | Supported cues reach eligible observers; private state stays private; rendered claims trace to committed evidence |
| W8: generality and cost | Rename/reorder fixtures, vary topology and organism capabilities, run held-out chains; bounded CPU/state/model-call budgets and offscreen no-call guarantees hold |

Test causality separately from repeatability. A repeatably omniscient wolf still
fails W3. Test cross-module chains as well as units; a conserving thermal solver
does not establish correct perception or behavior.

## 14. Delivery sequence and unresolved decisions

1. Map existing core/inn/matter/client records onto the ownership table; document
   adapters and missing data. Do not build a second production world alongside them.
2. Establish revisioned effects, observation boundaries and replay fixtures.
3. Continue the minimal physical/body substrate under C1–C4, with finite food,
   heat/contact and resource accounts rather than named encounter rules.
4. Add one bounded perception-memory-intention-action loop using an explicitly
   admitted policy. Prove W2–W5 with the persistent-wolf fixture.
5. Integrate offscreen summaries, latent state and refinement; then expose the
   same committed evidence in the renderer and test held-out creatures/assemblies.

Steps are evidence dependencies, not permission to bypass SPEC milestone order.
Physics work remains necessary throughout; cognition does not substitute for it.

Before implementation, resolve and record:

- Which first organism capabilities, senses and environmental approximations are
  supported, and which interactions report unsupported?
- Which existing choice/routine machinery can be reused for animals, and what
  evidence would justify a new policy or judgment family?
- Which body quantities are authoritative versus derived, with what calibration?
- What precision is needed for contacts, memory locations and evidence identity?
- Which offscreen interactions receive exact event processing versus bounded
  summaries, and how are contested regional resources settled?
- What state, work and observation budgets apply per active region and actor?

These are deliberate open decisions. No invented numeric thresholds or claim of
complete NPC intelligence is hidden in this initial contract.
