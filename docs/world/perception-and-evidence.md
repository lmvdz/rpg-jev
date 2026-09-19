# Perception and evidence

## Status and purpose

This is a module design draft subordinate to [the shared contract](../shared-world-contract.md)
and [SPEC](../../SPEC.md), especially sections 2, 5–7, 13–14 and 21–22.
It proposes boundaries and admission evidence, not implemented senses or schemas.
M2, its eight Jev families, existing sampling policies and milestone order stand.
No new model API, sensory judgment family or numeric calibration is authorized.

Perception turns admitted physical or communicative opportunities into evidence
available to one observer. Its purpose is not to reconstruct truth for that observer,
but to say what the observer could detect, at what precision, through what channel.
A correct observation may support an incorrect interpretation without being corrupt.
Non-goals are full optics, scent propagation, universal recognition and mind reading.
Neither proximity alone nor a convincing generated description establishes perception.

## Authority and neighboring contracts

[World context](world-identity-and-context.md) owns identities, locations and revisions.
[Composition](composition-and-processes.md) owns sources such as evolving combustion;
[embodiment](embodiment.md) owns the observer's admitted sensing capabilities.
This module owns committed observation opportunities, detection results and provenance.
It does not own source material, sensory organs, beliefs or action success.
Spatial lookup caches and candidate signal lists are derived, not additional truth.

[Memory](knowledge-and-memory.md) consumes observations without upgrading their precision.
[Intention](motivation-and-intention.md) consumes subjective evidence through memory;
it must not bypass that boundary to inspect raw source candidates.
[Execution](action-execution.md) supplies committed activity and outcome evidence.
[Persistence](time-and-persistence.md) coordinates observation effects and replay.
[Presentation](presentation-and-explanation.md) receives an observer-authorized projection,
not the unrestricted provenance graph used by the causal debugger.

A proposed handoff carries observer, modality, observation interval, detected features,
available location precision, status, relevant revision and a committed cause reference.
These are information requirements, not an already implemented TypeScript record.
Detection time remains distinct from delayed commit time: a late result cannot say
the observer saw an object at its later position.
Output statuses must distinguish a supported detection, a supported check with no
detection, and an unsupported check; unknown cannot silently mean absent.

### Provenance has two audiences

The privileged record may identify the physical source event and actual source entity.
The subjective projection exposes only what the observation establishes about them.
Hearing a sound can establish a direction without establishing the caller's identity.
An internal foreign key must not become a client-resolvable link to the hidden caller.
Where correlation is needed, an opaque observation reference is not an identity claim.
Its permitted equality semantics need admission; stable correlation itself can leak.
Debug traces can retain complete causes under separate authorization.
Neither a prose renderer nor a model slice receives raw provenance to redact afterward.

## Lifecycle and difficult boundaries

1. An admitted mechanism produces or maintains a signal opportunity from committed
   state. A draft action or rejected effect cannot produce a witnessed success.
2. Code gathers bounded candidates in the observer's scoped context, using declared
   channel and environmental approximations rather than a whole-world object scan.
3. Code checks the observer's capability and applicable exposure/occlusion conditions.
   A thermal contact path does not by itself establish a sight or sound path.
4. An admitted detection rule produces features and precision, or an explicit status.
   If that rule samples, SPEC's logged world RNG owns the draw and its causal scope.
5. The commit boundary validates the relevant versions and persists the result.
   Stale work is rejected or recomputed under declared rules, never relabeled current.
6. Eligible memory and presentation consumers receive their filtered observations.
   Investigation feedback can trigger later choices, not a recursive inference loop.

Physical outcome commits persist evidence opportunities, not already-known observer
facts. The durable handoff retains event-time detection conditions or reconstructible
immutable references and a stable delivery identity. Recovery resumes pending
detection against that context, never a later world snapshot. Recorded draws and
observation/learning delivery must remain idempotent across every crash boundary.
The exact protocol is open; losing opportunities or rerolling detection is not.

Continuous exposure needs an interval rule before it can be implemented.
Rechecking on every render frame cannot mint repeated independent detection chances.
An observer becoming incapable partway through an interval bounds that opportunity;
later recovery cannot retroactively witness its missing segment.
Arrival after an event may reveal persistent traces if a trace mechanism exists,
but does not entitle the arrival to an observation of the original event.

