# Bounded solid-contact learning slice

Current disposition: retain this bench as an automated engineering fixture.
The [enumeration and evidence-based next interaction](../../validation/thermal-learning/AUTOMATION.md)
supersede manual possibility testing and the recommendation to use the bench
itself as the next player experience. Its interactive tooling remains available;
no participant learning result is inferred.

Status: selected reversible implementation contract, not a general physics schema.
Baseline: `e91a8dac652d30c2d46855b669583ee0d4b4b68e`. Q063 is the learning goal;
Q064's cross-domain review motivates the boundaries below. This does not close
Q018's general geometry/calibration questions or C1–C8/W0–W8.

Process correction: the original implementation selected this fixture without
first documenting the required reconciliation of all six Q064 probes. The later
claim that implementation authorization granted a sequencing exception was wrong.
Authorization did not waive the prerequisite review. The
[corrective six-probe reconciliation](interaction-contract.md#corrective-six-probe-reconciliation-for-the-thermal-slice)
now evaluates those choices, including independent review before further
implementation. It supports conditional retention for evidence-first terminal
work, not retrospective compliance or closure of Q064's broader schemas and
empirical obligations. Fixture, sensor and timing choices remain implementation
selections, not previously accepted universal requirements.

## Reconciliation and selection

The integration contains the inn Store/effect/log/replay path, legacy ordinal
matter, C0 corrections and an isolated composition spike. C0's 15 scoped assertions
are reported passing; earlier failures are not current unfixed findings. Neither
that result nor the spike establishes structural manipulation, limited sensing
or player learning. The later foundation review is a recommendation companion,
not a replacement authority. The external Claude Doc remains unverified.

Solid contact wins over combustion (fuel/air/products), fluids (containment and
flow) and injury (exposure/body mapping). It can test arrangement, finite accounts,
intervention, ambiguous evidence and transfer without admitting those mechanisms.
Another transaction-only example or isolated thermal spike would not satisfy Q063.

The scoped cross-domain review preserves these handoffs:

| Responsibility | Slice commitment | Not inferred |
| --- | --- | --- |
| Physical change | Accounted finite exchange over derived contacts | A requested connection is not an existing path |
| Sensing | Probe state produces a rounded, attributed observation | Target truth does not become knowledge |
| Knowledge/interpretation | Private observations and actor-authored prediction history | Notes are not confirmed beliefs or world facts |
| Intention/execution | A request reaches feasibility/revision validation | Intending an outcome does not cause it |
| Embodiment/social change | Outside this admission; insulated fixture handling is explicit | No injury, physiology or belief-transfer mechanism |
| Coordination | One atomic settlement and authoritative timeline | No general scheduler or final multiplayer pacing |

This is not completion of Q064's six broader probes or a replacement for them.

## A. Transferable relationship

Heat follows face-contact paths, not names or total material inventory. Changing
the path changes the rate of redistribution; removing a warm part preserves its
stored energy. Finite sources cool, and a measurement can perturb its target.
Contrast connected/disconnected arrangements, conductive/poorly conductive
bridges, and equal inventories with an alternative bypass. Test an unfamiliar
arrangement after recording a prediction and reason, not after revealing truth.

This representation is inadequate if supported rearrangement loses energy, if
equal-temperature parts develop a gradient, if names select outcomes, or if a
player needs internal gradients that a uniform-temperature part cannot express.

## B. Distinguishable evidence

A fixture supports up to nine identical 0.01 m cubes in a rectangular tray up to
3 by 3 sockets. Socket centers are 0.01 m apart; seated face neighbors touch.
The tray and separate storage rack are ideal insulating supports. There is no
attachment, sealing, fluid, gravity, friction, or inferred contact from names.
All parts and positions on this bench are visible; thermal properties and initial
temperatures are not. IDs are stable public labels, not hidden-state hashes.

A shared finite-capacity contact probe docks to one seated cube's accessible top
face. It has its own thermal energy, persists on undocking and loads the target.
An explicit read records the probe's own temperature rounded to the nearest 1 K,
not the target's true temperature. Response delay comes from conduction, not CPU
queue latency. A read takes no simulated time; physical progression takes whole
minutes. Two reads without progression can be identical. Only the requesting
actor receives that observation; absence of observation does not stop exchange.

Wrong explanation: a cold reading proves there is no contact path. Inconclusive
case: immediately after docking, the same probe reading is compatible with a hot
or cold target. Cached old readings carry their original time and target; moving
the probe must not relabel them. Prediction/reason text is untrusted actor data,
never truth, criteria, physics input or a model prompt.

## C. Supported continuation and numerical domain

Supported operations: seat a known cube in an empty socket, move it to another
empty socket or the rack, dock/undock the probe, read, wait one minute, and record
a prediction/reason. Docked cubes require undocking before moving. The fixture's
insulated manipulator abstracts safe handling; this admits neither bare-hand
handling nor injury. Rearrangement is instantaneous at the choice boundary.

Every successful rearrangement preserves energies and identities. No finite
source is replenished; approaching equilibrium exhausts useful temperature
difference without a special flag. Disconnecting stops that path, not all paths.
There is no ambient reservoir and no heat input. No contact or equal temperatures
means no exchange. Unsupported geometry, heating, cutting, burning, duration,
or bodily requests are explicitly unsupported, not fabricated physical outcomes.

All thermal quantities are SI, explicitly independent of legacy ordinal matter.
Part mass is 0.001–1 kg, specific heat 100–2000 J/(kg K), admitted capacity
1–1000 J/K, conductivity 0.01–100 W/(m K), temperatures 250–400 K.
Probe capacity is 1–10 J/K and contact conductance 0.01–1 W/K.
Face conductance is area divided by the sum of the two half-cube resistances.
No contact resistance/air-gap model beyond the fixture is claimed.

Simultaneous forward exchange uses 0.01 s substeps, at most 6000 per minute.
The capacity/conductance/degree bounds make each update a convex temperature
combination. Before testing: total energy absolute tolerance 1e-6 J; analytic
fixture error at most 0.1 K; integer-second time partitions within 1e-8 K.
Replay of recorded effects is exact, not approximate solver equivalence.
Unsupported initial states are rejected before play, not turned into uncertainty.

## D. Event, evidence and choice ordering

One existing core Store owns both actors and this optional thermal state. One
closed versioned settlement effect atomically records physical state, authoritative
whole-minute clock, receipt, revision and any observation or prediction. There is
no second clock, async perception worker, general scheduler, model or RNG call.
Legacy clock effects cannot advance an active thermal world behind this path.

At a choice frontier: authenticate actor outside the pure API; check request
identity/retry, access, expected revision and operation support; compute a bounded
result; commit it; then return only the eligible receipt and public view.
The local two-actor terminal is a trusted test driver, not network authentication.
No actor privately advances time. A one-minute wait settles before another actor
acts; stopping/rearrangement is supported at the next minute, not retroactively.
No wall-clock/offline catch-up is claimed. The bench content has no inn schedules
or body processes; adding this thermal state to other content requires explicit
admission of its coupled progression, not merely setting the optional field.

Same actor/request ID and same payload returns the original receipt without
reapplying work or granting new evidence. Reusing the ID for different payload
is an explicit retry conflict. Stale attempts do not spend resources or advance
physical time. Evidence obtained later never changes an earlier receipt.
These durable semantics cover well-formed request identities from actors with
bench access. Malformed envelopes and inaccessible actors are rejected before
admission and reveal no hidden physical diagnostics. Saved logs are trusted
operator history; replay is not an authentication or hostile-save boundary.

## Ownership and validation obligations

Reuse Store, the closed effect vocabulary, JSONL event log and exact replay.
Add optional, mechanics-versioned SI state; never convert or rewrite old ordinal
records. The old inn remains unchanged when thermal state is absent. No renderer
or Jev code changes. The existing terminal package supplies a structured offline
interaction surface; it does not implement another simulation.
The accepted eventual shared SpacetimeDB runtime direction is unchanged. Local
Store ownership here does not settle Q045/Q047/Q050 or establish server capacity,
network authorization, worker scheduling or distributed persistence.

Required independent contrasts: bypass/topology, unfamiliar layout, property
substitution, renaming, zero path/input, misleading probe evidence, interruption,
shared probe conflicts, retry, save/reload and replay. Hidden-state twins must
have equal public payloads until an eligible measurement distinguishes them.
Full diagnostics and save files are trusted operator data, not player views.

## Corrective player surface and research records

The existing `play` entry now accepts `--bench`; the inn's entry implementation
is retained unchanged behind the other branch. This is launch/surface integration,
not embedding SI cubes in the ordinal sandbox or extending inn behavior.
The bench path imports no inn/model adapter. Its default save is the repository's
ignored `saves/thermal-bench.jsonl`; `--ephemeral` is an explicit testing choice.
`--json` retains the separate trusted two-actor structured driver.

Normal play accepts `look`, `seat`, `rack`, `dock`, `undock`, `read`, `wait`,
`history`, `prior`, `predict`, `revise`, `transfer`, `journal`, `retry` and `quit`.
The grid, parser, help and errors use public structure only. Apparatus orientation
explains visible face contact, insulated supports and the stateful probe display,
not which arrangement or material will succeed. No hidden-value scoring, recipe,
automatic study stage or reset is introduced. Uncertainty and no revision are valid.

Study reflections are versioned `thermal-study-v1` **input records in the existing
log**, not physical effects, NPC beliefs or evidence that anyone learned.
They retain actor/request identity, phase, statement, optional unstated reason,
declared provenance (`unspecified`, `participant`, `self-test`, `scripted`),
authoritative time/revision, then-visible structure and at most the latest 32
eligible readings. Omitted earlier readings are counted explicitly; full acquired
history remains available separately. A snapshot records availability, not which
evidence the participant actually used; prose citations are not validated links.

An unseen changed frontier rejects a new note rather than recording a newer
layout as its basis. Same-identity retries return the original record, including
across resume; different payload/provenance is a conflict. Notes and journal
inspection never change physics or simulated time. Loading preserves the stored
snapshot instead of calling perception on current state. Provenance is declared,
not authentication of a human participant. User text remains escaped data.
The physical operation catalog and mechanics version are unchanged, so previously
unsupported physical requests retain their replay meaning.

Engineering tests do not establish player learning. A participant must record
prior knowledge, prediction and reason before unfamiliar intervention, available
evidence and subsequent revision. Copying, prior physics knowledge and lucky
success must remain distinguishable. No participant result is claimed.
