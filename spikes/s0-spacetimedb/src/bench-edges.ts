// Items 5 and 6: the bitemporal edge query at 1k, 100k and 1M rows, in a reducer, as one-off
// SQL and as a subscription; then what closed rows cost in server memory and what archiving
// them gives back.
import { join } from "node:path";
import { connect, saveResult, sleep, subscribe } from "./conn.ts";
import { beliefSql } from "./lib/bitemporal.ts";
import { directoryMb, type ServerMemory, serverMemory } from "./lib/memory.ts";
import { meanMsBetween, reducerTime, scrape, type TableSize, tableSize } from "./lib/metrics.ts";
import { sql } from "./lib/sql.ts";
import { round, type Summary, summarize } from "./lib/stats.ts";
import type { DbConnection } from "./module_bindings/index.ts";

const CLAIMS = 10;
const VERSIONS = 10;
const ROWS_PER_SRC = CLAIMS * VERSIONS;
const SRCS_PER_CALL = 500;
const DATA_DIR = join(import.meta.dirname, "..", ".stdb", "data");

// Version 4 of every claim is valid at 4500 and was learned at 4030 + claim: ten rows.
const AT = 4_500n;
const KNOWN = 4_500n;
// Valid at 4010 for every claim, but not learned until 4030 at the earliest: no rows.
const AT_EARLY = 4_010n;
const KNOWN_EARLY = 4_020n;

async function timed(run: () => Promise<unknown>): Promise<number> {
  const started = performance.now();
  await run();
  return performance.now() - started;
}

/** Calls are spaced 5 ms apart: back-to-back calls that change no rows stall a timer tick (FINDINGS). */
async function repeatTimed(times: number, run: (i: number) => Promise<unknown>): Promise<Summary> {
  const samples: number[] = [];
  for (let i = 0; i < times; i++) {
    samples.push(await timed(() => run(i)));
    await sleep(5);
  }
  return summarize(samples);
}

async function edgeCount(): Promise<number> {
  const result = await sql("SELECT COUNT(*) AS n FROM edge");
  return Number(result.rows[0]?.[0] ?? 0);
}

type QueryResult = {
  edges: number;
  memory: ServerMemory;
  correct: { rowsAtKnown: number; rowsBeforeLearned: number };
  pingRttMs: Summary;
  table: TableSize;
  reducerIndexedRttMs: Summary;
  reducerIndexedServerMeanMs: number;
  reducerFullScanRttMs: Summary;
  reducerFullScanServerMeanMs: number;
  sqlIndexedServerMs: Summary;
  sqlIndexedClientMs: Summary;
  sqlUnindexedServerMs: Summary;
  subscriptionAppliedMs: Summary;
  subscriptionRows: number;
};

async function resultRows(tag: string): Promise<number> {
  const result = await sql(`SELECT rows FROM query_result WHERE tag = '${tag}'`);
  return Number(result.rows[0]?.[0] ?? -1);
}

