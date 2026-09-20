# Experimentation-first engine exploration

## Status and precedence

**Accepted product direction:** experimentation is the starting player loop for
the next engine exploration. **Accepted first learning milestone:** a player
learns a general rule and uses it creatively in an unfamiliar situation.
These decisions are recorded as Q063 in the [question register](questions.md).
They are not implemented or playtested completion.

This document also preserves the design-only research and cross-review that led
to that choice. Its alternatives, recommendations and proposed study are not
automatically accepted architecture or admitted mechanics. SPEC remains the
source of truth; the [shared contract](../shared-world-contract.md) and
[module drafts](README.md) own the corresponding boundaries.

The fan-out examined `integration/causal-world` at `14aba6a`: six research tracks
(physical structure, space/scale, time, knowledge, emergence, history) plus an
independent critic. Reports were exchanged, challenged and revised in a second
round. No engine or renderer code was changed by that research. This record was
reconciled with the subsequent shared-module decisions through `ffbbf90`.

In particular, accepted Q018 now prefers **meaningful stored structure with
compound simple geometry and explicit interfaces**, from which physical
approximations and visual representations are derived. It also selects SI units
internally. The earlier research's adaptive/coarse-first alternatives do not
supersede those decisions. Concrete geometry, precision, channels, calibration
and approximation transitions remain open.

This is a learning milestone for design research, not a replacement for M0–M5,
C0–C8 or W0–W8, nor acceptance of the entire no-story sandbox proposal. It adds no
Jev family, physics mechanism, schema, package or implementation authorization.

## Accepted player loop

> Form a hypothesis, change something, observe the consequence, and use what
> was learned elsewhere.

1. **Notice:** encounter an observable phenomenon.
2. **Hypothesize:** suggest a cause or a useful distinction.
3. **Arrange:** establish a comparison with controllable conditions.
4. **Intervene:** change a relevant contact, exposure, amount, duration or other
   supported condition.
5. **Observe and investigate:** gather evidence, including delayed consequences,
   without automatically receiving privileged physical truth.
6. **Transfer:** apply the learned relationship to an unfamiliar arrangement.

The goal is transferable understanding, not discovering authored combination
recipes or retrying until a generator produces an interesting outcome. Failure
can teach something; an unexplained reroll of properties cannot substitute for
causal depth. Variation is allowed, but its relevant causes must be stable and
investigable within the supported domain.

Experimentation is the initial emphasis, not the exclusion of survival, crafting,
trade, ownership or social testimony. Those can give discoveries lasting value
without requiring all of them in the first study.

## First milestone: learn a rule and use it creatively

**Success criterion:** a player can infer a supported general relationship from
evidence, make a useful prediction, and deliberately apply it to a different
arrangement without an object-specific recipe or an explanation that gives away
the answer.

Evidence must distinguish:

- recognizing a taught example from transferring understanding;
- a correct prediction for a reason from a lucky outcome;
- a plausible wrong hypothesis that evidence corrects from opaque failure;
- physical no-effect from ambiguous intent, missing support or pending work.

The current repository test suite, the thermal spike and a design review cannot
establish this learning result. Q060 remains **Needs measurement**. A future
study should retain the setup, available evidence, prediction made before the
action, observed outcome, player's explanation, unfamiliar application and any
confounding cue. Participant count, scoring rubric and pass threshold remain
open; no numerical success claim is made here.

### Proposed first domain, not yet selected mechanics

Heat, contact and insulation are a candidate small study: a finite source,
comparable objects, a covering and controllable contact/exposure. Compare
covered/uncovered objects, change contact, remove the source and observe retained
heat, then reuse the discovery in a different arrangement.

This is not permission to add named tool or wrapping recipes, nor a claim that
the integrated engine already supports the full setup. Required geometry,
materials, quantities, interfaces and body/observation effects must be compatible
with Q018 and the shared mechanisms. Do not silently expand this into liquids,
combustion, pressure, fracture, chemistry, ecology and seasons at once.

### Original design-only priority and subsequent bounded authorization

**Revised priority:** first review the
[common interaction contract across domains](interaction-contract.md). Do not
select the foundation or first mechanism set solely from the thermal journeys.
Q063's learning goal remains accepted; this changes the order of design work,
not the goal. Q064 tracks the open cross-domain contract.

The subsequent [solid-contact learning surface](thermal-learning.md) was selected
before the required six-probe reconciliation was documented. That process error
is not excused by implementation authorization. Corrective review must assess
the existing choices before further commitments; it cannot retrospectively
complete the original prerequisite or promote the journeys/foundation-review
companion into accepted architecture. Participant learning remains unmeasured.

The [three worked journeys](experimentation-journeys.md) now explore these
contrasting paths as preserved proposals for later validation, not the immediate
architectural basis or measured evidence:

1. A correct hypothesis supported by a controlled comparison.
2. A plausible wrong hypothesis distinguished from the actual cause by evidence.
3. A transfer problem applying the discovery to an unfamiliar arrangement.

They use warm/cold solid comparisons to examine a covering's effect on thermal
exchange, challenge the idea that it creates heat, and test transfer to keeping
a cold object cool. Apparatus, measurement and calibration still need decisions;
no thermal mechanism or fixture-specific outcome is admitted by the draft.

For each, identify the player's choice, existing physical structure, actor
knowledge, supported mechanism, persistent changes, available evidence and any
unsupported dependency. Include a counterexample with equal aggregate totals
but different internal structure. Ask whether the representation can distinguish
the responses the game promises, and whether the distinction changes a useful
player choice.

