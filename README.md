# rpg-jev

A persistent multiplayer RPG whose world keeps its own agenda. [TypeSafe Jev](https://docs.typesafe.ai) makes every in-world decision, Claude authors the world on a background thread, and code owns rules, numbers and state. The main client is a browser WebGL2 renderer that draws glyphs on real 3D terrain.

**[SPEC.md](SPEC.md) is the source of truth** for the design, the stack and the milestones.

## Status

There is a playable proof of concept: one night at an inn, in a terminal, against live Jev. **[docs/poc-report.md](docs/poc-report.md)** says whether it is fun, what was verified, and what it costs.

- [spikes/m0-jev](spikes/m0-jev): does Jev judge social fiction the way people do? Done: three of four tests pass and the fourth misses narrowly. See the [findings](spikes/m0-jev/FINDINGS.md).
- [spikes/m2-families](spikes/m2-families): are speech-act choice, distortion choice and accept-offer usable? Done: yes, with conditions. See the [findings](spikes/m2-families/FINDINGS.md).
- [spikes/s0-spacetimedb](spikes/s0-spacetimedb): scoped infrastructure measurements completed; see the [qualified findings](spikes/s0-spacetimedb/FINDINGS.md), not a full-world capacity claim.
- [Thermal engineering validation](validation/thermal-learning/AUTOMATION.md): deterministic enumeration covers 5,509 arrangements and 24,553 probe placements, with numerical and shared-settlement probes. The bench is a development fixture, not the next player exercise. Results select finite warmth allocation for an inn sleeping place as the next interaction to develop; that interaction is not yet implemented.

## Play it

Needs Node 22.18 or newer and pnpm 11. Put `TYPESAFE_API_KEY=...` in `.env` (git-ignored). Without a key the game still runs, on code's fallbacks.

```sh
pnpm install
pnpm play            # resume the last night, or start one
pnpm play --new      # start over (the old night is kept for `pnpm friction`); --seed=7 for a different night
pnpm play --cost     # show calls, tokens and latency after each action
pnpm play --offline  # play with the judge unreachable
pnpm play --fast     # no pauses before people speak; --plain prints each turn as one block
```

Plain verbs always work (`look`, `go kitchen`, `take iron key`, `search barrel`, `talk to mara`, `show apron to mara`). Anything else, say it as you would: `tell mara I found her ledger in the cellar`, `ask tobin what he saw at dusk`. `why mara` walks the causes behind what someone believes. The event log in `saves/` is the save.

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
| `pnpm client` | Open the renderer at http://localhost:5174. `?study` compares glyphs and material states, `?stress` shows the performance scene, and Tab opens the editor |
| `pnpm demo` | Play the fixed script against live Jev; write `demo/transcript.md` and `demo/metrics.json` |
| `pnpm demo --record` | As above, and re-record `demo/recordings.json` for the offline test. Do this after changing a slice, a question or the content |
| `pnpm friction` | Read the saved nights and write `playtests/friction.md`: where play snagged. See `docs/playtest-loop.md` |
| `pnpm sdlc status` | The development loop: snag to pull request through GitHub issues, worktrees and a cheap model. Switched off. See `docs/sdlc.md` |
| `pnpm --filter @rpg-jev/terminal routes` | Play each quest route across seeds and write `demo/routes.md` |
| `pnpm --filter @rpg-jev/spike-m2-families probe` | Re-run the family probes |
| `pnpm format` | Apply Biome fixes |
