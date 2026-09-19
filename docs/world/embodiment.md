# Embodiment

## Status and question

Draft module design under the [shared contract](../shared-world-contract.md).
SPEC and the existing physical contract take precedence. No new physiology,
damage formula, animal policy or numeric calibration is implemented by this file.

**How does a creature's physical condition constrain what it can sense, attempt
and sustain?** A hunger label that merely biases a choice is insufficient, but a
complete biological simulation is unnecessary. Model the causal links that make
care, effort, injury and survival meaningful.

## Ownership and interfaces

| State | Owner / interpretation | Boundary |
| --- | --- | --- |
| Body material, heat and physical damage | Composition's portions and processes | Embodiment references them, never copies their budgets |
| Physiological reserves and development | Admitted embodiment state | Changes require code-owned processes and resource accounts |
| Hunger, fatigue and discomfort indicators | Derived or explicitly stateful physiological signals | Must declare mapping, lag and authoritative inputs |
| Capabilities | Derived from organism definition, condition and context | No separate mutable list that can disagree with the body |
| Intention and emotional appraisal | Motivation module | Does not directly heal, feed or incapacitate the body |

The physiological/physical boundary needs explicit accounts. If a bodily reserve
is represented as material energy, it is not also independent spendable energy
in a metabolism counter. A coarse abstraction may use a calibrated budget without
chemical detail, but must declare what it conserves and what it does not model.

Inputs are committed intake, exposure, exertion and elapsed-time intervals.
Outputs are proposed reserve changes, developmental/condition events, capabilities
and eligible internal sensory signals. Pain or hunger information reaches the
agent through an admitted own-body channel; other observers do not get it for free.

Actual capability and actor-authorized capability information are different views.
An undetected impairment can prevent execution without preemptively changing a
subjective candidate list. Direct interoceptive context need not be retained as
memory, but still requires an admitted sensory/authorization path; it is not raw
access to every body quantity or diagnosis.

## Organism construction

An organism definition composes supported anatomy/functions and calibrations.
Sex, developmental stage and reproductive condition are separate state dimensions.
Only admitted mechanisms connect them to demands or capabilities. Social care
relationships live in world context; perceived obligations live in the mind.

Do not require every organism to have a human hand, human diet or social need.
Manipulation may be unavailable or supported by another structure. Feeding
eligibility depends on admitted intake/digestion mechanisms, not "is an NPC."
A species label identifies a definition; it is not a switch selecting an encounter.

Initialization validates reserves, body condition and any summary of prior
activity together. Migration preserves an injured creature's condition instead
of rebuilding a healthy default body from the latest definition.

## Lifecycle: ingestion is not nourishment by decree

1. Action execution validates access and consumes/transfers an actual food portion.
2. Embodiment admits intake consistent with organism capability and capacity.
3. Immediate or delayed processing follows the declared coarse digestion model;
   failed assimilation cannot grant the full successful nourishment.
4. Reserves and waste/external accounts change exactly once.
5. Derived needs and capabilities update; relevant events can interrupt intentions.

An initial model may collapse processing to an instantaneous calibrated conversion.
It must say so, debit the intake, and avoid claiming digestive delay or toxicity
it cannot represent. Later refinement cannot digest the same meal again.

Activity similarly incurs costs through admitted execution progress. A rejected
action does not automatically cost a whole action's effort; an interrupted run
cannot refund already completed exertion. Basal maintenance and activity cannot
both charge the same modeled work.

## Injury, exposure and recovery

Distinguish exposure, tissue/material change, functional limitation, subjective
sensation and outward evidence. Heat reaching a limb alone establishes none of
the later mappings until calibrated mechanisms exist. Pain is not damage, and
an absence of visible wounds is not proof of full function.

Recovery consumes time and any admitted supplies. Rest may restore one reserve
without restoring damaged structure. Treatments are physical attempts with
mechanisms, not a universal "heal" reset. Sleep, incapacity and death interrupt
activities while preserving body material and causal history.

An irreversible condition must not reverse because an aggregate need value
crosses a threshold or the creature unloads. Detailed death/recovery boundaries
are open policy/calibration work, not improvised rules in a wolf fixture.

## Alternatives and tradeoffs

**Independent need meters versus reserves with derived signals.**
Independent meters are easy to tune but can let an actor feel fed while having
no accounted intake, or charge hunger twice. Recommend authoritative reserves and
explicit signal mappings where modeled. Permit stateful lag only with a declared
update rule; do not force every emotional or physiological signal into one reserve.

**Universal HP versus functional body state.**
HP is cheap and fits the current combat stub but hides partial impairment.
Recommend incremental functional constraints linked to admitted damage mechanisms.
Keep the stub versioned until replacement exists; do not reinterpret historical
HP as precise limb injury. Fine anatomy is justified only by supported interactions.

**Species-specific code versus composed capabilities.**
Per-species branches are quick but multiply recipes and make unfamiliar creatures
inconsistent. Recommend code-defined functions with definition-selected parameters
and topology. Some functions genuinely differ; sharing a vocabulary must not force
a plant, wolf and person through identical metabolism or locomotion.

## Costs and fallback

Bound evaluated body parts, active physiological processes and event work per
advance. Inactive functions need not be recomputed each frame. Cached capabilities
carry body/context revision dependencies and cannot survive relevant damage.

An unavailable model returns a supported coarse capability or explicit unsupported
result, never a guessed injury. Offscreen summaries preserve reserve bounds and
important transitions; they cannot allow negative reserves followed by arbitrary
retroactive survival. Time/persistence owns deferred advancement.

## Worked cases and counterfactuals

**Wolf:** increased exertion spends a declared reserve; an admitted limb impairment
reduces the corresponding locomotion capability. Nursing may increase demand only
under an admitted physiological mechanism. Parenthood alone grants no metabolic
modifier, and hunger alone does not force attack.

**Non-wolf:** a person holding a hot pot and a wolf touching a hot surface share
physical heat transfer but may have different admitted sensation/damage mappings.
Changing display names leaves those calculations unchanged. A mechanical carrier
has no hunger merely because it can move and carry objects.

## Evidence and unresolved decisions

| Gate | Required evidence |
| --- | --- |
| W1/W2 | Coherent initialization, finite intake, single-spend nourishment, activity/interruption costs |
| C7/W2 | Controlled exposure affects the declared body capability only through admitted mappings |
| W3/W7 | Own-body signals and public cues stay distinct; hidden impairment twins have identical subjective options until admitted sensation/attempt feedback |
| W5/W6 | Equivalent player/NPC exertion, save/load during processing, offscreen reserve/event consistency |
| W8 | Held-out organism topology and missing-capability cases without name-based exceptions |

Before implementation choose the first physiological budgets, anatomy resolution,
intake conversion boundary, impairment semantics and minimum internal senses.
Publish calibration assumptions and directional tests before tuning fixtures.
Later biology must integrate with these accounts, not layer unrelated meters
over them until an animal merely looks convincing.
