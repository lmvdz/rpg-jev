import assert from "node:assert/strict";
import test from "node:test";
import { checkInvariants } from "../../src/effects.ts";
import { stableStringify } from "../../src/hash.ts";
import { parseLog, replay, Store, serializeLog } from "../../src/log.ts";
import { attempt, type Request, view } from "../../src/thermal/attempt.ts";
import type { ThermalSettlement } from "../../src/thermal/contract.ts";
import { benchWorld } from "../../src/thermal/fixture.ts";
import { temperature, validatePhysics } from "../../src/thermal/physics.ts";

function act(store: Store, operation: unknown, actor = "ada") {
  return attempt(store, actor, {
    requestId: `request-${store.log.length}`,
    expectedRevision: store.world.thermal?.revision ?? 0,
    operation,
  });
}

function physics(store: Store) {
  assert.ok(store.world.thermal);
  return store.world.thermal.physics;
}

function named(store: Store, id: string) {
  const part = physics(store).parts.find((candidate) => candidate.id === id);
  assert.ok(part);
  return part;
}

function lastSettlement(store: Store): ThermalSettlement {
  const entry = store.log.at(-1);
  assert.ok(entry?.kind === "effect" && entry.effect.kind === "thermal_settle");
  return structuredClone(entry.effect);
}

test("supported intervention connects actual faces; interruption preserves heat", () => {
  const store = new Store(benchWorld());
  const initial = structuredClone(physics(store));
  act(store, { kind: "wait" });
  assert.deepEqual(physics(store), initial);
  act(store, { kind: "seat", part: "D", slot: 1 });
  act(store, { kind: "dock", target: "B" });
  act(store, { kind: "wait" });
  assert.ok(temperature(named(store, "B")) > 290);
  assert.ok(temperature(named(store, "A")) < 370);
  assert.equal(act(store, { kind: "seat", part: "B", slot: null }).status, "infeasible");
  act(store, { kind: "dock", target: null });
  act(store, { kind: "seat", part: "B", slot: null });
  const retained = named(store, "B").energyJ;
  act(store, { kind: "wait" });
  assert.equal(named(store, "B").energyJ, retained);
  assert.deepEqual(checkInvariants(store.world), []);
});

test("unfamiliar path and substituted property follow a recorded prediction", () => {
  function run(bridge: "C" | "D") {
    const store = new Store(benchWorld());
    act(store, {
      kind: "predict",
      prediction: "The far cube will warm more with D",
      reason: "The bridge's properties should control the rate, not the row it occupies.",
    });
    act(store, { kind: "seat", part: "A", slot: 3 });
    act(store, { kind: "seat", part: "B", slot: 5 });
    act(store, { kind: "seat", part: bridge, slot: 4 });
    act(store, { kind: "dock", target: "B" });
    act(store, { kind: "wait" });
    return { store, reading: act(store, { kind: "read" }).observation?.probeKelvin };
  }
  const conductive = run("D");
  const resistive = run("C");
  assert.ok(conductive.reading !== undefined && resistive.reading !== undefined);
  assert.ok(conductive.reading > resistive.reading);
  const projection = view(conductive.store, "ada");
  assert.equal(projection.history?.[0]?.kind, "prediction");
  // This scripted prediction is engineering evidence, not a participant-learning result.
});

test("hidden twins have equal options and inconclusive first readings; probe retains memory", () => {
  const hot = new Store(benchWorld());
  const cold = new Store(benchWorld());
  named(cold, "A").energyJ = 20 * 290;
  assert.deepEqual(view(hot, "ada"), view(cold, "ada"));
  for (const store of [hot, cold]) act(store, { kind: "dock", target: "A" });
  assert.deepEqual(act(hot, { kind: "read" }), act(cold, { kind: "read" }));
  act(hot, { kind: "wait" });
  const prior = act(hot, { kind: "read" });
  assert.ok(prior.observation && prior.observation.probeKelvin > 290);
  act(hot, { kind: "dock", target: "B" });
  const current = act(hot, { kind: "read" });
  assert.equal(current.observation?.probeKelvin, prior.observation.probeKelvin);
  assert.equal(current.observation?.target, "B");
  assert.equal(prior.observation.target, "A");
  assert.deepEqual(view(hot, "bo").history, []);
  assert.ok(!JSON.stringify(view(hot, "ada")).includes("energyJ"));
});

test("two actors conflict; retries preserve successful and rejected settlements after replay", () => {
  const initial = benchWorld();
  const store = new Store(structuredClone(initial));
  const a: Request = {
    requestId: "a",
    expectedRevision: 0,
    operation: { kind: "seat", part: "D", slot: 1 },
  };
  const b: Request = {
    requestId: "b",
    expectedRevision: 0,
    operation: { kind: "seat", part: "C", slot: 1 },
  };
  const first = attempt(store, "ada", a);
  const loser = attempt(store, "bo", b);
  assert.equal(first.status, "committed");
  assert.equal(loser.status, "stale");
  act(store, { kind: "wait" });
  const log = parseLog(serializeLog(store.log));
  const restored = new Store(replay(initial, log), log);
  assert.deepEqual(restored.world, store.world);
  const count = log.length;
  assert.deepEqual(attempt(restored, "ada", a), first);
  assert.deepEqual(attempt(restored, "bo", b), loser);
  assert.equal(restored.log.length, count);
  assert.equal(
    attempt(restored, "ada", { ...a, operation: { kind: "wait" } }).status,
    "retry-conflict",
  );
  assert.equal(restored.world.clock, 1);
});

