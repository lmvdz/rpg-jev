// Item 4: a client subscribed to rows near a position. What the subscription costs as rows
// change, on the wire and on the server, and what it costs to move the window.
import {
  type Connected,
  connect,
  saveResult,
  sleep,
  subscribe,
  unsubscribe,
  waitFor,
} from "./conn.ts";
import { sql } from "./lib/sql.ts";
import { round, type Summary, summarize } from "./lib/stats.ts";
import type { DbConnection, SubscriptionHandle } from "./module_bindings/index.ts";

const SIDE = 1024;
const CELL = 32;
const ENTITIES = 10_000;

const cellId = (cx: number, cy: number): number => (cy << 16) | cx;
const nowMs = (): number => performance.timeOrigin + performance.now();

function cellsAround(cx: number, cy: number): number[] {
  const cells: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) cells.push(cellId(cx + dx, cy + dy));
  }
  return cells;
}

const cellQuery = (cell: number): string => `SELECT * FROM entity WHERE cell = ${cell}`;

function rangeQuery(cx: number, cy: number): string {
  const x0 = (cx - 1) * CELL;
  const y0 = (cy - 1) * CELL;
  const x1 = x0 + 3 * CELL;
  const y1 = y0 + 3 * CELL;
  return `SELECT * FROM entity WHERE x >= ${x0} AND x < ${x1} AND y >= ${y0} AND y < ${y1}`;
}

async function idsInCell(cx: number, cy: number): Promise<Target[]> {
  const result = await sql(`SELECT id FROM entity WHERE cell = ${cellId(cx, cy)}`);
  return result.rows.map((row) => ({ id: BigInt(row[0] as number), cx, cy }));
}

type Target = { id: bigint; cx: number; cy: number };
type Wire = { messages: number; bytes: number };

const snapshot = (c: Connected): Wire => ({ messages: c.wire.messages, bytes: c.wire.bytes });
const since = (c: Connected, from: Wire): Wire => ({
  messages: c.wire.messages - from.messages,
  bytes: c.wire.bytes - from.bytes,
});

type ChangeResult = {
  scenario: string;
  changes: number;
  updatesSeen: number;
  latencyMs: Summary;
  moverRttMs: Summary;
  messagesPerChange: number;
  bytesPerChange: number;
};

type Watch = { watcher: Connected; latencies: number[] };

async function watch(options: Parameters<typeof connect>[0], queries: string[]): Promise<Watch> {
  const watcher = await connect(options);
  const latencies: number[] = [];
  watcher.conn.db.entity.onUpdate((_ctx, _old, row) => latencies.push(nowMs() - row.sentMs));
  await subscribe(watcher.conn, queries);
  return { watcher, latencies };
}

/** Moves entities one call at a time and watches one subscriber's socket and callbacks. */
async function changes(
  scenario: string,
  mover: DbConnection,
  seen: Watch,
  targets: Target[],
): Promise<ChangeResult> {
  const count = 500;
  seen.latencies.length = 0;
  const rtts: number[] = [];
  const before = snapshot(seen.watcher);
  for (let i = 0; i < count; i++) {
    const target = targets[i % targets.length];
    if (!target) break;
    const x = target.cx * CELL + (i % CELL);
    const y = target.cy * CELL + ((i * 7) % CELL);
    const started = performance.now();
    await mover.reducers.moveEntity({ id: target.id, x, y, sentMs: nowMs() });
    rtts.push(performance.now() - started);
    await sleep(2);
  }
  await sleep(300);
  const wire = since(seen.watcher, before);
  const result = {
    scenario,
    changes: count,
    updatesSeen: seen.latencies.length,
    latencyMs: summarize(seen.latencies),
    moverRttMs: summarize(rtts),
    messagesPerChange: round(wire.messages / count),
    bytesPerChange: round(wire.bytes / count),
  };
  console.log(JSON.stringify(result));
  return result;
}

type WindowResult = {
  scenario: string;
  usableMs: number;
  doneMs: number;
  rows: number;
  messages: number;
  bytes: number;
};

async function initialWindow(
  scenario: string,
  compression: "none" | "gzip",
  queries: string[],
): Promise<WindowResult> {
  const watcher = await connect({ compression });
  const before = snapshot(watcher);
  const started = performance.now();
  await subscribe(watcher.conn, queries);
  const usableMs = round(performance.now() - started);
  const result = {
    scenario,
    usableMs,
    doneMs: usableMs,
    rows: Number(watcher.conn.db.entity.count()),
    ...since(watcher, before),
  };
  watcher.conn.disconnect();
  console.log(JSON.stringify(result));
  return result;
}

/** Per-cell handles: moving one cell east adds three cells and drops three. */
async function moveByCells(compression: "none" | "gzip"): Promise<WindowResult> {
  const client = await connect({ compression });
  const handles = new Map<number, SubscriptionHandle>();
  for (const cell of cellsAround(16, 16))
    handles.set(cell, await subscribe(client.conn, [cellQuery(cell)]));
  const before = snapshot(client);
  const started = performance.now();
  const wanted = new Set(cellsAround(17, 16));
  const added = [...wanted].filter((cell) => !handles.has(cell));
  await subscribe(client.conn, added.map(cellQuery));
  const usableMs = round(performance.now() - started);
  const dropped = [...handles].filter(([cell]) => !wanted.has(cell));
  await Promise.all(dropped.map(([, handle]) => unsubscribe(handle)));
  const result = {
    scenario: `move window one cell east: subscribe 3 cells, then drop 3 (${compression})`,
    usableMs,
    doneMs: round(performance.now() - started),
    rows: Number(client.conn.db.entity.count()),
    ...since(client, before),
  };
  client.conn.disconnect();
  console.log(JSON.stringify(result));
  return result;
}

