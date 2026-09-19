/**
 * The invariants batch C asked for (`spikes/vocabulary/FINDINGS.md`). Two of its rule errors
 * were in code one day old, and both were one fault: two rules that read the same thing and
 * meant different things by it.
 *
 * 5. One concept, one function: a form means the same to every rule, a thing is born one way,
 *    and a level is the same size of step wherever it is used.
 * 6. Conservation, extended: what force removes becomes a thing, the minutes a fire gives come
 *    out of its fuel, and what a hot thing loses the thing that cooled it gains.
 */
import { describe, expect, it } from "vitest";
import {
  type Act,
  alight,
  type Element,
  FRESH,
  type MatterWorld,
  POOL,
  placeOf,
  quantity,
  resolve,
  searchOdds,
  strength,
  type Thing,
  weight,
  worldOf,
} from "../../src/matter/index.ts";

const ROWS: Element[] = [
  {
    id: "cord2",
    name: "a short rope",
    kind: "thing",
    forms: ["cord"],
    props: { mass: 1, size: 2, hardness: 1, toughness: 5, flexibility: 5 },
  },
  {
    id: "cord5",
    name: "a long rope",
    kind: "thing",
    forms: ["cord"],
    props: { mass: 2, size: 5, hardness: 1, toughness: 5, flexibility: 5 },
  },
  {
    id: "hide2",
    name: "a small hide",
    kind: "thing",
    forms: ["sheet"],
    props: { mass: 1, size: 2, hardness: 1, toughness: 4, flexibility: 4 },
  },
  {
    id: "hide5",
    name: "a great hide",
    kind: "thing",
    forms: ["sheet"],
    props: { mass: 2, size: 5, hardness: 1, toughness: 4, flexibility: 4 },
  },
  {
    id: "pot",
    name: "a pot",
    kind: "thing",
    forms: ["hollow"],
    props: { mass: 2, size: 1, hardness: 3, toughness: 1 },
  },
  {
    id: "boulder",
    name: "a boulder",
    kind: "material",
    forms: ["round"],
    props: { mass: 5, size: 3, hardness: 4, toughness: 2 },
  },
  {
    id: "claybank",
    name: "a bank of clay",
    kind: "material",
    forms: [],
    props: { mass: 4, size: 4, hardness: 1, toughness: 1, absorbency: 3 },
    moist: 4,
  },
  {
    id: "spade",
    name: "a spade",
    kind: "thing",
    forms: ["edged", "flat"],
    props: { mass: 2, size: 2, hardness: 4, toughness: 4 },
  },
];

const at = (id: string, element: string, set: Partial<Thing["state"]> = {}): Thing => ({
  id,
  element,
  place: "here",
  state: { ...FRESH, ...set },
});

function world(things: Thing[], place = {}): MatterWorld {
  const empty = worldOf([...POOL, ...ROWS], [placeOf("here", place)]);
  return { ...empty, things: Object.fromEntries(things.map((t) => [t.id, t])) };
}

const amountOf = (w: MatterWorld, element: string) =>
  Object.values(w.things).reduce((n, t) => n + (t.element === element ? t.state.amount : 0), 0);

