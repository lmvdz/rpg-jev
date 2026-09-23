/**
 * The coverage cell (milestone J spike). Pure and deterministic: the same world and act always
 * bin to the same cell, and the bands read the same state the rules in `envelope.ts` and
 * `matter/graph/*-rules.ts` read.
 */
import { describe, expect, it } from "vitest";
import { cellKey, situationCell } from "../../src/jepa/coverage.ts";
import { scenario } from "../../src/jepa/scenario.ts";
import type { HeatAct } from "../../src/matter/heat.ts";
import { type Element, FRESH, type MatterWorld, type Thing } from "../../src/matter/types.ts";

const SEEDS = Array.from({ length: 500 }, (_, i) => 4_000_000_000 + i);

function el(id: string, patch: Partial<Element> = {}): Element {
  return { id, name: id, kind: "material", forms: [], props: {}, ...patch };
}

function thing(id: string, element: string, patch: Partial<Thing> = {}): Thing {
  return { id, element, place: "site", state: { ...FRESH }, ...patch };
}

function worldOf(elements: Element[], things: Thing[]): MatterWorld {
  return {
    elements: Object.fromEntries(elements.map((e) => [e.id, e])),
    things: Object.fromEntries(things.map((t) => [t.id, t])),
    bodies: {},
    places: {
      site: {
        id: "site",
        temperature: 2,
        moisture: 2,
        wind: 0,
        air: 5,
        abundance: {},
        searched: {},
      },
    },
    next: 0,
  };
}

const heatAct = (source: string, target: string): HeatAct => ({
  process: "heat",
  source,
  target,
  minutes: 5,
  contact: 1,
});

describe("situationCell", () => {
  it("is deterministic: the same world and act bin the same way", () => {
    for (const seed of SEEDS.slice(0, 200)) {
      const s = scenario(seed);
      const once = situationCell(s.world, s.act);
      const again = situationCell(s.world, s.act);
      expect(again).toEqual(once);
      if (once) expect(cellKey(once)).toBe(cellKey(again as typeof once));
    }
  });

  it("returns null for a process the model does not rank (search is not observed)", () => {
    const world = worldOf([el("bark")], [thing("t0", "bark")]);
    const cell = situationCell(world, {
      process: "search",
      place: "site",
      element: "bark",
      minutes: 1,
      draw: 0.5,
    });
    expect(cell).toBeNull();
  });

  it("classes a liquid party as liquid and a burning party as burning, over the liquid", () => {
    const water = el("water", { forms: ["liquid"], props: { meltsAt: 0 } });
    const log = el("log", { props: { flammability: 3 } });
    const world = worldOf(
      [water, log],
      [
        thing("liq", "water", { state: { ...FRESH, temperature: 2 } }),
        thing("burning-log", "log", {
          state: { ...FRESH, burning: { of: "self", fuel: 10 } },
        }),
      ],
    );
    const cell = situationCell(world, heatAct("liq", "burning-log"));
    expect(cell?.a).toBe("liquid");
    expect(cell?.b).toBe("burning");
  });

  it("classes a hollow thing as a container and an untouched solid as inert or flammable", () => {
    const pot = el("pot", { forms: ["hollow"] });
    const stone = el("stone", {});
    const world = worldOf([pot, stone], [thing("pot0", "pot"), thing("stone0", "stone")]);
    const cell = situationCell(world, heatAct("pot0", "stone0"));
    expect(cell?.a).toBe("hollow");
    expect(cell?.b).toBe("inert");
  });

  it("bands heat, wet and whole by the more extreme of the two parties", () => {
    const iron = el("iron", {});
    const world = worldOf(
      [iron],
      [
        thing("hot", "iron", { state: { ...FRESH, temperature: 5, integrity: 5, wetness: 0 } }),
        thing("cold", "iron", { state: { ...FRESH, temperature: 0, integrity: 1, wetness: 4 } }),
      ],
    );
    const cell = situationCell(world, heatAct("hot", "cold"));
    expect(cell?.heat).toBe("scorching");
    expect(cell?.wet).toBe("wet");
    expect(cell?.whole).toBe("damaged");
  });

  it("reads containment relations from where the things actually stand", () => {
    const pot = el("pot", { forms: ["hollow"] });
    const stew = el("stew", { forms: ["liquid"], props: { meltsAt: 0 } });
    const world = worldOf(
      [pot, stew],
      [thing("pot0", "pot"), thing("stew0", "stew", { place: "pot0.inside" })],
    );
    const cell = situationCell(world, {
      process: "contain",
      how: "remove",
      container: "pot0",
      thing: "stew0",
    });
    expect(cell?.relation).toBe("contains");
  });

  it("every sampled scenario the model ranks outcomes for lands on a well-formed cell", () => {
    let seen = 0;
    for (const seed of SEEDS) {
      const s = scenario(seed);
      const cell = situationCell(s.world, s.act);
      expect(cell).not.toBeNull();
      seen++;
    }
    expect(seen).toBe(SEEDS.length);
  });
});
