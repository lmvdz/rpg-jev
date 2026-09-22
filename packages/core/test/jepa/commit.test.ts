/**
 * P3 properties (SPEC section 16, milestone J): whatever the model scores (random, adversarial,
 * garbage) the committed world is valid, the chosen outcome is in the envelope, and replaying
 * the record without the model gives the same world byte for byte. Seeds here are a test range
 * (4e9 and up), disjoint from the dataset's.
 */
import { describe, expect, it } from "vitest";
import { commit, invariants, replay, type Scorer } from "../../src/jepa/commit.ts";
import { isLegal } from "../../src/jepa/envelope.ts";
import {
  CHANNELS,
  CLASS_NAMES,
  CLASS_OFFSETS,
  classify,
  outcomeOf,
} from "../../src/jepa/outcomes.ts";
import { scenario } from "../../src/jepa/scenario.ts";
import { resolve } from "../../src/matter/resolve.ts";
import { Rng } from "../../src/rng.ts";

const SEEDS = Array.from({ length: 400 }, (_, i) => 4_000_000_000 + i);

function scorerOf(kind: string, rng: Rng): Scorer {
  return (observations, legal) =>
    observations.map((_, i) => {
      const scores = new Float64Array(CLASS_NAMES.length);
      for (let j = 0; j < scores.length; j++) {
        if (kind === "random") scores[j] = rng.next();
        else if (kind === "garbage") scores[j] = [Number.NaN, -1, Infinity, 1e308, 0][j % 5] ?? 0;
        else if (kind === "extreme") scores[j] = 0;
      }
      if (kind === "extreme")
        CHANNELS.forEach((c, ch) => {
          // All mass on the least likely-looking legal class: the last one.
          const flags = legal[i]?.[ch] ?? [];
          const last = flags.lastIndexOf(true);
          scores[(CLASS_OFFSETS[ch] ?? 0) + (last < 0 ? 0 : last)] = 1;
          void c;
        });
      return scores;
    });
}

describe("commit: the model ranks, code commits", () => {
  for (const kind of ["random", "extreme", "garbage"]) {
    it(`a ${kind} scorer always leaves a valid world that replays byte for byte`, () => {
      const rng = Rng.fromSeed(1);
      let fellBack = 0;
      for (const seed of SEEDS) {
        const s = scenario(seed);
        const done = commit(
          s.world,
          s.act,
          s.view,
          scorerOf(kind, rng),
          Rng.fromSeed(seed),
          "test",
        );
        expect(invariants(s.world, done.world)).toEqual([]);
        if (done.record.fallback === "invariant") fellBack++;
        for (const choice of done.record.choices) {
          const legal = choice.candidates.split(".").map((f) => [...f].map((b) => b === "1"));
          expect(isLegal(legal, outcomeOf(choice.chosen))).toBe(true);
        }
        const again = replay(s.world, s.act, done.record);
        expect(JSON.stringify(again)).toBe(JSON.stringify(done.world));
      }
      expect(fellBack).toBeLessThan(SEEDS.length * 0.05);
    });
  }

  it("all mass on the engine's own outcome commits exactly the engine's world", () => {
    for (const seed of SEEDS.slice(0, 150)) {
      const s = scenario(seed);
      const engine = resolve(s.world, s.act);
      const ids = Object.keys(s.world.things).sort();
      const truth: Scorer = (observations) =>
        observations.map((_, i) => {
          const thing = s.world.things[ids[i] as string];
          const scores = new Float64Array(CLASS_NAMES.length);
          if (!thing) return scores;
          const o = classify(thing, engine.world.things[thing.id]);
          o.forEach((k, ch) => {
            scores[(CLASS_OFFSETS[ch] ?? 0) + k] = 1;
          });
          return scores;
        });
      const done = commit(s.world, s.act, s.view, truth, Rng.fromSeed(seed), "test");
      expect(done.record.fallback).toBe("none");
      expect(JSON.stringify(done.world.things)).toBe(JSON.stringify(engine.world.things));
    }
  });

  it("with no scorer, or a late one, the engine's outcome is committed and logged as such", () => {
    const s = scenario(4_100_000_000);
    const off = commit(s.world, s.act, s.view, null, Rng.fromSeed(1), "test");
    expect(off.record.fallback).toBe("off");
    const late = commit(s.world, s.act, s.view, () => null, Rng.fromSeed(1), "test");
    expect(late.record.fallback).toBe("deadline");
    expect(JSON.stringify(late.world)).toBe(JSON.stringify(resolve(s.world, s.act).world));
  });
});