test("read retry cannot obtain later evidence; rejected physical attempts stay rejected", () => {
  const store = new Store(benchWorld());
  act(store, { kind: "dock", target: "A" });
  const request = { requestId: "read-once", expectedRevision: 1, operation: { kind: "read" } };
  const reading = attempt(store, "ada", request);
  act(store, { kind: "wait" });
  assert.deepEqual(attempt(store, "ada", request), reading);
  const blocked = {
    requestId: "blocked",
    expectedRevision: 3,
    operation: { kind: "seat", part: "A", slot: null },
  };
  assert.equal(attempt(store, "ada", blocked).status, "infeasible");
  act(store, { kind: "dock", target: null });
  assert.equal(attempt(store, "ada", blocked).status, "infeasible");
});

test("authority rejects direct clock bypass and fabricated balanced heat or evidence", () => {
  const store = new Store(benchWorld());
  assert.equal(store.tryCommit({ kind: "advance_clock", minutes: 1 }, null), null);
  act(store, { kind: "read" });
  const forged = lastSettlement(store);
  forged.expectedRevision = 1;
  forged.requestedRevision = 1;
  forged.requestId = "forged-reading";
  forged.fingerprint = stableStringify({ expectedRevision: 1, operation: { kind: "read" } });
  forged.receipt.revision = 2;
  assert.ok(forged.receipt.observation);
  forged.receipt.observation.probeKelvin = 399;
  assert.equal(store.tryCommit(forged, null), null);
  act(store, { kind: "wait" });
  const heat = lastSettlement(store);
  heat.expectedRevision = 2;
  heat.requestedRevision = 2;
  heat.requestId = "forged-heat";
  heat.fingerprint = stableStringify({ expectedRevision: 2, operation: { kind: "wait" } });
  heat.beforeMinute = 1;
  heat.receipt.revision = 3;
  heat.receipt.minute = 2;
  const [a, b] = heat.physics.parts;
  assert.ok(a && b);
  a.energyJ -= 10;
  b.energyJ += 10;
  assert.equal(store.tryCommit(heat, null), null);
  assert.equal(store.world.clock, 1);
});

test("unsupported and unavailable are explicit; legacy worlds still advance normally", () => {
  const store = new Store(benchWorld());
  assert.equal(act(store, { kind: "burn" }).status, "unsupported");
  assert.equal(act(store, { kind: "wait", seconds: 1 }).status, "unsupported");
  assert.equal(act(store, { kind: "read" }, "outsider").status, "unavailable");
  assert.equal(store.world.clock, 0);
  const legacy = benchWorld();
  delete legacy.thermal;
  const old = new Store(legacy);
  assert.notEqual(old.tryCommit({ kind: "advance_clock", minutes: 1 }, null), null);
  assert.equal(old.world.clock, 1);
});

test("independent review: fresh counterfeit fingerprint and direct duplicate are rejected", () => {
  const template = new Store(benchWorld());
  act(template, { kind: "wait" });
  const forged = lastSettlement(template);
  const target = new Store(benchWorld());
  forged.requestId = "victim";
  forged.fingerprint = stableStringify({ expectedRevision: 0, operation: { kind: "read" } });
  assert.equal(target.tryCommit(forged, null), null);
  assert.equal(target.world.clock, 0);
  const valid = lastSettlement(template);
  assert.notEqual(target.tryCommit(valid, null), null);
  valid.beforeMinute = 1;
  valid.expectedRevision = 1;
  valid.requestedRevision = 1;
  valid.receipt.revision = 2;
  valid.receipt.minute = 2;
  valid.fingerprint = stableStringify({ expectedRevision: 1, operation: { kind: "wait" } });
  assert.equal(target.tryCommit(valid, null), null);
  assert.equal(target.world.clock, 1);
});

test("independent review: rack is not a valid docking surface", () => {
  const store = new Store(benchWorld());
  assert.equal(act(store, { kind: "dock", target: "C" }).status, "infeasible");
  const invalid = structuredClone(physics(store));
  invalid.probe.target = "C";
  assert.ok(validatePhysics(invalid).length > 0);
});

test("independent unfamiliar U path: same inventory, bypass versus gap", () => {
  function run(gap: boolean) {
    const initial = benchWorld();
    assert.ok(initial.thermal);
    const prototype = initial.thermal.physics.parts[0];
    assert.ok(prototype);
    initial.thermal.physics.parts = [0, 3, 4, 5, 2].map((slot, index) => ({
      ...prototype,
      id: `u${index}`,
      label: `cube ${index}`,
      slot,
      energyJ: 20 * (index === 0 ? 370 : 290),
    }));
    const store = new Store(initial);
    act(store, {
      kind: "predict",
      prediction: "The far end can warm around the empty upper socket.",
      reason: "A continuous face path exists around it; adjacency is not straight-line distance.",
    });
    if (gap) act(store, { kind: "seat", part: "u2", slot: null });
    act(store, { kind: "dock", target: "u4" });
    for (let minute = 0; minute < 5; minute++) act(store, { kind: "wait" });
    return act(store, { kind: "read" }).observation?.probeKelvin;
  }
  const connected = run(false);
  const broken = run(true);
  assert.ok(connected !== undefined && broken !== undefined);
  assert.ok(connected > broken);
  assert.equal(broken, 290);
});
