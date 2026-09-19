# Motivation and intention

## Status and purpose

This is a module draft subordinate to [the shared contract](../shared-world-contract.md)
and [SPEC](../../SPEC.md), especially sections 2, 5–7, 13–14 and 21–22.
It is not an implemented animal policy, new utility optimizer or replacement for M2.
The eight M2 Jev families, code-owned stance transitions, existing choice sampling,
schedule layers and combat stub retain their roles. No model API work is authorized.
Proposed records below are requirements for admission, not available runtime types.

Motivation explains why a course of action matters; intention maintains that course
long enough to attempt it. Neither determines whether the world lets it succeed.
Needs, dispositions, relationships, beliefs and commitments are distinct inputs.
Hunger is not an instruction to attack; fear is not evidence of danger.
Non-goals are unrestricted planning, a goal for every organism or full animal cognition.
The module must support persistent mistakes without turning persistence into blindness.

## Authority and neighboring contracts

[Memory](knowledge-and-memory.md) supplies bounded subjective context and reasons.
[Perception](perception-and-evidence.md) supplies eligible new evidence through that
context, not a second raw-world feed to a supposedly private decision.
[Embodiment](embodiment.md) supplies authorized own-body needs and capability information,
not an unrestricted view of actual bodily impairment.
[World identity](world-identity-and-context.md) supplies stable references and revisions;
an actor knowing a relationship is separate from that relationship existing.

This module owns active intentions, commitments, their reasons, current activity
references and interruption state. Candidate lists and qualitative summaries are derived.
The execution module owns attempt progress and costs; an intention may reference
that progress but must not maintain an independently advancing work account.
A schedule is executable data with its existing authority, not a parallel planner.
[Action execution](action-execution.md) accepts `Action{actor, verb, args}` attempts.
[Composition](composition-and-processes.md) resolves physical mechanisms, never goals.
[Persistence](time-and-persistence.md) commits transitions, decisions and retry handling.
[Presentation](presentation-and-explanation.md) receives observable conduct, not private
reasons merely because those reasons are useful in a privileged causal trace.

A proposed intention identifies goal, subjective target or remembered place, reasons,
start cause, admissible next activities, completion/interruption conditions, status
and relevant revisions. Its activity reference identifies the current execution.
Time, cause and status must survive each handoff; “selected” does not mean “completed.”
Reasons reference evidence as known then, not a live query for the currently best excuse.
Completion requires committed results under an admitted condition, not persuasive prose.

### The two meanings of feasibility

Candidate construction uses authorized capability information, subjective opportunities and authorized
constraints. Execution separately validates current truth, reach and actual resources.
An unperceived injury may change execution capability without changing the option
set. Direct own-body context may bypass retained memory, not sensory authorization.
This preserves SPEC's code pruning where observed facts rule an action out without
turning option omission into an oracle for concealed facts.
For example, a remembered path can remain an option despite a hidden obstruction.
An investigation must remain possible when the thing sought is absent.
Argument handles must preserve remembered precision; they cannot smuggle live tracking
into execution by binding “last seen there” to “wherever that entity is now.”
An invalid execution result is disclosed only through feedback the actor can receive.

## Lifecycle and schedule interaction

1. A supported event supplies changed evidence, need state, schedule priority or
   execution feedback. An irrelevant tick is not itself a request for a new choice.
2. Code checks whether the current commitment remains admissible under its declared
   conditions, without consulting hidden target state as subjective evidence.
3. Where reconsideration is justified, code builds bounded available attempts plus
   none from the existing FSM, schedule, capabilities and subjective context.
4. Existing admitted policy selects: routine work remains code; applicable M2
   action choice remains Jev's distribution sampled under SPEC's existing policy.
5. The decision and reasons are logged, with slice hash, answer and draw where
   applicable. Commit validates versions before creating or changing an intention.
6. Execution admits work and returns committed progress, failure or interruption.
   Reasons can persist across several activities without a choice every frame.
7. Completion or abandonment is logged; a later retry is distinct from redelivering
   the same decision. New evidence may lead to a new intention, not retroactive success.

SPEC's schedule priority remains overrides, commitments, needs, then role.
Needs-layer hysteresis remains code-owned; a higher-level intention must not silently
erase an override or reinterpret a social promise as an unconstrained preference.
Existing primitives remain `at`, `every`, `after`, `until` and `at_location`.
A promise to meet has a fuse, not a blocking “wait for actor” dependency.
Reusing the existing missed-meeting behavior requires a subjectively authorized place;
this draft does not grant a new live locator for a person the actor cannot observe.
Mappings between persistent intention and these layers need explicit compatibility tests.

Capability loss can stop actual work immediately even before the actor understands why.
The execution safety boundary does not depend on a model electing to notice injury.
Death/incapacitation cannot leave an activity spending or acquiring resources indefinitely.
Cancellation preserves spent effort; it neither refunds costs nor debits them twice.
If a target disappears unseen, preserve the mistaken goal until eligible feedback or
an admitted expiry changes it; do not narrate the hidden reason for failed admission.
Concurrent changes may stale a decision. Reject/reconsider within a bounded policy
rather than repeatedly sampling until an answer happens to commit.

