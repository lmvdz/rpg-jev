/**
 * The two examples the sandbox direction was argued from (`docs/sandbox-direction.md`),
 * derived from element rows alone. Nothing in `src/matter` knows what a sword or a stone is.
 */
import { describe, expect, it } from "vitest";
import { effective, play, resolve, searchOdds } from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";

describe("the burning sword", () => {
  const start = world(
    [
      thing("sword", "steel", "hearth", { edge: 4 }),
      thing("flask", "oil"),
      thing("fireplace", "fire", "hearth", { burning: { of: "self", fuel: 600 } }),
    ],
    [body("foe")],
  );

  it("does not light when it is only steel", () => {
    const { world: w } = resolve(start, {
      process: "heat",
      source: "fireplace",
      target: "sword",
      minutes: 2,
    });
    expect(w.things.sword?.state.burning).toBeNull();
  });

  const oiled = resolve(start, { process: "coat", substance: "flask", target: "sword" }).world;

  it("takes on the oil's surface when coated, and stays steel underneath", () => {
    const sword = oiled.things.sword;
    expect(sword?.state.coating?.element).toBe("oil");
    const p = sword ? effective(oiled, sword) : undefined;
    expect(p?.flammability).toBeGreaterThan(3);
    expect(p?.hardness).toBe(5);
  });

  const lit = resolve(oiled, { process: "heat", source: "fireplace", target: "sword", minutes: 2 });

  it("lights in the fireplace, and it is the coat that burns, for a time code worked out", () => {
    const burning = lit.world.things.sword?.state.burning;
    expect(burning?.of).toBe("coating");
    expect(burning?.fuel).toBeGreaterThan(1);
    expect(burning?.fuel).toBeLessThan(10);
    expect(lit.changes.some((c) => c.because.includes("M6"))).toBe(true);
  });

  it("burns out, and is a sword again with no coat", () => {
    const { world: w } = resolve(lit.world, { process: "drift", minutes: 15 });
    expect(w.things.sword?.state.burning).toBeNull();
    expect(w.things.sword?.state.coating).toBeNull();
    expect(w.things.sword?.element).toBe("steel");
  });

  it("cuts and sears when it slices, and the wound still bleeds", () => {
    const { world: w } = resolve(lit.world, {
      process: "force",
      instrument: "sword",
      patient: "foe",
      seconds: 0.3,
    });
    const wound = w.bodies.foe?.wounds[0];
    expect(wound?.depth).toBeGreaterThan(2);
    expect(wound?.burned).toBeGreaterThan(0);
    expect(wound?.bleeding).toBeGreaterThan(2);
  });

  it("seals a bleeding wound when hot iron is held on it, at the cost of a burn", () => {
    const hurt = world(
      [thing("bar", "iron", "hearth", { temperature: 5 })],
      [body("friend", { wounds: [{ depth: 3, bleeding: 3, burned: 0 }] })],
    );
    const pressed = resolve(hurt, {
      process: "force",
      instrument: "bar",
      patient: "friend",
      seconds: 5,
      manner: { effort: 0, care: 4, haste: 0 },
    });
    const wound = pressed.world.bodies.friend?.wounds[0];
    expect(wound?.bleeding).toBe(0);
    expect(wound?.burned).toBeGreaterThan(2);
    expect(pressed.world.bodies.friend?.wounds).toHaveLength(1);
  });

  it("does not seal it when the iron is only warm", () => {
    const hurt = world(
      [thing("bar", "iron", "hearth", { temperature: 3 })],
      [body("friend", { wounds: [{ depth: 3, bleeding: 3, burned: 0 }] })],
    );
    const { world: w } = resolve(hurt, {
      process: "force",
      instrument: "bar",
      patient: "friend",
      seconds: 5,
      manner: { effort: 0, care: 4, haste: 0 },
    });
    expect(w.bodies.friend?.wounds[0]?.bleeding).toBe(3);
  });
});

describe("pick up a stone", () => {
  const empty = world([]);
  const glance = { process: "search", element: "stone", minutes: 1, draw: 0.5 } as const;
  const thorough = { process: "search", element: "stone", minutes: 60, draw: 0.05 } as const;

  it("is far likelier at a glance in a quarry than in grass", () => {
    const grass = searchOdds(empty, { ...glance, place: "grass" });
    const quarry = searchOdds(empty, { ...glance, place: "quarry" });
    expect(grass).toBeLessThan(0.01);
    expect(quarry).toBeGreaterThan(0.6);
  });

  it("trades time for odds: looking around until one turns up", () => {
    const quick = searchOdds(empty, { ...glance, place: "grass" });
    const long = searchOdds(empty, { ...thorough, place: "grass" });
    expect(long).toBeGreaterThan(quick * 10);
  });

  it("makes the stone real once found, and remembers the search", () => {
    const { world: w } = resolve(empty, { ...thorough, place: "grass" });
    expect(Object.values(w.things).filter((t) => t.element === "stone")).toHaveLength(1);
    expect(w.places.grass?.searched.stone).toEqual({ minutes: 60, found: 1 });
  });

  it("cannot be farmed: the same patch gives less each time, then nothing", () => {
    let w = empty;
    const odds: number[] = [];
    for (let i = 0; i < 6; i++) {
      odds.push(searchOdds(w, { ...thorough, place: "grass" }));
      w = resolve(w, { ...thorough, place: "grass", draw: 0 }).world;
    }
    expect(odds[1]).toBeLessThan(odds[0] ?? 0);
    expect(odds.at(-1)).toBe(0);
    expect(Object.values(w.things).filter((t) => t.element === "stone").length).toBeLessThanOrEqual(
      2,
    );
  });

  it("never finds what cannot be there, however long the search", () => {
    const { world: w, changes } = play(
      empty,
      Array.from(
        { length: 20 },
        () =>
          ({ process: "search", place: "quarry", element: "gold", minutes: 120, draw: 0 }) as const,
      ),
    );
    expect(Object.values(w.things)).toHaveLength(0);
    expect(changes.every((c) => c.kind === "settle")).toBe(true);
  });
});
