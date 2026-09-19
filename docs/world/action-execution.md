# Action execution: attempts against shared reality

## Status and scope

This is a subordinate draft design, not a claim of runtime support.
The [shared world contract](../shared-world-contract.md) owns cross-module
boundaries and W acceptance gates; SPEC §§2, 5–7, 13–14 and 21–22 remain binding.
This module turns structured attempts into validated, causally attributable effects.
Players and NPCs use the same action structure and the same settlement authority.
It does not implement full combat, an animal policy, a planner or new physics.
No new Jev family, utility formula or runtime-authored mechanic is admitted here.

## Why this boundary matters

An intention is neither evidence of success nor permission to alter a resource.
A wolf may pursue prey it can no longer see; a person may pull a locked door.
Disallowing those candidates using secret truth would give actors omniscience.
Allowing their intended results to commit would instead give them wish fulfillment.
The boundary must therefore distinguish candidate admissibility from execution.
Code excludes impossible verbs and actions contradicted by the actor's evidence.
It does not reveal concealed obstacles merely to make a candidate list convenient.
At execution, authoritative reality determines what contact, transfer or failure occurs.
The actor learns only the resulting evidence its perceptual channels can receive.

## Authority and derived state

Authoritative inputs are actor identity, committed body and inventory state,
physical contacts, resource ownership, world time, versions and prior causes.
An accepted attempt also needs a stable identity and ordering position.
Its recorded status and already-settled costs survive retries and interrupted play.
Candidate lists, reachable-target indexes and predicted outcomes are derived caches.
They may expire without erasing an attempt or refunding a committed consequence.
Candidate caches carry the actor-view revision; truth validation carries world revisions.
Neither cache becomes a second writable copy of body or material state.
Only the common code commit boundary can apply the closed effect vocabulary.
Resolvers return proposed effects, dependencies and diagnostics, not direct writes.

## Interfaces and lifecycle

Proposed interface names below describe contracts, not existing exported APIs.

1. `buildCandidates(actorView, intent)` produces bounded structured attempts.
   Its inputs come from [perception](perception-and-evidence.md) and
   [knowledge](knowledge-and-memory.md), not an unrestricted world snapshot.
2. `selectAttempt(candidates, decision)` accepts deterministic player parsing or
   an admitted action-choice result; a code-generated set always includes none.
   Existing Jev sampling policy applies, using only logged world RNG draws.
3. `admitAttempt(action, basis)` resolves references and checks execution authority.
   It distinguishes malformed requests, stale references and valid but unsuccessful attempts.
4. `resolveAttempt(attempt, truth)` consults
   [embodiment](embodiment.md) and [composition](composition-and-processes.md).
   It computes physical consequences and resource debits through admitted mechanics.
5. `commitAttempt(resolution)` atomically validates read dependencies and effects.
   It records action, decision linkage, draws, costs, outcomes, evidence sources and cause IDs.
6. `emitEvidence(committedOutcome)` exposes only eligible observations.
   [Presentation](presentation-and-explanation.md) renders those observations.

For an interval action, admission starts a persistent activity rather than precommitting
its eventual success. Time advancement settles progress at declared boundaries.
Interruption ends future progress but does not undo fuel, travel or fatigue already spent.
[Intention](motivation-and-intention.md) decides whether to continue or choose again;
execution reports the committed interruption, not a replacement motivation.
Speech uses the existing structured protocol and code-owned conversation scheduler.
An overheard committed exchange must not be lost because a cosmetic remark queue expires.

## Truth checks without an information oracle

Validation has two audiences: internal settlement and actor-visible feedback.
An internal failure may name a hidden obstruction; the actor-facing record may not.
“Your hand meets resistance” requires observable contact; “a concealed lock stops you”
requires evidence identifying the lock. A generic failure is not permission to invent cues.
Preflight must not answer hidden predicates before the actor incurs the relevant attempt.
Identical visible situations should offer identical subjective choices, even if outcomes differ.
The known-feasibility rule from SPEC §5 still prunes choices contradicted by observed facts.
This distinction is not license to offer nonsense actions or bypass capability validation.
Access permissions and illegal references fail before physical execution.

## Concurrency, uncertainty and edge cases

