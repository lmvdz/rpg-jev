import { describe, expect, it } from "vitest";
import { sharpen, spearman } from "../src/metrics.ts";

describe("spearman", () => {
  it("is 1 for the same ordering and -1 for the reverse", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1);
  });

  it("handles ties by sharing ranks", () => {
    expect(spearman([1, 1, 2, 3], [5, 5, 6, 7])).toBeCloseTo(1);
  });

  it("needs at least three points", () => {
    expect(spearman([1, 2], [1, 2])).toBeNaN();
  });
});

describe("sharpen", () => {
  const raw = { turn_him_in: 0.68, stall: 0.18, hide_him: 0.13, none_of_these: 0.01 };

  it("leaves a distribution alone at power 1 and cutoff 0", () => {
    const d = sharpen(raw, 1, 0);
    expect(d.turn_him_in).toBeCloseTo(0.68);
    expect(d.hide_him).toBeCloseTo(0.13);
  });

  it("drops options under the cutoff and renormalises", () => {
    const d = sharpen(raw, 1, 0.15);
    expect(d.hide_him).toBe(0);
    expect(d.none_of_these).toBe(0);
    expect((d.turn_him_in ?? 0) + (d.stall ?? 0)).toBeCloseTo(1);
  });

  it("concentrates mass on the leader as the power rises", () => {
    expect(sharpen(raw, 2, 0).turn_him_in ?? 0).toBeGreaterThan(0.68);
  });

  it("always keeps the top option", () => {
    const flat = { a: 0.34, b: 0.33, c: 0.33 };
    expect(sharpen(flat, 1, 0.5).a).toBe(1);
  });
});
