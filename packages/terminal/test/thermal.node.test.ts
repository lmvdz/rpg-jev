import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { serializeLog } from "../../core/src/log.ts";
import { view } from "../../core/src/thermal/attempt.ts";
import { journal } from "../src/thermal-journal.ts";
import { BenchPlayer } from "../src/thermal-player.ts";
import { interact, loadBench, resumeBench, saveBench, startBench } from "../src/thermal-session.ts";

test("terminal session saves actual JSONL, reloads and returns original private evidence", () => {
  const directory = mkdtempSync(join(tmpdir(), "thermal-save-"));
  const path = join(directory, "bench.jsonl");
  try {
    const store = startBench();
    const request = { requestId: "r1", expectedRevision: 0, operation: { kind: "read" } };
    const first = interact(store, "ada", request);
    interact(store, "bo", { requestId: "b1", expectedRevision: 1, operation: { kind: "wait" } });
    saveBench(store, path);
    const loaded = loadBench(path);
    assert.deepEqual(loaded.world, store.world);
    assert.deepEqual(view(loaded, "ada"), view(store, "ada"));
    assert.deepEqual(view(loaded, "bo").history, []);
    const entries = loaded.log.length;
    assert.deepEqual(interact(loaded, "ada", request).receipt, first.receipt);
    assert.equal(loaded.log.length, entries);
    assert.equal(loaded.world.clock, 1);
    const text = readFileSync(path, "utf8");
    assert.throws(() => resumeBench(text.replace("thermal-bench-v1", "thermal-bench-v2")));
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test("human workflow records phases before interventions without a hidden-truth oracle", () => {
  const store = startBench();
  const player = new BenchPlayer(store, "ada", "scripted");
  assert.ok(player.intro().includes("No measurement acquired"));
  const before = structuredClone(store.world);
  player.turn(
    "prior I have seen experiments before | That is prior familiarity, not evidence here",
  );
  assert.deepEqual(store.world, before);
  player.turn("dock A");
  player.turn("read");
  player.turn("predict The reading might stay the same | I have only one observation");
  player.turn("wait");
  player.turn("read");
  player.turn("revise My expectation did not hold | Compare the recorded readings");
  player.turn("transfer I am uncertain about another layout | I will compare before deciding");
  const noteCount = journal(store, "ada").length;
  player.turn("retry");
  assert.equal(journal(store, "ada").length, noteCount);
  player.turn("undock");
  player.turn("seat D 1");
  player.turn("dock B");
  player.turn("read");
  player.turn("wait");
  player.turn("read");
  const notes = journal(store, "ada");
  assert.deepEqual(
    notes.map((note) => note.phase),
    ["prior", "prediction", "revision", "transfer"],
  );
  assert.equal(notes[1]?.context.minute, 0);
  assert.equal(notes[2]?.context.minute, 1);
  assert.equal(notes[1]?.context.observations.length, 1);
  assert.equal(notes[2]?.context.observations.length, 2);
  assert.equal(notes[3]?.context.parts.find((part) => part.id === "D")?.slot, null);
  assert.deepEqual(journal(store, "bo"), []);
  assert.ok(!player.turn("journal").text.includes("energyJ"));
  const loaded = resumeBench(serializeLog(store.log));
  const resumed = new BenchPlayer(loaded, "ada", "scripted");
  const count = loaded.log.length;
  const physics = structuredClone(loaded.world);
  resumed.turn("retry");
  assert.deepEqual(loaded.world, physics);
  assert.equal(loaded.log.length, count);
});

test("a competing action makes an unseen journal frontier stale rather than enriching a note", () => {
  const store = startBench();
  const player = new BenchPlayer(store, "ada", "self-test");
  interact(store, "bo", { requestId: "other", expectedRevision: 0, operation: { kind: "wait" } });
  assert.match(player.turn("predict An expectation | Before refreshing").text, /stale/);
  assert.deepEqual(journal(store, "ada"), []);
  player.turn("predict An expectation | After refreshing");
  assert.equal(journal(store, "ada")[0]?.context.minute, 1);
  const loaded = resumeBench(serializeLog(store.log));
  const count = loaded.log.length;
  new BenchPlayer(loaded, "ada", "self-test").turn("retry");
  assert.equal(loaded.log.length, count);
});

test("actual play --bench launch needs no JSON and preserves notes and retry across exit", () => {
  const directory = mkdtempSync(join(tmpdir(), "bench-player-"));
  const path = join(directory, "bench.jsonl");
  const imports = process.execArgv.flatMap((argument, index) => {
    const next = process.execArgv[index + 1];
    if (argument === "--import" && next) return [argument, next];
    return argument.startsWith("--import=") ? [argument] : [];
  });
  const script = fileURLToPath(new URL("../src/play.ts", import.meta.url));
  const run = (input: string, actor = "ada") => {
    const child = spawnSync(
      process.execPath,
      [
        ...imports,
        script,
        "--bench",
        `--save=${path}`,
        `--actor=${actor}`,
        "--provenance=scripted",
      ],
      { input, encoding: "utf8", timeout: 10000 },
    );
    assert.equal(child.status, 0, child.stderr);
    assert.ok(!child.stdout.includes("energyJ"));
    return child.stdout;
  };
  try {
    const output = run(
      [
        "prior Familiar with thermometers",
        "look",
        "dock A",
        "read",
        "predict I expect the next reading to match | This is an untested guess",
        "wait",
        "read",
        "revise The readings differ | My single reading was insufficient",
        "transfer I do not yet know a different layout | I will choose a comparison",
        "undock",
        "seat D 1",
        "dock B",
        "read",
        "journal",
        "quit",
        "",
      ].join("\n"),
    );
    assert.ok(output.includes("Sockets (row-major)"));
    assert.ok(output.includes("290 K") && output.includes("324 K"));
    assert.ok(output.includes("prediction (scripted"));
    const saved = readFileSync(path, "utf8");
    const resumed = run("retry\njournal\nquit\n");
    assert.ok(resumed.includes("My single reading was insufficient"));
    assert.equal(readFileSync(path, "utf8"), saved);
    const other = run("journal\nhistory\nquit\n", "bo");
    assert.ok(other.includes("No study notes") && other.includes("No measurement acquired"));
    assert.ok(!other.includes("My single reading was insufficient"));
    assert.equal(journal(loadBench(path), "ada").length, 4);
  } finally {
    rmSync(directory, { recursive: true });
  }
});
