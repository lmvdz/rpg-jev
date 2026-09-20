# World identity and context

## Status and question

Draft module design under the [shared contract](../shared-world-contract.md).
Recommendations below need schema review and evidence before becoming runtime
behavior. SPEC sections 2, 4, 13 and 22 take precedence.

**What makes this the same creature, object or place tomorrow, after movement,
splitting, death, refinement or unloading?** Without an answer, every other
module can be locally plausible while disagreeing about what actually exists.
This module establishes references and context; it is not an all-knowing mind.

## Accepted decision: accounted population entry

Use rule-driven population entry, persistent individuals afterward, and
event-driven activation. Ordinary creature spawning draws from an accounted
regional population source, which may initially be coarse. Suitable habitat or
player proximity alone does not refill an established source.
This replaces the proposal to establish every creature at region generation;
it does not require individually simulating the unrepresented regional population.

**Revised source model (Q009):** each genuinely new region may establish fresh,
seeded population sources, including further populations of an existing species.
There is no world-wide finite founding-stock requirement. An expanding world may
therefore offer an unlimited series of new regional population opportunities,
not unlimited retries or replacements within a region already initialized.
Suitable regions may still yield no population under admitted generation rules.

Initialization records a stable region/opportunity identity, seed basis,
generation/settings revision, source quantities and coherent group/individual
construction. It uses declared initialization accounts for bodies and supplies,
not an unrecorded transfer from a fictional neighboring population. Once committed,
that source follows the ordinary simulation rules. Retries, player arrival order,
unloading and relabeling a depleted area cannot initialize it again.

Existing observations, relationships, traces and cross-region events constrain
later generation. A newly detailed area cannot fabricate a history contradicting
established facts. Exact spatial initialization boundaries and the time basis of
initial history/catch-up remain design work; fresh generation is not permission
to ignore causal commitments at the edge of the known world.

Keep three operations distinct:

| Operation | Required meaning |
| --- | --- |
| Initial population | Establish regional source state and any initial individuals under a pinned initialization account |
| New arrival or birth | Introduce an individual through an admitted source/transition with a recorded origin |
| Activation | Resume an existing individual's execution; no new identity or population allocation |

Materializing an individual transfers its allocation from the unrepresented
regional source into the explicit population atomically. Dormant explicit
individuals still count: unloading cannot return their allocation and also keep
them alive. Migration of an established creature moves the same identity and
regional accounting, not a new copy. Source exhaustion prevents further entry
until an admitted replenishment event changes it.

Reproduction or immigration can change population through their own admitted
transitions. Birth does not require pretending the offspring already existed in
the source, but must update the account and satisfy its reproductive/body rules.
Deaths, departures and births are not generic immediate respawn refunds. Spawn
capacity, living population and physical material/energy are distinct accounts:
available capacity does not create an animal's body or undo a killed one's corpse.
Coarse-to-explicit materialization must use declared boundary/initialization
accounts and conserve whatever resources the chosen representation tracks.

Eligibility may read supported habitat, shelter, food, conditions, group and
territory constraints, recent events and placement evidence. These are candidate
inputs, not a claim that the complete ecological model exists. Code owns the
rules, counts, timing, probability and draws. Group construction validates its
members and relationships together rather than multiplying an individual budget.

Player proximity can prioritize evaluation, but does not reset its history.
Persist opportunity identity, due state and resolved draws/results. Retries,
extra players and boundary crossings cannot create additional independent trials
for the same opportunity. Re-evaluation requires admitted elapsed opportunity
or changed conditions; its exact rates and cooldown semantics remain undecided.

Placement must respect already established observations. A new arrival cannot
be given an invented history of occupying continuously watched empty ground.
Unattributed evidence can constrain later construction; it does not justify
arbitrarily selecting a maker inconsistent with committed facts.

After creation, leaving the active area preserves the individual's body,
relationships, memories and history. Retirement and archival need explicit
lifecycle rules; distance alone does not erase the individual. These decisions
define the contract, not an implemented spawn system or a measured population cap.

## Accepted decision: local extinction and causal recovery

Local depletion can become local extinction. If a regional population has no
survivors or unrepresented stock and no reachable source of new individuals,
it remains absent indefinitely until an admitted process changes that situation.
Elapsed time, suitable habitat, available capacity or a player returning cannot
recreate it. There is no hidden population floor or guaranteed replacement timer.

