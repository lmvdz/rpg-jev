// Item 2: scheduled fuses under load. Many one-off and repeating scheduled reducers due at the
// same moment; how late they fire, in what order, whether any are lost, and what a client's own
// reducer calls see while the burst runs.
import { connect, saveResult, sleep } from "./conn.ts";
import { ownerCount, sql } from "./lib/sql.ts";
import { inversions, type Summary, summarize } from "./lib/stats.ts";
import type { DbConnection } from "./module_bindings/index.ts";

const DELAY_MS = 3_000;

type Fired = { seq: number; debtId: number; dueMicros: number; firedMicros: number };

type Pinger = { stop: () => Promise<{ at: number; rttMs: number }[]> };

/** Sequential pings on their own connection: each RTT is what a player's reducer call would wait. */
function startPinger(conn: DbConnection): Pinger {
  const samples: { at: number; rttMs: number }[] = [];
  let running = true;
  const loop = (async () => {
    let n = 0;
    while (running) {
      const started = performance.now();
      await conn.reducers.ping({ n: n++ });
      samples.push({ at: Date.now(), rttMs: performance.now() - started });
      await sleep(5);
    }
  })();
  return {
    stop: async () => {
      running = false;
      await loop;
      return samples;
    },
  };
}

async function firedRows(batch: number): Promise<Fired[]> {
  const result = await sql(
    `SELECT seq, debt_id, due_micros, fired_micros FROM fuse_fired WHERE batch = ${batch}`,
  );
  const rows = result.rows.map((row) => ({
    seq: Number(row[0]),
    debtId: Number(row[1]),
    dueMicros: Number(row[2]),
    firedMicros: Number(row[3]),
  }));
  return rows.sort((a, b) => a.seq - b.seq);
}

async function firedCount(batch: number): Promise<number> {
  const result = await sql(`SELECT COUNT(*) AS n FROM fuse_fired WHERE batch = ${batch}`);
  return Number(result.rows[0]?.[0] ?? 0);
}

async function waitForFired(batch: number, expected: number, timeoutMs: number): Promise<number> {
  const deadline = performance.now() + timeoutMs;
  let seen = 0;
  let lastChange = performance.now();
  while (performance.now() < deadline) {
    const now = await firedCount(batch);
    if (now !== seen) lastChange = performance.now();
    seen = now;
    if (seen >= expected) break;
    // Nothing new for five seconds: whatever has not fired is not going to.
    if (performance.now() - lastChange > 5_000) break;
    await sleep(100);
  }
  return seen;
}

type OneOffResult = {
  scenario: string;
  scheduled: number;
  expected: number;
  fired: number;
  dropped: number;
  leftInFuseTable: number;
  scheduleCallMs: number;
  delayMs: Summary;
  burstSpanMs: number;
  firedPerSecond: number;
  orderInversions: number;
  pingDuringBurstMs: Summary;
  pingOutsideBurstMs: Summary;
  pingTimeline: { startedAfterBurstStartMs: number; rttMs: number }[];
};

type OneOffSpec = {
  batch: number;
  count: number;
  spin: number;
  failEvery: number;
  staggerMicros: bigint;
  scenario: string;
};

type Burst = { scenario: string; batch: number; scheduled: number; expected: number };

