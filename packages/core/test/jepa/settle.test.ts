/**
 * Milestone J in the shared world (P6): off is the engine exactly; shadow commits the engine's
 * world and leaves the RNG alone while logging what the model chose; live commits the ranked
 * world, logs every draw, and replays byte for byte from its logged changes and from its record.
 */
import { describe, expect, it } from "vitest";
import { replay, type Scorer } from "../../src/jepa/commit.ts";
import { CLASS_NAMES } from "../../src/jepa/outcomes.ts";
import { scenario } from "../../src/jepa/scenario.ts";
import { type RankedNote, rankedSettle } from "../../src/jepa/settle.ts";
import { apply } from "../../src/matter/apply.ts";
import { createSharedState, sharedTick } from "../../src/matter/shared.ts";
import { Rng } from "../../src/rng.ts";

const always = () => true;

function randomScorer(seed: number): Scorer {
  const rng = Rng.fromSeed(seed);
  return (observations) => observations.map(() => Float64Array.from(CLASS_NAMES, () => rng.next()));
}

const SEEDS = Array.from({ length: 60 }, (_, i) => 4_200_000_000 + i);

describe("a world's mode", () => {
  it("off is the engine, exactly", () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const state = createSharedState(scenario(seed).world, seed);
      const engine = sharedTick(state, [], always, 0.5);
      const off = sharedTick(state, [], always, 0.5, rankedSettle("off", randomScorer(1), "x"));
      expect(JSON.stringify(off)).toBe(JSON.stringify(engine));
    }
  });

  it("shadow commits the engine's world, keeps the RNG, and logs the model's choices", () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const state = createSharedState(scenario(seed).world, seed);
      const engine = sharedTick(state, [], always, 0.5);
      const shadow = sharedTick(
        state,
        [],
        always,
        0.5,
        rankedSettle("shadow", randomScorer(2), "x"),
      );
      expect(JSON.stringify(shadow.state)).toBe(JSON.stringify(engine.state));
      expect(shadow.draws).toEqual([]);
      const note = shadow.notes?.[0] as RankedNote;
      expect(note.mode).toBe("shadow");
      expect(note.things).toBe(Object.keys(state.world.things).length);
    }
  });

  it("live logs every draw and replays from its changes and from its record", () => {
    for (const seed of SEEDS) {
      const state = createSharedState(scenario(seed).world, seed);
      const live = sharedTick(
        state,
        [],
        always,
        0.5,
        rankedSettle("live", randomScorer(seed), "x"),
      );
      const note = live.notes?.[0] as RankedNote;
      expect(live.draws.length).toBe(note.record.choices.length);
      const drawn = Rng.fromState(state.rng);
      for (const d of live.draws) expect(d).toBe(drawn.next());
      expect(live.state.rng).toEqual(drawn.state);
      expect(JSON.stringify(apply(state.world, live.changes))).toBe(
        JSON.stringify(live.state.world),
      );
      const again = replay(state.world, { process: "drift", minutes: 0.5 }, note.record);
      expect(JSON.stringify(again)).toBe(JSON.stringify(live.state.world));
    }
  });
});