async function measureQueries(conn: DbConnection, srcs: number): Promise<QueryResult> {
  const src = (i: number): bigint => BigInt(1 + ((i * 7919) % srcs));

  await conn.reducers.queryBelief({ tag: "known", src: 1n, at: AT, knownAt: KNOWN, repeat: 1 });
  await conn.reducers.queryBelief({
    tag: "early",
    src: 1n,
    at: AT_EARLY,
    knownAt: KNOWN_EARLY,
    repeat: 1,
  });
  const correct = {
    rowsAtKnown: await resultRows("known"),
    rowsBeforeLearned: await resultRows("early"),
  };

  const pingRttMs = await repeatTimed(200, (i) => conn.reducers.ping({ n: i }));
  const before = await scrape();
  const reducerIndexedRttMs = await repeatTimed(200, (i) =>
    conn.reducers.queryBelief({ tag: "q", src: src(i), at: AT, knownAt: KNOWN, repeat: 1 }),
  );
  const reducerFullScanRttMs = await repeatTimed(5, () =>
    conn.reducers.queryBeliefScan({ tag: "scan", dst: 3n, at: AT, knownAt: KNOWN }),
  );

  const after = await scrape();

  const serverMs: number[] = [];
  const clientMs: number[] = [];
  for (let i = 0; i < 100; i++) {
    const result = await sql(beliefSql(src(i), AT, KNOWN));
    serverMs.push(result.serverMicros / 1000);
    clientMs.push(result.clientMs);
  }
  const unindexed: number[] = [];
  for (let i = 0; i < 5; i++) {
    const result = await sql(
      `SELECT COUNT(*) AS n FROM edge WHERE dst = 3 AND valid_from <= ${AT} AND valid_to > ${AT}`,
    );
    unindexed.push(result.serverMicros / 1000);
  }

  const applied: number[] = [];
  let subscriptionRows = 0;
  for (let i = 0; i < 20; i++) {
    const client = await connect();
    applied.push(await timed(() => subscribe(client.conn, [beliefSql(src(i), AT, KNOWN)])));
    subscriptionRows = Number(client.conn.db.edge.count());
    client.conn.disconnect();
  }

  return {
    edges: await edgeCount(),
    memory: serverMemory(),
    correct,
    pingRttMs,
    reducerIndexedRttMs,
    table: tableSize(after, "edge"),
    reducerIndexedServerMeanMs: meanMsBetween(
      reducerTime(before, "query_belief"),
      reducerTime(after, "query_belief"),
    ),
    reducerFullScanRttMs,
    reducerFullScanServerMeanMs: meanMsBetween(
      reducerTime(before, "query_belief_scan"),
      reducerTime(after, "query_belief_scan"),
    ),
    sqlIndexedServerMs: summarize(serverMs),
    sqlIndexedClientMs: summarize(clientMs),
    sqlUnindexedServerMs: summarize(unindexed),
    subscriptionAppliedMs: summarize(applied),
    subscriptionRows,
  };
}

type GrowthPoint = { edges: number; workingSetMb: number; privateMb: number; seedCallMs: number };

async function growTo(
  conn: DbConnection,
  srcsNow: number,
  srcsWanted: number,
  growth: GrowthPoint[],
): Promise<void> {
  let have = srcsNow;
  while (have < srcsWanted) {
    const add = Math.min(SRCS_PER_CALL, srcsWanted - have);
    const seedCallMs = await timed(() =>
      conn.reducers.seedEdges({
        srcStart: BigInt(have + 1),
        srcCount: add,
        claims: CLAIMS,
        versions: VERSIONS,
      }),
    );
    have += add;
    if (have % 1000 === 0 || have === srcsWanted) {
      growth.push({
        edges: have * ROWS_PER_SRC,
        ...serverMemory(),
        seedCallMs: Math.round(seedCallMs),
      });
    }
  }
}

type SubscriptionFollow = { closedSeenAsDelete: number; insertedSeenAsInsert: number };

/** A subscription on "what X believes now" must follow a close-and-insert. */
async function subscriptionFollowsChurn(conn: DbConnection): Promise<SubscriptionFollow> {
  const client = await connect();
  let deletes = 0;
  let inserts = 0;
  await subscribe(client.conn, [beliefSql(1n, 50_000n, 50_000n)]);
  client.conn.db.edge.onDelete(() => deletes++);
  client.conn.db.edge.onInsert(() => inserts++);
  await conn.reducers.churnEdges({ srcStart: 1n, srcCount: 1, dst: 3n, now: 40_000n });
  await new Promise((resolve) => setTimeout(resolve, 300));
  client.conn.disconnect();
  return { closedSeenAsDelete: deletes, insertedSeenAsInsert: inserts };
}

type ChurnResult = { closeAndInsertPerSecond: number; callMs: Summary; pairsPerCall: number };

async function churn(conn: DbConnection, srcs: number): Promise<ChurnResult> {
  const pairsPerCall = 100;
  const calls = 100;
  const callMs = await repeatTimed(calls, (i) =>
    conn.reducers.churnEdges({
      srcStart: BigInt(1 + ((i * pairsPerCall) % (srcs - pairsPerCall))),
      srcCount: pairsPerCall,
      dst: BigInt(i % CLAIMS),
      now: BigInt(20_000 + i),
    }),
  );
  // Time inside the calls only; the 5 ms spacing between calls is not the server's.
  const seconds = (callMs.mean * calls) / 1000;
  return {
    closeAndInsertPerSecond: Math.round((calls * pairsPerCall) / seconds),
    callMs,
    pairsPerCall,
  };
}

