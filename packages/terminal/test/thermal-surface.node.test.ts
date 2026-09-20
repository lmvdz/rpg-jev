import assert from "node:assert/strict";
import test from "node:test";
import { Store } from "../../core/src/log.ts";
import { attempt, view } from "../../core/src/thermal/attempt.ts";
import type { Receipt } from "../../core/src/thermal/contract.ts";
import { benchWorld } from "../../core/src/thermal/fixture.ts";
import {
  type BenchView,
  HELP,
  INTRO,
  parseBenchCommand,
  renderBench,
  renderHistory,
  renderReceipt,
} from "../src/thermal-surface.ts";

function visible(): BenchView {
  return view(new Store(benchWorld()), "ada");
}

test("hidden-state twins have identical UI, help, parser decisions and errors", () => {
  const first = benchWorld();
  const second = benchWorld();
  assert.ok(second.thermal);
  for (const part of second.thermal.physics.parts) {
    part.energyJ = 20 * 310;
    part.conductivityWPerMK = 1;
  }
  second.thermal.physics.probe.energyJ = 5 * 320;
  const left = view(new Store(first), "ada");
  const right = view(new Store(second), "ada");
  assert.deepEqual(left, right);
  assert.equal(renderBench(left), renderBench(right));
  assert.equal(renderHistory(left), renderHistory(right));
  for (const text of ["help", "dock A", "seat C 1", "rack mystery", "seat B -1", "wait 3"]) {
    assert.deepEqual(parseBenchCommand(text, left), parseBenchCommand(text, right));
  }
  const projected = `${renderBench(left)}\n${renderHistory(left)}\n${HELP}\n${INTRO}`;
  assert.doesNotMatch(
    projected,
    /370|290|energyJ|capacity|conductivity|specificHeat|bypass|conduction|equilibrium|hot|cold/,
  );
  assert.match(projected, /No measurement acquired/);
});

test("commands resolve only visible IDs or unique labels, including renamed identities", () => {
  const scene = visible();
  assert.ok(scene.parts);
  scene.parts[0] = { id: "quartz", label: "Pale cube", slot: 0 };
  assert.deepEqual(parseBenchCommand("SeAt PALE CUBE 1", scene), {
    kind: "action",
    operation: { kind: "seat", part: "quartz", slot: 1 },
  });
  assert.deepEqual(parseBenchCommand("dock QUARTZ", scene), {
    kind: "action",
    operation: { kind: "dock", target: "quartz" },
  });
  assert.deepEqual(parseBenchCommand("rack pale cube", scene), {
    kind: "action",
    operation: { kind: "seat", part: "quartz", slot: null },
  });
  assert.match(JSON.stringify(parseBenchCommand("dock A", scene)), /Unknown cube/);
  scene.parts[1] = { id: "other", label: "PALE CUBE", slot: 2 };
  assert.match(JSON.stringify(parseBenchCommand("dock pale cube", scene)), /Ambiguous cube/);
  scene.parts[1] = { id: "other", label: "quartz", slot: 2 };
  assert.match(JSON.stringify(parseBenchCommand("dock quartz", scene)), /Ambiguous cube/);
  assert.match(renderBench(scene), /0: "quartz" \| 1: empty \| 2: "other"/);
  assert.match(renderBench(scene), /Rack: "C", "D"/);
});

test("static commands have exact arity; no actors, reset or durations are admitted", () => {
  const scene = visible();
  for (const kind of ["look", "help", "history", "journal", "quit", "retry"]) {
    assert.deepEqual(parseBenchCommand(kind, scene), { kind });
    assert.equal(parseBenchCommand(`${kind} extra`, scene).kind, "invalid");
  }
  for (const kind of ["wait", "read"]) {
    assert.deepEqual(parseBenchCommand(kind, scene), { kind: "action", operation: { kind } });
  }
  assert.deepEqual(parseBenchCommand("undock", scene), {
    kind: "action",
    operation: { kind: "dock", target: null },
  });
  for (const text of [
    "",
    "wait 1",
    "read now",
    "undock A",
    "actor bo",
    "reset",
    "constructor",
    "seat A 1.5",
    "seat A 9",
    "seat A -1",
    "seat A 99999999999999999",
    "dock",
  ])
    assert.equal(parseBenchCommand(text, scene).kind, "invalid", text);
  assert.equal(parseBenchCommand("x".repeat(4097), scene).kind, "invalid");
  assert.equal(parseBenchCommand("dock A", { available: false }).kind, "invalid");
  assert.equal(renderBench({ available: false }), "Bench unavailable.");
  assert.equal(renderHistory({ available: false }), "Bench unavailable.");
});

