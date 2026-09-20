# Shared-food slice: implementation and verification

## Provenance and scope

Implemented on `implementation/shared-food`, based on
`954d858aaca3a4ba6c31d07a6604a47f2301ec10`. The source remote was refreshed;
the old attached M0 `main` was not used as the implementation base. The user
authorized preparing this checkout and restoring the existing frozen lockfile.
No dependency was added or model experiment run. The user subsequently authorized
logical commits and publication of this feature branch; no shared-branch merge
is authorized.

This is the [`?food` browser slice](../../docs/world/shared-food.md), not a
thermal extension. Its admission records resource units, authority, perception,
terrain, command time, replay and local persistence. It does not certify the full
shared-world architecture.

## Executed checks

- `pnpm format`: repository formatter.
- `pnpm check`: ordinary lint, all workspace typechecks, ordinary Vitest suite,
  new food native tests and retained native thermal/terminal tests.
  The ordinary suite has **1,254 passes and 331 expected failures**;
  expected failures remain limitations, not supported capabilities.
- `pnpm test:food`: **26 passes**, also included in `pnpm check`.
- Retained native thermal/terminal tests: **43 passes**, unchanged in scope.
- `pnpm --filter @rpg-jev/client build`: production build.
- `pnpm exec tsc --noEmit -p spikes/composition/tsconfig.json`: standalone
  composition typecheck.
- Existing Chromium integration smoke: editor toggles in both directions,
  pointer wait reaches core, observable result reaches HUD, no browser errors,
  WebGL error code zero.
- Shared-food Chromium workflow: launched through **`pnpm client`**, with actual
  keyboard/pointer/button inputs and a genuine page reload. No browser runtime
  errors; WebGL error code zero. Screenshots were captured and visually inspected.

Counts above are from this implementation run, not copied historical evidence.
The full gate explicitly includes the new native tests; they are not silently
excluded by Vitest's native-test exclusion.

### Requirement coverage

| Requirement | Executed evidence |
| --- | --- |
| Take/move/drop/eat accounting | Core session tests and client ground→hands→camp tests; complete finite depletion clears possession |
| Competing actors and exclusive possession | Sequential arbitration, another actor cannot acquire/consume held food; final portion cannot be spent twice |
| Evidence-conditioned relocation | Hidden/unsuitable/satiated cases, reachable versus unreachable alternatives; routines use already noticed candidates |
| Terrain before commitment | Blocked and alternate routes, no remote eating, denied walker admission leaves destination/pose unchanged |
| Frame independence | Both committed clicked paths and complete food-session state equal at 15 versus 144 render updates per second |
| Persistence | Core JSON round-trip and exact continuation, client saved needs/positions/possession, real page reload after consumption and camp placement |
| Retry/stale commands | Old ticks preserve state and grant no autonomous turn; menu and panel closures bind their rendered tick |
| Generality | Renamed identities and second terrain layout use the same production session rules |
| Snapshot admission | Malformed wound/capability/state inputs, nonfinite values, duplicate possession and invalid references reject |
| Replay | Ordered action and sensory deltas reproduce committed world through `matter.apply`; saved continuation matches uninterrupted continuation |
| Ordinary controls | Actual glyph picking/contextual take, keyboard movement, sidebar actions, pointer wait, save/reload; native legacy eight-way walking retained |
| Existing application | Inn recorded replay, core/matter, renderer tests, composition typecheck, production build and original browser smoke |

The bounded cases are not arbitrary geometry, arbitrary malicious-input coverage,
or a proof of all combinations.

## Browser workflow

The harness uses the repository's existing CDP infrastructure and an already
installed Chromium browser; no browser automation dependency or browser download
was added.

```sh
node validation/integration/browser-smoke.mjs . "<chromium executable>" "<output directory>" food
```

Omit `food` for the original integration smoke. The output directory receives
`result.json`, initial/intervention/restored screenshots and a disposable browser
profile. Use a scratch/output directory, not a directory containing private
browser data. The harness owns and closes only its own browser/server processes.

The food run:

1. Reads the opening interface; captures the camp, food and creature together.
2. Walks to food and takes a portion through actual glyph picking and the context
   menu; verifies the carried-resource projection.
3. Takes another portion, places one elsewhere, and observes committed creature
   movement and finite food loss.
4. Returns the carried portion to camp and retrieves the other surviving
   portion. Camp has two real ground portions, not a granted reward.
5. Selects wait from the pointer menu, saves, performs a page reload, and compares
   the complete player projection with the saved projection.
6. Loads a code-prepared initial-state contrast whose creature is already fed.
   Repeated waits preserve all five food portions and the creature's position.

Code prepares only the contrasting initial condition; gameplay actions in the
main run go through the visible UI. This is operability evidence, not a human
playtest. Engine tests independently cover unreachable and diet-inappropriate
food.

## Findings corrected during implementation

- The first browser view hid the creature behind the side panel. A wider
  food-only camera framing now exposes the shared situation.
- Initial demand could exhaust the entire supply and immediately consume the
  returned portion. Authored demand is now three portions from a finite supply
  of five; there is no camp immunity or success-triggered behavior change.
- The first native tests were not part of the normal gate. `test:food` now is.
- Independent review reproduced invalid snapshots leading to nonfinite movement.
  Bounded shape/reference validation and a finite derived-speed guard close that
  route; current awareness is re-derived rather than trusting a forged save.
- Returned changes originally omitted perception deltas. They now include the
  actual ordered sensory changes, with a replay equality test.
- Two older dietary tests attempted consumption from a different place. Their
  eaters are now at their sources; dietary assertions and expected-failure
  classifications were not weakened.
- Final independent seam review identified swallowed Tab/Space and focus loss.
  Food mode now permits native focus traversal/activation and preserves an
  equivalent control's focus across redraws.
- Browser automation initially raced page reload against the previous page's
  readiness flag. A context-local reload marker now requires the new document.

## Human evidence and limitations

The participant reported moving around on the first run while the forager ate
the food, then restarting and eating some food themselves. This is a narrow
human success: visible shared consumption was followed by a changed approach on
the next run. It does not establish that the camp objective was compelling or
that carrying and relocating food informed their decisions. Adaptation within
one continuing situation, rather than after restart, remains unverified.

**Unresolved discrepancy:** the participant described the forager eating all
the food. The final authored setup and deterministic test leave two of five
portions after it feeds. The played state/version has not been established;
an earlier save is a possibility, not a verified explanation. Preserve this
report and reproduce before attributing a cause or changing the balance.

The participant accepted command-stepped timing for this demo, while explicitly
rejecting pause as a multiplayer world rule. The shared-world direction is
server-owned time independent of player input: menus, hidden tabs and disconnects
cannot pause other actors, and returning observes current shared state rather
than restoring a personal snapshot. Pause and local restore remain demo-only
facilities, not multiplayer foundations.

**Outcome: qualified success** for the shared-resource mechanism and a small
instance of human adaptation, not validation of the full allocation/relocation
gameplay loop or shared-world architecture.

This is local browser storage, a static tile map, coarse sensing and discrete
choice time. There is no server deployment, offline catch-up, hunger regeneration,
general inventory/container framework, full terrain-aware visibility/scent,
learned taming or new Jev family. Stacked food retains separate actions while the
renderer shows one glyph on a tile. Camp progress counts visible ground food.
The external Claude Doc has not been synchronized.
