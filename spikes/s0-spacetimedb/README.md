# Spike S0: does SpacetimeDB hold as the world server?

Done, 2026-09-18. **The findings, numbers and recommendation are in [FINDINGS.md](FINDINGS.md).** The brief is [SPEC.md](../../SPEC.md), section 15.

## What is here

| Path | What it is |
| --- | --- |
| `module/src/index.ts` | The SpacetimeDB module (TypeScript): event log, entities, bitemporal edges, decision requests, fuses, and the bounded debt drain |
| `src/worker.ts` | The Jev worker: a SpacetimeDB client with a fake judge. It never calls TypeSafe and reads no key |
| `src/bench-*.ts` | One measurement script per checklist item; each writes `results/<name>.json` |
| `src/lib/` | Pure helpers (statistics, the fake judge's latency draw, the bitemporal predicate, metric parsing), tested in `test/` |
| `src/module_bindings/` | Generated client bindings. Git-ignored; `pnpm deploy:local` regenerates them |
| `.stdb/` | The local server's data and logs, and the local tokens of named clients (`.stdb/tokens/`). Git-ignored |
| `results/` | The numbers FINDINGS.md quotes |

## Reproduce

Needs the SpacetimeDB CLI (2.10.1 was used): in PowerShell, `iwr https://windows.spacetimedb.com -useb | iex`. Everything runs against a local standalone server on `127.0.0.1:3057`. Nothing is published to maincloud and no account is needed.

```sh
pnpm install                # from the repo root
cd spikes/s0-spacetimedb
pnpm server                 # terminal 1: local standalone server, data in .stdb/
pnpm deploy:local           # terminal 2: publish the module (wipes its data), regenerate bindings
pnpm bench:edges            # items 5 and 6. Run first, on a fresh server, for a clean memory baseline
pnpm bench:fuses            # item 2
pnpm bench:loop             # item 3 (starts and stops the worker itself)
pnpm bench:subscription     # item 4
pnpm bench:auth             # item 1: who may call which reducer, tried against the server
pnpm bench:seed <label>      # optional: insert cost and memory for 1M rows, on a fresh server and empty table
pnpm bench:restart --before # then stop the server within 60 s, wait until 90 s have passed, start it, and:
pnpm bench:restart --after
pnpm typecheck:bench        # typechecks the benches too (needs the generated bindings)
```

`pnpm typecheck` and the repo's `pnpm check` cover the module, `src/lib` and the tests, which do not need the CLI or the generated bindings.

Reducers that are not player intents refuse callers that are not registered workers. The benches and the worker connect under a name (`connect({ as: "bench" })`), and `src/lib/credentials.ts` has the module's owner register that identity through the CLI, which holds the local credentials that published the module. So `pnpm deploy:local` and the benches must run as the same OS user.
