# Knowledge and memory

## Status and purpose

This module draft is subordinate to [the shared contract](../shared-world-contract.md)
and [SPEC](../../SPEC.md), especially sections 2, 5–7, 13–14 and 21–22.
It describes required boundaries, not a new implemented memory engine or claim schema.
M2's claim, belief, sampling and source-update policies remain authoritative.
No new Jev family, memory-ranking model API or numeric calibration is admitted here.

Knowledge supplies the bounded subjective context from which an actor can act.
Memory retains evidence of what that actor observed or heard, not a miniature copy
of the current world. Its value is continuity under change, including being mistaken.
Non-goals are omniscient search, unrestricted deduction, prompt personas and full
autobiographical prose. A generated summary cannot be authoritative memory.

## Authority and contracts

[Perception](perception-and-evidence.md) supplies observer-specific evidence and precision.
[World identity](world-identity-and-context.md) supplies stable references and revisions,
but possession of a reference does not authorize reading the entity's current state.
This module owns retained observations, received claims, source attribution, remembered
places, subjective uncertainty and the accessibility state of those records.
The original event and physical truth remain owned outside this module.
Recall rankings, selected slices and display summaries are derived views.

[Intention](motivation-and-intention.md) reads a bounded context, including uncertainty
and known gaps, rather than a truth lookup disguised as a remembered target accessor.
[Embodiment](embodiment.md) supplies authorized own-body context separately from memories;
hunger need not create a retained memory record, but requires an admitted own-body
signal. Bypassing memory is not bypassing sensory authorization or exposing hidden
impairments. Fear is not sensory evidence.
[Execution](action-execution.md) sends committed outcomes through eligible evidence.
[Persistence](time-and-persistence.md) preserves learned time, causes and replay.
[Presentation](presentation-and-explanation.md) distinguishes recollection, report and
current perception without exposing other actors' private stores.
[Composition](composition-and-processes.md) remains authoritative when remembered
material condition differs from the actual object's condition.

A proposed evidence handoff carries the observer, observed/reported content, source
attribution available to that observer, observation time, learning time, precision,
cause reference, revision and status. A privileged cause is not subjective content.
A context response must indicate what was selected and what coverage is incomplete,
without disclosing omitted private records through counts or labels to other actors.
The exact schema and compatibility adapter remain admission work.

### Preserve rather than stretch M2

M2 uses structured, content-identified claims, recorded one-hop belief judgments and
code-owned credence. Its direct-evidence path remains direct; no Noul is added to
decide whether an actor saw already admitted proof.
Its source-discredit and corroboration rules remain code rules, not new calibrated
probabilities inferred from model confidence.
The settled M2 credence table is not a universal measurement-error model.
Seeing an ambiguous shape does not establish the proposition “this is the owner.”
Provisionally retain richer spatial/sensory evidence separately and map only an
admitted proposition into the existing claim path when the mapping is justified.
Keep claim content identity separate from reception provenance: repeated tellers may
share one claim row without becoming independent original witnesses.
This draft does not silently change existing corroboration; any richer dependence
handling needs explicit compatibility evidence before modifying that policy.

## Lifecycle and edge cases

1. Receive committed evidence and validate observer eligibility, revision and retry ID.
   A report's reception and the event it describes have different times and causes.
2. Preserve what was supplied, including uncertainty and authorized source attribution.
   Reject a proposed claim mapping that asserts more than the evidence supports.
3. Apply an existing admitted belief path where appropriate, logging the judgment,
   seeded draw and code-owned update; raw Noul values are not belief quantities.
4. Update accessibility and bounded retrieval indexes under declared code rules.
   Rank existing candidates by the established recency, severity and source-trust
   approach; model tie-breaking stays backlog, not a new family hidden in retrieval.
5. Compile a bounded subjective slice for a specific decision and log its hash.
   Stable time representation prevents irrelevant ticks from changing gated requests.
6. Later observations can amend beliefs and remembered places with new provenance.
   The earlier observation remains a statement about the earlier time.

A last-known place is a past place even if its entity reference still resolves.
If the target moves unseen, retrieval must not join against its live coordinates.
If it is retired or dies unseen, a remembered plan can still refer to it; execution
may discover absence, but the memory must not learn the lifecycle event for free.
Conflicting reports can coexist without an immediate canonical winner.
Their inconsistency is subjective evidence, not a reason to rewrite world history.

