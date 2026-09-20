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
player proximity alone does not create an unlimited supply of new individuals.
This replaces the proposal to establish every creature at region generation;
it does not require individually simulating the unrepresented regional population.

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
The full-extinction decision below extends this rule across the world. Specific
refuge designs and administrator-reset policy still need explicit decisions, not
invisible exceptions to ordinary spawning.

## Accepted decision: full extinction is possible

A species can become fully extinct within the world's declared population scope.
No guaranteed surviving refuge, minimum population or hidden replacement source
prevents that outcome. Independent populations and geographic barriers may make
extinction difficult, but cannot silently make it impossible.

This applies to both rare, geographically limited species and widespread species
such as wolves. Rarity or commonness grants no extinction exemption. Difficulty
follows from actual distribution, numbers, surviving sources and admitted recovery
mechanisms, not a species-label protection flag. A widespread species may be
extremely difficult to eliminate, but its ungenerated territory cannot serve as
an inexhaustible replacement source that makes the accepted outcome impossible.
This does not select a finite map, upfront population geography or bounded-range
generation scheme; those remain separate world-design decisions.

Full extinction requires exhausting all actual sources in that scope, including
explicit active/dormant individuals, coarse populations and any admitted viable
reproductive stages. Zero adults or zero sightings alone is insufficient.
An isolated surviving population prevents full extinction even if it cannot
currently replenish another region.

Once all sources are gone, ordinary migration, reproduction and reintroduction
cannot restore the species. Time, exploration, save/load and habitat restoration
do not supply new individuals. Later region generation must honor committed
population history rather than initialize replacement stock for an extinct species.
Renaming a definition or changing its version cannot bypass that history.

This requires defining the world's population scope and how ungenerated regions
and external sources are accounted for. If those sources are genuinely unresolved,
the engine cannot claim proven full extinction merely because generated regions
are empty. A coarse source inventory can cover unexplored territory without
creating every individual or revealing that inventory to players.

Authoritative extinction and an observer's belief remain distinct. Confirming the
world condition does not automatically announce it to players or NPCs.
No resurrection, protected-species exception, cross-world import or administrative
reset mechanic is admitted by this decision; any future exception must be explicit
and versioned rather than disguised as ordinary recovery.

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
| W1/W6 | Exhaust every source in a declared scope; exploration, reload and definition-version changes cannot recreate an extinct species |
| W1/W6 | Apply the same extinction rule to a limited-range fixture and a widespread multi-region fixture; commonness introduces no protected floor |
| W1/W3 | A surviving dormant/coarse population or admitted viable reproductive stage prevents full extinction without becoming observer knowledge |
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
Define global population scope and ungenerated/external source accounting before
claiming a full-extinction detector; test unresolved sources separately from zero.
