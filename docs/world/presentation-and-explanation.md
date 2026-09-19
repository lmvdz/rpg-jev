# Presentation and explanation: evidence without omniscience

## Status and scope

This is a subordinate draft design, not implemented renderer or runtime support.
The [shared world contract](../shared-world-contract.md) owns cross-module acceptance.
SPEC §§2, 5–7, 13–14 and 21–22 preserve structured simulation and code authority.
This module makes admitted consequences understandable without turning the UI into an oracle.
It covers visible cues, action feedback, causal inspection and deterministic fallback text.
It does not create world facts, determine beliefs or invent motives and physical mechanisms.
It introduces no Jev question family, damage formula or general animal-behavior policy.

## Why explanation needs its own boundary

An internal causal record may correctly name a secret that a player has not discovered.
Showing that record verbatim would defeat the perception and knowledge contracts.
Conversely, hiding every cause makes compositional depth indistinguishable from arbitrary dice.
The goal is faithful explanation of available evidence, not universal access to truth.
“It burned because fuel remained” is suitable only when that fuel is revealable.
“The flame continued after you stepped away” can communicate an observed consequence
without claiming access to the assembly's concealed reservoir or an NPC's private intention.
Uncertainty language must describe evidence limitations, not cover an invented explanation.

## Authority and derived artifacts

Committed events, cause IDs and authorized observations are inputs, not editable UI state.
[Perception](perception-and-evidence.md) owns what was available to an observer.
[Knowledge](knowledge-and-memory.md) owns the observer's claims and their provenance.
Physical truth remains in [composition](composition-and-processes.md) and
[embodiment](embodiment.md), never in a narrative cache.
Rendered prose, grouped notices, map highlights and explanation trees are derived views.
They may be rebuilt, localized or discarded without changing the simulation.
If a viewed cue is meant to become a memory, that happens through the evidence pipeline,
not because a language model happened to mention it in a sentence.
Only code commits effects; reading an explanation must be side-effect-free.

## Interfaces and lifecycle

Proposed contracts are descriptive and are not claims about current exports.

1. `selectView(viewer, frontier)` fixes identity, authorization and committed world revision.
   It never hands a renderer the unrestricted world snapshot for convenience.
2. `projectEvidence(view)` selects structured cues and eligible action outcomes.
   Evidence records distinguish direct observation, attributed report and uncertain inference.
3. `buildExplanation(subject, view)` traverses authorized causal edges under a work budget.
   It produces a bounded structured account with explicit unavailable or unknown details.
4. `render(payload)` converts that account into text or interface elements.
   Deterministic templates are always available; generated wording is optional and untrusted.
5. `publish(rendered, basis)` rejects stale or unsupported assertions before display.
   It retains the view revision so later history inspection does not pretend it was omniscient.

World events happen before rendering; a delayed or failed renderer cannot undo them.
The player can continue using structured controls and fallback text during model outages.
No prose is generated for offscreen NPC exchanges with no player present.
When an exchange was actually overheard, presentation preserves its committed evidence,
even if a cosmetic conversation scheduling queue would otherwise drop a remark.

## Player-facing why versus privileged diagnostics

Use separate payload builders, not a single omniscient payload with fields hidden by the UI.
The player-facing `why` endpoint traverses only viewer-authorized evidence and causal links.
An unexplained outcome can say “the cause is not known from your observations.”
It cannot reveal secret target IDs, withheld edge counts, internal names or traversal paths.
Source attribution must not identify a hidden informant through a provenance label.
Redacting a node while retaining its informative edge label is still a leak.
Caching must include viewer scope and evidence revision, not merely the requested entity.
Export, accessibility text, hover cards and network responses need the same projection.

SPEC §13's debug `why` includes judgment odds and the RNG draw separately.
Preserve that capability in an explicitly privileged diagnostic mode, not ordinary player output.
It may inspect full authoritative causes only with authorization outside the character view.
Do not pass privileged records into player-facing generation and trust the prompt to conceal them.
Even in diagnostics, a probability is not a physical magnitude or proof of a motive.
Any session exposing diagnostics must make the mode explicit and avoid persisting its facts
into character knowledge merely because the operator read them.

## Honest explanations

Explain the causal level actually recorded: attempt, contact, transfer, exposure and consequence.
Do not manufacture a smooth psychological story from a sampled action-choice distribution.
“The wolf withdrew” may be observed; “it remembers your cruelty” needs attributable evidence.
An intention can explain an attempt internally without being knowledge available to the player.
Distinguish “you saw the handle break” from “the worker says the handle broke.”
A false belief remains a belief in presentation, even when code knows it is false.
Absence of a cue is not proof that the underlying state is absent.
Unknown, not yet observed and unsupported simulation are different conditions.
Unsupported mechanics should not masquerade as mysterious in-world causes.
Consequences already visible can be stated confidently without revealing their hidden mechanism.