Two actors taking the same item cannot both receive it: settlement validates ownership.
For shared reservoirs, resolve the competing debits atomically under the physical budget rule.
A stale proposal cannot quietly target a different entity with a matching display name.
Destroyed or refined targets retain identity/history links; substitution requires explicit policy.
Persistent unknowns are realized once and recorded, not rerolled when an attempt retries.
Action variation samples admitted causal inputs once, not independent outcome dice for
each correlated consequence. A slipping grip and its resulting contact share that cause.
Code owns all quantities; Jev probabilities are neither damage nor effort magnitudes.
If validation loses a race after a draw, record the draw and rejected resolution.
Do not rewind RNG or hide retries; the exact draw-before-validation order needs a gate test.
Duplicate delivery returns the existing attempt result rather than paying or rewarding twice.
Cancellation after settlement is a new attempt, not deletion from history.
An actor incapacitated during windup cannot complete by relying on admission-time capability.

## Alternatives and provisional recommendation

**Resolve from intent directly:** simple, but conflates wishing with causal ability.
Reject it because conservation and hidden-state isolation become per-verb exceptions.
**Truth-prune every candidate:** cheap execution, but reveals concealed world facts.
Reject it except for access control and constraints already available in the actor view.
**Reserve all resources at admission:** predictable completion, but long actions can
monopolize scarce resources and create refund semantics for every interruption.
**Settle bounded progress at boundaries:** more bookkeeping, but preserves actual costs.
Provisionally prefer boundary settlement with short atomic validation windows.
Any reservation needed for exclusivity must be explicit, versioned and released by code.
Start with one bounded activity per supported fixture actor rather than a general planner.
Whether concurrent speech and physical work share an activity slot remains a design decision;
the current conversation scheduler's supported behavior must not regress.

## Invariants, bounds and fallback

- No body, inventory, material or location mutation bypasses the common effect commit.
- Success never exceeds authoritative capability or a finite source budget.
- Costs reflect committed progress, not narration or a sampled preference.
- Retrying an attempt cannot duplicate transfers, draws or learned observations.
- Hidden truth may change outcomes but not leak through candidate or error payloads.
- Mechanism dispatch depends on properties and relations, never character names.
- Every accepted transition retains an action ID and causal predecessor.

Candidate enumeration, contact traversal and interval work require declared code budgets.
Overflow must return a bounded unsupported/deferred result, not fabricate a success.
The exact limits require profiling; this draft does not bless silent truncation by name order.
Jev outage uses the existing deterministic matcher and admitted fallback behavior.
No player action waits on a generative model, and unsupported intent can ask a scoped question.
Resolver errors commit no partial resource transfer; diagnostics stay outside player evidence.
Physical approximation must use a separately admitted mechanism, not an improvised shortcut.

## Worked fixtures

**Wolf:** a hungry wolf sees an apparently available carried object and chooses an approach.
Its candidate slice includes observed heat cues, not the assembly's hidden fuel quantity.
An attempt to bite encounters the actual exposed part under the shared contact mechanism.
Fuel depletion, body exposure and admitted withdrawal costs settle in code.
Pain is evidence only if a pain mechanism is admitted; exposure alone cannot certify it.
The next choice may change because of evidence, not because execution rewrote its goal.
The fixture does not assert a species policy or guarantee aggression.

**Non-wolf:** a worker pulls a bucket whose handle has unseen damage.
The candidate is reasonable from the worker's knowledge; actual grip and structure govern it.
If the handle fails, spilled contents and lost progress persist and observers receive cues.
A second worker cannot collect the same contents from the original bucket simultaneously.
Replacing both display names must leave settlement unchanged.

## Acceptance matrix

Gate labels refer to the parent contract; these are proposed tests, not passing claims.

| Gate concern | Fixture and assertion |
| --- | --- |
| W0, W2, W6 | Retry after target refinement; preserve identity, injuries and costs. |
| W3 | Hidden lock/fuel changes outcome but not the pre-attempt candidate slice. |
| W2, W4 | Interrupt an interval attempt; settle only progress already made. |
| W5 | Player, wolf and worker contend for one source; no double debit or gain. |
| W0, W6 | Replay interrupted and rejected attempts without Jev or new RNG draws. |
| W7 | Failure feedback cannot name an unobserved cause. |
| W8 | Rename actors, vary capabilities and exhaust candidate budgets without fabricated outcomes. |

Physical budget and zero-exposure assertions also remain subject to C0–C8.

## Decisions still requiring evidence

Before implementation, settle atomic attempt boundaries and draw ordering with race fixtures.
Choose supported interval actions and define interruption points using existing mechanics.
Prove that hidden-state twins yield identical pre-action actor-facing payloads.
Measure candidate and contact fan-out before assigning explicit limits.
Specify which failures consume time or effort in code; this draft supplies no formula.
Require offline replay and a rendered cross-module fixture before closing any W gate.
