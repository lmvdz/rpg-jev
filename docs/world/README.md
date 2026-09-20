# Shared world module designs

The [shared contract](../shared-world-contract.md) is the cross-module agreement;
[SPEC section 22](../../SPEC.md#22-shared-world-contract) records its status.
These dedicated files are **draft designs for discussion**, not implemented APIs,
admitted mechanics or a promise that every suggested mechanism will ship.

Use the [numbered question register](questions.md) to track decided, open,
measurement-dependent and deferred questions separately from implementation
evidence. Q009 now permits fresh seeded population sources in new regions, with
persistent simulation afterward and explicitly revised extinction scope.
Q062 records the accepted six-layer variation model; Q061 retains concrete
variant-schema and admission questions. The
[next discussion is Q018](questions.md#next-question-q018):
concrete geometry, units and precision. Parts/typed relationships and structure-first
compound geometry are accepted; shape palette, fields, approximation transfers,
units and initial channels remain open.

| Module | Design question |
| --- | --- |
| [World identity and context](world-identity-and-context.md) | What persists through creation, movement, separation, refinement and death? |
| [Composition and processes](composition-and-processes.md) | How do accounted mechanisms change material and structure together? |
| [Embodiment](embodiment.md) | How do body condition and reserves constrain sensing and action? |
| [Perception and evidence](perception-and-evidence.md) | What can each observer actually detect, and with what provenance? |
| [Knowledge and memory](knowledge-and-memory.md) | How do evidence, uncertainty and remembered history differ from world truth? |
| [Motivation and intention](motivation-and-intention.md) | Why choose an attempt, persist in it or abandon it? |
| [Action execution](action-execution.md) | How do competing attempts become lawful, accountable effects? |
| [Time and persistence](time-and-persistence.md) | What survives saving, catch-up, concurrency and mechanics upgrades? |
| [Presentation and explanation](presentation-and-explanation.md) | How is causal depth legible without revealing private truth? |

## How to deepen a module

Keep purpose, state ownership, handoffs, lifecycle, alternatives/tradeoffs,
failure handling, worked counterfactuals, evidence and open decisions together.
Recommendations are not silently ratified decisions. Record the reasoning and
evidence when closing a question, and update the shared contract/SPEC when its
answer changes an interface or invariant.

The [compositional physics contract](../compositional-causality.md) remains the
authority for physical depth and C0–C8. Its module file discusses integration and
tradeoffs rather than replacing it. W0–W8 apply across the full shared contract.
Passing a module test cannot certify an untested handoff to another module.

### Apply the composition test to every question

The [standing design rule](../shared-world-contract.md#standing-design-rule-examples-test-composition)
applies to Q018 and all later discussions. For each candidate answer, ask:

1. What reusable state, primitives and relationships make the example expressible?
2. Which admitted typed choices interpret intent, and which code owns execution,
   arithmetic, simultaneous consequences and commit?
3. What other modules must share state for the interaction to remain coherent?
4. Does the rule survive renamed entities, substituted properties and unfamiliar
   combinations, without a new scenario branch?
5. Is a failure ambiguous meaning or an unsupported mechanism, and is that
   distinction reported honestly?

Examples can become regression fixtures, never a mandate for bespoke mechanics.
Do not use a successful typed parse as proof that the physical model is correct
or promote an illustrative sequence into a required named feature.

## Cross-module questions to resolve together

- **Identity versus recognition:** world IDs join true records, but an observer
  may not recognize two observations as the same creature.
- **Reserves versus signals:** physical/body accounts determine what was spent;
  hunger or pain is not a second independent resource ledger.
- **Opportunity versus feasibility:** the mind uses subjective opportunities;
  execution checks actual truth without revealing it through candidate pruning.
- **Evolution versus observation:** an environmental event may occur without
  anyone detecting it. Missing evidence must not stop physical evolution.
- **Concurrency versus causality:** one commit authority orders conflicts;
  modules cannot each commit their own version of a shared meal or contact.
- **Fidelity versus continuity:** cheaper catch-up must state its limits and
  preserve established facts, not generate a new encounter on return.

Resolve these with small cross-module traces and negative/counterfactual tests,
not just nine independently plausible documents. The persistent wolf and finite
burning assembly are fixtures; also test unrelated organisms and objects.
