/**
 * Real local protocol checks. Only --restart-owned-host restarts the local validation host.
 * Usage (Node >=22.18, workspace dependencies installed):
 *   node validation/shared-world/protocol.mjs <NEW-output-directory>
 * Requires parent-owned ws://127.0.0.1:3057/rpg-open-world and its archiver.
 * Two anonymous admissions persist on the host (there is no leave reducer).
 * Local test tokens stay in gitignored .stdb files, never in evidence reports.
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const args = process.argv.slice(2);
assert(
  args[0] && (args.length === 1 || args[1] === "--restart-owned-host"),
  "Usage: protocol.mjs <NEW-output-directory> [--restart-owned-host]",
);
const output = path.resolve(args[0]);
await mkdir(output); // Deliberately exclusive: existing directory is an error.
const tokens = [];
const clients = [];
const report = {
  version: 1,
  started: new Date().toISOString(),
  node: process.version,
  host: "ws://127.0.0.1:3057",
  database: "rpg-open-world",
  target: { acceptedSamples: 24, p95Ms: 250 },
  checks: [],
  commands: [],
  sql: [],
  observations: [],
  limits: [
    "No reset, provider calls or archive access. Optional restart targets only the local validation host.",
    "Anonymous admissions remain on host; requires two free admission slots.",
    "RNG/events are intentionally private: action RNG cannot be directly inspected.",
    "Retry non-effect is checked via sequence and pose; private event count is not observable.",
    "Latency includes SDK reducer completion and polling for visible acknowledgement (5ms polling).",
  ],
};
const clean = (value) => {
  let text = String(value);
  for (const token of tokens) if (token) text = text.split(token).join("[REDACTED]");
  return text.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED]");
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function bounded(promise, label, ms = 10000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function until(read, label, ms = 10000) {
  const end = performance.now() + ms;
  do {
    const value = read();
    if (value) return value;
    await sleep(5);
  } while (performance.now() < end);
  throw new Error(`Timeout: ${label}`);
}
async function check(name, fn) {
  try {
    const evidence = await fn();
    report.checks.push({ name, ok: true, evidence });
  } catch (error) {
    report.checks.push({ name, ok: false, error: clean(error) });
    throw error;
  }
}
function own(client) {
  const rows = [...client.db.db.viewer.iter()];
  assert.equal(
    rows.length,
    1,
    `${client.label}: broad subscription must expose exactly own viewer`,
  );
  assert.equal(rows[0].identity.toHexString(), client.identity);
  assert.equal([...client.db.db.event.iter()].length, 0, "event RLS leaked rows");
  const view = JSON.parse(rows[0].json);
  assert.equal(view.sequence, rows[0].seq);
  return { ...rows[0], view };
}
function snapshot(row) {
  const { actor, position, revision, sequence, tick, generation } = row.view;
  return { actor, position, revision, sequence, tick, generation, ok: row.ok, reason: row.reason };
}
async function send(client, payload, overrides = {}, label = "command") {
  await sleep(65); // Honor documented 50ms rate limit, outside latency measurement.
  const before = own(client);
  const input = {
    seq: before.seq + 1,
    revision: before.view.revision,
    generation: before.view.generation,
    payload: JSON.stringify(payload),
    ...overrides,
  };
  const evidence = { client: client.label, label, input, before: snapshot(before) };
  report.commands.push(evidence);
  const start = performance.now();
  try {
    await bounded(client.db.reducers.command(input), label);
    const after = await until(() => {
      const row = own(client);
      return row.seq === input.seq && row.command === input.payload ? row : null;
    }, `${label} visible ack`);
    evidence.ms = performance.now() - start;
    evidence.after = snapshot(after);
    evidence.classification = after.ok ? "accepted" : after.reason;
    return { before, after, input, ms: evidence.ms };
  } catch (error) {
    evidence.ms = performance.now() - start;
    evidence.error = clean(error);
    evidence.classification = "thrown";
    throw error;
  }
}
async function fresh(client, payload, label) {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const result = await send(client, payload, {}, `${label} attempt ${attempt}`);
    if (result.after.reason !== "stale-view") return result;
    assert.deepEqual(result.after.view.position, result.before.view.position);
    report.observations.push({
      label,
      attempt,
      classification: "stale-tick-or-concurrent-revision-race",
      ms: result.ms,
      seq: result.after.seq,
    });
  }
  throw new Error(`${label}: exhausted 8 explicitly recorded stale-view retries`);
}
async function sql(client, query) {
  const response = await fetch("http://127.0.0.1:3057/v1/database/rpg-open-world/sql", {
    method: "POST",
    headers: { Authorization: `Bearer ${client.token}`, "Content-Type": "text/plain" },
    body: query,
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.text();
  report.sql.push({ client: client.label, query, status: response.status, body: clean(body) });
  return { response, body };
}

try {
  // Dynamic imports ensure even dependency/import failures leave a summary.
  const { DbConnection } = await import("../../packages/client/src/shared_bindings/index.ts");
  const { buildClearing } = await import("../../packages/client/src/scene/clearing.ts");
  const { canStep, NEIGHBOURS } = await import("../../packages/client/src/scene/steps.ts");
  const { compile } = await import("../../packages/core/src/matter/compile.ts");
  async function connect(label, savedToken) {
    let db;
    // Local-issued credentials stay in gitignored operational storage, never
    // in the report. Re-running validation must not consume new admission slots.
    const tokenPath = path.resolve(
      import.meta.dirname,
      `../../packages/server/.stdb/protocol-${label}.token`,
    );
    const token =
      savedToken ?? (existsSync(tokenPath) ? readFileSync(tokenPath, "utf8") : undefined);
    const connected = new Promise((resolve, reject) => {
      db = DbConnection.builder()
        .withUri(report.host)
        .withDatabaseName(report.database)
        .withCompression("none")
        .withToken(token)
        .onConnect((connection, identity, token) => {
          tokens.push(token);
          if (label === "A" || label === "B") writeFileSync(tokenPath, token, { mode: 0o600 });
          resolve({ db: connection, identity: identity.toHexString(), token, label });
        })
        .onConnectError(() => reject(new Error(`${label}: SDK connection failed`)))
        .build();
    });
    // Retain handle even when connect fails so finally can close it.
    clients.push({ db, label });
    const client = await bounded(connected, `${label} connect`);
    clients[clients.length - 1] = client;
    await bounded(
      new Promise((resolve, reject) => {
        db.subscriptionBuilder()
          .onApplied(resolve)
          .onError(() => reject(new Error(`${label}: broad subscription failed`)))
          .subscribe(["SELECT * FROM viewer", "SELECT * FROM event"]);
      }),
      `${label} subscribe`,
    );
    const admission = { client: label, label: "join", input: {} };
    report.commands.push(admission);
    try {
      await bounded(db.reducers.join({}), `${label} join`);
      await until(() => [...db.db.viewer.iter()].length > 0, `${label} own viewer`);
      admission.after = snapshot(own(client));
    } catch (error) {
      admission.error = clean(error);
      throw error;
    }
    return client;
  }
  const a = await connect("A");
  const b = await connect("B");
  await check("independent anonymous identities and broad subscription RLS", () => {
    assert.notEqual(a.identity, b.identity);
    assert.notEqual(own(a).view.actor, own(b).view.actor);
    return clients.map((c) => ({ identity: c.identity, ...snapshot(own(c)) }));
  });
  await check("authenticated SQL RLS and private-table denial", async () => {
    for (const client of clients) {
      const viewer = await sql(client, "SELECT * FROM viewer");
      assert(viewer.response.ok, "viewer SQL failed");
      const results = JSON.parse(viewer.body);
      assert.equal(results.length, 1);
      assert.equal(results[0].rows.length, 1);
      assert(viewer.body.includes(own(client).view.actor), "own actor absent from SQL");
      const other = clients.find((c) => c !== client);
      // Other actor may legitimately be present in visible things, not as a viewer row.
      const row = results[0].rows[0];
      assert(JSON.stringify(row).includes(client.identity), "own identity absent");
      assert(!JSON.stringify(row).includes(other.identity), "other identity leaked");
      const events = await sql(client, "SELECT * FROM event");
      assert(events.response.ok);
      assert.equal(JSON.parse(events.body)[0].rows.length, 0);
      for (const table of ["world_state", "player"]) {
        const denied = await sql(client, `SELECT * FROM ${table}`);
        assert([400, 401, 403].includes(denied.response.status), `${table}: expected SQL denial`);
        assert(
          /private|permission|authoriz|not found|does not exist|no such|not accessible/i.test(
            denied.body,
          ),
          `${table}: failure did not explain access denial`,
        );
      }
    }
  });
  await check("ordinary players cannot register archivers or delete event history", async () => {
    for (const client of clients) {
      await assert.rejects(
        bounded(
          client.db.reducers.registerArchiver({ identity: own(client).identity }),
          "unauthorized worker registration",
        ),
        /owner only/i,
      );
      await assert.rejects(
        bounded(client.db.reducers.archiveThrough({ seq: 1n }), "unauthorized archive deletion"),
        /archive worker only/i,
      );
    }
  });
  const move = (to) => ({ version: 1, kind: "move", to });
  await check("forged actor cannot move either actor", async () => {
    const other = own(b).view.position;
    const result = await fresh(a, { ...move([1, 1]), actor: own(b).view.actor }, "forged actor");
    assert.equal(result.after.ok, false);
    assert.equal(result.after.reason, "unsupported-command");
    assert.deepEqual(result.after.view.position, result.before.view.position);
    assert.deepEqual(own(b).view.position, other);
  });
  await check("illegal far movement leaves pose unchanged", async () => {
    const result = await fresh(a, move([10000, 10000]), "illegal far move");
    assert.equal(result.after.ok, false);
    assert.equal(result.after.reason, "invalid-step");
    assert.deepEqual(result.after.view.position, result.before.view.position);
  });
  await check("stale revision produces visible rejected acknowledgement", async () => {
    const result = await send(a, move([1, 1]), { revision: 0 }, "stale revision");
    assert.equal(result.after.ok, false);
    assert.equal(result.after.reason, "stale-view");
    assert.deepEqual(result.after.view.position, result.before.view.position);
  });
  await check("generation mismatch is refused without sequence/pose change", async () => {
    const before = own(a);
    await assert.rejects(
      send(a, move([1, 1]), { generation: "invalid-generation" }, "generation mismatch"),
      /generation/i,
    );
    assert.equal(own(a).seq, before.seq);
    assert.deepEqual(own(a).view.position, before.view.position);
  });
  let last;
  const latencies = [];
  await check("24 accepted seeded-terrain neighbor movements", async () => {
    const grid = buildClearing(own(a).view.seed).grid;
    for (let sample = 0; sample < report.target.acceptedSamples; sample++) {
      const view = own(a).view;
      const blocked = (index) => view.things.some((t) => t.solid && grid.index(t.x, t.z) === index);
      const candidates = NEIGHBOURS.map(([dx, dz]) => [
        view.position[0] + dx,
        view.position[1] + dz,
      ]).filter(([x, z]) => canStep(grid, blocked, ...view.position, x, z));
      assert(candidates.length, "no legal visible seed-terrain edge");
      let accepted = false;
      for (const to of candidates) {
        const result = await fresh(a, move(to), `latency sample ${sample + 1}`);
        if (!result.after.ok) {
          assert.equal(result.after.reason, "invalid-step", "unexpected legal-neighbor rejection");
          continue;
        }
        assert.deepEqual(result.after.view.position, to);
        latencies.push(result.ms);
        last = result;
        accepted = true;
        break;
      }
      assert(accepted, "no candidate accepted by host");
    }
    return { samples: latencies };
  });
  await check("identical retry has no second effect; altered retry throws", async () => {
    const result = await send(a, JSON.parse(last.input.payload), last.input, "identical retry");
    assert.equal(result.after.seq, last.after.seq);
    assert.deepEqual(result.after.view.position, last.after.view.position);
    await assert.rejects(
      send(a, move([10000, 10000]), { seq: last.input.seq }, "altered same-sequence retry"),
      /sequence/i,
    );
    assert.equal(own(a).seq, last.after.seq);
    assert.deepEqual(own(a).view.position, last.after.view.position);
  });
  await check("general X8 search remains accepted", async () => {
    const answers = {
      process: "X8",
      patient: "something not in sight",
      instrument: "none",
      kind: "stone",
      duration: "a moment",
    };
    // Compiler verification uses a minimal inert vocabulary, never the host's private world.
    const compiled = compile(
      { elements: { stone: {} }, things: {}, bodies: {} },
      { answers, operands: {}, actor: own(a).view.actor, hands: "", place: "clearing", draw: 0.5 },
    );
    assert.equal(compiled?.process, "search");
    assert.equal(compiled.element, "stone");
    assert.equal(compiled.minutes, 1);
    const result = await fresh(a, { version: 1, kind: "act", answers, operands: {} }, "X8 search");
    assert.equal(result.after.ok, true, result.after.reason);
    assert(result.after.view.revision > result.before.view.revision);
    return {
      compiled,
      before: snapshot(result.before),
      after: snapshot(result.after),
      rng: "not observable to ordinary clients; no resource discovery required",
    };
  });
  await check("host tick advances with both clients idle", async () => {
    const before = clients.map((c) => snapshot(own(c)));
    await sleep(1600);
    const after = clients.map((c) => snapshot(own(c)));
    for (let i = 0; i < 2; i++) {
      assert(after[i].tick > before[i].tick);
      assert.equal(after[i].sequence, before[i].sequence);
      assert.deepEqual(after[i].position, before[i].position);
    }
    return { before, after };
  });
  if (args[1] === "--restart-owned-host") {
    await check(
      "host restart preserves admitted identities, positions and command sequences",
      async () => {
        const { spacetimeCli, SERVER_DIR } = await import("../../packages/server/src/cli.ts");
        const before = [a, b].map((client) => snapshot(own(client)));
        a.db.disconnect();
        b.db.disconnect();
        const pidPath = path.join(SERVER_DIR, ".stdb/server.pid");
        const pid = Number(readFileSync(pidPath, "utf8"));
        assert(Number.isSafeInteger(pid) && pid > 0, "invalid owned host PID");
        if (process.platform === "win32")
          execFileSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
        else process.kill(pid, "SIGTERM");
        await sleep(1000);
        const fd = openSync(path.join(SERVER_DIR, ".stdb/server.log"), "a");
        const host = spawn(
          spacetimeCli(),
          [
            "start",
            "--listen-addr",
            "127.0.0.1:3057",
            "--data-dir",
            path.join(SERVER_DIR, ".stdb/data"),
            "--non-interactive",
          ],
          { stdio: ["ignore", fd, fd], detached: true },
        );
        writeFileSync(pidPath, String(host.pid));
        host.unref();
        for (let retry = 0; retry < 100; retry++) {
          try {
            if ((await fetch("http://127.0.0.1:3057/v1/ping")).ok) break;
          } catch {
            /* The restarted host is not listening yet. */
          }
          if (retry === 99) throw new Error("host did not restart");
          await sleep(100);
        }
        const restored = [
          await connect("A-restored", a.token),
          await connect("B-restored", b.token),
        ];
        const after = restored.map((client) => snapshot(own(client)));
        for (let i = 0; i < 2; i++) {
          assert.equal(after[i].actor, before[i].actor);
          assert.equal(after[i].generation, before[i].generation);
          assert.equal(after[i].sequence, before[i].sequence);
          assert.deepEqual(after[i].position, before[i].position);
        }
        return { before, after };
      },
    );
  }
  await check("declared accepted-ack p95 <=250ms", () => {
    const sorted = [...latencies].sort((x, y) => x - y);
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
    report.latency = {
      samples: latencies,
      p95,
      method: "nearest rank",
      staleAttempts: report.observations,
      thresholdMs: 250,
    };
    assert(p95 <= 250, `p95 ${p95.toFixed(2)}ms exceeds fixed 250ms target`);
    return report.latency;
  });
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.failure = clean(error);
  process.exitCode = 1;
} finally {
  for (const client of clients) {
    try {
      client.db.disconnect();
    } catch {
      /* Preserve primary failure evidence. */
    }
  }
  report.finished = new Date().toISOString();
  await writeFile(
    path.join(output, "summary.json"),
    `${clean(JSON.stringify(report, null, 2))}\n`,
    { flag: "wx" },
  );
  console.log(JSON.stringify({ ok: report.ok, summary: path.join(output, "summary.json") }));
}
