# Shared food: bounded browser slice

## Admission and purpose

The player needs food for a journey and can bring finite food back to camp.
Another inhabitant independently needs nourishment. The reusable capability is
moving finite resources around autonomous inhabitants, not a bait puzzle.
Names, camp progress and introductory text must not select physical consequences.
This direction supersedes the earlier next-step selection of a thermal inn
interaction; the thermal bench remains an independent engineering fixture.

This record admits a bounded local-browser use of the existing matter world,
not a second world engine, multiplayer service or general inventory framework.
It introduces no Jev family or live-model dependency. Existing ordinal matter
and dietary semantics are not SI nutrition or a general physiological model.

## Q064 ownership and handoff review

The published corrective six-probe review in `interaction-contract.md` is the
starting point, not a blanket admission for this slice. Before implementing
this slice, the necessary handoffs were reconciled as follows:

| Probe | Narrow ownership and admitted handoff | Unsupported scope |
| --- | --- | --- |
| Support, movement and detachment | Matter actor state owns committed position. A terrain-aware movement attempt validates its next step before commitment. Rendering interpolates that state; it cannot move first and ask the engine afterward. Carried portions follow their owner. | Forces, loads, attachment graphs and general physical frames |
| Material entering/leaving containment | Each portion has one stable identity and one authoritative possession/location state. Taking and placing transfer that identity, never copy it. Code rechecks reach and availability at commitment. | Containers, capacities, pouring, splitting and merging |
| Body consuming resources during activity | Existing dietary suitability and need semantics govern intake. Consumption debits the actual finite portion once and changes the consuming body's need through code. Another carrier's portion is not locally available food. | Caloric physiology, respiration, stamina and SI/ordinal conversions |
| A process changing its own substrate | Consumed food ceases to be an available source. Later candidates and actions read the new state; an earlier selection cannot resurrect it. | New thermal, damage, spoilage or phase mechanisms |
| An observer acquiring incomplete evidence | Autonomous choices begin with the existing sensory machinery, bounded by the supported terrain policy. Execution can read truth to reject an impossible attempt but must not use hidden food coordinates to manufacture a pursuit. | General scent transport, full visibility geometry, durable learned maps and asynchronous perception workers |
| An agent revising an intention | Existing need/routine machinery selects from eligible evidence; each subsequent action revalidates the target. Satiation, depletion, changed possession and inaccessible food can remove pursuit opportunities. | Taming, trust, combat, new judgment families and generic planning |

**Composed trace:** a player takes a portion → its possession changes atomically
→ an autonomous opportunity sees only currently eligible food → the creature
selects an ordinary action → terrain/reach/availability checks precede effects
→ consumption reduces the finite source → subsequent player options reflect
the committed state. Placing a portion may alter this trace, but is not a special
“distract” operation or guaranteed response.

The client owns input and presentation; core owns consequences. The browser
persistence adapter stores the complete supported simulation state rather than
reconstructing it from rendered objects. The camp indicator is a read-only
projection of actual resources and grants nothing.

Q064 remains open for broader schema selection. This review does not close
W0–W8, certify general physical causality, or retroactively waive prerequisites.

## Behavioral contract

- Food is represented by finite, discrete portions with stable identities.
  Portions do not split or merge in this slice.
- Taking, putting down and eating revalidate possession, reach and availability.
  Stale selections cannot acquire or consume a portion twice.
- The same terrain eligibility applies before player and creature movement is
  committed. Blocked movement does not charge successful travel and rewind it.
- Simulation advances on bounded command steps, not renderer frame deltas.
  Movement and waiting provide autonomous opportunities on the same timeline.
  This trades real-time ambient motion for deterministic, inspectable choices:
  doing nothing pauses the world, but walking does not freeze the creature.
- Background tabs, pause and absence perform no catch-up. Resume restores the
  saved timeline, needs, positions and resource state without refilling supplies.
  This is local browser persistence, not full offline world simulation.
- Observable event feedback must not expose exact private creature need scores,
  hidden food locations or privileged reasons for a choice.
- Authoring a finite alternate supply is permitted; infinite search/refill
  sources are not part of this slice.

