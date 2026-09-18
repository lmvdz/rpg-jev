# Spike S0: findings

Measured on 2026-09-18 against a local SpacetimeDB standalone server. The raw numbers are in [results/](results/); this page is the interpretation. How to rerun everything is in [README.md](README.md).

## Verdict

**SpacetimeDB holds as the world server. Go, with three conditions that change the design in SPEC sections 4, 9 and 18.** Nothing measured here is a reason to take the fallback.

1. **Fuses are not one scheduled reducer per debt.** Debts are ordinary rows, and one repeating scheduled reducer drains whatever is due, in `(due, id)` order, a bounded number per tick. One scheduled row per debt lost nothing up to 100,000 at once, but it fires in reverse order of insertion, it ignores the order of due times inside a burst, it makes every client's reducer call wait for the rest of the burst (1.95 s at 100,000), and a fuse that throws is consumed without a retry. The drain design was built and measured: in order, none lost, and a client's call never waited more than 17 ms while 100,000 debts drained.
2. **Closed rows need an archive worker from the start**, for the event log as much as for edges. Every row lives in memory, a million edge rows cost about 215 MB of server memory, and memory given up by deleted rows is reused but not handed back to the operating system until a restart.
3. **Reducers must check who calls them. Built and measured in this spike.** Out of the box any anonymous client can call any reducer, and before the guard an anonymous HTTP call to an ordinary reducer succeeded. The module now keeps a private table of worker identities, registered only by the identity that published it, and every reducer that is not a player intent refuses any other caller. An unregistered client's `commit_decision` and `apply_effect` were refused and wrote nothing to the event log; a registered worker's went through; the player intents stayed open; nobody but the owner could register a worker. The loop's overhead did not move (p50 4.1 to 4.8 ms with the guard, 4.1 to 4.7 ms without). Details are in "Item 1 in detail". Rule 1 ("only code writes world state") already held at the table level: anonymous SQL writes are refused and private tables are invisible.

The rest of the checklist passed without conditions: the request-and-commit loop adds about 4 ms to the judge's latency, a stale decision is rejected and logged, a positional subscription costs one 145-byte message per visible change and nothing for invisible ones, and the bitemporal query takes 0.1 to 0.4 ms at a million rows when an index leads to the NPC.

## Versions and machine

| | |
| --- | --- |
| SpacetimeDB CLI and standalone server | 2.10.1 (commit `3d76070`), installed with the official `iwr https://windows.spacetimedb.com -useb \| iex` |
| `spacetimedb` npm package (module library and client SDK) | 2.10.1 |
| Module language | TypeScript, run by the server in V8 |
| Node, pnpm, TypeScript | 25.8.2, 11.15.1, 7.0.2 |
| Machine | Windows 11 Pro build 26200, Intel i7-12700K (12 cores, 20 threads), 64 GB RAM |
| Server | `spacetime start` on `127.0.0.1:3057`, persistent (commit log on disk), default settings. Clients on the same machine, so there is no network in any number below |

Another Claude session was using the same machine throughout. Tail latencies (p99, max) moved between runs by a factor of two or more; medians were stable. Where two runs disagreed, both are given.

## Checklist

