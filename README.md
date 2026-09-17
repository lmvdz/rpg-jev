# rpg-jev

A persistent multiplayer RPG whose world keeps its own agenda. [TypeSafe Jev](https://docs.typesafe.ai) makes every in-world decision, Claude authors the world on a background thread, and code owns rules, numbers and state. The main client is a browser WebGL2 renderer that draws glyphs on real 3D terrain.

**[SPEC.md](SPEC.md) is the source of truth** for the design, the stack and the milestones.

## Status

Repo scaffold only. Two spikes gate everything else:

- [spikes/m0-jev](spikes/m0-jev): does Jev judge social fiction the way people do?
- [spikes/s0-spacetimedb](spikes/s0-spacetimedb): does SpacetimeDB hold as the world server?

## Layout

```
packages/core    pure simulation code, no I/O (so far: the world's seeded RNG)
spikes/          throwaway experiments that answer one question each
SPEC.md          architecture spec
```

Packages planned in the spec (`jev`, `server`, `author`, `client`, `terminal`) are added when their milestone starts, not before.

## Setup

Needs Node 22.18 or newer and pnpm 11.

```sh
pnpm install
pnpm check      # lint, typecheck and tests
```

| Command | Does |
| --- | --- |
| `pnpm test` | Run the Vitest suite once |
| `pnpm test:watch` | Run it in watch mode |
| `pnpm typecheck` | Typecheck every package |
| `pnpm lint` | Biome lint and format check |
| `pnpm format` | Apply Biome fixes |

## Secrets

Keys live in a git-ignored `.env` file at the repo root and never reach a client.

| Variable | Needed from |
| --- | --- |
| `TYPESAFE_API_KEY` | Spike M0 |
| `ANTHROPIC_API_KEY` | M3, the author thread |
