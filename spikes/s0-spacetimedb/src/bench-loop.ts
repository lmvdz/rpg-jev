// Item 3: the request-and-commit loop, end to end. Request row written -> worker sees it ->
// fake judge -> commit reducer re-checks preconditions -> effect visible to a subscriber.
import { type ChildProcess, spawn } from "node:child_process";
import { join } from "node:path";
import { connect, saveResult, sleep, subscribe } from "./conn.ts";
import { sql } from "./lib/sql.ts";
import { round, type Summary, summarize } from "./lib/stats.ts";
import type { DbConnection } from "./module_bindings/index.ts";

type Outcome = { kind: string; judgeMs: number; seenAt: number };

const waiting = new Map<string, (outcome: Outcome) => void>();

function startWorker(args: string[]): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(import.meta.dirname, "worker.ts"), ...args], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    child.stdout.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("worker ready")) resolve(child);
    });
    child.on("error", reject);
  });
}

function outcomeOf(tag: string): Promise<Outcome> {
  return new Promise((resolve) => {
    waiting.set(tag, resolve);
  });
}

type LoopResult = {
  scenario: string;
  concurrency: number;
  requests: number;
  wallMs: number;
  perSecond: number;
  endToEndMs: Summary;
  judgeMs: Summary;
  overheadMs: Summary;
};

async function runLoop(
  conn: DbConnection,
  scenario: string,
  concurrency: number,
  total: number,
): Promise<LoopResult> {
  const endToEnd: number[] = [];
  const judge: number[] = [];
  const overhead: number[] = [];
  let issued = 0;
  const slot = async (index: number): Promise<void> => {
    while (issued < total) {
      const tag = `${scenario}-${concurrency}-${issued++}`;
      const done = outcomeOf(tag);
      const started = performance.now();
      await conn.reducers.requestDecision({ actor: BigInt(index + 1), clientTag: tag });
      const outcome = await done;
      const elapsed = outcome.seenAt - started;
      endToEnd.push(elapsed);
      judge.push(outcome.judgeMs);
      overhead.push(elapsed - outcome.judgeMs);
    }
  };
  const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, (_, index) => slot(index)));
  const wallMs = performance.now() - started;
  return {
    scenario,
    concurrency,
    requests: endToEnd.length,
    wallMs: Math.round(wallMs),
    perSecond: round((endToEnd.length / wallMs) * 1000),
    endToEndMs: summarize(endToEnd),
    judgeMs: summarize(judge),
    overheadMs: summarize(overhead),
  };
}

type StaleResult = { attempts: number; dropped: number; committed: number; sampleLogRow: unknown };

/** The precondition that fails on purpose: the actor changes between the request and the commit. */
async function staleDecisions(conn: DbConnection, attempts: number): Promise<StaleResult> {
  let dropped = 0;
  let committed = 0;
  const actor = 40n;
  for (let i = 0; i < attempts; i++) {
    const tag = `stale-${i}`;
    const done = outcomeOf(tag);
    await conn.reducers.requestDecision({ actor, clientTag: tag });
    await conn.reducers.applyEffect({
      kind: "shift_drive",
      target: actor,
      amount: 0.05,
      causeId: 0n,
    });
    const outcome = await done;
    if (outcome.kind === "decision_dropped") dropped++;
    else committed++;
  }
  const log = await sql("SELECT * FROM event_log WHERE kind = 'decision_dropped'");
  return { attempts, dropped, committed, sampleLogRow: log.rows[0] };
}

async function main(): Promise<void> {
  const { conn } = await connect();
  conn.db.eventLog.onInsert((_ctx, row) => {
    if (row.kind !== "shift_drive" && row.kind !== "decision_dropped") return;
    const payload = JSON.parse(row.payload) as { tag?: string; judgeMs?: number };
    if (!payload.tag) return;
    waiting.get(payload.tag)?.({
      kind: row.kind,
      judgeMs: payload.judgeMs ?? 0,
      seenAt: performance.now(),
    });
    waiting.delete(payload.tag);
  });
  await subscribe(conn, [
    "SELECT * FROM event_log WHERE kind = 'shift_drive'",
    "SELECT * FROM event_log WHERE kind = 'decision_dropped'",
  ]);
  const existing = await sql("SELECT COUNT(*) AS n FROM entity");
  if (Number(existing.rows[0]?.[0] ?? 0) === 0) {
    await conn.reducers.seedEntities({ start: 1n, count: 64, side: 1024 });
  }

  const loops: LoopResult[] = [];
  let worker = await startWorker([]);
  for (const concurrency of [1, 4, 16]) {
    const result = await runLoop(
      conn,
      "fake judge at M0 latency",
      concurrency,
      concurrency === 1 ? 100 : 400,
    );
    console.log(JSON.stringify(result));
    loops.push(result);
  }
  const stale = await staleDecisions(conn, 25);
  console.log(JSON.stringify(stale));
  worker.kill("SIGTERM");
  await sleep(500);

  worker = await startWorker(["--instant"]);
  for (const concurrency of [1, 16, 64]) {
    const result = await runLoop(conn, "instant judge: the loop alone", concurrency, 2_000);
    console.log(JSON.stringify(result));
    loops.push(result);
  }
  worker.kill("SIGTERM");

  saveResult("loop", { at: new Date().toISOString(), loops, stale });
  conn.disconnect();
}

await main();
