/**
 * The envelope must contain the engine's own outcome (SPEC section 16, milestone J), and the
 * observation must be engine-agnostic: moving the whole scene changes nothing the model sees.
 * Seeds are a test range (3e9 and up), disjoint from the dataset's.
 */
import { describe, expect, it } from "vitest";
import { candidateHash, candidates, isLegal, legal } from "../../src/jepa/envelope.ts";
import { isGap } from "../../src/jepa/families.ts";
import { OBSERVATION_WIDTH, observe } from "../../src/jepa/observe.ts";
import { classify, NONE, outcomeId, outcomeOf, VOCABULARY_SIZE } from "../../src/jepa/outcomes.ts";
import { scenario } from "../../src/jepa/scenario.ts";
import { resolve } from "../../src/matter/resolve.ts";
import type { MatterWorld } from "../../src/matter/types.ts";

const SEEDS = Array.from({ length: 3000 }, (_, i) => 3_500_000_000 + i);

describe("the envelope", () => {
  it("always holds the engine's own outcome and always offers nothing happening", () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const s = scenario(seed);
      const out = resolve(s.world, s.act);
      if (isGap(s.world, s.act, out.changes)) continue;
      for (const thing of Object.values(s.world.things)) {
        const set = legal(s.world, thing, s.view);
        expect(isLegal(set, classify(thing, out.world.things[thing.id]))).toBe(true);
        expect(isLegal(set, NONE)).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(8000);
  });

  it("lists candidates in a canonical order and hashes the set stably", () => {
    const s = scenario(SEEDS[0] as number);
    const thing = Object.values(s.world.things)[0];
    if (!thing) throw new Error("no thing");
    const set = legal(s.world, thing, s.view);
    const ids = candidates(set);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(ids).toContain(outcomeId(NONE));
    expect(candidateHash(set)).toBe(candidateHash(legal(s.world, thing, s.view)));
  });

  it("round-trips every outcome id", () => {
    for (let id = 0; id < VOCABULARY_SIZE; id += 7) expect(outcomeId(outcomeOf(id))).toBe(id);
  });
});

function shifted(world: MatterWorld, dx: number, dz: number): MatterWorld {
  const things = Object.fromEntries(
    Object.entries(world.things).map(([id, t]) => [
      id,
      t.where ? { ...t, where: [t.where[0] + dx, t.where[1] + dz] as const } : t,
    ]),
  );
  return { ...world, things };
}

describe("the observation", () => {
  it("is fixed-width, in [0, 1], and blind to where the scene stands", () => {
    for (const seed of SEEDS.slice(0, 300)) {
      const s = scenario(seed);
      const moved = shifted(s.world, 37, -12);
      for (const thing of Object.values(s.world.things)) {
        const a = observe(s.world, thing, s.view);
        const b = observe(moved, moved.things[thing.id] ?? thing, s.view);
        expect(a.length).toBe(OBSERVATION_WIDTH);
        expect(a.every((v) => v >= 0 && v <= 1)).toBe(true);
        expect([...b]).toEqual([...a]);
      }
    }
  });
});
