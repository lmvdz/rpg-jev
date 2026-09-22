import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { apply } from "../../packages/core/src/matter/apply.ts";
import { Rng } from "../../packages/core/src/rng.ts";
import { EVENT_CODEC_LIMITS, encodeEvent } from "../../packages/server/module/src/event-codec.ts";
import { encodeArchivePayload } from "../../packages/server/src/archive-payload.ts";
import { LIMITS, verifyArchive } from "./replay.mjs";

const generation = "a".repeat(64);
function fixture() {
  const state = {
    version: 1,
    world: {
      elements: {},
      things: {},
      next: 0,
      places: { clearing: { id: "clearing", abundance: {}, searched: {} } },
      bodies: {
        actor: {
          id: "actor",
          place: "clearing",
          health: 5,
          needs: {},
          wounds: [],
          sickness: 0,
          sickensIn: 0,
          where: [0, 0],
        },
      },
    },
    rng: Rng.fromSeed(1).state,
    tick: 0,
  };
  const rng = Rng.fromState(state.rng);
  const draw = rng.next();
  return [
    { version: 1, kind: "initial", state },
    {
      version: 1,
      revision: 1,
      kind: "command",
      command: "SECRET-COMMAND-CONTENT",
      changes: [{ kind: "body", body: "actor", set: { where: [1, 0] }, because: [], note: "" }],
      draws: [draw],
      rng: rng.state,
      tick: 0,
    },
    {
      version: 1,
      revision: 2,
      kind: "tick",
      command: "",
      changes: [],
      draws: [],
      rng: rng.state,
      tick: 1,
    },
  ].map((payload, i) => ({ generation, seq: String(i + 1), payload: JSON.stringify(payload) }));
}
const encode = (rows) => `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
function temporary(fn) {
  const directory = mkdtempSync(join(import.meta.dirname, ".replay-test-"));
  try {
    return fn(join(directory, "archive.jsonl"), join(directory, "report.json"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
function alter(rows, index, mutate) {
  const event = JSON.parse(rows[index].payload);
  mutate(event);
  rows[index].payload = JSON.stringify(event);
}

test("replays changes and preserves recorded RNG/tick without exposing content", () =>
  temporary((file) => {
    const rows = fixture();
    const bytes = encode(rows);
    writeFileSync(file, bytes);
    const report = verifyArchive(file);
    const expected = JSON.parse(rows[0].payload).state;
    expected.world.bodies.actor.where = [1, 0];
    expected.tick = 1;
    expected.rng = JSON.parse(rows[2].payload).rng;
    assert.equal(
      report.stateSha256,
      createHash("sha256").update(JSON.stringify(expected)).digest("hex"),
    );
    assert.equal(report.events, 3);
    assert.equal(report.revision, 2);
    assert.equal(report.archiveSha256, createHash("sha256").update(bytes).digest("hex"));
    assert(!JSON.stringify(report).includes("SECRET-COMMAND-CONTENT"));
    assert.equal(readFileSync(file, "utf8"), bytes);
  }));

test("batched state patches preserve create, consume and recreate ordering", () =>
  temporary((file) => {
    const rows = fixture();
    alter(rows, 0, (event) => {
      event.state.world.elements.stone = { id: "stone" };
    });
    const state = {
      temperature: 2,
      surfaceAbove: 0,
      wetness: 0,
      integrity: 5,
      edge: 0,
      contamination: 0,
      corrosion: 0,
      taint: 0,
      amount: 5,
      flaw: 0,
      temper: 0,
      wetWith: null,
      burning: null,
      coating: null,
      set: false,
    };
    const stone = { id: "stone-1", element: "stone", place: "clearing", state };
    const changes = [
      { kind: "create", thing: stone },
      { kind: "state", thing: stone.id, set: { temperature: 3 } },
      { kind: "state", thing: stone.id, set: { temperature: 4 } },
      { kind: "consume", thing: stone.id, amount: 5 },
      { kind: "create", thing: stone },
      { kind: "state", thing: stone.id, set: { temperature: 1 } },
    ].map((change) => ({ ...change, because: [], note: "" }));
    alter(rows, 1, (event) => {
      event.changes = changes;
    });
    writeFileSync(file, encode(rows));
    const expected = JSON.parse(rows[0].payload).state;
    for (const change of changes) expected.world = apply(expected.world, [change]);
    expected.tick = 1;
    expected.rng = JSON.parse(rows[2].payload).rng;
    assert.equal(
      verifyArchive(file).stateSha256,
      createHash("sha256").update(JSON.stringify(expected)).digest("hex"),
    );
  }));

test("reserved auto-increment gaps after host restart do not imply missing revisions", () =>
  temporary((file) => {
    const rows = fixture();
    rows[1].seq = "4097";
    rows[2].seq = "8193";
    writeFileSync(file, encode(rows));
    const report = verifyArchive(file);
    assert.equal(report.events, 3);
    assert.equal(report.revision, 2);
    alter(rows, 2, (event) => {
      event.revision = 3;
    });
    writeFileSync(file, encode(rows));
    assert.throws(() => verifyArchive(file), /revision-gap-or-order/);
  }));

test("mixed legacy and compact events replay identically and reject unknown codec versions", () =>
  temporary((file) => {
    const rows = fixture();
    alter(rows, 1, (event) => {
      event.changes = Array.from({ length: 12 }, (_, i) => ({
        ...event.changes[0],
        set: { where: [i, 0] },
        note: "recorded cause ".repeat(30),
      }));
    });
    writeFileSync(file, encode(rows));
    const legacy = verifyArchive(file);
    rows[1].payload = encodeEvent(rows[1].payload);
    const compact = JSON.parse(rows[1].payload);
    assert(Array.isArray(compact), "fixture must exercise compact transport");
    writeFileSync(file, encode(rows));
    const restored = verifyArchive(file);
    assert.equal(restored.stateSha256, legacy.stateSha256);
    assert.equal(restored.revision, legacy.revision);
    assert.equal(restored.storage.compactEvents, 1);
    assert.equal(legacy.storage.compactEvents, 0);
    assert(restored.storage.compactPayloadBytes < restored.storage.compactDecodedBytes);
    assert.equal(restored.storage.decodedPayloadBytes, legacy.storage.payloadBytes);
    rows[1] = { ...rows[1], ...encodeArchivePayload(rows[1].payload) };
    writeFileSync(file, encode(rows));
    const archived = verifyArchive(file);
    assert.equal(archived.storage.gzipEvents, 1);
    assert.equal(archived.stateSha256, legacy.stateSha256);
    assert(archived.storage.archivedPayloadBytes < restored.storage.archivedPayloadBytes);
    delete rows[1].encoding;
    compact[1] = 999;
    rows[1].payload = JSON.stringify(compact);
    writeFileSync(file, encode(rows));
    assert.throws(() => verifyArchive(file), /event codec payload/);
  }));

test("the single-parse legacy path retains unsafe-key, depth and value-count bounds", () =>
  temporary((file) => {
    const rows = fixture();
    for (const [payload, reason] of [
      ['{"constructor":{}}', /unsafe-key/],
      [`${'{"x":'.repeat(65)}0${"}".repeat(65)}`, /json-depth-limit/],
      [JSON.stringify({ x: Array(EVENT_CODEC_LIMITS.visits + 1).fill(0) }), /json-value-limit/],
    ]) {
      const initial = { ...rows[0], ...encodeArchivePayload(payload) };
      writeFileSync(file, encode([initial]));
      assert.throws(() => verifyArchive(file), reason);
    }
  }));

const corruptions = {
  "missing initial": (r) =>
    alter(r, 0, (e) => {
      e.kind = "tick";
    }),
  "mixed generations": (r) => {
    r[1].generation = "b".repeat(64);
  },
  "sequence gap followed by duplicate": (r) => {
    r[1].seq = "3";
  },
  "duplicate sequence": (r) => {
    r[1].seq = "1";
  },
  "noncanonical sequence": (r) => {
    r[0].seq = "01";
  },
  "revision gap": (r) =>
    alter(r, 1, (e) => {
      e.revision = 2;
    }),
  "unknown change": (r) =>
    alter(r, 1, (e) => {
      e.changes[0].kind = "not-real";
    }),
  "missing body": (r) =>
    alter(r, 1, (e) => {
      e.changes[0].body = "missing";
    }),
  "invalid body patch": (r) =>
    alter(r, 1, (e) => {
      e.changes[0].set.health = "bad";
    }),
  "rng mismatch": (r) =>
    alter(r, 1, (e) => {
      e.rng[0] ^= 1;
    }),
  "draw mismatch": (r) =>
    alter(r, 1, (e) => {
      e.draws[0] = 0;
    }),
  "tick mismatch": (r) =>
    alter(r, 2, (e) => {
      e.tick = 2;
    }),
  "bad initial state": (r) =>
    alter(r, 0, (e) => {
      e.state.world.bodies.actor.id = "wrong";
    }),
  "unknown snapshot": (r) =>
    alter(r, 1, (e) => {
      e.state = {};
    }),
  "malformed payload": (r) => {
    r[0].payload = "private malformed JSON";
  },
};
for (const [name, corrupt] of Object.entries(corruptions)) {
  test(`rejects ${name}`, () =>
    temporary((file) => {
      const rows = fixture();
      corrupt(rows);
      writeFileSync(file, encode(rows));
      assert.throws(() => verifyArchive(file));
    }));
}
test("fails closed on incomplete tails, oversized lines, and invalid UTF-8", () =>
  temporary((file) => {
    for (const bytes of [
      encode(fixture()).slice(0, -1),
      "x".repeat(LIMITS.lineBytes + 1),
      Buffer.from([0xff, 10]),
      "",
    ]) {
      writeFileSync(file, bytes);
      assert.throws(() => verifyArchive(file));
    }
  }));
test("CLI requires new output and does not print malformed payloads", () =>
  temporary((file, output) => {
    const run = () =>
      spawnSync(
        process.execPath,
        [fileURLToPath(new URL("./replay.mjs", import.meta.url)), file, output],
        { encoding: "utf8" },
      );
    writeFileSync(file, encode(fixture()));
    assert.equal(run().status, 0);
    const original = readFileSync(output, "utf8");
    assert.equal(run().status, 1);
    assert.equal(readFileSync(output, "utf8"), original);
    rmSync(output);
    writeFileSync(file, "PRIVATE-CREDENTIAL\n");
    const failed = run();
    assert.equal(failed.status, 1);
    assert(
      ![failed.stdout, failed.stderr, readFileSync(output, "utf8")]
        .join("")
        .includes("PRIVATE-CREDENTIAL"),
    );
  }));