test("notes preserve authored text and leave an absent reason explicitly empty", () => {
  const scene = visible();
  const phases = {
    prior: "prior",
    predict: "prediction",
    revise: "revision",
    transfer: "transfer",
  };
  for (const [command, phase] of Object.entries(phases)) {
    assert.deepEqual(parseBenchCommand(`${command} My statement`, scene), {
      kind: "note",
      phase,
      statement: "My statement",
      reason: "",
    });
    assert.deepEqual(parseBenchCommand(`${command} My statement | My reason`, scene), {
      kind: "note",
      phase,
      statement: "My statement",
      reason: "My reason",
    });
    assert.equal(parseBenchCommand(`${command} | reason`, scene).kind, "invalid");
  }
  assert.equal(parseBenchCommand(`predict ${"x".repeat(1000)}`, scene).kind, "note");
  assert.equal(parseBenchCommand(`predict ${"x".repeat(1001)}`, scene).kind, "invalid");
  assert.equal(parseBenchCommand(`predict x | ${"x".repeat(1001)}`, scene).kind, "invalid");
  assert.match(HELP, /phases are labels, not accomplishments/);
});

test("acquired history retains original target and minute after probe movement and shared wait", () => {
  const store = new Store(benchWorld());
  function act(actor: string, requestId: string, operation: unknown) {
    return attempt(store, actor, {
      requestId,
      expectedRevision: store.world.thermal?.revision ?? 0,
      operation,
    });
  }
  act("ada", "dock", { kind: "dock", target: "A" });
  const receipt = act("ada", "read", { kind: "read" });
  act("bo", "wait", { kind: "wait" });
  act("ada", "move", { kind: "dock", target: "B" });
  const scene = view(store, "ada");
  assert.match(renderBench(scene), /shared minute 1/);
  assert.match(renderBench(scene), /Probe attachment: "B"/);
  for (const text of [renderBench(scene), renderHistory(scene), renderReceipt(receipt)]) {
    assert.match(text, /Historical probe reading — minute 0; original target: "A"/);
  }
  assert.match(renderHistory(view(store, "bo")), /No measurement acquired/);
});

test("untrusted labels, notes, and historical targets cannot inject terminal controls", () => {
  const scene = visible();
  assert.ok(scene.parts && scene.history);
  const attack = "\x1b[2J\r\nfake\x9b31m\u202e";
  scene.parts[0] = { id: attack, label: attack, slot: 0 };
  scene.parts[1] = { id: "other", label: attack, slot: 2 };
  scene.probeTarget = attack;
  scene.history.push(
    { kind: "prediction", minute: 0, prediction: attack, reason: attack },
    { kind: "observation", minute: 0, target: attack, probeKelvin: 290, resolutionKelvin: 1 },
  );
  const error = parseBenchCommand(`dock ${attack}`, scene);
  const output = [
    renderBench(scene),
    renderHistory(scene),
    error.kind === "invalid" ? error.message : "",
    renderReceipt({
      status: "committed",
      minute: 0,
      revision: 0,
      observation: { minute: 0, target: attack, probeKelvin: 290, resolutionKelvin: 1 },
    }),
  ].join("\n");
  for (const control of ["\x1b", "\r", "\x9b", "\u202e"])
    assert.equal(output.includes(control), false);
  assert.doesNotMatch(output, /\nfake/);
  assert.match(output, /\\u001b/);
  assert.match(output, /\\u009b/);
  assert.match(output, /\\u202e/);
});

test("receipt statuses stay distinct and explain shared time without hidden diagnoses", () => {
  const statuses: Receipt["status"][] = [
    "committed",
    "stale",
    "infeasible",
    "unsupported",
    "unavailable",
    "retry-conflict",
  ];
  const results = statuses.map((status) => renderReceipt({ status, minute: 2, revision: 3 }));
  assert.equal(new Set(results).size, statuses.length);
  for (const result of results) {
    assert.match(result, /Receipt minute 2/);
    assert.match(result, /Time changes are shared/);
    assert.doesNotMatch(result, /energy|conductivity|temperature|correct|success|grade/i);
  }
});