| # | Item | What was measured | Numbers | Result |
| --- | --- | --- | --- | --- |
| 1 | One write path, one event log | Tables written only through reducers; an append-only `event_log`; anonymous writes attempted | Anonymous SQL `INSERT` refused ("not authorized to run SQL DML"). Private tables not visible to clients. Scheduled reducer not callable by a client (HTTP 404). Before the guard, an anonymous HTTP call to an ordinary reducer succeeded (HTTP 200). With the guard (`pnpm bench:auth`): unregistered client refused on `commit_decision` and `apply_effect`, over the SDK and over bare HTTP (status 530), 0 event-log rows written, the request still `pending`; registered worker allowed, 1 log row each; `request_decision`, `move_entity` and `ping` still open to the unregistered client; self-registration and registration by a non-owner worker both refused, worker rows 1 before and 1 after; a worker the owner removed is refused again. Cost: none measurable on the loop | **Go**. Condition 3 built and measured |
| 2 | Scheduled fuses under load | One-off fuses due at one instant: 100, 1,000, 10,000, 100,000. Repeating: 100 and 1,000 at 100 ms. Throwing fuses, CPU-heavy fuses, restart with fuses pending. Then the drain design | None lost in any scenario. Firing delay p50/p99/max: 9/10/10 ms at 100; 12/17/18 ms at 1,000; 95/202/204 ms at 10,000; 1,036/2,073/2,094 ms at 100,000 (about 48,000 fuses per second). Order: exactly reversed. A client call during the 100,000 burst waited 1,953 ms. Drain design at 100,000: delay p50/p99 2.0/3.95 s, order kept, client call max 16 ms | **No-go as one scheduled row per debt. Go as a drained debt table** |
| 3 | Jev worker, request and commit | End-to-end latency, request reducer called to effect seen by a subscriber, with a fake judge drawing M0's latency; throughput at 1, 4 and 16 in flight; 25 decisions made stale on purpose | End to end p50/p99: 171/434 ms at 1; 187/465 ms at 4; 169/457 ms at 16, against a judge of 166/428, 182/461, 165/453 ms. Overhead of the loop p50 4.1 to 4.7 ms, p99 9 to 15 ms. Throughput 5.2, 20.1 and 83.6 decisions per second, which is the judge's latency and nothing else. With an instant judge: 332, 2,901 and 7,252 per second at 1, 16 and 64 in flight. Stale: 25 of 25 rejected, 0 committed, each logged as `decision_dropped` with the version wanted and the version seen | **Go** |
| 4 | Subscription near a position | 10,000 entities on a 1,024 by 1,024 map, a window of nine 32 by 32 cells (92 rows). Node client, not a browser | Initial window: 1 message, 4.9 KB (1.2 KB gzip), usable in 2 to 12 ms. A change inside the window: 1 message, 145 bytes, seen p50 2.6 to 4.3 ms, p99 6 to 10 ms after the mover sent it (one run had a 76 ms p99). A change outside the window: 0 messages, 0 bytes. 400 other subscribers elsewhere: no measurable cost. 100 other subscribers on the same window: p50 6.5 ms. Moving the window one cell: 3.0 KB and new rows usable in 16 ms as per-cell queries, 9.2 KB and 2.5 ms as one range query | **Go**. Browser not measured |
| 5 | Bitemporal edge query | "What did X believe at T, as known at K" at 1,000, 100,000 and 1,000,000 rows (100 rows per NPC, 90% closed), in a reducer, as one-off SQL and as a subscription; an unindexed variant for contrast; correctness checked at every size | Indexed by `(src, kind)`: reducer 0.39/0.20/0.23 ms mean on the server; SQL 0.16/0.16/0.12 ms p50 on the server; subscription applied in 1.9/1.6/1.3 ms p50. Flat in table size. Unindexed full scan: 0.7/33/188 ms in a reducer, 0.25/8/40 ms in SQL. Right answers at every size: 10 rows at a time the NPC knew, 0 rows before it had learned them | **Go** |
| 6 | Closed-row growth in memory | Server process memory while inserting 1,000,000 edge rows (90% closed), then archiving 910,001 closed rows, then refilling | 215 MB of private memory per million rows (275 MB at 1M against 60 MB empty); the server's own accounting says 122 MB rows plus 31 MB index keys. Linear. After archiving 91%: 307 MB, not lower. After refilling to 1M: 339 MB, so the freed space is reused. After a restart with 1M live rows: 239 MB. Archiving ran at 122,000 rows per second | **Go**, with condition 2 |

## Item 1 in detail: who may call what

Added after the first round, because the pull request's security scan flagged exactly this on `module/src/index.ts`. The rest of this page is the first round's measurements, taken before the guard existed; `results/fuses.json` and `results/loop.json` are those runs, and the runs with the guard sit beside them as `results/fuses-with-guard.json` and `results/loop-with-guard.json`.