/** One range query: the new window is subscribed whole, then the old one is dropped. */
async function moveByRange(compression: "none" | "gzip"): Promise<WindowResult> {
  const client = await connect({ compression });
  const old = await subscribe(client.conn, [rangeQuery(16, 16)]);
  const before = snapshot(client);
  const started = performance.now();
  await subscribe(client.conn, [rangeQuery(17, 16)]);
  const usableMs = round(performance.now() - started);
  await unsubscribe(old);
  const result = {
    scenario: `move window one cell east: subscribe new range, then drop old (${compression})`,
    usableMs,
    doneMs: round(performance.now() - started),
    rows: Number(client.conn.db.entity.count()),
    ...since(client, before),
  };
  client.conn.disconnect();
  console.log(JSON.stringify(result));
  return result;
}

async function crowd(n: number, sameArea: boolean): Promise<Connected[]> {
  const others: Connected[] = [];
  for (let i = 0; i < n; i++) {
    const other = await connect();
    const cx = sameArea ? 16 : 2 + ((i * 5) % 28);
    const cy = sameArea ? 16 : 2 + ((i * 3) % 10);
    await subscribe(other.conn, cellsAround(cx, cy).map(cellQuery));
    others.push(other);
  }
  return others;
}

async function crossing(
  mover: DbConnection,
  walker: Target,
): Promise<{ enteredSeenAsInsert: number; leftSeenAsDelete: number }> {
  const { conn } = await connect();
  await subscribe(conn, cellsAround(16, 16).map(cellQuery));
  let inserts = 0;
  let deletes = 0;
  conn.db.entity.onInsert(() => inserts++);
  conn.db.entity.onDelete(() => deletes++);
  await mover.reducers.moveEntity({
    id: walker.id,
    x: 16 * CELL + 1,
    y: 16 * CELL + 1,
    sentMs: nowMs(),
  });
  await waitFor(() => inserts === 1, 2_000, "the row to enter the window");
  const back = { x: walker.cx * CELL + 1, y: walker.cy * CELL + 1 };
  await mover.reducers.moveEntity({ id: walker.id, ...back, sentMs: nowMs() });
  await waitFor(() => deletes === 1, 2_000, "the row to leave the window");
  conn.disconnect();
  return { enteredSeenAsInsert: inserts, leftSeenAsDelete: deletes };
}

async function main(): Promise<void> {
  const mover = await connect();
  await mover.conn.reducers.clearEntities({});
  await mover.conn.reducers.seedEntities({ start: 1n, count: ENTITIES, side: SIDE });
  const hot = await idsInCell(16, 16);
  const far = await idsInCell(2, 30);
  console.log(`${ENTITIES} entities, ${hot.length} in the hot cell, ${far.length} in the far cell`);
  const cellQueries = cellsAround(16, 16).map(cellQuery);

  const changeResults: ChangeResult[] = [];
  const nobody: Watch = { watcher: mover, latencies: [] };
  changeResults.push(
    await changes("no subscriber at all (mover RTT only)", mover.conn, nobody, hot),
  );

  const windows: WindowResult[] = [];
  for (const compression of ["none", "gzip"] as const) {
    for (const shape of ["cells", "range"] as const) {
      const queries = shape === "cells" ? cellQueries : [rangeQuery(16, 16)];
      const label = `${shape}, ${compression}`;
      windows.push(await initialWindow(`initial window (${label})`, compression, queries));
      const seen = await watch({ compression }, queries);
      changeResults.push(
        await changes(`change inside the window (${label})`, mover.conn, seen, hot),
      );
      changeResults.push(
        await changes(`change far outside the window (${label})`, mover.conn, seen, far),
      );
      seen.watcher.conn.disconnect();
    }
  }

  const confirmed = await watch({ confirmedReads: true }, cellQueries);
  changeResults.push(
    await changes(
      "change inside the window (cells, none, confirmed reads)",
      mover.conn,
      confirmed,
      hot,
    ),
  );
  confirmed.watcher.conn.disconnect();

  const walker = far[0];
  const crossed = walker ? await crossing(mover.conn, walker) : null;
  console.log(JSON.stringify(crossed));

  // Many subscribers: the server evaluates every change against every subscription.
  const primary = await watch({}, cellQueries);
  for (const [n, sameArea] of [
    [100, false],
    [100, true],
    [400, false],
  ] as const) {
    const others = await crowd(n, sameArea);
    const where = sameArea ? "on the same window" : "on windows elsewhere";
    changeResults.push(
      await changes(
        `change inside the window, ${n} more subscribers ${where}`,
        mover.conn,
        primary,
        hot,
      ),
    );
    for (const other of others) other.conn.disconnect();
    await sleep(500);
  }
  primary.watcher.conn.disconnect();

  for (const compression of ["none", "gzip"] as const) {
    windows.push(await moveByCells(compression));
    windows.push(await moveByRange(compression));
  }

  saveResult("subscription", {
    at: new Date().toISOString(),
    entities: ENTITIES,
    hotCellEntities: hot.length,
    windows,
    changes: changeResults,
    crossing: crossed,
  });
  mover.conn.disconnect();
}

await main();
