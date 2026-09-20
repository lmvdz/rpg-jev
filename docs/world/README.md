# Shared world module designs

The [shared contract](../shared-world-contract.md) is the cross-module agreement;
[SPEC section 22](../../SPEC.md#22-shared-world-contract) records its status.
These dedicated files are **draft designs for discussion**, not implemented APIs,
admitted mechanics or a promise that every suggested mechanism will ship.

Use the [numbered question register](questions.md) to track decided, open,
measurement-dependent and deferred questions separately from implementation
evidence. Q009 now permits fresh seeded population sources in new regions, with
persistent simulation afterward and explicitly revised extinction scope.
The [next discussion is Q061](questions.md#next-question-q061):
technically distinct variants versus individual traits and community identity.

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
