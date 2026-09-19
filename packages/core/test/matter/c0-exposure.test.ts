import { describe, expect, it } from "vitest";
import { NONE } from "../../src/matter/graph/grown.ts";
import { heatFrom } from "../../src/matter/heat.ts";
import { type Act, apply, type MatterWorld, resolve } from "../../src/matter/index.ts";
import { soakFrom } from "../../src/matter/soak.ts";
import { clearing, put, stateOf } from "./held-out-fixture.ts";

/** The outputs, not prose, must replay without rerunning a physical decision. */
function run(world: MatterWorld, act: Act) {
  const before = structuredClone(world);
  const result = resolve(world, act);
  expect(world).toEqual(before);
  expect(result).toEqual(resolve(world, act));
  expect(apply(world, result.changes).things).toEqual(result.world.things);
  for (const change of result.changes.filter((c) => c.kind !== "nothing"))
    expect(change.because.length).toBeGreaterThan(0);
  return result;
}

function coated() {
  const world = clearing();
  put(world, "target", "metal", {
    burning: { of: "coating", fuel: 1 },
    coating: { element: "oil", amount: 0.1, coverage: 1, bond: 0 },
  });
  return world;
}

describe("C0: supplied dose, not the requested or named liquid", () => {
  it.each([
    { dose: 0, stock: 1 },
    { dose: -1, stock: 1 },
    { dose: 1, stock: 0 },
  ])("no supplied dose admits no washing, wetting, cooling or steam: %j", ({ dose, stock }) => {
    const world = coated();
    put(world, "source", "soap", { amount: stock });
    const result = run(world, {
      process: "soak",
      liquid: "source",
      target: "target",
      amount: dose,
    });
    expect(result.world.things).toEqual(world.things);
    expect(result.changes.filter((c) => c.kind === "signal")).toEqual([]);
  });

  it("positive washing still lifts an unbonded coat and debits the actual supply", () => {
    const world = coated();
    put(world, "source", "soap", { amount: 0.5 });
    const result = run(world, { process: "soak", liquid: "source", target: "target", amount: 0.1 });
    expect(stateOf(result.world, "target").coating).toBeNull();
    expect(stateOf(result.world, "target").wetWith).toBe("soap");
    expect(stateOf(result.world, "source").amount).toBeCloseTo(0.4, 12);
  });

  it.each([
    { oiliness: 0, amount: 0.499, out: false },
    { oiliness: 0, amount: 0.5, out: true },
    { oiliness: 2.5, amount: 0.999, out: false },
    { oiliness: 2.5, amount: 1, out: true },
    { oiliness: 5, amount: 1, out: false },
  ])("aqueous dose controls dousing at the threshold: %j", ({ oiliness, amount, out }) => {
    const world = clearing();
    world.elements.unnamed = {
      id: "unnamed",
      name: "not a mechanism selector",
      kind: "material",
      forms: ["liquid"],
      props: { oiliness },
    };
    put(world, "source", "unnamed", { amount: 2 });
    put(world, "target", "reed", { temperature: 4, burning: { of: "self", fuel: 10 } });
    const result = run(world, { process: "soak", liquid: "source", target: "target", amount });
    expect(stateOf(result.world, "target").burning === null).toBe(out);
    expect(stateOf(result.world, "target").temperature).toBe(out ? 3 : 4);
    const steamed = result.changes.some((c) => c.kind === "signal" && c.note === "steam");
    expect(steamed).toBe(oiliness < 5);
    expect(stateOf(result.world, "source").amount).toBeCloseTo(2 - amount, 12);
  });

  it("a large request cannot douse using more aqueous liquid than is present", () => {
    const world = clearing();
    put(world, "source", "water", { amount: 0.49 });
    put(world, "target", "reed", { burning: { of: "self", fuel: 10 } });
    const result = run(world, { process: "soak", liquid: "source", target: "target", amount: 100 });
    expect(stateOf(result.world, "target").burning?.fuel).toBe(10);
    expect(result.world.things.source).toBeUndefined();
  });
});

