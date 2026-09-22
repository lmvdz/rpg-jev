# Local authoritative shared clearing

This is the browser open-world multiplayer foundation, not a production host.
The server runs the existing generated ordinal-matter clearing; clients submit
intent and render caller-specific committed projections. No model, Iroh or
Matrix service is required.

## Run

Tested on Windows, Node 25.8.2, pnpm 11.15.1, SpacetimeDB CLI/SDK 2.10.1,
and installed Google Chrome with WebGL2. Other platforms remain unmeasured.

From the repository root, after `pnpm install`:

1. `pnpm world:server` — keep running. Binds only `127.0.0.1:3057`.
2. `pnpm world:publish` — additive publication of `rpg-open-world`; also
   regenerates checked-in browser bindings. Never uses `--delete-data`.
3. `pnpm world:archive` — keep running before playing.
4. `pnpm client` — open `http://localhost:5174/?shared`.

Use two independent browser sessions for distinct travellers. A reload keeps
the same identity via session storage. Duplicating a tab can copy its session;
that is the same identity, not another player. Use a separate browser profile
when testing distinct identities. Tokens are credentials: do not copy them into
issues, screenshots, archives or commits.

Keyboard movement waits for the host's accepted position. Right-click exposes
the existing compiled physical interactions, including searching for materials.
There is no client-side resolution, RNG, editor or time cheat in shared mode.
Some menu candidates may be refused by stricter current-state reach/awareness
checks; refusal never grants an effect.

## Authority and persistence

- One SpacetimeDB transaction owns each world commit. Authenticated sender
  identity selects a private actor binding; payloads cannot name another actor.
- The host rechecks movement, possession, perception and compiled effect targets.
  A command carries generation, sequence, observed revision and exact payload.
  Unrelated ticks do not invalidate input; a revision preceding that actor's
  last accepted command does. Reused sequence with changed payload is refused.
- Only the latest receipt is retained. A client seeing a later sequence cannot
  claim that its old command succeeded: it reports an unknown/conflicting outcome.
- The single scheduled reducer runs every 500 ms. Each tick applies 1/120
  legacy simulation minute of passive drift and one ordered opportunity for
  each autonomous body. Player activity does not grant extra NPC turns.
  This is not measured wall-clock catch-up or an offline scheduler.
- World/player/timer tables are private. Viewer rows are sender-filtered.
  Event rows are visible only to the registered archive worker. Clients receive
  discrete visible surfaces and their own whole-percent HUD meters, not hidden
  material properties or other actors' private routines. Identical quiet views
  can be suppressed for one tick; a two-tick heartbeat still reports the clock.
- `.stdb/data` contains the persistent host database. Stop and restart the host
  with the same directory to preserve state, admission and receipt sequences.
  Do not reset it to fix an ordinary connection problem.

The canonical JSON snapshot is deliberately a bounded-region implementation,
not a scalable sharded-world storage design. Generated terrain uses seed 1 on
both sides; this does not select the future geometry/parts representation.

## Archive and failure recovery

The owner-authorized worker appends generation-scoped events to
`.stdb/archive/rpg-open-world-<generation>.jsonl`, flushes them with `fsync`,
then acknowledges deletion of the corresponding hot database rows.
Restart/reconnect deduplicates exact event payloads. It never acknowledges a
failed write, mismatched payload, unknown frontier or another generation.

At 512 unarchived events, the world **pauses rather than loses history**.
The browser reports the archive backlog. Restore the archive worker to resume.
This may happen after roughly 256 seconds of idle ticks without a worker.

The worker uses an exclusive per-generation lock. After an actual crash, first
confirm no worker owns it; only then remove that stale lock. A torn archive
record or conflicting payload stops recovery. Preserve both the archive and
database for investigation; never truncate history or acknowledge past damage
blindly. Automatic repair, rollover and complete host-loss restoration are not
implemented.

Startup reads records incrementally. Limits are explicit: 1 MiB per JSON record,
10,000 rows per batch, and 1,000,000 distinct sequence digests per generation.
The digest index still grows to that limit; this is not indefinite archival.
Generation IDs isolate database recreations, not arbitrary rollback of the same
generation. There is no claimed archive/directory power-loss transaction.
The measured validation archive reached roughly 0.94 GB in 2,159 events:
quiet passive drift records remain expensive. Do not run this host indefinitely
as if an archival compaction/cost gate had passed.

Simulation-event replay does **not** reconstruct private authentication bindings
or rejected-command receipts. Ordinary restart recovery uses the durable
SpacetimeDB database, not the archive alone.

## Deliberate limits

- Eight lifetime anonymous admissions; no slot reclamation, accounts, reconnect
  after session-token loss, admission policy UI or character export.
- Loopback only. No TLS/reverse-proxy configuration, LAN/internet security,
  remote invitations, Iroh or Matrix integration.
- Existing finite/ordinal physical rules, not a complete survival RPG. No
  author thread, social-model worker, JEPA predictor or downloaded executable mod.
- No multi-hour load, bandwidth/operating-cost claim, integrated-GPU sign-off
  or human playability acceptance.

See [the validation record](../../validation/shared-world/README.md) for actual
workflow evidence, performance budgets and remaining gates.
