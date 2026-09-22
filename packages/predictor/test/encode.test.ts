import * as jepa from "@rpg-jev/core/jepa";
import * as matter from "@rpg-jev/core/matter";
import { describe, expect, it } from "vitest";
import { AT_REST, assemble, encodeScene, postRelated } from "../src/encode.ts";

// A development range, disjoint from the dataset's seeds.
const SEEDS = Array.from({ length: 300 }, (_, i) => 3_900_000_000 + i);

describe("encoded rows rebuild the observation exactly", () => {
  it("before and after, for every thing of every scene", () => {
    for (const seed of SEEDS) {
      const s = jepa.scenario(seed);
      const encoded = encodeScene(s);
      expect(encoded.uncovered).toBe(0);
      const after = matter.resolve(s.world, s.act).world;
      const things = Object.values(s.world.things).sort((a, b) => (a.id < b.id ? -1 : 1));
      things.forEach((thing, i) => {
        const sample = encoded.samples[i];
        if (!sample) throw new Error("missing sample");
        expect([...assemble(encoded.rows, sample)]).toEqual([
          ...jepa.observe(s.world, thing, s.view),
        ]);
        const post = after.things[thing.id];
        if (!post) return;
        const expected = jepa.observe(after, post, AT_REST, postRelated(after, post, s.world));
        expect([...assemble(encoded.rows, sample, true)]).toEqual([...expected]);
      });
    }
  });
});