Forgetting changes accessibility or code-owned confidence under an admitted rule.
It does not delete the underlying event, undo a debt, erase spent resources or reroll
a hidden fact. Archive retention and subjective forgetting have different owners.
A retrieval miss caused by a budget is not a new belief that nothing happened.
Initialization may seed a coherent remembered history with explicit initialization
provenance; it must not masquerade as a sequence of simulated observations.
No-player rumor propagation remains structured and code-driven under SPEC.
Load replays committed learning and decisions; it does not ask whether the actor
still believes a claim or ask a model to reconstruct memories from prose.

## Alternatives and provisional recommendations

**One generalized claim table versus separate evidence with explicit claim adapters.**
A universal claim shape simplifies consumers but encourages exact propositions where
the observation supplies only approximate position or unidentified features.
Separate evidence records cost adapter work and require identity discipline, but
keep observation, attribution and belief distinguishable.
Provisionally choose explicit adapters while retaining M2 claims unchanged.
Admission should show that two views cannot disagree about what was actually learned.

**Updating remembered objects in place versus time-qualified knowledge history.**
In-place updates are compact and convenient but lose “what did the actor know then?”
and can accidentally replace a remembered position with a live position.
Time-qualified records preserve stale belief and causal explanations, at storage cost.
Provisionally use SPEC's temporal/log approach with bounded current decision views;
do not scan full history on the decision path or invent a second history database.

**Eager total belief reconciliation versus bounded event-driven updates.**
Recomputing every belief after a discredited source seems comprehensive but can
produce unbounded cascades and accidentally perform multi-hop inference in one call.
Local updates are cheaper and preserve causal ordering but can leave unresolved
contradictions that consumers must handle honestly.
Provisionally preserve existing M2 updates and bound any added dependency work.
Do not extend source effects transitively until their semantics and costs are admitted.

## Invariants, costs and fallbacks

- A mind can be wrong without the world being wrong; changing belief never changes
  the described physical fact or grants the actor an ability.
- Evidence never gains precision or identity through retrieval, summary or rendering.
- Retelling the same rumor must not manufacture a second witnessed event.
  Dependence metadata cannot reveal a hidden original source to the receiver.
- Observation time, claim event time and learning time remain distinguishable.
- Private provenance is not a backdoor from an actor's context to unrestricted truth.
- Each learning event applies once; a genuinely new report has its own reception.

Costs are retention, per-actor indexing, ranking, context size and update fan-out.
Use entity-led indexes and current-valid views as SPEC requires; archive history is
for replay and authorized explanation, not an accidental full scan during choice.
Concrete budgets and retention rules need measurement before admission.
When retrieval is bounded, return a bounded honest context rather than a generated
completion of missing history. If an adapter cannot represent evidence, preserve
the supported evidence or mark it unsupported; do not promote it to a confident claim.
Model outages leave existing committed beliefs intact and follow existing fallback
policy. No outage justifies omniscient defaults or fabricated successful learning.

## Worked wolf fixture and non-wolf counterexample

The wolf has a seeded, explicitly historical memory of a place where food was found.
Its current need can make revisiting that place a subjective opportunity.
Moving the food unseen changes neither the remembered place nor that opportunity.
A later admitted search can supply evidence of what was encountered, while execution
accounts for travel and any actual consumption. Memory supplies no free nourishment.
Seeing a player drop a burning assembly updates only detected features and location;
the wolf does not learn internal fuel or grip temperature from the assembly ID.
This fixture specifies causal boundaries, not an admitted animal belief policy.

Counterexample: a traveler hears that a bridge is open, then hears it is closed.
Both reports retain their time and available sources; the current bridge state is
not consulted to select the “right” memory before the traveler chooses a route.
Several retellings of the first report are not several firsthand bridge inspections.
A route attempt can fail lawfully, and a supported inspection can update knowledge.
This catches truth joins and provenance inflation that a simple visible-wolf scene misses.

## Admission evidence and open questions

W1 tests seeded memory against coherent initialization and explicit historical provenance.
W3 changes hidden target position, lifecycle and contents while comparing recall and
options; test private cause traversal as well as the obvious current-position field.
W4 saves mid-commitment and verifies identical recalled reasons after reload.
W0/W6 verify replay, deduplication and preserved learned times across archival boundaries.
W7 requires player-facing recollection to distinguish hearsay from supported observation.
W8 stresses conflicting claims, rumor fan-out, bounded queries and held-out non-wolf cases.
These remain proposed admission tests; no W or physical C gate is closed by this draft.

Which evidence precision and correlation semantics can the existing claim adapter carry?
How are inaccessible memories distinguished from expired validity in existing stores?
What source-dependence handling is compatible with M2's settled corroboration policy?
Which records must remain hot so a current commitment can cite its reasons?
Admission needs adapter fixtures, compatibility regressions, indexed workload measurements
and end-to-end privacy tests before richer memory is used to steer an actor.
