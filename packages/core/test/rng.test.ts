import { describe, expect, it } from "vitest";
import { Rng } from "../src/index.ts";

describe("Rng", () => {
  it("is deterministic for a given seed", () => {
    const a = Rng.fromSeed(42);
    const b = Rng.fromSeed(42);
    const drawsA = Array.from({ length: 100 }, () => a.nextUint32());
    const drawsB = Array.from({ length: 100 }, () => b.nextUint32());
    expect(drawsA).toEqual(drawsB);
  });

  it("diverges for different seeds", () => {
    expect(Rng.fromSeed(1).nextUint32()).not.toBe(Rng.fromSeed(2).nextUint32());
  });

  it("resumes exactly from a saved state", () => {
    const original = Rng.fromSeed(7);
    for (let i = 0; i < 10; i++) original.next();
    const restored = Rng.fromState(original.state);
    expect(restored.next()).toBe(original.next());
  });

  it("returns floats in [0, 1)", () => {
    const rng = Rng.fromSeed(3);
    for (let i = 0; i < 1000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("samples in proportion to the distribution", () => {
    const rng = Rng.fromSeed(11);
    const counts = { hide: 0, sell_out: 0, stall: 0 };
    for (let i = 0; i < 10_000; i++) {
      counts[rng.sample({ hide: 0.6, sell_out: 0.3, stall: 0.1 })]++;
    }
    expect(counts.hide / 10_000).toBeCloseTo(0.6, 1);
    expect(counts.sell_out / 10_000).toBeCloseTo(0.3, 1);
    expect(counts.stall / 10_000).toBeCloseTo(0.1, 1);
  });

  it("does not depend on key order", () => {
    const forward = Rng.fromSeed(5).sample({ a: 0.5, b: 0.5 });
    const reversed = Rng.fromSeed(5).sample({ b: 0.5, a: 0.5 });
    expect(forward).toBe(reversed);
  });

  it("rejects empty and zero-mass distributions", () => {
    const rng = Rng.fromSeed(1);
    expect(() => rng.sample({})).toThrow();
    expect(() => rng.sample({ a: 0 })).toThrow();
  });
});
