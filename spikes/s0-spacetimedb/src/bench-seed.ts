// How the cost of inserting edges moves as the table grows. Prints the time of each 50k-row
// seed call; run on an empty edge table (`pnpm deploy:local`).
import { connect, saveResult } from "./conn.ts";
import { serverMemory } from "./lib/memory.ts";

const label = process.argv[2] ?? "seed";

const { conn } = await connect({ as: "bench" });
const before = serverMemory();
const callMs: number[] = [];
for (let call = 0; call < 20; call++) {
  const started = performance.now();
  await conn.reducers.seedEdges({
    srcStart: BigInt(call * 500 + 1),
    srcCount: 500,
    claims: 10,
    versions: 10,
  });
  callMs.push(Math.round(performance.now() - started));
}
console.log(`ms per 50,000-row seed call, 0 to 1M rows: ${callMs.join(" ")}`);
const after = serverMemory();
const privateMbPerMillionRows = after.privateMb - before.privateMb;
console.log(`server private memory: ${before.privateMb} MB -> ${after.privateMb} MB`);
saveResult(label, {
  at: new Date().toISOString(),
  rowsPerCall: 50_000,
  callMs,
  before,
  after,
  privateMbPerMillionRows,
});
conn.disconnect();
