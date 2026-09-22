/**
 * Milestone J, gate J2 (SPEC section 16): 8 connected SDK clients, each sending one seeded
 * command a second for the stated duration, against a local SpacetimeDB 2.10.1 host whose world
 * holds >= 2,000 things, every one scored every tick, on a 100 ms tick, with the model live.
 *
 *   RPG_WORLD_PORT=3077 RPG_WORLD_DATABASE=rpg-jepa node validation/jepa-proof/load.mjs <out.json> [--seconds 300] [--mode live]
 *
 * Needs the local host and its archive worker running (packages/server/src/{local,archive}.ts),
 * and configures the world as its publisher through the CLI. Tokens stay in the gitignored .stdb.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { decodeSharedView } from "../../packages/core/src/world/shared-wire.ts";
import { OBSERVE_INTERVAL_MS } from "../../packages/server/module/src/observers.ts";
import {
  DATABASE,
  HTTP_URL,
  RUNTIME_DIR,
  spacetimeCli,
  WS_URL,
} from "../../packages/server/src/cli.ts";

const args = process.argv.slice(2);
const output = path.resolve(args[0] ?? "j2.json");
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const SECONDS = Number(option("seconds", "300"));
const MODE = option("mode", "live");
const CLIENTS = Number(option("clients", "8"));
const THINGS = Number(option("things", "2000"));
const TICK_MICROS = Number(option("tick", "100000"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = (...a) =>
  execFileSync(
    spacetimeCli(),
    ["call", DATABASE, ...a, "--server", HTTP_URL, "--no-config", "--yes"],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

const report = {
  gate: "J2",
  started: new Date().toISOString(),
  environment: {
    node: process.version,
    host: WS_URL,
    database: DATABASE,
    spacetimedb: "2.10.1 standalone, loopback",
    platform: `${process.platform} ${process.arch}`,
  },
  config: {
    seconds: SECONDS,
    mode: MODE,
    clients: CLIENTS,
    things: THINGS,
    tickMicros: TICK_MICROS,
  },
  thresholds: { scoringP95Ms: 5, ackP95Ms: 250, fallbackRate: 0.01, deadlineMs: 10 },
  commands: [],
  errors: [],
};

const { DbConnection } = await import("../../packages/server/bindings/index.ts");
const { buildClearing, canStep, NEIGHBOURS } = await import(
  "../../packages/core/src/world/index.ts"
);

call("configure_jepa", JSON.stringify(MODE), String(TICK_MICROS));
call("populate", String(THINGS), "2026");

function connect(label) {
  const tokenPath = path.join(RUNTIME_DIR, `j2-${DATABASE}-${label}.token`);
  const saved = existsSync(tokenPath) ? readFileSync(tokenPath, "utf8") : undefined;
  return new Promise((resolve, reject) => {
    const db = DbConnection.builder()
      .withUri(WS_URL)
      .withDatabaseName(DATABASE)
      .withCompression("none")
      .withToken(saved)
      .onConnect((conn, identity, token) => {
        writeFileSync(tokenPath, token, { mode: 0o600 });
        resolve({ db: conn, identity: identity.toHexString(), label });
      })
      .onConnectError(() => reject(new Error(`${label}: connection failed`)))
      .build();
    void db;
  });
}

function own(client) {
  const rows = [...client.db.db.viewer.iter()];
  if (rows.length !== 1) return null;
  return { ...rows[0], view: decodeSharedView(rows[0].json) };
}

async function until(read, ms) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    const v = read();
    if (v) return v;
    await sleep(2);
  }
  return null;
}

async function join(client) {
  await new Promise((resolve, reject) =>
    client.db
      .subscriptionBuilder()
      .onApplied(resolve)
      .onError(() => reject(new Error("subscribe failed")))
      .subscribe(["SELECT * FROM viewer", "SELECT * FROM jepa_tick"]),
  );
  await client.db.reducers.join({});
  assert(await until(() => own(client), 10000), `${client.label}: no view`);
  client.heartbeat = setInterval(
    () => void client.db.reducers.observe({}).catch(() => undefined),
    OBSERVE_INTERVAL_MS,
  );
}

function nextCommand(client, rng) {
  const row = own(client);
  const view = row.view;
  if (rng() < 0.2)
    return {
      version: 1,
      kind: "act",
      answers: {
        process: "X8",
        patient: "something not in sight",
        instrument: "none",
        kind: "stone",
        duration: "a moment",
      },
      operands: {},
    };
  const grid = client.grid;
  const blocked = (index) => view.things.some((t) => t.solid && grid.index(t.x, t.z) === index);
  const options = NEIGHBOURS.map(([dx, dz]) => [
    view.position[0] + dx,
    view.position[1] + dz,
  ]).filter(([x, z]) => canStep(grid, blocked, ...view.position, x, z));
  const to = options[Math.floor(rng() * options.length)] ?? view.position;
  return { version: 1, kind: "move", to };
}

async function send(client, payload) {
  const before = own(client);
  const input = {
    seq: before.seq + 1,
    revision: before.view.revision,
    generation: before.view.generation,
    payload: JSON.stringify(payload),
  };
  const started = performance.now();
  const entry = { client: client.label, kind: payload.kind, at: started };
  try {
    await client.db.reducers.command(input);
    const after = await until(() => {
      const r = own(client);
      return r && r.seq === input.seq && r.command === input.payload ? r : null;
    }, 10000);
    entry.ms = performance.now() - started;
    if (after) entry.outcome = after.ok ? "accepted" : after.reason;
    else entry.outcome = "no-ack";
  } catch (error) {
    entry.ms = performance.now() - started;
    entry.outcome = "thrown";
    entry.error = String(error).slice(0, 200);
  }
  report.commands.push(entry);
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clients = [];
try {
  for (let i = 0; i < CLIENTS; i++) {
    const c = await connect(String.fromCharCode(65 + i));
    c.grid = buildClearing(1).grid;
    await join(c);
    clients.push(c);
  }
  const startTick = Math.max(0, ...[...clients[0].db.db.jepaTick.iter()].map((r) => r.tick));
  const end = performance.now() + SECONDS * 1000;
  await Promise.all(
    clients.map(async (client, i) => {
      const rng = seeded(1000 + i);
      await sleep((1000 / CLIENTS) * i);
      while (performance.now() < end) {
        const started = performance.now();
        await send(client, nextCommand(client, rng));
        await sleep(Math.max(0, 1000 - (performance.now() - started)));
      }
    }),
  );
  const ticks = [...clients[0].db.db.jepaTick.iter()]
    .filter((r) => r.tick > startTick)
    .sort((a, b) => a.tick - b.tick);
  report.ticks = ticks.map((r) => ({
    tick: r.tick,
    mode: r.mode,
    things: r.things,
    scoringMicros: r.scoringMicros,
    tickMicros: r.tickMicros,
    fallback: r.fallback,
    agreed: r.agreed,
    draws: r.draws,
    scored: r.scored,
    cached: r.cached,
  }));
} catch (error) {
  report.errors.push(String(error).slice(0, 500));
} finally {
  for (const c of clients) {
    clearInterval(c.heartbeat);
    c.db.disconnect();
  }
}

const nearest = (values, q) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length > 0 ? sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] : null;
};
const accepted = report.commands.filter((c) => c.outcome === "accepted").map((c) => c.ms);
const ticks = report.ticks ?? [];
const scoring = ticks.map((t) => t.scoringMicros / 1000);
const fallbacks = ticks.filter((t) => t.fallback === "deadline").length;
report.results = {
  commands: report.commands.length,
  accepted: accepted.length,
  outcomes: Object.fromEntries(
    [...new Set(report.commands.map((c) => c.outcome))].map((o) => [
      o,
      report.commands.filter((c) => c.outcome === o).length,
    ]),
  ),
  ackP50Ms: nearest(accepted, 0.5),
  ackP95Ms: nearest(accepted, 0.95),
  ticks: ticks.length,
  ticksPerSecond: ticks.length / SECONDS,
  thingsScored: nearest(
    ticks.map((t) => t.things),
    0.5,
  ),
  scoringP50Ms: nearest(scoring, 0.5),
  scoringP95Ms: nearest(scoring, 0.95),
  tickP50Ms: nearest(
    ticks.map((t) => t.tickMicros / 1000),
    0.5,
  ),
  tickP95Ms: nearest(
    ticks.map((t) => t.tickMicros / 1000),
    0.95,
  ),
  fallbackRate: ticks.length > 0 ? fallbacks / ticks.length : null,
};
const r = report.results;
report.pass = {
  scoring: r.scoringP95Ms !== null && r.scoringP95Ms <= 5,
  ack: r.ackP95Ms !== null && r.ackP95Ms <= 250,
  fallback: r.fallbackRate !== null && r.fallbackRate < 0.01,
  things: (r.thingsScored ?? 0) >= 2000,
};
report.pass.all = Object.values(report.pass).every(Boolean);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({ results: report.results, pass: report.pass, errors: report.errors }, null, 2),
);
process.exit(0);
