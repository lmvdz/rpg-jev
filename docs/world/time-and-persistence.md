# Time and persistence: advancing one committed world

## Status and scope

This is a subordinate draft, not evidence of integrated runtime support.
The [shared world contract](../shared-world-contract.md) defines the W gates.
SPEC §§2, 7, 13 and 21–22 govern clocks, schedules, archives and replay.
This module coordinates admitted processes and preserves their committed history.
It does not promise a simulated ecosystem, general animal society or arbitrary precision.
It adds neither a Jev family nor numerical integration or biological formulas.
Unobserved evolution remains code, with only the constitutional debt exception for Jev.

## The problem to solve

Observation must not create a second physical world with different ownership rules.
Yet stepping every organism every minute would be unbounded and mostly unobservable.
Schedules already offer direct evaluation for routine location, while material processes
need interval evolution and settlement of end events. Neither replaces the other.
The coordinator must know what may be evaluated directly, what must advance, and what
cannot yet be represented. “Offscreen” is not a license to invent a plausible outcome.
The initial proof is a bounded participant/process fixture, not emergent population ecology.

## Authority and rebuildable views

The event log is the save; committed effects, decisions and logged RNG draws are authority.
World identity, mechanics/definition versions and a monotonic committed frontier accompany it.
Time/persistence owns the clock and version manifest; world context holds references to them.
Active activities, unresolved commitments and physical reservoirs are persistent state.
Stored intentions or memories retain their own provenance; time does not re-infer them.
An acceleration checkpoint is valid only against a verified log prefix and version manifest.
Hot rows, due-event indexes, schedule caches and render digests are reconstructible views.
Evicting a cache must not delete a debt, a persistent unknown or a historical cause.
The [identity](world-identity-and-context.md) module owns stable references;
this module preserves them across snapshots, archival and refinement.
Only one code commit authority writes effects, regardless of who requested advancement.

## Advancement interface and lifecycle

The following are proposed responsibilities, not new public runtime APIs.

1. `requestAdvance(targetTime, scope)` records the desired frontier and dependencies.
   Scope is an execution bound, not permission to ignore cross-boundary sources.
2. `collectBoundaries(frontier, targetTime)` gathers scheduled changes, activity ends,
   expiries, physical transitions and due obligations from bounded indexes.
3. `advanceInterval(start, end)` advances admitted active mechanisms to the next boundary.
   Processes consume finite sources using the shared atomic budget rules.
4. `settleBoundary(time)` commits end events after their active interval is integrated.
   Stable ordering and tie semantics must be part of the pinned mechanics contract.
5. `publishFrontier(time)` exposes only a state whose required dependencies are settled.
6. `checkpoint(prefix)` optionally materializes a replay accelerator and verifies it.

An observer entering during catch-up sees a consistent committed frontier, not a mixture
of future body state and past inventory. The remaining interval stays explicit pending work.
The coordinator must define a bounded interaction response if the desired frontier is not ready.
It may defer a dependent interaction rather than claim that a partially advanced world is current.
This is code work, never waiting on generated prose or asking Jev to summarize missing physics.

## Different kinds of time work

**Schedules:** preserve the override, commitment, needs and role priority order.
Use the admitted primitives `at`, `every`, `after`, `until` and `at_location`.
Do not add “wait for actor”; a meeting is a commitment with a fuse.
Pure schedule lookup can determine routine location where the existing contract permits it.
An injured body or blocked route must not be erased by treating routine lookup as teleportation.
The boundary between routine location evaluation and embodied travel needs explicit resolution.

**Active processes:** fuel, heat and contacts evolve under admitted code mechanisms.
Integrate the active interval before extinguishing a source at its end.
Body consequences are settled from actual exposures, not an offscreen scene description.

**Information:** rumor transfers and memory changes remain structured committed events.
No prose is produced for NPC-to-NPC conversations with no player present.
Knowing that time passed does not let an actor learn events it neither witnessed nor heard.

**Debts:** due obligations may trigger the SPEC exception for an unobserved judgment.
That exception does not authorize background action-choice calls for every unseen actor.
Record any admitted answer and world RNG draw so replay never invokes Jev.

## Catch-up and summary limits

A catch-up summary is a compact account of work actually performed under declared mechanisms.
It identifies interval, scope, mechanics version, settled events and deferred dependencies.
It cannot manufacture births, hunts, migrations or relationship changes for narrative plausibility.
Aggregate accounting requires conservation of all admitted tracked reservoirs and causes.
An approximation must advertise its supported domain and error contract before use.
“Same final state for any partition” is not a general guarantee: event thresholds, interaction
ordering and approximate integration can differ unless the mechanism proves otherwise.
Tests should demand exact committed replay and declared equivalence for named scenarios.
Numerical tolerances belong to code-owned mechanics, not prose in this coordination draft.
Where no summary operator is admitted, execute bounded detailed work or defer explicitly.

### Freeze, overload and resumption

Preserve SPEC section 11's load-shedding order: freeze unobserved regions first,
then skip optional questions, then use cached routines and deterministic parsing.
With nobody online, execution freezes and the elapsed gap is reconciled in code at
next login; this is not permission to reseed bodies or skip finite fuel expenditure.