## Implemented interface

Run `pnpm client`, then open `http://localhost:5174/?food`. Existing clearing,
card, stress and editor modes remain available without `?food`.

- Tap WASD/arrows for cardinal steps, or click the terrain to follow a cardinal
  path. Every committed step gives the creature one opportunity.
- Hover to inspect; right-click to look, walk, take, eat, put down carried food
  at your feet, or wait. The side panel also offers nearby actions and carrying.
- Bring food to the dirt beside the camp shelter and put it down. The indicator
  counts currently visible, unheld food on that ground, not inventory or a reward.
- Use **Pause/Resume** to suspend/resume an unfinished walk. Hidden tabs suspend
  path advancement explicitly; returning does not advance elapsed world time.
- Use **Save session** or Ctrl+S/Cmd+S to keep the committed state. Reloading the
  page resumes that save automatically. **Reload saved session** discards
  unsaved play and cancels unfinished walking commands.
- **New clearing** explicitly creates unsaved initial circumstances after
  confirmation; it does not overwrite the previous save until another save.
- Tab/Shift+Tab navigate controls; Space/Enter activate focused buttons.

The authored layout supplies five independently identified berry portions and a
creature initially needing three portions' nourishment. The goal is two portions
on camp ground. All quantities are authored code constants/state, not model
judgments. Feeding first, keeping food, eating now and repositioning food use the
same rules. Camp is not protected from a creature that can still eat.

The core adapter admits bounded integer tile maps, at most 64 actors and 256
things. Each accepted command increments a choice-boundary tick, commits the
player action, refreshes current sensing, then gives each autonomous actor in
persisted arbitration order one opportunity. A rejected or old-tick command
returns unchanged state with no autonomous opportunity. Independent fresh
commands are not assumed to be retries. Menus and panel actions bind their
rendered tick.

The timeline is **not elapsed minutes**: no ambient metabolism, drift or hunger
regrowth runs per tick. Existing movement capability/cost and dietary calculations
remain in core. This deliberate pause model does not promise ongoing ecology.
The view does not debit resources or repair invalid core movement afterward.

Snapshots store the complete supported matter world, terrain, actor order and
tick in the browser's localStorage key `rpg-jev.food-session.v1`. Snapshot
admission validates consequential numeric fields and identity/possession
references. Current awareness is re-derived on restore; it is not a saved learned
map. Ordered action and perception changes reproduce each committed world via
`matter.apply`; deterministic commands also reproduce continuation. There are no
live decisions or random draws in this adapter, and no server event-log claim.

## Evidence and remaining boundaries

See [the validation report](../../validation/shared-food/REPORT.md) for executed
checks and the browser workflow. Historical integration counts are not used as
current evidence.

This remains a local command-step slice. Terrain is a static walkability grid,
not full visibility geometry or scent transport. Existing sensing is coarse;
path feasibility filters already noticed candidates and cannot reveal hidden
ones. Bodies can share tiles. The object layer displays one glyph per occupied
tile; separate co-located portions remain individual menu/panel targets.
Carrying is shown by the controlled actor's indicator rather than separate
carried glyphs. Creature changes appear at committed tiles; player movement
interpolates. No general containers, offline ecology, taming or thermal coupling
are implied.

The saved state is local to a browser origin/profile; changing development ports,
clearing browser data or losing that profile loses access to that save. Storage
failure is visible and does not replace current play or silently overwrite a bad
save. Snapshots are not authenticated multiplayer messages.

Automated workflow checks establish operability, not intuitive playability.
The participant observed the forager consuming food on one run, then restarted
and ate some themselves. This supports a narrow instance of human adaptation,
not the appeal of the camp or relocation loop. Their report of all food being
consumed differs from the final fixture's tested remainder; the played state
and cause remain unresolved in the validation report.

The participant accepted the demo's command timing, not multiplayer pause.
Shared-world time must be server-owned and independent of input; menus, hidden
tabs and disconnects cannot pause others, and returning observes current shared
state. The local clock and restore controls above are demo-only facilities.
The external Claude Doc has not been verified or synchronized.