Extinction is an authoritative population condition, not "nothing is currently
visible." Count explicit active and dormant individuals and the coarse regional
source consistently. A player's unsuccessful search or belief in extinction does
not erase undiscovered survivors. Conversely, an exhausted source cannot be
reinitialized as unexplored stock to avoid a committed extinction.

Recovery needs a source and conditions permitting establishment. Migration
transfers individuals or accounted population from a real source; repeated
arrivals can deplete that source too. Reproduction needs surviving eligible
reproductive sources and its admitted lifecycle; empty habitat cannot reproduce.
Reopening a route enables migration only if a reachable source actually exists.
Player reintroduction transfers existing individuals rather than spawning free
replacements. None of these opportunities guarantees successful establishment.

Habitat restoration can improve eligibility but does not itself supply creatures.
Exact source boundaries, migration eligibility, reproductive conditions and
recovery times remain admission work; no food-web or population solver is claimed.
Fresh generation elsewhere may create a future migration source. It does not
immediately refill this region: any arrival still needs a real transfer and valid
route. Specific refuge designs and administrator-reset policy remain separate
decisions, not invisible exceptions to established-region accounting.

## Revised decision: extinction has an explicit scope

**Supersedes the earlier Q005 promise** that both rare and widespread species must
be capable of permanent extinction across all possible future geography. The user
chose continued seeded population generation in new regions instead. The finite
founding-range proposal was not accepted. This is a rules change, not a claim that
the two promises were compatible.

For a species or variant still eligible for open-ended regional generation,
exhausting all established sources does not establish extinction across all future
regions. A later, separately initialized population is permitted; the old losses
are not undone. Rarity changes generation eligibility, not the meaning of scope.

Local extinction remains real. Specific individuals and fully ended families,
lineages or communities are not regenerated by discovering a similar population.
Settlement, faction and biological identity are distinct: a new goblin community
is not automatically the destroyed clan. Continuing a specific identity requires
valid surviving links and committed history, not just reusing its display name.

An extinction assertion must identify its scope and account for active/dormant
individuals, coarse sources and admitted viable reproductive stages. Unseen and
unresolved are not zero. Closed-scope extinction cannot be reported as world-wide
extinction when future generation remains eligible. No new global species-ban,
resurrection or administrator-reset mechanic is admitted here.

Authoritative population state and observer belief remain separate. An NPC may
believe a species extinct and later encounter another population; discovery changes
knowledge, not the recorded fate of previously established creatures.

## Accepted direction: technically distinct species variants

A species may have persistent, technically distinct variant definitions, not just
different display names. Distinguish a species grouping, a variant definition,
a population/community identity and an individual identity. A cultural affiliation,
faction or village is not automatically a biological variant.

Variant differences must be represented through admitted structured properties,
capabilities, material/body composition or bounded generation parameters. Names
render those differences; they do not select special outcomes. Runtime content
uses existing code-owned kinds and calibrations, not newly invented physiology,
formulas or judgment families. Definition revisions preserve replay semantics.

For example, two generated goblin populations may use different admitted body
profiles while retaining a shared species grouping. They can also have different
communities without having different body profiles. An individual injury or
personality change does not by itself create a new variant definition.

Loss and eligibility need explicit scope: absence of one variant is not absence
of all related variants, and a new variant is not a replacement for an ended
lineage or community. Future regional generation may introduce a variant only
under its admitted eligibility and initialization rules. Changing a name, ID or
definition version cannot reset an existing population or evade its history.

The minimum species/variant schema, meaningful distinction criteria, inheritance,
reproductive compatibility and variant admission workflow remain open (Q061).
No genetics, evolution or hybridization system is implied by this direction.

## Accepted direction: expanding geography and world settings

Indefinitely expanding, progressively generated geography is an intended world
capability, rather than requiring every world to have a fixed geographic boundary.
World rules must be configurable through explicit settings. This does not promise
infinite resident state, compute or mathematical coordinates; execution, storage
and supported limits remain bounded engineering concerns.

Geographic expansion may establish additional seeded population sources under
Q009. Keep that initialization boundary separate from recovery of existing regions.
Source units, placement, eligibility, generation-time semantics and bounded work
still need design; an unlimited sequence of regions does not imply unlimited
active simulation or an inexhaustible source in any one region.

