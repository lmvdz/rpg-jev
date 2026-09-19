/**
 * Held-out scenarios proposed independently of the existing tests and vocabulary batches.
 * Expectations are behavioral contracts, not snapshots of the implementation.
 * See docs/held-out-clearing-report.md for assumptions and expected-failure policy.
 */
import { describe, expect, it } from "vitest";
import { type Act, play, resolve } from "../../src/matter/index.ts";
import { clearing, put, stateOf } from "./held-out-fixture.ts";

describe("held-out clearing: finite supplies", () => {
  it("eating an exhausted portion cannot nourish the player again", () => {
    const world = clearing();
    put(world, "meal", "food", { amount: 0.5 });
    const eat: Act = { process: "ingest", body: "player", thing: "meal", amount: 100 };
    const first = resolve(world, eat).world;
    expect(first.bodies.player?.needs.hunger).toBe(4);
    expect(first.things.meal).toBeUndefined();
    expect(resolve(first, eat).world).toEqual(first);
  });

  it("many coating attempts cannot use more oil than the supply contains", () => {
    const world = clearing();
    put(world, "supply", "oil", { amount: 0.3 });
    put(world, "tool", "metal");
    const coat: Act = { process: "coat", substance: "supply", target: "tool", amount: 0.2 };
    const after = play(
      world,
      Array.from({ length: 10 }, () => coat),
    ).world;
    expect(after.things.supply).toBeUndefined();
    expect(stateOf(after, "tool").coating?.amount).toBeCloseTo(0.3);
  });

  it("an exhausted water supply cannot wet a second object", () => {
    const world = clearing();
    put(world, "cup", "water", { amount: 0.2 });
    put(world, "first", "reed");
    put(world, "second", "reed");
    const after = play(world, [
      { process: "soak", liquid: "cup", target: "first", amount: 1 },
      { process: "soak", liquid: "cup", target: "second", amount: 1 },
    ]).world;
    expect(after.things.cup).toBeUndefined();
    expect(stateOf(after, "first").wetness).toBeGreaterThan(0);
    expect(stateOf(after, "second").wetness).toBe(0);
  });

  it("burning food removes the edible portion and cannot nourish later", () => {
    const world = clearing();
    // Combustibility is authored data, not inferred from the food's name.
    const food = world.elements.food;
    if (!food) throw new Error("Missing food fixture");
    food.props.flammability = 4;
    put(world, "meal", "food", { burning: { of: "self", fuel: 2 } });
    const burnt = resolve(world, { process: "drift", minutes: 10 }).world;
    expect(burnt.things.meal).toBeUndefined();
    const hunger = burnt.bodies.player?.needs.hunger;
    const after = resolve(burnt, { process: "ingest", body: "player", thing: "meal" }).world;
    expect(after.bodies.player?.needs.hunger).toBe(hunger);
  });
});