Keep the existing renderer as a visualization/interaction harness. Major
renderer architecture and art-direction commitments in this exploration wait
for clearer engine needs. Compatibility fixes and necessary diagnostic visibility
are distinct from committing to a final renderer.

## Research synthesis: alternatives, not a parallel specification

| Track | Alternatives explored | Revised research direction / tradeoff | Owning discussion |
| --- | --- | --- | --- |
| Physical structure | Flat objects; fully explicit structure; adaptive representations | General material/part/contact relationships rather than named recipes. Do not claim coarse state is sufficient just because it conserves totals. Current accepted stored-structure approach takes precedence. | [Composition](composition-and-processes.md), Q017–Q022 |
| Space and scale | Grid; continuous geometry; topology; hierarchical hybrid | Canonical placement/containment and boundaries, with local metric information where mechanisms need it. Neither renderer tiles nor independently editable duplicate graphs define truth. Geometry cost and useful precision remain choices. | [Identity/context](world-identity-and-context.md), Q013/Q018 |
| Time and execution | Global ticks; pure discrete events; action time; hybrid | Ordered commits plus bounded local evolution. Real action order can matter; storage order should not. Shared prescribed weather is not the same coupling as a finite shared resource or feedback field. Player pacing is a separate choice. | [Execution](action-execution.md), [time](time-and-persistence.md), Q045/Q049–Q055 |
| Knowledge and uncertainty | Eager generation; inspection-triggered creation; persistent causal unknowns | Settle needed causes before dependent outcomes, not merely on observation. Stable samples alone do not ensure correlated or conditionally consistent refinement. Evidence and belief remain distinct from truth. | [Knowledge](knowledge-and-memory.md), [perception](perception-and-evidence.md), Q029–Q037 |
| Emergence and generation | Fixed content; bounded runtime content; staged mechanics admission; runtime invention of laws | Seek novel combinations and calibrated variation within admitted mechanics. New capabilities need separate admission. Finite preset profiles versus bounded continuous variation remains a calibration/learnability question, not approval of arbitrary generated constants. | [Composition](composition-and-processes.md), [identity/context](world-identity-and-context.md), Q018/Q021/Q061/Q062 |
| History and replay | Snapshots; all effects forever; solver traces; semantic history/checkpoints | Preserve committed facts, references and useful causal accounts, not imagined microscopic histories. Bounded hot memory does not bound a growing archive. Exact playback, reconstruction, explanation and counterfactuals have different requirements. | [Time/persistence](time-and-persistence.md), [presentation](presentation-and-explanation.md), Q053/Q058 |

### Changes caused by cross-review

- **Refinement is not retrospective authorship.** Equal mass and heat can hide
  different contact paths, gradients and threshold events. Physical approximations
  need tested response/threshold limits; later detail cannot change prior effects.
  A validity envelope is bounded evidence, not proof for arbitrary compositions.
- **One authority per fact.** Material portions own quantities; groups do not add
  mass. Placement/containment and typed interfaces must agree across physical,
  inventory and observation queries. A consumed ID survives as lineage, not a
  second live stock; genuine remainders remain live.
- **Generic is not unsupported.** A generic result is unnamed or coarse matter
  produced by a supported mechanism. Absence of a mechanism cannot justify
  inventing even a generic physical outcome, or claiming physical no-effect.
- **Numeric uncertainty is not a world trait.** A solver unable to classify a
  threshold has unresolved work, not permission to sample a hidden ignition fact.
  Dependent outcomes cannot assume a result that has not been established.
- **Social facts are causal too.** Origin, ownership, promises and witnessing
  cannot arrive late as harmless flavour if they would alter prior duties,
  evidence or trust. A new report may be a claim made now, not a rewritten past.
- **History has explicit limits.** State reconstruction, causal explanation,
  exact audiovisual playback and counterfactual re-simulation are separate
  promises. Compaction cannot both discard detail and guarantee every future
  historical question. No new lossy retention policy is selected here.
- **Complexity must earn its place.** The critic challenged a supposedly small
  slice combining tools, liquids, fracture, containers, witnesses and seasons.
  A coherent bounded study is preferable to calling a platform schema a milestone.

### Remaining disagreement and scope choices

The main research tension is general-foundation-first versus a narrowly bounded
interaction-family study. The recommended compromise is general concepts with
narrow, explicit claims and tests on unfamiliar combinations. This is not a
fixed inventory of prefab items or a promise of universal physical simulation.

The primary player loop is now decided: experimentation. Still open are the
exact first mechanism set, the qualitative/numerical observation instruments,
material variation and cue design, pacing, study protocol and resource budgets.
Action-driven single-player time was suggested as a research baseline; it does
not replace the accepted shared runtime or decide the eventual multiplayer clock.
Broad combinatorial freedom versus deeper fidelity over a smaller domain remains
a product tradeoff, not something solver architecture can decide alone.

The earlier stress cases (heated coated tool, closed unknown container, seasonal
region) remain useful adversarial questions, not requirements to implement all
their mechanisms in the first milestone.

## Evidence boundary

The [integration report](../integration-status.md) and
[C0 report](../c0-exposure.md) describe the existing narrow verified baseline.
The [composition spike](../../spikes/composition/README.md) is isolated numerical
evidence, not a production parts engine or a player-learning result.
The [PoC report](../poc-report.md#is-the-inn-fun) motivates testing meaningful
choices and learning rather than equating inhabited simulation with a good game.

No new gameplay, engine, renderer or learning-study result is claimed by this
document. Repository documentation is updated; the external Claude Doc remains
unsynchronized.