/** Runs `schedule`, waits for the burst to finish and reports what it looked like from outside. */
async function measureBurst(
  pingConn: DbConnection,
  burst: Burst,
  schedule: () => Promise<void>,
): Promise<OneOffResult> {
  const pinger = startPinger(pingConn);
  await sleep(500);
  const started = performance.now();
  await schedule();
  const scheduleCallMs = performance.now() - started;
  await sleep(DELAY_MS);
  const fired = await waitForFired(burst.batch, burst.expected, 120_000);
  await sleep(500);
  const pings = await pinger.stop();
  const rows = await firedRows(burst.batch);
  const first = rows[0];
  const last = rows[rows.length - 1];
  const burstStart = first ? first.dueMicros / 1000 : 0;
  const burstEnd = last ? last.firedMicros / 1000 : 0;
  const inBurst = pings.filter((p) => p.at >= burstStart && p.at - p.rttMs <= burstEnd);
  const outside = pings.filter((p) => p.at < burstStart);
  const spanMs = first && last ? (last.firedMicros - first.firedMicros) / 1000 : 0;
  return {
    scenario: burst.scenario,
    scheduled: burst.scheduled,
    expected: burst.expected,
    fired,
    dropped: burst.expected - fired,
    leftInFuseTable: ownerCount("fuse") + ownerCount("debt"),
    scheduleCallMs: Math.round(scheduleCallMs),
    delayMs: summarize(rows.map((r) => (r.firedMicros - r.dueMicros) / 1000)),
    burstSpanMs: Math.round(spanMs),
    firedPerSecond: spanMs > 0 ? Math.round((rows.length / spanMs) * 1000) : rows.length,
    orderInversions: inversions(rows.map((r) => r.debtId)),
    pingDuringBurstMs: summarize(inBurst.map((p) => p.rttMs)),
    pingOutsideBurstMs: summarize(outside.map((p) => p.rttMs)),
    pingTimeline: inBurst.slice(0, 20).map((p) => ({
      startedAfterBurstStartMs: Math.round(p.at - p.rttMs - burstStart),
      rttMs: Math.round(p.rttMs),
    })),
  };
}

function oneOff(
  conn: DbConnection,
  pingConn: DbConnection,
  spec: OneOffSpec,
): Promise<OneOffResult> {
  const failing = spec.failEvery > 0 ? Math.ceil(spec.count / spec.failEvery) : 0;
  const burst = { ...spec, scheduled: spec.count, expected: spec.count - failing };
  return measureBurst(pingConn, burst, () =>
    conn.reducers.scheduleFuses({
      batch: spec.batch,
      count: spec.count,
      delayMicros: BigInt(DELAY_MS * 1000),
      staggerMicros: spec.staggerMicros,
      intervalMicros: 0n,
      spin: spec.spin,
      failEvery: spec.failEvery,
    }),
  );
}

/** The same burst as debts in an ordinary table, drained by one repeating reducer, bounded per tick. */
async function drained(
  conn: DbConnection,
  pingConn: DbConnection,
  batch: number,
  count: number,
): Promise<OneOffResult> {
  const tickMs = 20;
  const limit = 500;
  await conn.reducers.startDrain({ intervalMicros: BigInt(tickMs * 1000), limit });
  const scenario = `${count.toLocaleString("en")} debts, one due time, drained ${limit} per ${tickMs} ms tick`;
  const burst = { scenario, batch, scheduled: count, expected: count };
  const result = await measureBurst(pingConn, burst, () =>
    conn.reducers.createDebts({ batch, count, delayMicros: BigInt(DELAY_MS * 1000) }),
  );
  await conn.reducers.stopDrain({});
  return result;
}

type RepeatingResult = {
  scenario: string;
  fuses: number;
  intervalMs: number;
  windowMs: number;
  firings: number;
  firingsPerFuse: Summary;
  expectedPerFuse: number;
  gapMs: Summary;
  leftAfterCancel: number;
  pingMs: Summary;
};