describe("C0: heat admission covers all transformations, not only temperature", () => {
  it.each([
    { minutes: 0, contact: 1 },
    { minutes: 1, contact: 0 },
    { minutes: 0, contact: 0 },
    { minutes: -1, contact: 1 },
  ])("zero exposure preserves both complete physical states: %j", ({ minutes, contact }) => {
    const world = clearing();
    world.elements.fragile = {
      id: "fragile",
      name: "fragile",
      kind: "material",
      forms: [],
      props: { toughness: 0, setting: 5 },
    };
    put(world, "source", "water");
    put(world, "target", "fragile", { temperature: 5, contamination: 4, wetness: 3 });
    const result = run(world, {
      process: "heat",
      source: "source",
      target: "target",
      minutes,
      contact,
    });
    expect(result.world.things).toEqual(world.things);
    expect(result.changes.filter((c) => c.kind === "signal")).toEqual([]);
  });

  it.each([0, 1])("positive exposure cracks or tempers: meltsAt=%s", (meltsAt) => {
    const world = clearing();
    world.elements.sample = {
      id: "sample",
      name: "sample",
      kind: "material",
      forms: [],
      props: { toughness: 0, meltsAt },
    };
    put(world, "source", "water");
    put(world, "target", "sample", { temperature: 4.5 });
    const act: Act = { process: "heat", source: "source", target: "target", minutes: 1 };
    const positive = run(world, act).world;
    expect(stateOf(positive, "target").temperature).toBeLessThan(4.5);
    expect(stateOf(positive, "target").integrity).toBe(meltsAt === 0 ? 3 : 5);
    expect(stateOf(positive, "target").temper).toBe(meltsAt === 0 ? 0 : 1);
    expect(run(world, { ...act, minutes: 0 }).world.things).toEqual(world.things);
    expect(run(world, { ...act, contact: 0 }).world.things).toEqual(world.things);
  });

  it("zero contact neither spends flame fuel nor lights a hot target", () => {
    const world = clearing();
    put(world, "source", "reed", { burning: { of: "self", fuel: 1 } });
    put(world, "target", "reed", { temperature: 5 });
    const result = run(world, {
      process: "heat",
      source: "source",
      target: "target",
      minutes: 2,
      contact: 0,
    });
    expect(result.world.things).toEqual(world.things);
  });

  it("the process gate also excludes future admitted rows at zero exposure", () => {
    const grown = {
      ...NONE,
      rules: [
        {
          id: "test-exposure",
          says: "An admitted exposure changes the target",
          about: "tgt",
          first: [
            {
              effects: [{ kind: "set" as const, q: "tgt.s.integrity", to: 1, lo: 0, hi: 5 }],
              because: ["X3"],
            },
          ],
        },
      ],
    };
    const world = clearing();
    put(world, "source", "water");
    put(world, "target", "metal");
    const heat = heatFrom(grown);
    const soak = soakFrom(grown);
    const heatAct = { process: "heat" as const, source: "source", target: "target", minutes: 0 };
    const soakAct = { process: "soak" as const, liquid: "source", target: "target", amount: 0 };
    expect(apply(world, heat(world, heatAct)).things).toEqual(world.things);
    expect(apply(world, soak(world, soakAct)).things).toEqual(world.things);
    const heated = apply(world, heat(world, { ...heatAct, minutes: 1 }));
    const soaked = apply(world, soak(world, { ...soakAct, amount: 0.1 }));
    expect(stateOf(heated, "target").integrity).toBe(1);
    expect(stateOf(soaked, "target").integrity).toBe(1);
  });
});

describe("C0: integrate the active interval before burnout", () => {
  it.each([0, 0.5, 0.99999, 1, 1.00001, 2, 10])("analytic temperature at %s minutes", (minutes) => {
    const world = coated();
    const result = run(world, { process: "drift", minutes });
    // Independent closed form for mass=2, conductivity=4, ambient=2, fuel=1.
    const rate = 0.0225;
    const heated = 5 - 3 * Math.exp(-rate * Math.min(minutes, 1));
    const expected = 2 + (heated - 2) * Math.exp(-rate * Math.max(0, minutes - 1));
    const state = stateOf(result.world, "target");
    expect(state.temperature).toBeCloseTo(expected, 10);
    expect(state.burning === null).toBe(minutes >= 1);
    expect(state.coating === null).toBe(minutes >= 1);
    if (minutes > 0)
      expect(result.changes.some((c) => c.kind === "state" && c.because.includes("S1"))).toBe(true);
  });

  const partitions = [
    [0.5, 0.5, 1],
    [0.99999, 0.00002, 0.99999],
    [1, 1],
    [0.25, 0.25, 0.25, 0.25, 1],
  ];
  it.each(partitions)("partitions around exhaustion agree within 1e-10: %j", (...parts) => {
    const world = coated();
    const one = run(world, { process: "drift", minutes: 2 }).world;
    const many = parts.reduce((at, minutes) => run(at, { process: "drift", minutes }).world, world);
    expect(stateOf(many, "target").temperature).toBeCloseTo(stateOf(one, "target").temperature, 10);
    expect(stateOf(many, "target").burning).toBeNull();
    expect(stateOf(many, "target").coating).toBeNull();
  });

  it.each(["no air", "no fuel", "not combustible"])("does not heat with %s", (missing) => {
    const world = coated();
    const target = world.things.target;
    const place = world.places.clearing;
    if (!(target && place)) throw new Error("Missing fixture");
    if (missing === "no air") place.air = 0;
    if (missing === "no fuel") target.state.burning = { of: "coating", fuel: 0 };
    if (missing === "not combustible") target.state.coating = null;
    const result = run(world, { process: "drift", minutes: 2 });
    expect(stateOf(result.world, "target").temperature).toBe(2);
    expect(stateOf(result.world, "target").burning).toBeNull();
  });
});