describe("held-out clearing: exposure and state chains", () => {
  it("wet reeds resist an exposure that ignites otherwise identical dry reeds", () => {
    const world = clearing();
    put(world, "fire", "reed", { burning: { of: "self", fuel: 30 }, temperature: 5 });
    put(world, "bundle", "reed", { wetness: 5 });
    const dry = structuredClone(world);
    put(dry, "bundle", "reed");
    const act: Act = { process: "heat", source: "fire", target: "bundle", minutes: 0.5 };
    expect(stateOf(resolve(dry, act).world, "bundle").burning).not.toBeNull();
    const after = resolve(world, act).world;
    expect(stateOf(after, "bundle").burning).toBeNull();
  });

  it("water ends a coating fire and waiting does not restart it", () => {
    const world = clearing();
    put(world, "cup", "water");
    put(world, "tool", "metal", {
      temperature: 4,
      coating: { element: "oil", amount: 0.2, coverage: 1, bond: 0 },
      burning: { of: "coating", fuel: 2 },
    });
    const out = resolve(world, { process: "soak", liquid: "cup", target: "tool", amount: 1 }).world;
    expect(stateOf(out, "tool").burning).toBeNull();
    const later = resolve(out, { process: "drift", minutes: 30 }).world;
    expect(stateOf(later, "tool").burning).toBeNull();
    expect(stateOf(later, "tool").temperature).toBeLessThanOrEqual(
      stateOf(out, "tool").temperature,
    );
  });

  // H1: douse is applied to every liquid, including flammable oil.
  it.fails("oil is not treated as extinguishing water on burning fuel", () => {
    const world = clearing();
    put(world, "supply", "oil");
    put(world, "wick", "reed", {
      temperature: 5,
      burning: { of: "self", fuel: 10 },
    });
    const after = resolve(world, {
      process: "soak",
      liquid: "supply",
      target: "wick",
      amount: 1,
    }).world;
    // Exposed, air-fed flame; no sealed vessel or oxygen-starvation action.
    expect(stateOf(after, "wick").burning).not.toBeNull();
  });

  // H2: washing and wetWith changes run even when the used amount is zero.
  it.fails("zero washing liquid cannot remove an existing oil coating", () => {
    const world = clearing();
    put(world, "wash", "soap");
    put(world, "tool", "metal", {
      coating: { element: "oil", amount: 0.5, coverage: 1, bond: 0 },
    });
    const after = resolve(world, {
      process: "soak",
      liquid: "wash",
      target: "tool",
      amount: 0,
    }).world;
    expect(after).toEqual(world);
  });

  // H5: shock ignores exposure. Cold water must be liquid, not frozen, to test this.
  it.fails.each([
    { minutes: 0, contact: 1 },
    { minutes: 1, contact: 0 },
  ])("zero exposure cannot crack a hot brittle object: %j", ({ minutes, contact }) => {
    const world = clearing();
    put(world, "cold", "water", { temperature: 1 });
    put(world, "hot", "pebble", { temperature: 5 });
    const pebble = world.elements.pebble;
    if (!pebble) throw new Error("Missing pebble fixture");
    pebble.props.toughness = 1;
    const after = resolve(world, {
      process: "heat",
      source: "cold",
      target: "hot",
      minutes,
      contact,
    }).world;
    expect(stateOf(after, "hot").integrity).toBe(5);
  });

  // H3: the source-side exchange ignores negative transfer (a cooling target).
  it.fails("a cold source gains the heat lost by an equal-capacity hot target", () => {
    const world = clearing();
    put(world, "cold", "metal", { temperature: 1 });
    put(world, "hot", "metal", { temperature: 4 });
    const after = resolve(world, {
      process: "heat",
      source: "cold",
      target: "hot",
      minutes: 5,
    }).world;
    expect(stateOf(after, "hot").temperature).toBeLessThan(4);
    expect(stateOf(after, "cold").temperature).toBeGreaterThan(1);
    expect(stateOf(after, "cold").temperature + stateOf(after, "hot").temperature).toBeCloseTo(5);
  });

  // H4: drift clears the expired fire before accounting for the time it burned.
  it.fails("waiting past coating exhaustion has the same qualitative result in smaller steps", () => {
    const world = clearing();
    put(world, "tool", "metal", {
      coating: { element: "oil", amount: 0.2, coverage: 1, bond: 0 },
      burning: { of: "coating", fuel: 5 },
    });
    const one = resolve(world, { process: "drift", minutes: 10 }).world;
    const many = play(
      world,
      Array.from(
        { length: 10 },
        (): Act => ({
          process: "drift",
          minutes: 1,
        }),
      ),
    ).world;
    for (const after of [one, many]) {
      expect(stateOf(after, "tool").burning).toBeNull();
      expect(stateOf(after, "tool").coating).toBeNull();
      expect(stateOf(after, "tool").amount).toBe(1);
    }
    // After the same burn, both should still retain some heat above the mild surroundings.
    expect(stateOf(many, "tool").temperature).toBeGreaterThan(2);
    expect(stateOf(one, "tool").temperature).toBeGreaterThan(2);
  });
});

describe("held-out clearing: settled search and deterministic execution", () => {
  it("zero search time and impossible resources cannot mint instances", () => {
    const world = clearing();
    const after = play(world, [
      { process: "search", place: "clearing", element: "pebble", minutes: 0, draw: 0 },
      { process: "search", place: "clearing", element: "metal", minutes: 1000, draw: 0 },
    ]).world;
    expect(after.things).toEqual({});
    expect(after.places.clearing?.searched.metal?.found).toBe(0);
  });

  it("repeated successful searches cannot exceed the patch's finite rare stock", () => {
    const world = clearing();
    const acts = Array.from(
      { length: 100 },
      (): Act => ({
        process: "search",
        place: "clearing",
        element: "pebble",
        minutes: 60,
        draw: 0,
      }),
    );
    const after = play(world, acts).world;
    const found = Object.values(after.things).reduce((sum, thing) => sum + thing.state.amount, 0);
    expect(found).toBeGreaterThan(0);
    // Rare stock is two in the present code; repeated perfect draws must not exceed it.
    expect(found).toBeLessThanOrEqual(2);
    expect(after.places.clearing?.searched.pebble?.found).toBe(found);
  });

  it("a cross-process chain is deterministic, causal, and leaves its input untouched", () => {
    const world = clearing();
    put(world, "supply", "oil");
    put(world, "tool", "metal");
    put(world, "fire", "reed", { burning: { of: "self", fuel: 30 }, temperature: 5 });
    const before = structuredClone(world);
    const acts: Act[] = [
      { process: "coat", substance: "supply", target: "tool", amount: 0.2 },
      { process: "heat", source: "fire", target: "tool", minutes: 2 },
      { process: "drift", minutes: 10 },
    ];
    const first = play(world, acts);
    expect(first).toEqual(play(world, acts));
    expect(world).toEqual(before);
    const effects = first.changes.filter((change) => change.kind !== "nothing");
    expect(effects.length).toBeGreaterThan(0);
    for (const change of effects) expect(change.because.length).toBeGreaterThan(0);
  });
});
