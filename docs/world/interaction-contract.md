# Common interaction contract: cross-domain design review

## Status and precedence

**Accepted sequencing:** review a common interaction contract across several
domains before selecting concrete geometry, initial mechanisms or a learning-study
domain. Player journeys remain later validation tools, not the foundation from
which all architecture must be inferred.

**Implementation status:** the first [solid-contact slice](thermal-learning.md)
was selected without first documenting the required six-probe reconciliation.
Calling its authorization a sequencing exception was incorrect. The
[corrective review below](#corrective-six-probe-reconciliation-for-the-thermal-slice)
assesses the existing choices against this prerequisite, without retrospectively
marking the original selection compliant or declaring Q064 closed.

**Draft content:** the envelope, lifecycle and probes below are a proposal for
Q064, not accepted schemas, new effect kinds or implemented behavior. SPEC and the
[shared contract](../shared-world-contract.md) take precedence. Existing module
ownership, Q018 foundations, C/W gates, M2 catalog and milestone order remain
binding. This is not a tenth authoritative module or a replacement physics engine.

Q063's experimentation goal remains accepted. The
[worked thermal journeys](experimentation-journeys.md) are preserved as optional
future probes; their apparatus does not select the common contract.

## What must be common, and what must not

Commonality belongs in references, authority, typed handoffs, causal time,
validation, commitment and evidence. Domain mechanisms retain their own inputs
and meaning. Physical transfer, acquiring a belief and revising an intention do
not become the same operation because all produce effects.

Recommended architecture: a small common envelope around separately validated
domain payloads. Avoid both a universal bag of optional fields and isolated
subsystems that invent incompatible transaction/history conventions.
No free-form payload gains write access merely by being put in the envelope.

| Common concern | Proposed responsibility | Domain-specific distinction |
| --- | --- | --- |
| Trigger | Stable request/event identity, cause and eligible time | Actor attempt, existing process, environmental event or due commitment; no invented actor for a passive process |
| Participants and bindings | Valid references with declared roles, precision and access | Part, assembly, region, observer or subjective target; a memory handle is not a live locator |
| State basis | Required facts, revisions, frame references and provenance | Physical state may be privileged; choice context may contain only authorized knowledge |
| Relationships | Relevant typed edges/interfaces and their validity | Contact, support, containment and witnessed/heard evidence have different semantics |
| Mechanism | Admitted code handler/template and supported domain | Not an arbitrary formula or named encounter selected by a model |
| Proposed change | Typed effects, progress and justification | Physical channels need resource accounts; knowledge updates need evidence provenance, not fake conservation of beliefs |
| Time | Interval/boundary, progress and interruption dependencies | Continuous approximation, discrete transition and decision opportunity are distinct |
| Commit | One authoritative validation/application path and retry identity | Modules propose; none commits a private competing version of the same fact |
| Evidence/history | Durable event-time opportunities, effects and cause references | Observer-specific detection/learning follow separately, with privacy and replay guarantees |

These responsibilities are not finalized field names or one table per row.
Concrete schemas may share records or indexes only where ownership remains clear.

## Typed interpretation versus execution

For actor-initiated work, existing parsing/TypeSafe families interpret meaning
through code-built closed options including none. Bindings must express the
attempt's intended relationships without granting the requested benefit.
Compatible combinations are validated in code; independently type-correct fields
can still describe an impossible arrangement.

Execution reads the truth it needs to resolve that attempt. It may discover an
obstacle unknown to the actor, but neither candidate omission nor returned internal
diagnostics may expose that hidden fact without eligible evidence.
Non-actor processes use admitted triggers, not artificial intent judgments.

Do not ask a model to choose one physical consequence when several mechanisms
apply. Code discovers applicable admitted channels, resolves their shared
dependencies/accounts, and commits a coherent result. New phrasing may map to
existing primitives; a missing primitive or physical law remains missing.

## Proposed lifecycle and handoffs

1. **Establish the trigger and scope.** Record its stable identity and causal
   basis. Delivery retries are not new actions, observations or random trials.
2. **Build the appropriate view.** The mind gets authorized context; a resolver
   gets a declared privileged read set. Do not reuse one unrestricted world
   snapshot as both interfaces.
3. **Bind participants and relationships.** Preserve reference precision and
   identity. Resolve an assembly target to supported part/interface bindings by
   code, not arbitrary name matching or a hidden live-target substitution.
4. **Check support and admission.** Validate schemas, authority, revisions and
   mechanism domain. Distinguish unsupported work from a valid unsuccessful
   physical attempt. Observed feasibility and actual feasibility differ.
5. **Propose bounded evolution.** Read a consistent state; use admitted channel
   rules and shared accounts. Identify dependent boundaries, consumed work and
   stopping conditions. Do not let each neighbor spend the full source budget.
6. **Commit through the shared authority.** Revalidate dependencies and apply the
   typed effects, progress, source accounts and durable evidence opportunities.
   Stale proposals follow a bounded rejection/retry policy, not sampling until
   something happens to commit.
7. **Detect and learn.** Resume pending observation work against its recorded
   event-time context. Commit detection/learning idempotently; then expose eligible
   feedback to later decisions and presentation. Do not recursively run an
   unbounded perception/decision/action chain inside one transaction.
8. **Continue or settle.** Active work persists across time, interruption and
   save/load. Completed/consumed sources cannot be applied again. Changes to
   topology, capabilities or rules invalidate the appropriate remaining work.

This describes contracts, not a final scheduler. Q045/Q047/Q050/Q054 own concrete
atomic boundaries, evidence delivery, event ordering and live-rule transitions.
Q018 supplies representations; Q019 allocates physical transfers. Q064 checks
that their handoffs form one coherent system instead of deciding all of them here.

## Result distinctions and privacy

Internal resolution must distinguish at least these meanings, without treating
this list as an already admitted status enum:

- **Ambiguous interpretation:** the request could mean different supported attempts.
- **Malformed/unauthorized request:** the caller or reference is not admissible.
- **Unsupported mechanism or representation:** no admitted resolver can establish
  the claimed physical result; do not label this physical no-effect.
- **Pending/unresolved work:** numerical or scheduling work has not established
  the result; uncertainty in the solver is not an extra random world trait.
- **Resolved failure/no effect:** an admitted mechanism actually establishes that
  outcome, with only its defined attempted costs.
- **Progress, completion or interruption:** commit exactly the supported effects
  and consumed work; do not refund the past or pre-grant future success.

These internal distinctions do not authorize revealing hidden targets, diagnoses
or causes. Player-facing feedback is filtered by the evidence contract. A generic
coarse result is valid only when produced by a supported mechanism, not as a
fallback that invents unknown physics.

## Cross-domain probes

These are architectural thought experiments, not a first implementation inventory.
All rows must fit without naming a specific item or creature in production rules.
They do not require every domain to be built at once.

| Probe | Shared contract exercised | Specialized mechanism / account | Failure the review must catch |
| --- | --- | --- | --- |
| Support, movement and detachment | Parts, frames, support/attachment edges, interval progress and topology events | Admitted force/work and body-cost mappings | A frame conversion changes load, or movement bypasses exertion because only location changed |
| Material entering/leaving containment | Portion identity, opening/contact bindings, capacity and transfer commit | Material quantity and environmental/source destination accounts; no full fluid simulation assumed | Source is consumed twice, contents teleport through an unrepresented opening, or inventory and physical containment disagree |
| Body consuming resources during activity | Activity progress, resource bindings, body capability and interruption | Admitted intake/metabolism/respiration; distinct reserves and evidence | Choosing an action grants energy, oxygen and stamina are conflated, or interruption refunds spent work |
| A process changing its own substrate | Shared read basis, active interval, damage/topology boundary and recomputation | Admitted thermal/mechanical/transformation channels | Removing a layer erases prior heat or later rows use stale interfaces and double-spend resources |
| An observer acquiring incomplete evidence | Source event, observer-specific detection, durable handoff and learned time | Admitted sensory model and knowledge provenance, not energy-account semantics | A private source ID reveals the emitter, a retry improves detection odds, or a crash recomputes perception from later conditions |
| An agent revising an intention | Evidence/context revision, reasons, commitment and subsequent action trigger | Existing admitted choice/routine policy; no automatic physical effect from a decision | Hidden world changes rewrite reasons, an intention owns duplicate execution progress, or a choice loop rerolls every tick |

For each row, trace the same handoffs and identify:

1. Who owns every fact, and which inputs the acting/observing agent can know.
2. Which admitted mechanism could resolve it and which capability is still absent.
3. What is conserved or otherwise validated, and what must not be conserved by
   analogy (for example, sharing a report does not consume the speaker's belief).
4. What commits together, what follows durably, and what survives interruption.
5. Which cue can reach which observer, and why later behavior can legitimately change.

Combine pairs as a second pass: topology change interrupts activity; activity
changes an evidence source; learning changes a later attempt. Each must reuse the
same ownership and handoff rules rather than acquire a bespoke integration callback.

## Alternatives and recommendation

**One universal effect/mechanism record:** convenient generic handling, but
optional fields hide incompatible meanings and make invalid states easier to
express. Reject a claim that every domain shares a numerical conservation law.

**Independent domain engines with ad hoc messages:** keeps local schemas simple,
but duplicates time, identity, retries and authority. A chain can look correct
inside each engine while losing or inventing state between them.

**Recommended: common envelope, typed domain contracts, one commit authority.**
This preserves domain meaning while making cross-module validation explicit.
The tradeoff is deliberate adapters and supported-domain declarations; the envelope
cannot magically synthesize the physics or social inference those adapters lack.
This recommendation remains under review in Q064, not a newly accepted API.

## Corrective six-probe reconciliation for the thermal slice

This review occurs **after** the first implementation. It corrects a missed
prerequisite; it does not rewrite that chronology. The following are annotated
design traces, not claims that six runtime mechanisms have been implemented.
They evaluate whether the existing fixture can responsibly be retained before
making further commitments.

| Probe | Ownership, annotated trace and unsupported dependencies |
| --- | --- |
| Support, movement and detachment | Structure owns part identity, placement and supports; bodies would own exertion. An attempt binds an observed part/support, execution validates reach/support/capability, then commits placement and incurred costs together. Only eligible movement/contact cues reach observers. The bench admits discrete relocation by an explicitly insulated fixture manipulator, not free bodily work, arbitrary attachment or gravity. Its local socket coordinates cannot stand in for the unimplemented general frame/force contract. Moving a warm part preserves its energy. |
| Material entering/leaving containment | A portion owns quantity; containment owns opening/capacity relationships, not a second copy of that quantity. An attempt binds source, destination and opening; code checks all three and atomically debits/credits admitted progress. Interruption retains transferred material. Seeing a vessel does not reveal concealed contents. The bench implements neither portions nor containment; a rack is separate support, not an inventory/container mechanic. Adding pouring would require new representation and accounts, not another seating command. |
| Body consuming resources during activity | Body state owns distinct physiological reserves and capability. Activity binds duration and sources, validates an admitted metabolism/work mapping, and commits spent reserves with progress at supported boundaries. Eligible bodily signals are separate evidence, not direct access to hidden reserve numbers. Interruption does not refund work. These mechanisms are absent; the fixture's safe manipulation must not be advertised as bare-hand handling, unlimited stamina or respiration. |
| A process changing its own substrate | Physical parts own quantities and structure; active processes own progress. Execution reads a common start basis, settles exchange up to the next admitted topology/material event, commits all shared accounts, then derives the next interfaces from the new structure. Prior heat is not erased when a path disappears. The bench supports persistent heat plus later seating changes at minute boundaries, not burning, phase changes, damage or automatic structural failure within an interval. No generated rule can supply those missing events. |
| An observer acquiring incomplete evidence | Physics owns the source and probe state; sensing owns a rounded eligible reading; the actor owns only acquired evidence. A read validates access at one frontier and commits its original time, target and result with its receipt. Retry returns that record rather than detecting again; later observations cannot rewrite it. The bench's synchronous path avoids a commit/detection crash gap without asserting that asynchronous workers are generally unnecessary. Evidence is not a physical commodity or an omniscient world snapshot. |
| An agent revising an intention | An actor's evidence and authored interpretation justify a possible later choice, not successful physical effects. A recorded prediction/reason remains an attributed claim; any subsequent action starts a fresh authority/feasibility check. Neither note text nor hidden thermal truth selects an outcome. Human study reflections are research metadata, not an implemented NPC belief/intention policy. Existing M2 rules remain unchanged; no new planner or judgment family is admitted. |

**Composed trace:** observation at frontier N → attributed prediction using only
then-available evidence → seating attempt with N's revision → one validated
structural settlement → subsequent shared wait → explicit probe read → attributed
revision of the explanation → a separately validated next attempt. Competing
actors may invalidate the seating attempt. A note neither reserves the part nor
advances the clock. Recorded observations remain available after rearrangement,
but are not relabeled as current truth. This uses the existing Store/log authority,
not a second physical writer or a universal “transfer” operation for information.

**Counterexamples and alternatives:** arbitrary user-supplied contact edges would
grant effects without structure; truthful solver values in a journal would erase
the evidence boundary; tying note text to success would make interpretation an
executable law. Conversely, introducing a general body, container, perception
worker or workflow engine merely to support this fixture would add unsupported
mechanisms rather than satisfy the review.

**Retention decision:** the fixture is adequate for the stated finite solid/
probe/choice-boundary experiment, with those exclusions made visible. Retain its
physical model for corrective player-surface work; do not broaden its admitted
mechanisms. Shared envelopes, physiological mappings, containment, general frames,
offscreen scheduling and NPC intention policies remain unresolved in their owning
Q IDs. Q064 stays open for broader contract selection and measured handoffs.
Independent review of all six probes reached the same provisional retention
recommendation before the corrective surface implementation. It additionally
requires immutable, actor-authorized study snapshots, declared participant versus
self-test provenance, explicit historical probe readings and no automatic
truth/learning scores. The review supports a narrow choice; it does not certify
general C/W gates. Revise or stop the fixture if sensing granularity, probe
perturbation or unsupported internal gradients prevent useful comparisons.

## Evidence and exit criteria for the review

The [shared-food admission](shared-food.md#q064-ownership-and-handoff-review)
records the subsequent six-probe reconciliation for finite possession,
terrain-valid movement, diet, current sensory evidence and local persistence.
It does not reuse the thermal retention decision as a sequencing waiver or close
the general contract. Its executable scope is the existing ordinal matter world,
not SI metabolism, general containment or asynchronous belief delivery.

The design review is ready to inform mechanism selection when every probe has a
coherent annotated trace, ownership map and explicit unsupported dependencies,
and at least one cross-domain composition introduces no special-case write path.
An unresolved contradiction is reported, not patched with a new fixture-specific
field. A successful paper trace is still not runtime verification.

Implementation admission later requires the corresponding C/W tests: unchanged
results under renames/equivalent frames; finite shared-source accounting; hidden
state twins; partial/interrupted work; stable retry/draw semantics; crash recovery
between commit/detection/learning; bounded fan-out and unsupported-result behavior.
Tests must separate physical failure from missing support and exact replay from
approximate time-partition equivalence.

After the cross-domain review, choose a bounded initial mechanism set, determine
the necessary Q018 geometry and precision, and test learning with Q063/Q060.
The existing journeys can then be revised or replaced. Neither they nor the
probe matrix admits all the mechanisms mentioned here.

## Open choices

Q064 asks which envelope responsibilities genuinely need shared schema versus
domain-specific adapters, how bindings convey roles/precision/authority, and how
read dependencies and proposed effects are represented without unrestricted world
access. It also asks whether the lifecycle separates resolution from detection
adequately across all probes.

Related decisions stay owned elsewhere: concrete physical shape/quantity schema
(Q018), source allocation (Q019), claim/evidence adapters (Q034), choice policies
(Q039), atomicity/draw order (Q045), evidence delivery (Q047), frontier/scheduling
(Q050) and measurement of cost/learning (Q055/Q060). This record adds no formulas,
numerical thresholds, Jev families or additional implementation milestone.