describe("5. one concept, one function", () => {
  it("a cord and a sheet are thin to a load as they are to a cut: a longer rope is not a stronger one", () => {
    const w = world([
      at("short", "cord2"),
      at("long", "cord5"),
      at("small", "hide2"),
      at("great", "hide5"),
    ]);
    const bears = (id: string) => strength(w, w.things[id] as Thing);
    expect(bears("long")).toBeLessThanOrEqual(bears("short") + 0.2);
    expect(bears("great")).toBeLessThanOrEqual(bears("small") + 0.2);
  });

  it("whatever comes into being is born as wet as its element is moist, by whatever path", () => {
    const found = resolve(world([], { abundance: { berries: 4 } }), {
      process: "search",
      place: "here",
      element: "berries",
      minutes: 60,
      draw: 0,
    }).world;
    const berries = Object.values(found.things).find((t) => t.element === "berries");
    expect(berries?.state.wetness).toBe(3);
    const dug = resolve(
      world([at("bank", "claybank", { wetness: 4 }), at("spade", "spade", { edge: 2 })]),
      {
        process: "force",
        instrument: "spade",
        patient: "bank",
        aim: "surface",
        manner: { effort: 3, care: 2, haste: 2 },
      },
    ).world;
    const spoil = Object.values(dug.things).find(
      (t) => t.element === "claybank" && t.id !== "bank",
    );
    expect(spoil?.state.wetness).toBeGreaterThan(3);
  });

  it("a level of mass is the same step for weight as for heat, and thirty pots do not outweigh a boulder", () => {
    const w = world([at("pots", "pot", { amount: 30 }), at("rock", "boulder")]);
    expect(weight(w, ["pots"])).toBeLessThan(weight(w, ["rock"]));
    expect(weight(w, ["pots"])).toBeGreaterThan(weight(world([at("pots", "pot")]), ["pots"]) + 1);
    expect(quantity(3) / quantity(2)).toBe(quantity(5) / quantity(4));
    expect(weight(w, ["rock"])).toBeCloseTo(5, 5);
  });

  it("one rumoured thing is no likelier found in a bigger place, and a common thing is as likely", () => {
    const hour = (extent: number, level: number) =>
      searchOdds(world([], { extent, abundance: { stone: level } }), {
        process: "search",
        place: "here",
        element: "stone",
        minutes: 60,
        draw: 0.5,
      });
    expect(hour(8, 1)).toBeLessThan(hour(1, 1));
    expect(hour(8, 4)).toBeGreaterThanOrEqual(hour(1, 4) * 0.9);
  });
});

describe("6. conservation, extended", () => {
  it("what force takes off a thing becomes a thing: the bank is the less and the spoil is there", () => {
    const w = world([
      at("bank", "claybank", { amount: 50, wetness: 4 }),
      at("spade", "spade", { edge: 2 }),
    ]);
    const dig: Act = {
      process: "force",
      instrument: "spade",
      patient: "bank",
      aim: "surface",
      manner: { effort: 3, care: 2, haste: 2 },
    };
    const after = resolve(w, dig).world;
    expect(after.things.bank?.state.amount).toBeLessThan(50);
    expect(amountOf(after, "claybank")).toBeCloseTo(50, 6);
  });

  it("the minutes a fire gives come out of its fuel", () => {
    const made = world([at("hearth", "branch", { amount: 4 }), at("pot", "stone")]);
    const hearth = made.things.hearth as Thing;
    const w = { ...made, things: { ...made.things, hearth: alight(made, hearth) } };
    const fuel = w.things.hearth?.state.burning?.fuel ?? 0;
    const after = resolve(w, {
      process: "heat",
      source: "hearth",
      target: "pot",
      minutes: 60,
    }).world;
    expect(after.things.hearth?.state.burning?.fuel).toBeCloseTo(fuel - 60, 6);
  });

  it("what a hot thing loses, the water that cooled it gains", () => {
    const w = world([at("trough", "water", { amount: 3 }), at("bar", "blade", { temperature: 5 })]);
    const after = resolve(w, {
      process: "heat",
      source: "trough",
      target: "bar",
      minutes: 5,
    }).world;
    expect(after.things.bar?.state.temperature).toBeLessThan(4);
    expect(after.things.trough?.state.temperature).toBeGreaterThan(2);
    const held = (x: MatterWorld) =>
      ["trough", "bar"].reduce((sum, id) => {
        const t = x.things[id];
        const mass = [...POOL, ...ROWS].find((e) => e.id === t?.element)?.props.mass ?? 0;
        return t ? sum + t.state.temperature * quantity(mass) * t.state.amount : sum;
      }, 0);
    expect(held(after)).toBeLessThanOrEqual(held(w) + 1e-6);
    expect(held(after)).toBeGreaterThan(held(w) * 0.95);
  });
});