## Staleness, replay and failure cases

Render a multi-line account from one consistent frontier or mark subsequent changes explicitly.
A target destroyed between selection and display may still have a valid historical observation.
Use stable identity references; never resolve a remembered name to a new entity silently.
An archive miss means historical detail is unavailable, not that the event never happened.
Loading a save regenerates presentation from committed records without new world RNG draws.
Cosmetic variation must not advance the world's single logged causal RNG stream.
Generated text that invents an item, injury or cue is rejected in favor of structured fallback.
Raw player text remains labeled untrusted input and cannot become rendering instructions.
Persistent view caches must not transfer one player's privileged evidence to another.
The audience of a shared multiplayer display needs an explicit policy; default to the
intersection of authorized facts rather than revealing one participant's private knowledge.

## Alternatives and provisional recommendation

**Expose the whole causal graph:** maximally informative, unacceptable for ordinary play.
**Hide causes and show only outcomes:** secure but undermines learnable physical depth.
**Generate explanations from full state with a secrecy instruction:** easy to prototype,
but makes confidentiality depend on model obedience and leaves structured metadata exposed.
**Project evidence first, then render:** stricter data plumbing but testable information boundaries.
Provisionally choose evidence-first projection and deterministic factual templates.
Allow optional prose only over that already-safe payload, with unsupported claims rejected.
Keep a separate privileged diagnostic projection for engineering and controlled playtests.
This increases maintenance cost, but avoids making every new UI surface a secrecy exception.

## Invariants, bounds and fallback

- Rendering cannot create a fact, transfer a resource, sample an action or advance time.
- Player-facing provenance never discloses more than its authorized evidence basis.
- Hidden-state twins produce identical payloads until distinguishable evidence occurs.
- Generated wording cannot promote a report into truth or a guess into a known motive.
- All displayed numerical quantities come from code-owned authorized fields.
- Names do not select outcomes or special explanatory stories.
- Reading historical causes cannot re-infer Jev decisions or consume world RNG.

Bound cue count, causal traversal depth, archive requests and text size.
Stable code ranking prioritizes actionable evidence without depending on secret salience.
Omission notices must not leak how many concealed facts exist.
Detect cycles in cause links and stop with a neutral bounded explanation.
On timeout, missing archive or generation failure, show available structured evidence.
Never fill unavailable history with a plausible story to make a response look complete.
Budget numbers require UX and workload measurements before implementation.

## Worked fixtures

**Wolf:** the player sees a wolf approach an assembly and then recoil from contact.
The view can show visible contact, flame and movement, plus observed body consequences.
It cannot name hidden fuel, remembered hunger history or an unexpressed intention.
Privileged diagnostics may link the sampled choice, contact and injury with odds and draw.
The ordinary why view explains only the visible chain and admits missing causal detail.
After a later discovery, a new view may offer more context without rewriting old observations.

**Non-wolf:** a worker reports a bucket handle broke while the player was elsewhere.
The player sees an attributed report, not a first-hand mechanical diagnosis.
Inspecting the bucket later may add visible damage evidence under perception rules.
The worker's concealed motive for lying remains unavailable unless evidence reveals it.
An internal record of the lie does not appear in provenance, search snippets or error messages.

## Acceptance matrix

All tests below are proposed evidence for parent W gates, not completion claims.

| Gate concern | Fixture and assertion |
| --- | --- |
| W3, W7 | Hidden-state twins match in text, payloads, IDs and provenance. |
| W3, W4, W7 | A sampled wolf choice does not disclose an unobserved motive. |
| W2, W7 | Visible contact/injury cues match committed effects, not invented prose. |
| W5, W7 | Failed action feedback reveals only eligible contact and outcome evidence. |
| W0, W6 | Save/load and archived history preserve attribution without new inference. |
| W7, W8 | Cold renderer and Jev outage still provide usable factual feedback. |

Also test shared screens, revoked access, stale caches, malicious text and archive timeouts.
Physical causal explanations remain contingent on C0–C8, not evidence that those gates pass.

## Open decisions and implementation evidence

Define the capability boundary between player `why` and privileged debugging.
Decide whether historical explanations use then-known or now-known evidence, and label both
if both are supported; never silently reinterpret the player's earlier knowledge.
Choose representation for uncertain or withheld causes without side-channel identifiers.
Prove projection isolation across every output surface before adding generated explanations.
Measure whether fallback cues let players predict consequences in unseen assemblies.
Require a wolf and non-wolf rendered fixture plus multiplayer leakage tests before closing W gates.
