# rpg-jev

An RPG being built toward persistent, independently operated worlds and portable characters. Code owns rules, numbers and state; [TypeSafe Jev](https://docs.typesafe.ai) judges bounded social choices. The playable inn is currently local and single-player. Live background authoring, hosted multiplayer and character travel are later milestones, not implemented features. The browser remains the primary-client direction; its WebGL2 renderer currently has separate local-world fixtures.

**[SPEC.md](SPEC.md) is the source of truth** for the design, the stack and the milestones.

## Status

**Active target: the browser open-world RPG.** Build on the existing renderer,
physical-world engine and JEPA research, not further terminal-inn features.
The current browser scenes are partial implementations, not yet the accepted
persistent open-world game. [SPEC §16](SPEC.md#16-milestones) records this change
of delivery priority and preserves the technical and research gates.

The terminal inn is an earlier playable proof of concept and regression fixture.
**[docs/poc-report.md](docs/poc-report.md)** records its historical findings.

- [spikes/m0-jev](spikes/m0-jev): does Jev judge social fiction the way people do? Done: three of four tests pass and the fourth misses narrowly. See the [findings](spikes/m0-jev/FINDINGS.md).
- [spikes/m2-families](spikes/m2-families): are speech-act choice, distortion choice and accept-offer usable? Done: yes, with conditions. See the [findings](spikes/m2-families/FINDINGS.md).
- [spikes/s0-spacetimedb](spikes/s0-spacetimedb): scoped infrastructure measurements completed; see the [qualified findings](spikes/s0-spacetimedb/FINDINGS.md), not a full-world capacity claim.
- [Thermal engineering validation](validation/thermal-learning/AUTOMATION.md): deterministic enumeration covers 5,509 arrangements and 24,553 probe placements, with numerical and shared-settlement probes. The bench is a development fixture, not the next player exercise. Results select finite warmth allocation for an inn sleeping place as the next interaction to develop; that interaction is not yet implemented.

## Run the browser world

```sh
pnpm install
pnpm client
```

Open `http://localhost:5174/` for the seeded landscape and world-interaction
renderer, or `http://localhost:5174/?food` for the bounded authoritative
movement/resource/save demonstration. Neither should be mistaken for the
finished open-world slice; connecting existing capabilities into a persistent
browser world is the active work. JEPA's research status is distinct from
implemented runtime behavior.

## Run the terminal regression fixture

Needs Node 22.18 or newer and pnpm 11. Put `TYPESAFE_API_KEY=...` in `.env` (git-ignored). Without a key the game still runs, on code's fallbacks.

```sh
pnpm install
pnpm play            # resume the last night, or start one
pnpm play --new      # start over (the old night is kept for `pnpm friction`); --seed=7 for a different night
pnpm play --cost     # show calls, tokens and latency after each action
pnpm play --offline  # play with the judge unreachable
pnpm play --fast     # no pauses before people speak; --plain prints each turn as one block
pnpm play --new --handwritten --save=supper  # the versioned, checked-in scheduled-proposal night
```

Plain verbs always work (`look`, `go kitchen`, `take iron key`, `search barrel`, `talk to mara`, `show apron to mara`). Anything else, say it as you would: `tell mara I found her ledger in the cellar`, `ask tobin what he saw at dusk`. `why mara` walks the causes behind what someone believes. The event log in `saves/` is the save.

`journal` recalls your character's earned accounts with stable note numbers and
sources. Use `tell mara about note 1` or `ask mara about note 1` when she is present.
These are ordinary conversation actions, not automatic persuasion or evidence
handovers. `why <name>` is an omniscient developer tool, not the player's journal.
Endings explicitly distinguish an out-of-scene epilogue from witnessed events.

The handwritten night starts you hungry while the staff hold the supper items.
Try `wait 3`, `take bread`, then `eat bread`: a queued, validated proposal places
real food in the room. Pending events survive quitting; resume with
`pnpm play --save=supper`, without the start flag. Standard nights and old saves
are unchanged. [Proposal evidence and limits](validation/m2-proposals/README.md)
distinguish this M2 content path from the still-unbuilt live author thread.

The [inn playtest](validation/m2-playability/PLAYTEST.md) remains available for
that fixture. It no longer blocks browser open-world work. Human acceptance of
the browser experience, not an inn verdict, is the current playability gate.

## Layout

```
packages/core      pure simulation: tables, the effect vocabulary, the event log and replay,
                   schedules, debts, claims and distortion, the conversation scheduler, why
packages/jev       the judge port: the eight question families, the slice compiler, and live,
                   recorded, scripted, caching, metered and resilient judges
packages/inn       the Gilded Carp: content, parser, slices, the game engine, prose templates
packages/terminal  pnpm play, pnpm demo, and the route harness
packages/client    WebGL2 glyph renderer, grown clearing, world editor and visual study
spikes/            experiments that answer one question each
demo/              the recorded demo: transcript, costs, recordings for the offline tests, routes
docs/              the world bible and the PoC report
SPEC.md            architecture spec
```

Packages planned in the spec (`server`, `author`) are added when their milestone starts, not before.

## Commands

| Command | Does |
| --- | --- |
| `pnpm check` | Lint, typecheck and tests. Tests run offline against recorded judge answers. The lint is strict (complexity, length, nested ternaries, unused code) and the tests include a ratchet on character names in engine code and coverage over every verb, thing, deed, voice and activity |
| `pnpm play` | Play the inn |
| `node validation/thermal-learning/validate.ts --out=<new-directory>` | Automate the thermal engineering checks using existing dependencies; see the report for a no-install launcher |
| `pnpm play --bench` | Optional development fixture, not a recommended player exercise; resumes `saves/thermal-bench.jsonl` |
| `pnpm client` | Open the renderer at http://localhost:5174. `?food` plays the [shared-food slice](docs/world/shared-food.md#implemented-interface); `?study` compares glyphs and material states, `?stress` shows the performance scene, and Tab opens the editor outside food mode |
| `pnpm demo` | Play the fixed script against live Jev; write `demo/transcript.md` and `demo/metrics.json` |
| `pnpm demo --record` | As above, and re-record `demo/recordings.json` for the offline test. Do this after changing a slice, a question or the content |
| `pnpm friction` | Read the saved nights and write `playtests/friction.md`: where play snagged. See `docs/playtest-loop.md` |
| `pnpm sdlc status` | The development loop: snag to pull request through GitHub issues, worktrees and a cheap model. Switched off. See `docs/sdlc.md` |
| `pnpm --filter @rpg-jev/terminal routes` | Play each quest route across seeds and write `demo/routes.md` |
| `pnpm --filter @rpg-jev/spike-m2-families probe` | Re-run the family probes |
| `pnpm format` | Apply Biome fixes |