- **How it is built.** Two private tables. `module_owner` holds one identity, written by the `init` lifecycle reducer, where `ctx.sender` is the identity that published the module (the documentation says so, and the row matched the CLI's local identity). `worker` holds the identities allowed to write. `add_worker` and `remove_worker` require the owner. `requireWorker(ctx)` passes a registered worker or the owner and throws a `SenderError` for anyone else; it is the first line of `apply_effect`, `commit_decision`, and every seeding, clearing, archiving, fuse, debt and drain-control reducer. `request_decision`, `move_entity` and `ping` are the player intents and stay open.
- **Scheduled reducers.** The documentation says a scheduled call arrives with the module's own identity as sender. `requireScheduler(ctx)` compares `ctx.sender` with `ctx.databaseIdentity`, and with it in place every fuse and every drain tick still fired (100,000 of 100,000, both designs). The server already refuses a client's call to a scheduled reducer (HTTP 404), so this guard is a second lock, and it was not reached from outside.
- **How a client becomes a worker.** A named client (`connect({ as: "bench" })`, the Jev worker as `jev-worker`) keeps the token the local server minted for it under the git-ignored `.stdb/tokens/`, and its identity is registered through the CLI, which carries the publisher's local credentials. Nothing is stored in the repo. Anything that connects without a name is a fresh anonymous identity: a player.
- **What was tried** (`results/auth.json`). Unregistered client: `request_decision` allowed; `commit_decision` refused, "caller is not a registered worker", 0 log rows; `apply_effect` refused, 0 log rows; the same two over bare HTTP with no token, status 530 and the same message; the request row still `pending` after all four. `add_worker` on itself refused, "only the module owner may do this"; `add_worker` by a registered worker who is not the owner refused; worker rows 1 before and 1 after; the stranger's `apply_effect` still refused afterwards. Registered worker: `commit_decision` allowed, 1 log row, request `committed`; `apply_effect` allowed, 1 log row. Unregistered client again: `move_entity` allowed (1 log row), `ping` allowed. After the owner removed the worker, its `apply_effect` was refused.
- **What it costs.** On the loop, nothing measurable: overhead p50 4.05, 4.45 and 4.75 ms at 1, 4 and 16 in flight with the guard, against 4.74, 4.13 and 4.71 ms without; with an instant judge 2.71 ms against 2.84 ms; 25 of 25 stale decisions still dropped. A guarded `apply_effect` by a worker returned in p50 1.40 ms, the unguarded `ping` in 1.34 ms. A refused call changes no rows, so back to back it shows the 15.6 ms Windows stall described below (p50 15.4 ms).
- **One cost that is real.** On one scheduled row per debt, the scheduler guard cost about 10 microseconds a fuse: 48,459 fuses a second without it and 32,893 with it at 100,000 fuses, in two runs taken back to back (`results/fuses-ab-without-scheduler-guard.json` and `results/fuses-with-guard.json`), and 33,402 in an earlier guarded run whose file was not kept. Reading `ctx.sender` and `ctx.databaseIdentity` is not free at that volume. The drain design pays it once a tick and was unchanged (25,128 debts a second with the guard, 24,833 and 25,080 without; a client's call during that guarded drain waited at most 31 ms, against 16 to 17 ms in the other runs, which is within the noise of this machine). It is one more reason for the drain, and no reason to drop the check.
- **What this does not settle.** Player intents are open to any identity, and nothing here ties an identity to a player or limits how fast it may call. That is authentication and rate limiting, needed before M5, not part of S0. The `belief_count` procedure is unguarded because it only reads a public table.

## Item 2 in detail: fuses

A fuse here is a row in a scheduled table; its reducer writes the due time and `ctx.timestamp` into `fuse_fired`. While a burst ran, a second connection called a trivial reducer back to back and recorded each round trip, which is what a player's action would wait.

| Scenario | Fired | Delay p50 / p90 / p99 / max (ms) | Burst length | Order | A client's call during the burst |
| --- | --- | --- | --- | --- | --- |
| 100 one-off, one due time | 100 of 100 | 8.9 / 9.7 / 9.9 / 9.9 | 3 ms | reversed | 5 ms |
| 1,000 one-off | 1,000 of 1,000 | 11.7 / 16.2 / 17.4 / 17.6 | 13 ms | reversed | 17 ms |
| 10,000 one-off | 10,000 of 10,000 | 95 / 183 / 202 / 204 | 199 ms | reversed | 188 ms |
| 100,000 one-off | 100,000 of 100,000 | 1,036 / 1,885 / 2,073 / 2,094 | 2,087 ms | reversed | 1,953 ms |
| 1,000 one-off, due 1 microsecond apart | 1,000 of 1,000 | 10.8 / 15.4 / 16.4 / 16.5 | 12 ms | reversed (998 of 999 neighbours out of order) | 6 ms |
| 1,000 one-off, every tenth throws | 900 of 900 | 15 / 21 / 23 / 23 | 20 ms | reversed | 16 ms |
| 200 one-off, each about 8.7 ms of CPU | 200 of 200 | 856 / 1,574 / 1,731 / 1,748 | 1,747 ms | reversed | 636 and 1,116 ms |
| 10,000 debts, drained 500 per 20 ms tick | 10,000 of 10,000 | 193 / 351 / 382 / 382 | 376 ms | in order | p50 3.8, max 16 ms |
| 100,000 debts, drained 500 per 20 ms tick | 100,000 of 100,000 | 1,997 / 3,600 / 3,952 / 3,998 | 3,987 ms | in order | p50 6.3, max 16 ms |

Repeating fuses at 100 ms held their rate: 100 fuses fired 50 times each in 5 s, and 1,000 fuses fired 50 times each. The gap between firings was 99.9 and 99.6 ms on average, but individual gaps ran from 75 to 125 ms. While they ran, a client's call took p50 2 to 2.6 ms, p90 16 ms, max 34 and 54 ms. With no fuses running the same call took p50 1.9 ms, p99 3.5 ms.

What this says about the reviewer's report:

- **Pipelining: confirmed.** Due scheduled reducers and client reducer calls share one serial queue, and a burst of due rows goes in as a block. A call that arrives during a burst waits for what is left of it. With cheap fuses that is 200 ms at 10,000 and 2 s at 100,000. With fuses that do real work it is the sum of that work: 1.1 s for 200 fuses of 8.7 ms.
- **Ordering: worse than reported.** Fuses due in one wake-up fire in reverse order of insertion, and spreading the due times a microsecond apart changed nothing. Rule 9 needs a replay to land the same way, so nothing may depend on the order in which the server fires scheduled rows.
- **Isolation: holds for data, not for the debt.** A fuse that throws rolls back its own transaction and does not disturb the others: 900 of the 900 healthy ones fired. But the throwing fuse's row is gone afterwards and it is not retried. The only trace is a `PANIC` line in the module log. A debt whose reducer throws would be silently lost.
- **Dropped: none.** Nothing was lost at any size, and 100 fuses whose due time passed while the server was stopped all fired when it came back (52.9 s late in the final run, which is how long it was down past the due time).

The drain design answers all four. One repeating row wakes a reducer every 20 ms; it reads the `debt` table through an index on `(due, id)`, takes at most 500 due rows, deletes them and applies them. Order is ours, a tick is bounded (about 20 microseconds a debt, so 10 ms for 500), client calls interleave between ticks, and a debt that cannot be applied is a row we still hold, to be logged as dropped by code and not lost by the scheduler. It costs throughput under a pathological burst (25,000 debts a second against 48,000) and nothing otherwise. It is also the more portable design: the fallback needs a `setInterval` and the same table.

## Item 3 in detail: the loop

The worker is a separate Node process and an ordinary client. It subscribes to `SELECT * FROM decision_request WHERE status = 'pending'`, waits out a latency drawn from a lognormal fitted to M0's p50 163 ms and p99 462 ms, and calls `commit_decision`. The reducer re-reads the actor, compares its version with the one stored in the request, and either applies the effect or writes a `decision_dropped` row to the log. The bench measures from just before its `request_decision` call to the moment its own subscription delivers the log row.

- The loop's own cost is two committed transactions and two subscription deliveries: p50 4 to 5 ms.
- Throughput is set by the judge. 16 in flight gave 83.6 decisions a second; with the judge removed the same loop did 2,901 a second at 16 in flight and 7,252 at 64.
- An earlier run on the busy machine showed overhead p99 of 101 ms at 4 in flight and 77 ms at 16, with the same medians. The run in `results/loop.json` is the quieter one.
- The precondition that fails on purpose: a request is written, the bench then changes the actor through `apply_effect` before the judge has answered, and the commit finds version 1 where the request recorded 0. 25 of 25 were dropped and logged, none applied.
- The worker has no cap on requests in flight and the fake judge never fails. A real worker needs both a cap and a timeout path.

## Item 4 in detail: subscriptions

- Subscription SQL accepts both shapes tried: equality on an indexed cell column (nine queries, one per cell) and a range on `x` and `y` (one query). Both deliver exactly the rows in the window, and both send nothing at all for changes outside it.
- An update is one message of 145 bytes for a row of eight scalar columns. Gzip does not change that: small messages are sent uncompressed. It cut the initial window from 4.9 KB to 1.2 KB.
- A row that moves into the window arrives as an insert, and one that moves out arrives as a delete. Checked once each.
- Moving the window is cheaper as per-cell queries (subscribe three new cells, then drop three: 3.0 KB) than as a range (subscribe the whole new window, then drop the old: 9.2 KB, because the overlap is sent again). The per-cell version took longer to apply in this run (16 ms against 2.5 ms); both are far inside one game tick.
- The server's cost per change did not move with 400 extra subscribers on other windows (mover round trip p50 3.9 ms against 2.4 to 4.2 ms without them). 100 extra subscribers on the same window raised it to 6.5 ms, which is the fan-out.
- `withConfirmedReads(true)` made no measurable difference (p50 3.9 ms). Whether the flag changes anything on a local standalone server was not established.
- Not measured: a browser. The client SDK is the same npm package with a browser build, so the protocol and the byte counts are the same, but nothing here ran in one. Also not measured: one transaction that changes hundreds of visible rows at once, which is what a village tick would do.

## Item 5 in detail: the bitemporal query

The edge table is SPEC section 4's shape with `valid_to` set to the largest i64 for an open row, so the column stays a plain indexed integer in both SpacetimeDB and the fallback. Indexes: the primary key, a btree on `(src, kind)` and a btree on `valid_to` for the archiver.

- **The query is cheap because it never looks at history that is not the NPC's.** The index takes it to the 100 rows of one NPC and the three time comparisons run over those. Time is flat in the table's total size from 1,000 to 1,000,000 rows.
- **A query that cannot start from an index scans everything**: 188 ms in a reducer at a million rows, during which the world is stopped. "Who believed claim C at time T" needs its own index on `(dst, kind)`. No decision may run an unindexed query, which SPEC section 4 already says in other words.
- **Indexes that are possible:** btree, single or multi-column, with equality on a prefix and a range on the next column. There is no interval or range-containment index, so `valid_from <= T < valid_to` is always a filter after the index seek. That is fine while one NPC's history is hundreds of rows, and it is the reason to archive.
- **Where the query can be expressed:** everywhere. In a reducer through the index accessor; as one-off SQL over HTTP (0.12 ms on the server, 2.5 ms seen by the client); as a subscription, which also follows a close-and-insert live (the closed row arrived as a delete, the new one as an insert); and as a procedure that returns the count to its caller. Subscriptions take SQL text, so "as known at K" is a literal in the query: a client that wants a different K subscribes again.
- A multi-column index is not free. Changing the archiver's index from `(valid_to)` to `(valid_to, id)` raised memory from 215 to 334 MB per million rows and made nothing faster (`results/edges-composite-valid-to-index.json`). Replacing `(src, kind)` with `(src)` alone changed nothing (276 against 281 MB at a million rows; `results/seed-index-*.json`).
- Insert cost grows with the table: a 50,000-row insert took 150 ms into an empty table and 670 ms at a million rows, about 3 to 13 microseconds a row. The cause was not found. At the rates below it does not matter.

## Item 6 in detail: closed rows, and the archival policy

Close-and-insert ran at 14,600 pairs a second at a million rows (100 pairs per reducer call, 6.6 ms a call). The world will not get near that, so the question is only how much memory the closed rows hold.

| State | Edge rows | Server private memory |
| --- | --- | --- |
| Empty | 0 | 60 MB |
| | 100,000 | 106 MB |
| | 500,000 | 183 MB |
| | 1,000,000 | 275 MB |
| After archiving every closed row | 100,000 | 307 MB |
| After refilling | 1,000,000 | 339 MB |
| After a restart, same rows | 1,000,000 | 239 MB |

- **215 MB per million edge rows**, open or closed. The server's own accounting is 128 bytes a row plus 32 bytes of index keys; the process pays about 1.35 times that.
- **The event log is heavier.** By the server's accounting a log row with a short JSON payload is 232 bytes plus 16 of index keys, against 160 for an edge. At the same ratio that is roughly 335 MB per million log rows. That figure is an estimate; only edges were measured at scale.
- **Deleting rows does not shrink the process**, but the space is reused: refilling 900,000 rows cost 32 MB, not 190. So memory follows the high-water mark of live rows until the next restart.
- **A restart replays the whole commit log**, including rows that were archived long ago. With 2.8 million inserts and 0.9 million deletes in the log, the server took 16.7 s from launch to its first answer (15.4 s of replay); other runs of similar size took 6.0 and 9.5 s. Only the initial snapshot existed on disk in every run, so snapshots did not shorten any of these. The commit log was 194 MB on disk.

How fast closed rows arrive is not something this spike could measure, because the village does not exist. SPEC section 9 gives an upper bound: one gossip exchange per pair per 35 game minutes. If 200 NPCs each have one exchange every 35 minutes for 16 hours a day and each exchange closes two edges, that is about 11,000 closed rows per game day, or a million in 90 game days. The log will grow several times faster than the edges, since every effect is a log row.

**Proposed policy:**

1. **Archive by count, not by date.** Keep the hot `edge` table under 250,000 closed rows and the hot `event_log` under 500,000 rows. Together that is a budget of about 250 MB above the empty server. The counts are thresholds in code, checked by the archive worker.
2. **An archive worker, shaped like the Jev worker.** It reads the oldest closed rows with one-off SQL, appends them to the archive (a file per game day is enough until a query becomes painful; SPEC section 18 already names SurrealDB or Raphtory for later), confirms the write, and only then calls `archive_closed(before, limit)`.
3. **Small batches.** The delete costs about 8 microseconds a row, and a reducer holds the world while it runs: 2,000 rows a call is about 16 ms. The spike's 20,000-row calls took 155 ms at the median, which is too long.
4. **Closed rows stay hot for a horizon** (start with seven game days) so that `why` and NPCs citing causes do not need the archive for recent events. Open rows are never archived.
5. **The archive is the save.** Rule 9 replays our event log, not SpacetimeDB's commit log. Once the archive holds the log, the hot database can be rebuilt from it, and that is also how SpacetimeDB's own commit log gets truncated: publish with a clean database and replay ours. How often to do that is decided by restart time; at 15 s for 3.7 million row operations it is not urgent.

## The three S0 questions in SPEC section 17

- **How do scheduled reducers in a TypeScript module behave under load?** They do not drop, and they survive a restart. They fire about 48,000 a second, in reverse insertion order within a wake-up, as a block that client calls queue behind, and a throwing one is consumed without retry. The reviewer's pipelining report is confirmed; isolation of data between reducers holds. Use one repeating reducer that drains a debt table in bounded batches. Settled.
- **Are SpacetimeDB procedures stable?** In 2.10.1 a TypeScript procedure compiled, published as a hot update that kept a million rows, and answered over HTTP in 2 ms with the right values (10 and 0 for the two belief questions). The documentation page, as fetched on 2026-09-18, marks procedures unstable for C# and C++ only. The reference shipped with the CLI documents `ctx.withTx`, `ctx.http.fetch` and scheduled procedures. We still do not need them: workers make every outbound call, and a procedure that calls a model from inside the database would blur the line rule 1 and section 4 draw. One use is worth keeping in mind: a read that returns a value to its caller, which a reducer cannot do. Settled as "stable enough, not needed".
- **How fast do closed edge rows grow in memory, and when are they archived?** 215 MB per million rows; the arrival rate is an estimate of 11,000 a game day for 200 NPCs; archive by count with the policy above. Settled for edges, estimated for the event log.

**Hosting limits learned** (read from pages, not tested): the licence is BSL 1.1 with a grant for one SpacetimeDB instance in production and no database-as-a-service use, changing to AGPL v3 with a linking exception on 2031-09-08. Maincloud, per its pricing page as fetched, has a free tier of 2,500 TeV a month (about 1 GB of table storage), Pro at $25 with 100,000 TeV and Team at $250 with 250,000 TeV, and meters reducer calls, bytes scanned and written, index seeks, CPU, egress and table storage. Since every row is in memory and metered, the archival policy is also the cost policy. `spacetime start` listens on `0.0.0.0:3000` unless told otherwise, and its page pool is capped at 8 GiB by default.

## Things found on the way

- **The SDK's types do not survive `exactOptionalPropertyTypes`.** With the repo's base tsconfig, `InferSchema<typeof spacetimedb>` collapses to `never` and every `ctx.db` access fails to typecheck. The spike's tsconfig turns that option off and sets `moduleResolution` to `bundler`. The world-server package will need the same exception.
- **Generated client bindings import without file extensions**, so Node cannot run them by type stripping and they break the repo's import convention. `src/deploy.ts` rewrites them after every generate. They are erasable-syntax clean otherwise.
- **The CLI's default server is maincloud**, and `spacetime init --local` still wrote `"server": "maincloud"` into the template's `spacetime.json`. This spike hard-codes the loopback address in `src/lib/cli.ts` and passes `--server` on every call. The CLI's default was also switched to `local` on this machine.
- **Publishing locally "logs in" to the local server**: it mints a local identity and stores its token in the CLI's config under `%LOCALAPPDATA%\SpacetimeDB`. No account was created and nothing left the machine.
- **A reducer reply costs a commit.** A call that changes rows returns in 1.7 to 2.4 ms; one that changes nothing returns in 0.4 ms.
- **A 15.6 ms stall on Windows.** Calls that change no rows, sent back to back, mostly took 15 to 16 ms each (247 of 300), and 0.4 ms when spaced 5 ms apart. It looks like the Windows timer tick. It also shows as the 16 ms p90 of client calls while scheduled reducers run, and as the 75 to 125 ms spread of a 100 ms repeating fuse. Cause not investigated; Linux not tested.
- **Hot publish keeps data** when the change is additive: adding a procedure republished over a million rows in place.

## Verified and believed

**Verified by measurement here** (local standalone 2.10.1, Windows, one machine, loopback): every number in the checklist and the detail sections; that anonymous SQL writes are refused; that an anonymous client can call an ordinary reducer unless the reducer checks its caller; that with the caller check built, an unregistered client cannot commit a decision or apply an effect (over the SDK or bare HTTP) and writes nothing to the event log when it tries, a registered worker can, the player intents stay open, only the owner can register or remove a worker, and scheduled reducers still fire when they require the database's own identity as sender; that `init` receives the publisher's identity; that the caller check costs the loop nothing measurable and costs one scheduled row per debt about 10 microseconds a fuse; that pending fuses survive a stop and fire on restart; that a throwing fuse is consumed; that deleted rows' space is reused and not returned; that the belief query is right at every size; that a TypeScript procedure runs.

**Measured once, or noisy:** tail latencies on a shared machine; restart time (6.0, 9.5 and 16.7 s for logs of similar size); the crossing of a row into and out of a subscription window (once each); the scheduled reducer's refusal of a client call (one HTTP attempt; the 404 said "No such procedure", but a wrong argument encoding was not ruled out); the 15.6 ms stall (one 300-call probe, not kept as a script, and seen again as the 15.4 ms p50 of refused calls in `bench:auth`); the refusals in `bench:auth` (one attempt per case, in one run); the fuse cost of the scheduler guard (one back-to-back pair of runs, plus one earlier guarded run that agreed).

**Believed, not verified:**

- That Linux and maincloud behave like this. The timer-tick effects are probably Windows only, which would make fuse delays and jitter better elsewhere, not worse.
- That a browser client costs the same as the Node client. Same SDK, same protocol, not run.
- That periodic snapshots bound restart time. Only the initial snapshot was ever written in these runs, and the cadence was not found in the docs read.
- The event log's 335 MB per million rows, scaled from the server's accounting by the ratio seen for edges.
- The arrival rate of closed rows, derived from SPEC section 9's gossip limit and not from a running village.
- The hosting and licence facts, which were read through a summarising fetch of the pricing page and the licence file on 2026-09-18 and not checked against an account or a lawyer.
- That the documentation is silent on ordering, failure and restart of scheduled reducers. The scheduled-tables page as fetched said nothing on any of them; other pages were not searched exhaustively.

**Not measured at all:** sustained load over hours; a transaction that updates hundreds of subscribed rows at once; more than about 400 connections; a browser; the fallback (Node with embedded SurrealDB), so this spike says SpacetimeDB is good enough and says nothing about which of the two is better.

## Proposed SPEC changes

The spike left SPEC.md alone. The go and its three conditions were accepted by the owner on 2026-09-18, and the changes below are now in SPEC.md sections 4, 9, 13, 17 and 18.

- **Section 4, Concurrency.** Add: every reducer that is not a player intent checks `ctx.sender` against an allow-list of worker identities, kept in a private table that only the publishing identity (captured in `init`) can change; scheduled reducers require the database's own identity as sender. S0 built and measured this. Tying an identity to a player, and rate-limiting the open intents, is a separate question for M5. Add: a decision's hard precondition is a version on the rows it read, compared at commit; this is what S0 built.
- **Section 4, Temporal graph.** State that an open row's `valid_to` is the largest i64, not null, so the column is a plain indexed integer in both servers. State the index rule: every decision-path query starts from an index that leads to one entity's rows, `(src, kind)` for beliefs; a question that starts from the other end gets its own index or goes to the archive.
- **Section 9, Causal debt ledger.** Replace "SpacetimeDB scheduled reducers for debt fuses" with: debts are rows with a due time; one repeating scheduled reducer drains due debts in `(due, id)` order, at most N per tick (start with 500 per 20 ms); firing order is ours and is what the log records. A debt that cannot be applied is settled as dropped by code, never by an exception.
- **Section 13 or 18, Event log.** Add the archival policy above: count thresholds, an archive worker, 2,000-row batches, a seven-day hot horizon, and the archive as the save.
- **Section 17.** Close the three S0 questions with the answers above. Add two: how much memory a million event-log rows really cost (measure when the village produces them), and whether the 15.6 ms effects exist on the Linux host we would deploy to. The hosting question can record the BSL one-instance grant.
- **Section 18, Technology table.** World server: decided, SpacetimeDB 2.10.x. Timers: one repeating scheduled reducer draining a debt table. Jev worker and State sync: decided. Add a row: Archive worker, a Node client that moves closed edges and old log rows out of memory. Note the tsconfig exception the SDK needs.
