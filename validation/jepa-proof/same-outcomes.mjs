/**
 * Milestone J, P6: two clients of one world see identical outcomes. Two SDK clients join the
 * running world; at a moment both hold the same revision, every thing both can see must have the
 * same tile and visible states in both projections (the server is the only authority).
 *   RPG_WORLD_PORT=<port> RPG_WORLD_DATABASE=<db> node validation/jepa-proof/same-outcomes.mjs <out.json>
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { decodeSharedView } from "../../packages/core/src/world/shared-wire.ts";
import { DATABASE, RUNTIME_DIR, WS_URL } from "../../packages/server/src/cli.ts";

const { DbConnection } = await import("../../packages/server/bindings/index.ts");
const out = path.resolve(process.argv[2] ?? "same-outcomes.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(label) {
  const tokenPath = path.join(RUNTIME_DIR, `same-${DATABASE}-${label}.token`);
  const saved = existsSync(tokenPath) ? readFileSync(tokenPath, "utf8") : undefined;
  return new Promise((resolve, reject) => {
    DbConnection.builder()
      .withUri(WS_URL)
      .withDatabaseName(DATABASE)
      .withToken(saved)
      .onConnect((db, _identity, token) => {
        writeFileSync(tokenPath, token, { mode: 0o600 });
        resolve(db);
      })
      .onConnectError(() => reject(new Error(`${label}: connection failed`)))
      .build();
  });
}

async function joined(db) {
  await new Promise((resolve) =>
    db.subscriptionBuilder().onApplied(resolve).subscribe(["SELECT * FROM viewer"]),
  );
  await db.reducers.join({});
  for (let i = 0; i < 600 && [...db.db.viewer.iter()].length === 0; i++) await sleep(50);
  setInterval(() => void db.reducers.observe({}).catch(() => undefined), 5000);
}

const view = (db) => {
  const row = [...db.db.viewer.iter()][0];
  return row ? decodeSharedView(row.json) : null;
};

const a = await connect("A");
const b = await connect("B");
await joined(a);
await joined(b);
const report = { database: DATABASE, samples: [] };
for (let sample = 0; sample < 20; sample++) {
  await sleep(700);
  const va = view(a);
  const vb = view(b);
  if (!(va && vb) || va.revision !== vb.revision) continue;
  const byId = new Map(vb.things.map((t) => [t.id, t]));
  let compared = 0;
  const differences = [];
  for (const t of va.things) {
    const u = byId.get(t.id);
    if (!u) continue;
    compared++;
    const left = JSON.stringify({ x: t.x, z: t.z, states: t.states, element: t.element });
    const right = JSON.stringify({ x: u.x, z: u.z, states: u.states, element: u.element });
    if (left !== right) differences.push({ id: t.id, a: left, b: right });
  }
  report.samples.push({
    revision: va.revision,
    compared,
    differences: differences.length,
    examples: differences.slice(0, 3),
  });
}
report.identical = report.samples.length > 0 && report.samples.every((s) => s.differences === 0);
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({
    samples: report.samples.length,
    compared: report.samples.map((s) => s.compared),
    identical: report.identical,
  }),
);
process.exit(0);
