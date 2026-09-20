# Shared world question register

This is a discussion and evidence index, not another architecture specification.
It inventories questions already present in the [module drafts](README.md) and
[shared contract](../shared-world-contract.md). SPEC remains the source of truth;
the linked module owns each question's reasoning and eventual answer.
Creating this register does not accept provisional recommendations, add features,
change milestone order or certify implementation.

## Status and maintenance

Two different kinds of progress must stay separate:

| Discussion status | Meaning |
| --- | --- |
| Decided | An accepted contract answers this question at its stated scope; narrower implementation choices may remain open |
| Open | A choice or concrete contract is still needed; a draft recommendation is not approval |
| Needs measurement | Existing requirements need experimental evidence before calibration or a capacity claim |
| Deferred | Not admitted to the current scope; reopening needs an explicit scope decision, not an assumption that it will ship |

Delivery is tracked separately in the [evidence ledger](#implementation-evidence).
**Implemented and verified** requires a pinned implementation and relevant gate
evidence; a decided row, document review or green repository check is insufficient.
No new integrated W0–W8 capability is marked implemented and verified here.

- IDs are stable. Append new questions; never renumber existing ones to conceal
  scope changes. Split a question with new IDs and preserve its original context.
- Discuss one question at a time. Record its answer in the owning module and
  update the shared contract/SPEC when an interface or rule changes.
- Update the row and linked evidence in the same logical change. Reopening a
  decided question must name the changed assumption and affected contracts.
- Keep measurements and deferred follow-ups out of the immediate conversational
  queue unless they block the question being discussed.
- Counts describe this inventory, not engineering effort or percent completion.
  Related rows differ in size and can depend on each other.
- Apply the [composition test](README.md#apply-the-composition-test-to-every-question)
  to Q018 and every subsequent answer. Examples exercise general mechanisms;
  they do not authorize named features or new judgment families. Keep semantic
  interpretation, code-owned resolution and missing support distinct.

## Next question: Q018

**Which shape vocabulary and geometric detail do the next design-only player
journeys require from the accepted foundation?**

The [Q018 foundation](composition-and-processes.md#accepted-q018-foundation-parts-and-typed-relationships)
is accepted: material-bearing parts and typed couplings underlie assemblies.
Material definitions, portions, parts, assemblies, couplings and processes have
distinct responsibilities; bodies and bulk environments share accounted exchanges.
The [structure-first approach](composition-and-processes.md#accepted-q018-approach-structure-before-approximation)
is also accepted: compound simple geometry and explicit interfaces, with physical
approximations and visual representations derived from meaningful stored structure
and shared state. This settles the direction, not the concrete shape palette,
schema fields, precision, approximation transfers or supported channels.
[SI physical units](composition-and-processes.md#accepted-q018-units-si-internally)
are now accepted internally, with descriptive/converted presentation values.
Legacy calibration/conversion and migration remain explicit integration work;
the unit choice does not establish numerical accuracy or physical realism.
[Hierarchical coordinates and frame invariance](composition-and-processes.md#accepted-q018-coordinates-hierarchical-frames-and-invariant-changes)
are accepted: frame changes alone preserve physical outcomes, identities,
generation history and knowledge. Numeric formats, dimensions, transform details
and error budgets remain open. Follow Q063's
[design-only journeys](experimentation.md#next-work-remains-design-only) to assess
candidate geometry before selecting a concrete palette or claiming implementation.

Assess a coherent coupled representation, not isolated subsystems. The spontaneous
sword/ground/exertion example probes contact, support, work, body demand and thermal
state; it does not require a sword-dragging action or an exhaustive scripted chain.
Identify the reusable primitives and admitted interpretation path, then test their
composition on unrelated objects/actors. Q018 remains open until its schema and
supported channels are chosen; recognizing the example's meaning does not close it.

Q009 is now decided: genuinely new regions may initialize fresh seeded population
sources without a finite world-wide founding inventory. Once established, sources
and individuals persist and follow simulation. Initialization retries, exploration
order and re-entry cannot reset them. Source schema, placement and generation-time
details remain Q010–Q012, not claimed implementations.

This changed the assumption behind Q005. The earlier permanent species-wide
extinction promise is superseded: species/variants eligible for open-ended regional
generation may appear elsewhere after all established populations disappear.
Local losses and ended individual/community identities remain persistent. This
is an explicit decision revision, not completion of the old finite-source proposal.

The user accepted technically distinct species variants and the six-layer causal
variation model (Q062): founding traits, development, acclimatization/conditioning,
current condition, learning/culture and population composition. Environment can
affect initialization and later change through admitted mechanisms, not preset
swaps. Q061 retains the concrete variant schema/admission work; Q023–Q027 retain
physiological choices and calibration. No inheritance/genetics system was selected.
Move to Q018's physical representation rather than exhausting ecological tuning.

## Accepted cross-module decisions

These record the recent agreed direction. None implies a complete entity runtime.

| ID | Question | Status | Answer / source |
| --- | --- | --- | --- |
| Q001 | Does each entity need its own continuously running machine? | Decided | Persistent state and bounded event-driven work share a runtime; [runtime decision](time-and-persistence.md#accepted-decision-logical-entity-runtimes) |
| Q002 | Must every creature exist individually at region generation? | Decided | No; rule-driven entry draws from accounted sources; [population entry](world-identity-and-context.md#accepted-decision-accounted-population-entry) |
| Q003 | Does distance or reactivation replace an established creature? | Decided | No; individuals persist, activation is not creation, migration preserves identity; [population entry](world-identity-and-context.md#accepted-decision-accounted-population-entry) |
| Q004 | Does an isolated depleted region automatically recover? | Decided | No; recovery needs admitted causal sources and conditions; [local extinction](world-identity-and-context.md#accepted-decision-local-extinction-and-causal-recovery) |
| Q005 | Can both rare and widespread species become fully extinct? | Decided | Revised by Q009: no permanent world-wide guarantee for species/variants still eligible for new-region generation; preserve local and identity-scoped losses; [extinction scope](world-identity-and-context.md#revised-decision-extinction-has-an-explicit-scope) |
| Q006 | Must geography be finite to support accounting? | Decided | No; expanding geography uses Q009's fresh regional initialization rather than finite world-wide stock; [world expansion](world-identity-and-context.md#accepted-direction-expanding-geography-and-world-settings) |
| Q007 | Are world rules configurable? | Decided | Yes, with code-validated revisioned semantics; actual settings remain Q015; [world settings](world-identity-and-context.md#accepted-direction-expanding-geography-and-world-settings) |
| Q008 | May ecological rules change while the world runs? | Decided | Yes, explicitly and prospectively without resetting history; transition details remain Q054; [live settings](world-identity-and-context.md#accepted-decision-prospective-live-ecological-settings) |

## World identity and context

| ID | Question | Status | Source / what closes it |
| --- | --- | --- | --- |
| Q009 | What population-source model reconciles endless geography and extinction? | Decided | Fresh seeded sources in genuinely new regions, persistent accounts afterward; supersedes the global-extinction premise of Q005 rather than pretending to satisfy it; [population entry](world-identity-and-context.md#accepted-decision-accounted-population-entry) |
| Q010 | What does coarse population state represent, distinct from habitat capacity and body resources? | Open | [Population entry](world-identity-and-context.md#accepted-decision-accounted-population-entry); source units, cohorts/viable stages where needed, and explicit/coarse transfer invariants |
| Q011 | Which conditions, opportunities and replenishment mechanisms govern entry? | Open | [Population entry](world-identity-and-context.md#accepted-decision-accounted-population-entry); supported inputs, timing/draw identity, migration/birth boundaries and no repeated-evaluation exploit |
| Q012 | How are coherent regions/individuals/groups initialized atomically and retried? | Open | [Initialization](world-identity-and-context.md#coherent-initialization-not-attribute-confetti) and [source model](world-identity-and-context.md#accepted-decision-accounted-population-entry); spatial boundary/time basis, stable allocation IDs, constraint/fan-out bounds and initialization accounts respecting established facts |
| Q013 | How are identity, world placement/containment and relationship transitions represented? | Open | [Lifecycle](world-identity-and-context.md#lifecycle-and-identity-decisions); [hierarchical frames/invariance accepted](composition-and-processes.md#accepted-q018-coordinates-hierarchical-frames-and-invariant-changes), but coordinate/containment schema, conversion precision, relationship lifetimes and lineage still need design |
| Q014 | When may individual state retire, archive or refine? | Open | [Evidence questions](world-identity-and-context.md#evidence-and-open-decisions); retention/refinement rules preserving references, quantities and history |
| Q015 | Which settings, bounds, defaults and caller permissions are supported? | Open | [Live settings](world-identity-and-context.md#accepted-decision-prospective-live-ecological-settings); concrete validated catalogue and authorization rules, with Q054 transitions |
| Q016 | Are exceptional restoration, protected-species or administrator-reset mechanics admitted? | Deferred | [Extinction scope](world-identity-and-context.md#revised-decision-extinction-has-an-explicit-scope); none admitted; Q009 initializes new sources, not restoration of ended identities or depleted regions |

## Composition and processes

| ID | Question | Status | Source / what closes it |
| --- | --- | --- | --- |
| Q017 | Do we retain compositional physics rather than named encounter recipes? | Decided | Yes; physical/rule graphs, conservation and C gates remain foundational; [physical contract](../compositional-causality.md#what-is-abstracted) |
| Q018 | What minimal parts, contacts, geometry and quantity schema supports the first integrated slice? | Open | [Parts/relationships](composition-and-processes.md#accepted-q018-foundation-parts-and-typed-relationships), [structure-first geometry](composition-and-processes.md#accepted-q018-approach-structure-before-approximation), [SI units](composition-and-processes.md#accepted-q018-units-si-internally) and [hierarchical frames/invariance](composition-and-processes.md#accepted-q018-coordinates-hierarchical-frames-and-invariant-changes) accepted; palette, fields, precision, adapters, transforms and channels remain open, guided by Q063 journeys |
| Q019 | How are simultaneous physical transfers allocated from shared budgets? | Open | [Process lifecycle](composition-and-processes.md#lifecycle-across-changing-topology); consistent read state, allocation and boundary settlement; coordinate Q045/Q050 |
| Q020 | How do damage, fracture and attachment changes alter topology? | Open | [Process lifecycle](composition-and-processes.md#lifecycle-across-changing-topology); first admitted mechanisms with material/energy-preserving transitions |
| Q021 | Which current matter processes migrate first, through which adapters? | Open | [Physical open decisions](composition-and-processes.md#evidence-and-open-decisions); mechanism-to-current-row compatibility map, not a second production engine |
| Q022 | What error, event and work bounds can the integrated physical model support? | Needs measurement | [Numerical limits](composition-and-processes.md#budgets-numerical-limits-and-fallback); predeclared tolerances, budget and partition tests on admitted domains |

## Embodiment

| ID | Question | Status | Source / what closes it |
| --- | --- | --- | --- |
| Q023 | Which body reserves/functions are authoritative and which signals are derived? | Open | [Body ownership](embodiment.md#ownership-and-interfaces); first organism functions, anatomy resolution and no duplicate physical/physiological budget |
| Q024 | How does actual intake become nourishment and waste? | Open | [Ingestion lifecycle](embodiment.md#lifecycle-ingestion-is-not-nourishment-by-decree); supported conversion/delay and exactly-once accounting |
| Q025 | How do exposure, damage, impairment and recovery relate? | Open | [Injury and recovery](embodiment.md#injury-exposure-and-recovery); supported mappings, capability constraints and interruption semantics |
| Q026 | Which own-body sensations can enter subjective decisions directly? | Open | [Body ownership](embodiment.md#ownership-and-interfaces); admitted internal senses, authorized capability view and hidden-impairment twins |
| Q027 | What physiological calibration is justified for the admitted functions? | Needs measurement | [Body evidence](embodiment.md#evidence-and-unresolved-decisions); declared assumptions and directional tests before tuning, not invented biological precision |

## Perception and evidence

| ID | Question | Status | Source / what closes it |
| --- | --- | --- | --- |
| Q028 | Can agents read hidden truth or privileged provenance as knowledge? | Decided | No; evidence and subjective identity are separately authorized; [provenance boundary](perception-and-evidence.md#provenance-has-two-audiences) |
| Q029 | Which first senses and environmental/geometric approximations are supported? | Open | [Perception questions](perception-and-evidence.md#admission-evidence-and-open-questions); channel definitions, capability/exposure requirements and unsupported cases |
| Q030 | How is continuous detection distinguished from duplicate delivery or repeated rolls? | Open | [Perception lifecycle](perception-and-evidence.md#lifecycle-and-difficult-boundaries); interval semantics and delivery identity, paired with Q047 |
| Q031 | What evidence supports negative searches and recognition? | Open | [Perception questions](perception-and-evidence.md#admission-evidence-and-open-questions); coverage, precision and identity limits without absence/omniscience shortcuts |
| Q032 | How can observations correlate across modalities without leaking hidden identity? | Open | [Provenance boundary](perception-and-evidence.md#provenance-has-two-audiences); permitted handle/equality semantics and adversarial correlation tests |
| Q033 | What detection/query/fan-out limits preserve useful evidence at bounded cost? | Needs measurement | [Perception bounds](perception-and-evidence.md#invariants-costs-and-honest-fallbacks); crowded-source workloads and honest fallback evidence |

## Knowledge and memory

| ID | Question | Status | Source / what closes it |
| --- | --- | --- | --- |
| Q034 | How does richer evidence map to existing M2 claims? | Open | [M2 compatibility](knowledge-and-memory.md#preserve-rather-than-stretch-m2); explicit precision/provenance adapters and compatibility fixtures |
| Q035 | How do retrieval, forgetting, stale validity and inaccessible memory differ? | Open | [Memory lifecycle](knowledge-and-memory.md#lifecycle-and-edge-cases); bounded recall policy that never updates remembered locations from hidden truth |
| Q036 | How are dependent reports distinguished from independent corroboration? | Open | [Memory questions](knowledge-and-memory.md#admission-evidence-and-open-questions); source-dependence policy compatible with M2's settled belief rules |
| Q037 | Which memory records must stay accessible to current commitments? | Open | [Memory questions](knowledge-and-memory.md#admission-evidence-and-open-questions); retention/hot/archive mapping and preserved learned time; coordinate Q053 |

## Motivation and intention

| ID | Question | Status | Source / what closes it |
| --- | --- | --- | --- |
| Q038 | Does an intention guarantee an outcome or get rerolled every tick? | Decided | Neither; persistent reasons authorize attempts, with event-driven reconsideration; [shared intention contract](../shared-world-contract.md#8-motivation-intentions-and-choice) |
| Q039 | Which admitted routine/choice policy supports the first animal fixture? | Open | [Agency questions](motivation-and-intention.md#admission-evidence-and-open-questions); adapter/policy evidence preserving current Jev roles, not assumed animal intelligence |
| Q040 | How do schedules, promises and intention state share authority? | Open | [Schedule interaction](motivation-and-intention.md#lifecycle-and-schedule-interaction); compatibility map preserving existing priority and fuse semantics |
| Q041 | Which conditions stop execution immediately versus trigger subjective reconsideration? | Open | [Schedule interaction](motivation-and-intention.md#lifecycle-and-schedule-interaction); capability-loss, hidden-target and urgent-evidence cases without information leaks |
| Q042 | Which failure/reconsideration policy and hysteresis avoid oscillation, stale retries and repeated chance exploits? | Open | [Agency questions](motivation-and-intention.md#admission-evidence-and-open-questions) and [bounds](motivation-and-intention.md#invariants-cost-and-degraded-behavior); choose the policy, then measure continuity/candidate/reconsideration workloads to set limits |
| Q043 | May new judgment families or unrestricted planners be introduced by these drafts? | Deferred | [Agency scope](motivation-and-intention.md#status-and-purpose); M2 catalog stays frozen; separate admission required, no new family authorized |

## Action execution

| ID | Question | Status | Source / what closes it |
| --- | --- | --- | --- |
| Q044 | Do players and NPCs use the same attempt/resolution boundary? | Decided | Yes; subjective options, truth-based execution, one commit authority and shared physical accounts; [shared action contract](../shared-world-contract.md#9-attempts-transactions-and-feedback) |
| Q045 | What are atomic attempt boundaries, conflict/retry semantics and RNG ordering? | Open | [Execution questions](action-execution.md#decisions-still-requiring-evidence); race fixtures, reference validation and logged-draw ownership; coordinate Q019/Q050 |
| Q046 | Which interval actions and failures spend what time/effort? | Open | [Execution lifecycle](action-execution.md#interfaces-and-lifecycle); admitted progress/interruption costs without refunds or duplicate debits |
| Q047 | What durable protocol hands outcome opportunities to detection and learning? | Open | [Execution lifecycle](action-execution.md#interfaces-and-lifecycle); event-time context, exactly-once effects and crash-boundary tests with Q030/Q053 |

## Time and persistence

Q001 already records the accepted shared-runtime architecture.

| ID | Question | Status | Source / what closes it |
| --- | --- | --- | --- |
| Q048 | May replay rerun models or reinterpret history under current rules? | Decided | No; committed effects/decisions/draws and pinned revisions are authoritative; [persistence contract](time-and-persistence.md#persistence-and-recovery) |
| Q049 | What does freezing a region mean for its effective time and later entry? | Open | [Freeze/resume](time-and-persistence.md#freeze-overload-and-resumption); preserve SPEC §11 ordering and prove absence → overload → return behavior |
| Q050 | How are dependency frontiers and simultaneous boundaries ordered/published? | Open | [Advancement interface](time-and-persistence.md#advancement-interface-and-lifecycle); consistent dependent state and race fixtures; coordinate Q019/Q045 |
| Q051 | When is schedule location lookup valid versus requiring embodied travel? | Open | [Kinds of time work](time-and-persistence.md#different-kinds-of-time-work); preserve SPEC §7 without bypassing blocked routes or injured bodies |
| Q052 | Which offscreen interactions admit summaries, and under which error contracts? | Open | [Catch-up limits](time-and-persistence.md#catch-up-and-summary-limits); selected operators, shared-source settlement and detailed-reference comparisons |
| Q053 | What checkpoint, archival and migration protocols preserve the complete causal chain? | Open | [Recovery requirements](time-and-persistence.md#unresolved-decisions-and-required-evidence); concrete schema/protocol and crash tests; existing S0 archive policy remains binding |
| Q054 | How does each live-adjustable setting transition in-flight and offscreen work? | Open | [Live transitions](time-and-persistence.md#live-rule-transition-boundaries); per-setting policy at an effective simulation boundary, no historical reinterpretation |
| Q055 | What capacity, fairness, latency and storage budgets support the shared runtime? | Needs measurement | [Runtime decision](time-and-persistence.md#accepted-decision-logical-entity-runtimes) and [time bounds](time-and-persistence.md#invariants-budgets-and-fallback); sleeping/active/dense and clustered/dispersed-player workloads |

## Presentation and explanation

| ID | Question | Status | Source / what closes it |
| --- | --- | --- | --- |
| Q056 | May player-facing explanation reveal privileged world truth? | Decided | No; render authorized evidence, keep privileged diagnostics separate; [explanation boundary](presentation-and-explanation.md#player-facing-why-versus-privileged-diagnostics) |
| Q057 | Who can inspect privileged causes, and through which surfaces? | Open | [Presentation questions](presentation-and-explanation.md#open-decisions-and-implementation-evidence); authorization model across UI, subscriptions, diagnostics and errors |
| Q058 | Does historical explanation use then-known or now-known evidence? | Open | [Presentation questions](presentation-and-explanation.md#open-decisions-and-implementation-evidence); explicit supported view(s), labels and history-preservation tests |
| Q059 | How are uncertainty, withheld causes, staleness and degraded output represented? | Open | [Honest explanations](presentation-and-explanation.md#honest-explanations) and [failure cases](presentation-and-explanation.md#staleness-replay-and-failure-cases); non-leaking projections and deterministic fallbacks |
| Q060 | Do supported cues help players predict unfamiliar consequences? | Needs measurement | [Presentation evidence](presentation-and-explanation.md#open-decisions-and-implementation-evidence) and [accepted learning milestone](experimentation.md#first-milestone-learn-a-rule-and-use-it-creatively); prediction and transfer evidence, wolf/non-wolf fixtures, legibility and multiplayer leakage tests; study protocol and thresholds remain open |

## Variation follow-ups and decisions

Appended without renumbering prior questions. Q061 tracks concrete representation
and admission; Q062 separately records the accepted causal model, not completion
of those schema/mechanics choices.

| ID | Question | Status | Source / what closes it |
| --- | --- | --- | --- |
| Q061 | How are species groupings and technically distinct variants represented and admitted? | Open | [Variant direction](world-identity-and-context.md#accepted-direction-technically-distinct-species-variants); Q062 settles the causal-layer distinction, while schema, definition-admission criteria, identity and compatibility remain open |
| Q062 | Which causal layers explain environmentally influenced variation? | Decided | [Six-layer model](world-identity-and-context.md#accepted-model-six-causes-of-variation); founding traits, development, acclimatization/conditioning, current condition, learning/culture and population composition; admitted mechanisms connect environment/history to changes, not labels or assumed evolution |

## Experimentation-first product direction

The research record is advisory where it compares architecture or proposes a
domain. Q063 records the accepted player loop and learning goal, not completion
of the Q060 evidence or selection of Q018's concrete mechanisms.

| ID | Question | Status | Source / what closes it |
| --- | --- | --- | --- |
| Q063 | Which player loop and first learning milestone guide the next engine exploration? | Decided | [Experimentation-first direction](experimentation.md#accepted-player-loop): hypothesize, intervene, observe, transfer; a player learns a general rule and uses it creatively in an unfamiliar situation. Exact study domain, pacing, protocol and success thresholds remain open; no implementation claimed |

## Implementation evidence

Evidence here is inherited and scoped, not newly established by making this list.

| Scope | Delivery status | Evidence and limits |
| --- | --- | --- |
| Production C0 exposure/event correction | Implemented and verified for the narrow correction | [C0 report](../c0-exposure.md) and [combined integration](../integration-status.md#verification); not arbitrary generated-row composition or full material accounts |
| Isolated thermal composition proof | Partial evidence for C1–C4 | [Spike evidence](../compositional-causality.md#evidence-from-the-isolated-proof); not production bodies, perception, latent state or persistence |
| SpacetimeDB infrastructure | Partial evidence for Q001/Q048/Q055 | [S0 findings](../../spikes/s0-spacetimedb/FINDINGS.md#verdict); measured queues, transactions, subscriptions and storage, not complete entity capacity |
| Existing M2 systems | Existing baseline, not certification of richer modules | [SPEC minds](../../SPEC.md#6-npc-minds) and [catalog](../../SPEC.md#14-jev-question-design-rules); richer adapters/policies still need compatibility and admission |
| Shared integrated W0–W8 contract | Not verified | [Required gates](../shared-world-contract.md#13-acceptance-gates); no module-wide completion inferred from current test counts |

When a question's selected implementation passes its required evidence, add a
scoped record here with revision/test references and link it from the question.
Do not mark an entire module verified because one fixture passes.

## Progress snapshot

The register contains **63 questions**: **17 decided**, **39 open**,
**5 needing measurement**, and **2 deferred**. These counts are a discussion
inventory, not a completion percentage. None of the nine shared modules is claimed
complete. C0's existing narrow completion is tracked separately above.

Update the counts when rows change; retain the distinction between decision and
delivery. The external Claude Doc remains unsynchronized with repository decisions.
