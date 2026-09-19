import { describe, expect, it } from "vitest";
import {
  DRIFT_AFTER,
  DRIFT_BEFORE,
  DRIFT_DERIVED,
  DRIFT_DURING,
} from "../../src/matter/graph/drift-rules.ts";
import { envOf, partyOf, readyAll } from "../../src/matter/graph/kernel.ts";
import { apply, type MatterWorld, resolve } from "../../src/matter/index.ts";
import { clearing, put, stateOf } from "./held-out-fixture.ts";

function coated(amount: number, wind: number, fuel = 1.3, temperature = 2) {
  const world = clearing();
  const place = world.places.clearing;
  if (!place) throw new Error("Missing place");
  place.wind = wind;
  put(world, "target", "metal", {
    amount,
    temperature,
    burning: { of: "coating", fuel },
    coating: { element: "oil", amount: 0.1, coverage: 1, bond: 0 },
  });
  return world;
}

function wait(world: MatterWorld, minutes: number) {
  const before = structuredClone(world);
  const result = resolve(world, { process: "drift", minutes });
  expect(world).toEqual(before);
  expect(result).toEqual(resolve(world, { process: "drift", minutes }));
  expect(apply(world, result.changes).things).toEqual(result.world.things);
  return result.world;
}

// Independent analytic case: base flame rate; admitted bulk/wind cooling after burnout.
const flameRate = 0.0225;
const coolingRate = (amount: number, wind: number) =>
  flameRate * Math.max(1, amount) ** -0.25 * (1 + 0.3 * Math.max(0, wind - 1));
const conditions = [
  { amount: 2, wind: 0 },
  { amount: 1, wind: 2 },
  { amount: 2, wind: 2 },
];

describe.each(conditions)("C0: unchanged grown drift rows with %j", ({ amount, wind }) => {
  it.each([0.7, 1.29999, 1.3, 1.30001, 2.7])("retains heat around exhaustion: t=%s", (minutes) => {
    const result = wait(coated(amount, wind), minutes);
    const heated = 5 - 3 * Math.exp(-flameRate * Math.min(minutes, 1.3));
    const expected =
      2 + (heated - 2) * Math.exp(-coolingRate(amount, wind) * Math.max(0, minutes - 1.3));
    const state = stateOf(result, "target");
    expect(state.temperature).toBeCloseTo(expected, 10);
    expect(state.burning === null).toBe(minutes >= 1.3);
    expect(state.coating === null).toBe(minutes >= 1.3);
  });

  it.each([
    [0.4, 0.8, 0.3, 1.2],
    [1.29999, 0.00002, 1.39999],
    [1.3, 1.4],
  ])("non-grid partitions preserve residual heat: first=%s", (...parts) => {
    const world = coated(amount, wind);
    const whole = wait(world, 2.7);
    const split = parts.reduce(wait, world);
    expect(stateOf(split, "target").temperature).toBeCloseTo(
      stateOf(whole, "target").temperature,
      10,
    );
    expect(stateOf(split, "target").burning).toBeNull();
    expect(stateOf(split, "target").coating).toBeNull();
  });

  it.each(["no air", "no fuel", "not combustible"])("initial %s cools immediately", (missing) => {
    const world = coated(amount, wind, missing === "no fuel" ? 0 : 1.3, 4);
    const target = world.things.target;
    const place = world.places.clearing;
    if (!(target && place)) throw new Error("Missing fixture");
    if (missing === "no air") place.air = 0;
    if (missing === "not combustible" && target.state.coating)
      target.state.coating.element = "metal";
    const result = wait(world, 1);
    const state = stateOf(result, "target");
    expect(state.temperature).toBeCloseTo(2 + 2 * Math.exp(-coolingRate(amount, wind)), 10);
    expect(state.burning).toBeNull();
    expect(state.coating === null).toBe(missing === "no fuel");
  });
});

describe("C0: interval snapshots and boundary extinctions", () => {
  it("keeps the start snapshot and active flame/coating through all interval rows", () => {
    const world = coated(2, 2, 1);
    const target = world.things.target;
    if (!target) throw new Error("Missing target");
    const party = partyOf(world, target);
    const env = envOf(world, { self: party }, 1);
    for (const rule of readyAll([...DRIFT_BEFORE, ...DRIFT_DURING], DRIFT_DERIVED)) rule(env);
    expect(party.was).toBe(target.state);
    expect(party.was.temperature).toBe(2);
    expect(party.s.temperature).toBeGreaterThan(2);
    expect(party.s.burning?.fuel).toBe(1);
    expect(party.s.coating).toEqual(target.state.coating);
    for (const rule of readyAll(DRIFT_AFTER, DRIFT_DERIVED)) rule(env);
    expect(party.s.burning).toBeNull();
    expect(party.s.coating).toBeNull();
    expect(party.was).toBe(target.state);
    expect(party.was.burning?.fuel).toBe(1);
  });

  it.each([0.5, 5])("endpoint weather keeps heat without restoring flame: fuel=%s", (fuel) => {
    const world = coated(2, 4, fuel);
    const result = wait(world, 0.5);
    const state = stateOf(result, "target");
    expect(state.temperature).toBeCloseTo(5 - 3 * Math.exp(-flameRate * 0.5), 10);
    expect(state.burning).toBeNull();
    expect(state.coating === null).toBe(fuel === 0.5);
  });

  it("self-fuel exhausted at a weather endpoint still consumes the substrate", () => {
    const world = clearing();
    const place = world.places.clearing;
    if (!place) throw new Error("Missing place");
    place.wind = 4;
    put(world, "target", "reed", { burning: { of: "self", fuel: 0.5 } });
    expect(wait(world, 0.5).things.target).toBeUndefined();
  });

  it("already-due self exhaustion is settled even without air", () => {
    const world = clearing();
    const place = world.places.clearing;
    if (!place) throw new Error("Missing place");
    place.air = 0;
    put(world, "target", "reed", { burning: { of: "self", fuel: 0 } });
    expect(wait(world, 1).things.target).toBeUndefined();
  });
});
