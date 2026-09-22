import { describe, expect, it } from "vitest";
import { buildClearing, CLEARING_SIZE } from "../../src/world/clearing.ts";
import { CLEARING_PLACE, seedMatterWorld } from "../../src/world/matter-seed.ts";
import { standable } from "../../src/world/steps.ts";

describe("the grown clearing", () => {
  it("grows the same map from the same seed, on a grid of the advertised size", () => {
    const a = buildClearing(1);
    const b = buildClearing(1);
    expect(a.grid.width).toBe(CLEARING_SIZE);
    expect(a.grid.depth).toBe(CLEARING_SIZE);
    expect([...a.grid.heights]).toEqual([...b.grid.heights]);
    expect([...a.grid.kinds]).toEqual([...b.grid.kinds]);
    expect(a.things.map((t) => t.id)).toEqual(b.things.map((t) => t.id));
    expect(a.hearth).toEqual(b.hearth);
  });

  it("grows a different map from a different seed", () => {
    const a = buildClearing(1);
    const b = buildClearing(2);
    expect([...a.grid.heights]).not.toEqual([...b.grid.heights]);
  });

  it("starts the traveller on ground they can actually stand on", () => {
    const { grid, start } = buildClearing(1);
    expect(standable(grid, () => false, start[0], start[1])).toBe(true);
  });

  it("seeds every scenery thing with a look as matter in the clearing", () => {
    const { things, grid } = buildClearing(1);
    const world = seedMatterWorld(things, grid.width * grid.depth);
    expect(world.places[CLEARING_PLACE]).toBeDefined();
    const scenery = things.filter((thing) => thing.kind !== "creature");
    for (const thing of scenery) expect(world.things[thing.id]).toBeDefined();
  });
});