Setting names, defaults and the catalogue of live-adjustable rules remain undecided.
They must use code-owned validated semantics and join the world's pinned generation/mechanics
configuration so replay does not reinterpret old events using current settings.
Changing persistent semantics needs an explicit migration, not a silent reseed.
No automatic replenishment mode for established regions is admitted by accepting
settings in general. Fresh population initialization in new regions is the explicit
Q009 rule, not a hidden setting exception.

## Accepted decision: prospective live ecological settings

Ecological rules may change while a world is running through explicit, authorized,
recorded revision changes that govern future evolution. Permission to change rules
is not permission to reset existing state. Each admitted setting needs validated
bounds, an effective simulation boundary and a transition policy.

Preserve established individuals, relationships, realized traits, injuries,
population/source accounts and committed history. Changing abundance cannot refill
depleted established sources or reset local losses; changing a reproduction parameter cannot
retroactively create offspring. Future lawful births or migrations still require
their ordinary prerequisites and accounts.

Generation settings do not rewrite established terrain or source allocations.
Any change applying to future generation must preserve those facts and declare
its compatibility with the existing generation contract. The exact adjustable
settings and defaults remain open; no new ecology mechanism is admitted here.

The [time/persistence transition contract](time-and-persistence.md#live-rule-transition-boundaries)
defines how version boundaries, in-flight work and offscreen catch-up must be
handled. A rule change lacking a safe transition is rejected or deferred, not
applied opportunistically when each region next becomes visible.

## Ownership and interfaces

| Record | Authority | Not an independent source of truth |
| --- | --- | --- |
| Entity identity | Stable ID, lifecycle, definition revision, construction cause | Display name, renderer handle |
| Placement/membership | Authoritative location and containment/assembly references | Spatial lookup caches and drawing coordinates |
| Relationship | Typed participants, validity interval, establishing/ending cause | A creature's belief about the relationship |
| Region context | Environmental definitions, field identity, population source/allocation records, ownership boundaries | A second copy of physical reservoir quantities |
| Construction record | Pinned inputs, logged realizations and initialization provenance | An invented eyewitness history |

Time/persistence owns the clock and commit/version machinery. This module
references that clock and selected revisions rather than maintaining another.
Composition owns the material quantities in entities and reservoirs. Embodiment
owns biological condition. Region context names and locates those records.

Proposed read interfaces supply revisioned identity/placement snapshots to
authorized world services, and separately scoped references to observer services.
Construction, relocation, relationship changes and retirement propose typed
effects through the common commit authority. A returned reference is not a grant
to read every field of its entity.

## Lifecycle and identity decisions

Recommended lifecycle distinguishes proposed, committed, inactive/unloaded and
retired records. Death is a bodily transition, not automatic identity deletion:
a corpse can remain a physical thing and an actor can remain a historical source.
Unloading is storage/execution policy, not death or despawning.

Splitting a material portion creates new portion references and explicit lineage;
it cannot give both children the parent's full amount. Detaching a grip retains
its part identity. Reassembling parts changes membership rather than copying
them. Destroyed entities retain archival identity when referenced by causes.
Whether a radically rebuilt named object retains its gameplay identity remains
a content/identity policy question, not a physical conservation decision.

Relationship semantics need more than a generic edge: biological parenthood,
current group membership, care responsibility, possession and territorial claim
have different lifetimes and validators. Possession is not material ownership
and a territorial claim is not exclusive physical occupancy. Do not silently
implement social truth as an NPC's stance value.

## Coherent initialization, not attribute confetti

1. Select an admitted construction template and code-owned parameter constraints.
2. Establish shared causes: region, group and related entities before dependent
   facts that require them. Detect dependency cycles; jointly validate connected
   proposals rather than publishing half a family.
3. Resolve admitted latent variation with logged world randomness and pinned
   construction semantics. Reuse previously realized shared causes.
4. Validate body, relationships, stock and placement as one consistent proposal.
5. Commit once with initialization provenance; later calls reuse the record.

A nursing creature cannot independently acquire a new offspring group every time
its state is inspected. Initial food reserves and recent feeding must agree.
Summarized history is permitted but must not fabricate witnessed events or
retroactively alter the supplies of an already-established neighboring world.
Pre-simulation boundary resources need an explicit initialization account.

## Alternatives and tradeoffs

**Identity from display/content hash versus persistent opaque identity.**
Content hashes are useful for immutable definitions but fail for mutable instances:
injuring a wolf must not make it a new wolf. Recommend stable instance IDs plus
versioned definition hashes. Stable IDs still require an allocation/retry policy;
names and generation order alone are not sufficient.

**Independent lazy generation versus constraint-aware construction.**
Independent spawning is cheap but creates duplicate relatives and contradictory
regional stocks. Recommend lazy construction with committed shared records and
joint validation at relationship boundaries. Eagerly simulating a whole ecosystem
before play is not required. The tradeoff is more explicit partial/unresolved
state and rejection paths instead of conveniently inventing missing facts.

**One global spatial scale versus hierarchical context.**
Uniform high resolution is expensive; unrelated coarse cells hide contact detail.
Recommend region/place/part references with explicit conversion precision.
No spatial refinement may change established reach, topology or material balances.
Actual coordinate/containment schema remains open.

## Failure modes, budgets and fallback

Bound construction fan-out, constraint solving and reference traversal. An
unbounded chain of "create its parent" is not a valid initializer. If validation
cannot finish, retain a pending proposal or reject it; never publish inconsistent
half-state. Do not reinterpret "pending" as a visible absence.

Conflicting concurrent creation requests share a stable request identity and
one commit result. Stale relocation reads revalidate. Cache invalidation follows
placement revisions; a stale cache cannot authorize an action.
Archived referenced entities remain resolvable, even if live indices omit them.

## Worked cases and counterfactuals

**Wolf:** one established offspring relationship survives separation, region
unloading and save/load. The adult need not know the offspring's current position.
Changing group membership can affect future social options without changing
biological parenthood, remembered evidence or identity.

**Non-wolf:** a pot carried between rooms remains the same pot. Pouring its water
does not move the pot's ID into the puddle; material lineage records the transfer.
Theft changes possession, not mass or every observer's belief about ownership.

## Evidence and open decisions

| Gate | Required evidence |
| --- | --- |
| W0/W1 | Retry construction and relocation; no duplicate entity or stock; same pinned initialization reproduces |
| W0/W1/W5 | Concurrent spawn opportunities share one source; groups cannot overdraw it; activation and migration never duplicate individuals |
| W1/W3 | Shared family facts remain consistent; changing hidden location does not update an agent's memories |
| W1/W6 | Revisit, extra observers, save/load and reordered evaluations do not reset settled opportunities or explicit dormant individuals |
| W1/W6 | Exhaust all local sources and isolate the region; time, reload, player return and habitat restoration alone preserve absence |
| W1/W5 | Restore a real migration route or reintroduce individuals; source is debited, identity/accounting persists, and establishment still checks eligibility |
| W3/W7 | Failed searches do not assert authoritative extinction or disclose hidden survivors |
| W1/W6 | Deplete an established region, then generate a new region with an eligible fresh population; old losses persist and migration requires a real transfer |
| W0/W1/W6 | Concurrent/reordered exploration initializes each source once under its pinned generation basis; reload never rerolls established stock |
| W1/W3 | Extinction assertions state scope and account for dormant/coarse/reproductive sources without leaking hidden truth to observers |
| W1/C3 | Distinct variant profiles use admitted properties; renames leave outcomes unchanged, and new communities do not resurrect ended identities |
| C6/W6 | Split, detach, archive, refine and migrate without dangling references, resource duplication or latent rerolls |
| W8 | Rename/reorder proposals and test bounded cyclic relationships and missing definitions |

Before implementation decide allocation/idempotency scope, legal relationship
types, group-construction transaction bounds, initialization boundary accounts,
and reference-retention policy. Evidence must include concurrent requests and
late refinement, not only deterministic construction in a fixed order.
Define regional source units, replenishment mechanisms, eligibility inputs,
opportunity timing and retirement policy before implementing population entry.
Tests must include exhaustion, birth/death accounting and continuously observed
placement, not merely a reproducible random spawn.
Recovery tests must distinguish an empty active view from actual local extinction,
and opportunity to recover from guaranteed recovery.
Define generation eligibility and extinction scope before reporting extinction;
test unresolved sources separately from zero and open-ended generation separately
from closed regional loss. Resolve Q061's variant schema without assuming every
individual trait or cultural difference is a separate biological kind.
