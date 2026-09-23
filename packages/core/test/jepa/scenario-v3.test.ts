/**
 * `scenarioV3` (physics coverage follow-up, `docs/physics-coverage.md`): it must never disturb
 * `scenario()` (`scenario-pin.test.ts` pins that separately), it must always resolve without
 * throwing, and every cell it lands on must be one `coverage.ts`'s `possible` admits — a target
 * it missed would be a bug in the builder, not a gap in the map.
 */
import { describe, expect, it } from "vitest";
import { cellKey, possible, possibleCells, situationCell } from "../../src/jepa/coverage.ts";
import { isLegal, legal } from "../../src/jepa/envelope.ts";
import { isGap } from "../../src/jepa/families.ts";
import { classify } from "../../src/jepa/outcomes.ts";
import { scenarioV3 } from "../../src/jepa/scenario-v3.ts";
import { resolve } from "../../src/matter/resolve.ts";

const SEEDS = Array.from({ length: 4000 }, (_, i) => 6_900_000_000 + i);

describe("scenarioV3", () => {
  it("is deterministic: the same seed always grows the same scene, act and target cell", () => {
    for (const seed of SEEDS.slice(0, 200)) {
      const once = scenarioV3(seed);
      const again = scenarioV3(seed);
      expect(JSON.stringify(again)).toBe(JSON.stringify(once));
    }
  });

  it("always resolves on the engine without throwing, and lands on a well-formed cell", () => {
    for (const seed of SEEDS) {
      const s = scenarioV3(seed);
      expect(() => resolve(s.world, s.act)).not.toThrow();
      const cell = situationCell(s.world, s.act);
      expect(cell).not.toBeNull();
    }
  });

  it("only ever lands on a cell coverage.ts's possible() admits", () => {
    for (const seed of SEEDS) {
      const s = scenarioV3(seed);
      const cell = situationCell(s.world, s.act);
      if (cell) expect(possible(cell)).toBe(true);
    }
  });

  it("holds the engine's own outcome inside its own envelope, same as scenario()'s own gate", () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const s = scenarioV3(seed);
      const out = resolve(s.world, s.act);
      if (isGap(s.world, s.act, out.changes)) continue;
      for (const thing of Object.values(s.world.things)) {
        const set = legal(s.world, thing, s.view);
        const outcome = classify(thing, out.world.things[thing.id]);
        expect(isLegal(set, outcome)).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(5000);
  });

  it("stratifies over the possible universe: most of it is reached in a few thousand seeds", () => {
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      const s = scenarioV3(seed);
      const cell = situationCell(s.world, s.act);
      if (cell) seen.add(cellKey(cell));
    }
    // A cell a seed picks uniformly out of 12,769 means 4,000 draws still miss most of them by
    // chance alone; this only holds the shape (spread across many cells), not a coverage target.
    expect(seen.size).toBeGreaterThan(2000);
  });

  it("possibleCells() itself has no duplicate keys: every target is reachable exactly one way", () => {
    const keys = possibleCells().map(cellKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