type ArchiveResult = {
  before: { edges: number; memory: ServerMemory };
  after: { edges: number; memory: ServerMemory };
  archived: number;
  batchLimit: number;
  batchCallMs: Summary;
  rowsPerSecond: number;
};

async function archive(conn: DbConnection): Promise<ArchiveResult> {
  const batchLimit = 20_000;
  const before = { edges: await edgeCount(), memory: serverMemory() };
  const callMs: number[] = [];
  const started = performance.now();
  let archived = 0;
  for (;;) {
    callMs.push(
      await timed(() => conn.reducers.archiveClosed({ before: 1_000_000n, limit: batchLimit })),
    );
    const moved = await resultRows("archive");
    archived += moved;
    if (moved < batchLimit) break;
  }
  const seconds = (performance.now() - started) / 1000;
  return {
    before,
    after: { edges: await edgeCount(), memory: serverMemory() },
    archived,
    batchLimit,
    batchCallMs: summarize(callMs),
    rowsPerSecond: Math.round(archived / seconds),
  };
}

async function main(): Promise<void> {
  const { conn } = await connect();
  if ((await edgeCount()) !== 0)
    throw new Error("edge table is not empty: run `pnpm deploy:local` first");
  const empty = serverMemory();
  const growth: GrowthPoint[] = [{ edges: 0, ...empty, seedCallMs: 0 }];
  const queries: QueryResult[] = [];
  let srcs = 0;
  for (const wanted of [1_000, 100_000, 1_000_000]) {
    await growTo(conn, srcs, wanted / ROWS_PER_SRC, growth);
    srcs = wanted / ROWS_PER_SRC;
    const result = await measureQueries(conn, srcs);
    console.log(JSON.stringify(result));
    queries.push(result);
  }

  const follows = await subscriptionFollowsChurn(conn);
  console.log(JSON.stringify(follows));
  const churned = await churn(conn, srcs);
  console.log(JSON.stringify(churned));
  const diskMbBeforeArchive = directoryMb(DATA_DIR);
  const archived = await archive(conn);
  console.log(JSON.stringify(archived));
  const afterArchive = await measureQueries(conn, srcs);

  // Does the space archived rows leave get reused? Refill to the old size and look at memory again.
  const refill: GrowthPoint[] = [];
  await growTo(conn, srcs, srcs + 9_000, refill);
  const refilled = { edges: await edgeCount(), memory: serverMemory() };
  console.log(JSON.stringify({ refilled }));

  const first = growth[0];
  const last = growth[growth.length - 1];
  const biggest = queries[queries.length - 1]?.table;
  const perMillion =
    first && last && biggest
      ? {
          serverAccountedRowMbPerMillionRows: round(
            ((biggest.rowBytes / biggest.rows) * 1e6) / (1024 * 1024),
          ),
          serverAccountedIndexKeyMbPerMillionRows: round(
            ((biggest.indexKeyBytes / biggest.rows) * 1e6) / (1024 * 1024),
          ),
          rows: last.edges,
          closedShare: (VERSIONS - 1) / VERSIONS,
          workingSetMbPerMillionRows: round(
            ((last.workingSetMb - first.workingSetMb) / last.edges) * 1e6,
          ),
          privateMbPerMillionRows: round(((last.privateMb - first.privateMb) / last.edges) * 1e6),
        }
      : null;
  console.log(JSON.stringify(perMillion));
  saveResult("edges", {
    at: new Date().toISOString(),
    shape: { claimsPerSrc: CLAIMS, versionsPerClaim: VERSIONS, rowsPerSrc: ROWS_PER_SRC },
    queries,
    growth,
    perMillion,
    subscriptionFollowsChurn: follows,
    churn: churned,
    diskMbBeforeArchive,
    archive: archived,
    queriesAfterArchive: afterArchive,
    refilledAfterArchive: refilled,
    diskMbAfterArchive: directoryMb(DATA_DIR),
  });
  conn.disconnect();
}

await main();