## Alternatives and provisional recommendations

**Fresh action selection every tick versus persistent event-driven commitments.**
Fresh selection reacts quickly but multiplies model cost and creates oscillation or
repeated chance opportunities without meaningful new evidence.
Commitments preserve continuity and bounded cost but need explicit interrupt conditions
to avoid ignoring urgent needs or continuing an impossible physical activity.
Provisionally prefer event-driven commitments around existing schedule/action machinery.
Admission must show both stability under irrelevant ticks and justified interruption.

**One numerical utility score versus existing layered policy with explicit reasons.**
A single score offers convenient comparisons but hides incompatible meanings in weights,
would replace admitted Jev roles, and needs behavioral calibration not supplied here.
Layered schedules and existing judgments are more constrained, but can expose conflicts
that require a deliberate adapter rather than a universal preference ranking.
Provisionally preserve the existing layers and judgments, recording reasons explicitly.
Animal policy remains a separate admission decision, not an invitation to invent weights.

**Prune by actual success versus prune by authorized attempt constraints.**
Truth-based pruning simplifies the resolver's workload but tells a searching actor
whether hidden food, a person or an unblocked path actually exists.
Attempt-based options allow mistakes and impose failure handling and cost accounting.
Provisionally choose authorized attempt constraints, with truth checked at execution.
The extra rejected/failed attempts are meaningful simulation, not bad model answers.

## Invariants, cost and degraded behavior

- Intention authorizes an attempt; it cannot create food, grant damage or bypass reach.
- Private world changes alone cannot change subjective options or the decision slice.
  Physical execution can differ; its feedback must still respect the evidence boundary.
- Actual identity relationships may matter when available to the actor; literal names,
  sex labels or fixture roles cannot select a complete behavioral outcome.
- None is always present in model-backed choice sets; no model invents a new action.
- Choice distributions, belief confidence and physical risk remain different concepts.
  Existing M2 sampling is not replaced by argmax or an invented sharpening policy.
- Replay consumes logged choices and effects without model calls or renewed sampling.

Bound work in candidate generation, memory retrieval, reconsideration, stale retries
and model slice size; bound active commitments rather than accumulating abandoned goals.
An actor must not repeatedly reconsider a declined unchanged offer to reroll acceptance;
preserve SPEC's admitted waver/refusal semantics and changed-state requirements.
No-player regions run code routines/catch-up, subject to the existing debt exception,
not speculative background minds. Coupled offscreen interactions need admitted summaries.
For an outage, preserve safe valid routine progress or use existing deterministic
fallbacks; where no supported attempt is available, none is honest.
Fallback cannot ignore dangerous capability loss, invent a successful action or add a
new animal behavior rule simply because a model is unavailable.
Numeric cooldowns, bounds and interruption thresholds need code-owned admission evidence.

## Worked wolf fixture and non-wolf counterexample

The persistent wolf remembers a possible feeding place and has an authorized need.
Provisionally admitted policy may support investigation from that remembered place,
but this document does not select that policy or assert that hunger mandates attack.
The wolf sees admitted features of a player's finite-fuel assembly, not its hidden
fuel quantity or the player's private intention. Those features may justify
reconsideration only through the admitted policy and logged evidence.
A maintained investigation incurs execution costs; injury can constrain the attempt.
Dropping the assembly changes contacts in physics, not an encounter stage in its mind.
Save/load mid-investigation preserves reasons, choice and spent effort.

Counterexample: a human worker promises to meet someone at a remembered room.
The person moves unseen; the commitment persists and the worker can miss them.
An observed urgent bodily condition can interrupt the trip under admitted rules,
while a hidden vacancy elsewhere cannot quietly become the worker's next option.
This tests schedule precedence, fallible place references and lawful interruption
without any predator/prey assumptions or a universal utility policy.

## Admission evidence and open questions

W3 pairs worlds differing only in hidden food, target movement or obstructions and
compares option sets, labels, ordering and slices before execution, not just choices.
Include a concealed bodily impairment twin: options remain equal until authorized
sensation or attempted execution supplies evidence; actual work may differ.
W4 tests irrelevant ticks, near-equal reasons, urgent interrupts and save/load continuity.
W2/W5 verify shared execution costs, failed searches and cancellation without refunds.
W0/W6 verify stale decision rejection, retry idempotence and replay without new draws.
W7 checks that visible behavior does not reveal private exact goals or reasons.
W8 measures candidate/reconsideration bounds and offscreen calls across held-out actors.
These are required future evidence, not claims that any W or C gate has passed.

Which existing routine/choice path can support the first animal fixture without expansion?
How do intention status and schedule priority share one source of truth?
Which interrupts are immediate safety constraints versus later subjective reconsideration?
How are repeated failure and stale retries bounded without hidden-state-dependent options?
Admission requires a concrete adapter map, M2 compatibility tests, explicit animal-policy
review and measured continuity/cost evidence before this draft can steer production actors.