async function repeating(
  conn: DbConnection,
  pingConn: DbConnection,
  batch: number,
  fuses: number,
): Promise<RepeatingResult> {
  const intervalMs = 100;
  const windowMs = 5_000;
  const pinger = startPinger(pingConn);
  await conn.reducers.scheduleFuses({
    batch,
    count: fuses,
    delayMicros: 0n,
    staggerMicros: 0n,
    intervalMicros: BigInt(intervalMs * 1000),
    spin: 0,
    failEvery: 0,
  });
  await sleep(windowMs);
  await conn.reducers.cancelFuses({ batch });
  await sleep(1_000);
  const pings = await pinger.stop();
  const rows = await firedRows(batch);
  const byFuse = new Map<number, number[]>();
  for (const row of rows) {
    const list = byFuse.get(row.debtId) ?? [];
    list.push(row.firedMicros);
    byFuse.set(row.debtId, list);
  }
  const gaps: number[] = [];
  for (const times of byFuse.values()) {
    for (let i = 1; i < times.length; i++) {
      const prev = times[i - 1];
      const cur = times[i];
      if (prev !== undefined && cur !== undefined) gaps.push((cur - prev) / 1000);
    }
  }
  return {
    scenario: `${fuses} repeating fuses, every ${intervalMs} ms`,
    fuses,
    intervalMs,
    windowMs,
    firings: rows.length,
    firingsPerFuse: summarize([...byFuse.values()].map((times) => times.length)),
    expectedPerFuse: windowMs / intervalMs,
    gapMs: summarize(gaps),
    leftAfterCancel: ownerCount("fuse"),
    pingMs: summarize(pings.map((p) => p.rttMs)),
  };
}

async function main(): Promise<void> {
  const { conn } = await connect({ as: "bench" });
  const { conn: pingConn } = await connect();
  await conn.reducers.clearFired({});

  const idle = startPinger(pingConn);
  await sleep(3_000);
  const idlePings = await idle.stop();

  const oneOffSpecs: OneOffSpec[] = [
    {
      batch: 1,
      count: 100,
      spin: 0,
      failEvery: 0,
      staggerMicros: 0n,
      scenario: "100 one-off fuses, one due time",
    },
    {
      batch: 2,
      count: 1_000,
      spin: 0,
      failEvery: 0,
      staggerMicros: 0n,
      scenario: "1,000 one-off fuses, one due time",
    },
    {
      batch: 3,
      count: 10_000,
      spin: 0,
      failEvery: 0,
      staggerMicros: 0n,
      scenario: "10,000 one-off fuses, one due time",
    },
    {
      batch: 7,
      count: 100_000,
      spin: 0,
      failEvery: 0,
      staggerMicros: 0n,
      scenario: "100,000 one-off fuses, one due time",
    },
    {
      batch: 6,
      count: 1_000,
      spin: 0,
      failEvery: 0,
      staggerMicros: 1n,
      scenario: "1,000 one-off fuses, due 1 microsecond apart",
    },
    {
      batch: 4,
      count: 1_000,
      spin: 0,
      failEvery: 10,
      staggerMicros: 0n,
      scenario: "1,000 one-off, every 10th throws",
    },
    {
      batch: 5,
      count: 200,
      spin: 3_000_000,
      failEvery: 0,
      staggerMicros: 0n,
      scenario: "200 one-off, each spins the CPU",
    },
  ];
  const oneOffs: OneOffResult[] = [];
  for (const spec of oneOffSpecs) {
    const result = await oneOff(conn, pingConn, spec);
    console.log(JSON.stringify(result));
    oneOffs.push(result);
  }

  for (const [batch, count] of [
    [21, 10_000],
    [22, 100_000],
  ] as const) {
    const result = await drained(conn, pingConn, batch, count);
    console.log(JSON.stringify(result));
    oneOffs.push(result);
  }

  const repeats: RepeatingResult[] = [];
  for (const [batch, fuses] of [
    [11, 100],
    [12, 1_000],
  ] as const) {
    const result = await repeating(conn, pingConn, batch, fuses);
    console.log(JSON.stringify(result));
    repeats.push(result);
  }

  saveResult("fuses", {
    at: new Date().toISOString(),
    idlePingMs: summarize(idlePings.map((p) => p.rttMs)),
    oneOff: oneOffs,
    repeating: repeats,
  });
  await conn.reducers.clearFired({});
  conn.disconnect();
  pingConn.disconnect();
}

await main();
