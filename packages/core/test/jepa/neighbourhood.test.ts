/**
 * The indexed neighbourhood must give exactly what a full scan gives: training builds
 * observations by a full scan (`relatedTo` over every thing), while the server tick builds them
 * through `prepare`, which uses the index. Any difference would feed the model inputs it was
 * never trained on. Checked on generated scenes (with containers) and on a crowded yard.
 */
import { describe, expect, it } from "vitest";
import { prepare } from "../../src/jepa/commit.ts";
import { observe } from "../../src/jepa/observe.ts";
import { scenario } from "../../src/jepa/scenario.ts";
import { resolve } from "../../src/matter/resolve.ts";
import type { MatterWorld } from "../../src/matter/types.ts";

const SEEDS = Array.from({ length: 400 }, (_, i) => 4_300_000_000 + i);

function fullScan(world: MatterWorld, view: Parameters<typeof prepare>[1]) {
  return Object.values(world.things)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((t) => [...observe(world, t, view)]);
}

describe("the neighbourhood index", () => {
  it("gives the same observations as a full scan, before and after acts", () => {
    for (const seed of SEEDS) {
      const s = scenario(seed);
      const after = resolve(s.world, s.act).world;
      for (const [world, view] of [
        [s.world, s.view],
        [after, { process: "tick" as const, roles: {}, minutes: 1 / 600 }],
      ] as const) {
        const indexed = prepare(world, view).observations.map((o) => [...o]);
        expect(indexed).toEqual(fullScan(world, view));
      }
    }
  });

  it("holds in a crowded place where many things share and border tiles", () => {
    const base = scenario(4_399_999_999).world;
    const template = Object.values(base.things)[0];
    if (!template) throw new Error("no thing");
    const world: MatterWorld = { ...base, things: { ...base.things } };
    for (let i = 0; i < 120; i++) {
      const id = `crowd${i}`;
      world.things[id] = { ...template, id, where: [i % 11, Math.floor(i / 11) % 9] };
    }
    const view = { process: "tick" as const, roles: {}, minutes: 1 };
    expect(prepare(world, view).observations.map((o) => [...o])).toEqual(fullScan(world, view));
  });
});
