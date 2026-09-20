import assert from "node:assert/strict";
import test from "node:test";
import { runContrasts } from "../../../../validation/thermal-learning/contrasts.ts";
import { runNumericProbes } from "../../../../validation/thermal-learning/numeric-probes.ts";
import {
  DOMAIN,
  initialPhysics,
  inspectCase,
  placements,
} from "../../../../validation/thermal-learning/sweep.ts";
import { evolve, validatePhysics } from "../../src/thermal/physics.ts";

test("enumeration covers every unique partial placement and each eligible probe target", () => {
  const cases = [...placements()];
  assert.equal(cases.length, DOMAIN.placements);
  assert.equal(new Set(cases.map((slots) => JSON.stringify(slots))).size, DOMAIN.placements);
  const byOccupancy = [0, 0, 0, 0, 0];
  let dockings = 0;
  for (const slots of cases) {
    const occupied = slots.filter((slot) => slot !== null);
    assert.equal(new Set(occupied).size, occupied.length);
    byOccupancy[occupied.length] = (byOccupancy[occupied.length] ?? 0) + 1;
    dockings += occupied.length + 1;
  }
  assert.deepEqual(byOccupancy, [1, 36, 432, 2016, 3024]);
  assert.equal(dockings, DOMAIN.placementProbeCases);
});

test("oracle rejects globally balanced leakage and a no-op solver on connected gradients", () => {
  const initial = initialPhysics();
  const forged = structuredClone(initial);
  const [a, b] = forged.parts;
  assert.ok(a && b);
  a.energyJ -= 10;
  b.energyJ += 10;
  assert.ok(inspectCase(initial, forged).failures.length > 0);
  const connected = structuredClone(initial);
  const bridge = connected.parts[3];
  assert.ok(bridge);
  bridge.slot = 1;
  assert.ok(
    inspectCase(connected, connected).failures.some((message) => message.includes("no exchange")),
  );
  assert.deepEqual(inspectCase(connected, evolve(connected, 60)).failures, []);
});

test("oracle rejects non-energy mutations even when output physics remains valid", () => {
  const initial = initialPhysics();
  for (const mutation of ["identity", "mass", "placement", "probe", "bench"]) {
    const forged = structuredClone(initial);
    const part = forged.parts[0];
    assert.ok(part);
    if (mutation === "identity") part.id = "renamed";
    if (mutation === "mass") part.massKg *= 1.1;
    if (mutation === "placement") part.slot = 1;
    if (mutation === "probe") forged.probe.conductanceWPerK /= 2;
    if (mutation === "bench") forged.rows -= 1;
    assert.deepEqual(validatePhysics(forged), [], mutation);
    assert.ok(
      inspectCase(initial, forged).failures.includes("solver changed non-energy properties"),
      mutation,
    );
  }
});

test("declared contrasts, square transforms and numeric probes pass without retuning", () => {
  const contrasts = runContrasts();
  assert.deepEqual(contrasts.failures, []);
  assert.equal(contrasts.transformErrorsK.length, 8);
  const numeric = runNumericProbes();
  assert.equal(numeric.cases, 243);
  assert.deepEqual(numeric.failures, []);
  // Diagnostic is intentionally not flattened into an all-domain 0.1 K claim.
  assert.ok(Number.isFinite(numeric.maxAnalyticErrorK));
  assert.ok(numeric.maxNonstiffAnalyticErrorK < 0.1);
});