Communication needs an eligible receiving opportunity as well as a structured claim.
An addressed listener outside admitted hearing cannot learn merely because named.
Hearing a report establishes that a report was heard, not that its content is true.
Preserve the existing conversation scheduler and M2 claim path; any richer channel
adapter must explicitly identify the additional data and tests it requires.
No-player catch-up uses code only, subject to SPEC's existing debt exception.
It may preserve supported opportunities; it cannot invent detailed retrospective senses.

## Alternatives and provisional recommendations

**Source events pushed to observers versus observer queries over active sources.**
Pure push gives clear causality but can fan out across every nearby actor and can
miss a steady source when an observer arrives after its start.
Pure pull handles steady sources but risks repeated work and duplicate evidence.
Provisionally use code-owned scoped queries at declared event/interval boundaries,
with source lifecycle events invalidating derived candidate caches.
Admission requires workload and split-interval evidence; this is not a scheduler API.

**Exact source identity versus feature-first observations.**
Copying entity IDs simplifies tracking and debugger joins but reveals ownership and
continuity beyond the sense that justified the observation.
Feature-first records preserve uncertainty but need explicit later recognition and
can leave two observations ambiguously related.
Provisionally keep exact causes privileged and feature-first subjective records.
Recognition must be an admitted code/data mapping, not a free model inference hop.

**Deterministic detection versus stochastic detection.**
Deterministic approximations are cheap, replayable and easier to explain, but their
boundaries may be coarse; stochastic detection can represent admitted variability
but creates correlation, exposure and calibration obligations.
Provisionally begin with deterministic supported channels where sufficient.
Do not add noise merely to look biological; any stochastic channel needs evidence
that its time semantics and repeated checks do not distort opportunity.

## Invariants, costs and honest fallbacks

- Holding admitted signals constant while changing hidden truth leaves subjective
  evidence, option inputs and player rendering unchanged.
- Detection can reveal a feature only at the admitted channel's precision.
  Scent does not imply an owner, exact coordinates or a modeled propagation field.
- Absence of detection is not evidence of absence unless a separately admitted
  search coverage rule supplies that inference and its limits.
- Retry of one observation commit cannot duplicate learning or its downstream costs.
  A new supported observation remains distinct even if its features resemble an old one.
- Looking closer may reveal persistent truth, never reroll an already realized fact.

Costs include active source lookup, observer-source checks, retained observations and
downstream memory pressure; broad fan-out can dominate even without model calls.
Budgets must cover each, including crowded regions and long-lived steady sources.
When work is exhausted, defer or report incomplete coverage under a documented rule;
do not report a complete negative search because candidate processing was truncated.
Unsupported channels yield no invented cue. Supported coarse cues retain their limits.
Dropping redundant display updates cannot erase committed observations or their causes.
Deterministic ordering must use stable admitted keys, not names or container order.

## Worked wolf fixture and non-wolf counterexample

The persistent wolf enters a region with a player holding a finite-fuel assembly.
Suppose an admitted visual opportunity supports movement and a visible flame feature.
The wolf receives those features at supported precision, not the fuel reserve,
player intent, grip temperature or exact time until burnout.
If the player drops the assembly, composition changes contacts and evolves the fuel;
perception supplies new evidence only where a supported channel detects a difference.
An unheard or unseen drop cannot directly update the wolf's subjective context.
The fixture must not assume scent, fear, attack or recognition is already implemented.

Counterexample: a person behind a partition hears a vessel fall in another room.
If the admitted sound channel supports only a coarse direction, the observation does
not name its owner or assert that it broke, even if the privileged event knows both.
Swapping the concealed owner while preserving the audible features must leave the
listener's evidence and choices unchanged. This defeats an identity-rich event copy
that appears to work in the wolf fixture because the player happened to be visible.

## Admission evidence and open questions

W0 requires version rejection, idempotent commit and model-free replay tests.
W3 requires paired hidden-world tests, including source identity, position, contents
and undetected movement; compare projected evidence and candidate options, not prose alone.
W6 requires whole/split interval and offscreen reconciliation tests for admitted channels.
W7 requires eligible-cue delivery plus adversarial traversal of provenance references;
renderer and model inputs must not recover a source hidden by the projection.
W8 requires renamed/reordered fixtures, crowded-source bounds and a held-out organism.
These proposed tests do not close any W gate or substitute for physical C gates.

Which first channels and geometric approximations are supportable with existing data?
What distinguishes repeated evidence from duplicate delivery for a continuous source?
Can a subjective observation handle safely support correlation across modalities?
What evidence supports negative search coverage or recognition without exact identity?
Admission needs a concrete schema/adapter map, channel fixtures, cost measurements,
declared fallback semantics and privacy tests before integration, not narrative plausibility.
