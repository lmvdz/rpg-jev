// What a server restart does to pending fuses and to memory. Two phases, with the server
// stopped and started by hand in between (see FINDINGS.md):
//   node src/bench-restart.ts --before   schedules fuses due in 60 s; stop the server now
//   node src/bench-restart.ts --after    run once the server is back, later than the due time
import { join } from "node:path";
import { connect, saveResult, sleep } from "./conn.ts";
import { directoryMb, serverMemory } from "./lib/memory.ts";
import { ownerCount, sql } from "./lib/sql.ts";
import { summarize } from "./lib/stats.ts";

const BATCH = 31;
const FUSES = 100;
const DATA_DIR = join(import.meta.dirname, "..", ".stdb", "data");

async function count(table: string, where = ""): Promise<number> {
  const result = await sql(`SELECT COUNT(*) AS n FROM ${table} ${where}`);
  return Number(result.rows[0]?.[0] ?? 0);
}

async function before(): Promise<void> {
  const { conn } = await connect({ as: "bench" });
  await conn.reducers.scheduleFuses({
    batch: BATCH,
    count: FUSES,
    delayMicros: 60_000_000n,
    staggerMicros: 0n,
    intervalMicros: 0n,
    spin: 0,
    failEvery: 0,
  });
  const state = {
    pendingFuses: ownerCount("fuse"),
    edges: await count("edge"),
    memory: serverMemory(),
  };
  console.log(JSON.stringify(state));
  saveResult("restart-before", { at: new Date().toISOString(), ...state });
  conn.disconnect();
}

async function after(): Promise<void> {
  const memoryOnArrival = serverMemory();
  await sleep(3_000);
  const fired = await sql(`SELECT due_micros, fired_micros FROM fuse_fired WHERE batch = ${BATCH}`);
  const lateMs = fired.rows.map((row) => (Number(row[1]) - Number(row[0])) / 1000);
  const state = {
    scheduledBeforeRestart: FUSES,
    firedAfterRestart: fired.rows.length,
    stillPending: ownerCount("fuse"),
    lateByMs: summarize(lateMs),
    edges: await count("edge"),
    eventLogRows: await count("event_log"),
    memoryOnArrival,
    dataDirMb: directoryMb(DATA_DIR),
  };
  console.log(JSON.stringify(state));
  saveResult("restart-after", { at: new Date().toISOString(), ...state });
}

if (process.argv.includes("--before")) await before();
else if (process.argv.includes("--after")) await after();
else console.error("pass --before or --after");