Overload freezing still needs an explicit clock contract: does it accrue deferred
simulation time or pause a region's effective time, and how are cross-region debts
and player entry reconciled? This draft does not decide that by using the word
"pending." Admission requires an absence → overload → return trace for fuel,
reserves, commitments and entry, including a dependency that cannot yet advance.
Unrelated play needs a measured safe path; pending work alone does not establish
SPEC's promise that the play loop never fails.

## Persistence and recovery

Log each Jev request basis, questions, full answer, draw and committed effects.
Maintain one seeded world RNG, advanced only by logged draws; no per-region hidden stream.
Replay applies committed effects and does not resample choices or recompute historical physics.
Pin mechanics, definitions and model versions; upgrading any of them is an explicit migration.
Refinement preserves established resources, damage and history and is logged idempotently.
Checkpoint acceptance verifies sequence continuity and hashes before trusting materialized state.
An incomplete final transaction must not appear as half an interval or half a transfer.
Recovery resumes from the last valid committed frontier with pending work still identifiable.
External requests use stable identities so replay/retry cannot duplicate an interval.

SPEC §13's archive-first protocol remains authoritative: confirm archival before hot deletion.
Open rows remain hot; recent closed history follows the existing retention policy.
Cause references remain resolvable after migration from hot rows to archive.
Archive unavailability may degrade historical inspection, but cannot justify deleting evidence.
An archive is not a lossy narrative digest; a readable summary cannot replace replay data.
Retention optimizations must prove that no live reference or audit chain is orphaned.

## Alternatives and provisional recommendation

**Uniform tiny ticks:** easy local reasoning, unacceptable unbounded offscreen work.
**Direct final-state formulas everywhere:** fast, but erase intervening interruptions and contacts.
**Narrative summaries:** cheap and expressive, but violate code authority and reproducibility.
**Event-bounded advancement with admitted shortcuts:** keeps explicit boundaries and permits
schedule lookup or tested summaries where their assumptions actually hold.
Provisionally choose the last approach for a small dependency-closed fixture.
Use detailed advancement as the reference for each proposed shortcut, not as a promise
that every future mechanism has an exact cheap aggregate representation.
Do not silently change mechanics resolution because a region becomes unobserved.

## Invariants, budgets and fallback

- Committed time never regresses within a world history.
- No published state mixes incompatible dependency frontiers.
- Boundary settlement cannot consume a source already spent by another process.
- Save/load cannot alter an established unknown, physical outcome or subjective belief.
- A retry or repeated checkpoint load cannot apply an interval twice.
- Offscreen work cannot create knowledge without an admitted evidence transfer.
- Refinement and archival preserve referential identity and causal reachability.

Bound per-transaction events, dependencies and archive batches; yield at valid boundaries.
Detect zero-time cycles rather than iterating indefinitely through mutually triggered events.
Overflow must remain pending with telemetry, not be dropped or declared fully caught up.
A deterministic fallback may advance only supported independent work; it must not let actors
interact across unresolved dependencies. Exact UX and latency budgets need measurement.
Jev failure follows existing degradation rules; it cannot stall the whole world clock.

## Worked fixtures

**Wolf:** a wolf withdraws from a finite-fuel assembly and the player leaves the area.
Catch-up continues admitted fuel and body processes, preserves injury and pending activity,
and does not narrate a successful hunt merely to resolve hunger before the player returns.
Arrival during catch-up joins the committed frontier; the wolf is not freshly reseeded.
Save/load halfway through withdrawal yields the same logged outcomes without new draws.

**Non-wolf:** a mill worker has a dusk meeting while a finite heat source cools.
The meeting fuse expires in code if its conditions are unmet; no indefinite wait is added.
The heat interval settles before its relevant end event, and the resulting material state persists.
A later witness can learn about the missed meeting only through eligible evidence.
This proves bounded commitments and processes, not a general offscreen economy.

## Acceptance matrix

These tests target parent W gates and do not replace physical C0–C8 evidence.

| Gate concern | Fixture and assertion |
| --- | --- |
| W0, W1, W6 | Save after refinement; stable body and assembly references survive. |
| W2, W6 | Offscreen injury/exposure cannot reset at observation. |
| W2, W4 | Meeting expiry and interrupted progress each settle once. |
| W5 | Competing processes at one boundary share one finite budget. |
| W0, W6 | Cold replay uses no model calls or fresh RNG; equals committed log state. |
| W6 | Whole/split exposure and catch-up meet declared tolerances on admitted fixtures. |
| W8 | Long absence yields explicit pending work, never invented ecosystem events. |
| W7 | Archived causes remain addressable under authorized inspection. |

## Unresolved decisions and required evidence

Define boundary ordering, simultaneous events and frontier publication with race fixtures.
Resolve embodied travel versus schedule location lookup without silently rewriting SPEC §7.
Choose checkpoint format and prove crash recovery at every log/archive acknowledgement boundary.
Include outcome commit → pending evidence → detection → learning crash boundaries;
retain original detection conditions and prevent duplicate draws or observations.
Resolve overload freeze/resume semantics against SPEC section 11 before admission.
Profile long-absence work and zero-time cycles before assigning operational limits.
Validate each summary separately against named detailed fixtures and declared tolerances.
Keep all W gates open until integrated observed/offscreen/replay evidence exists.
