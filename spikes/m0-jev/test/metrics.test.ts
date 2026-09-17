import { describe, expect, it } from "vitest";
import {
  auc,
  distributionOf,
  meanDistribution,
  meanProbabilityStd,
  percentile,
  spread,
  topLabel,
  totalVariation,
} from "../src/metrics.ts";

describe("metrics", () => {
  it("turns a Noul into a two-outcome distribution", () => {
    const d = distributionOf({ type: "noul", noul: 0.8 });
    expect(d.yes).toBeCloseTo(0.8);
    expect(d.no).toBeCloseTo(0.2);
  });

  it("spread is 0 for one peak and 1 for a flat distribution", () => {
    expect(spread({ a: 1, b: 0, c: 0 })).toBe(0);
    expect(spread({ a: 0.25, b: 0.25, c: 0.25, d: 0.25 })).toBeCloseTo(1);
    expect(spread({ yes: 0.5, no: 0.5 })).toBeCloseTo(1);
  });

  it("total variation is 0 for identical and 1 for disjoint distributions", () => {
    expect(totalVariation({ a: 0.5, b: 0.5 }, { a: 0.5, b: 0.5 })).toBe(0);
    expect(totalVariation({ a: 1 }, { b: 1 })).toBe(1);
    expect(totalVariation({ a: 0.7, b: 0.3 }, { a: 0.5, b: 0.5 })).toBeCloseTo(0.2);
  });

  it("averages distributions and finds the top label", () => {
    const d = meanDistribution([
      { a: 0.6, b: 0.4 },
      { a: 0.2, b: 0.8 },
    ]);
    expect(d.a).toBeCloseTo(0.4);
    expect(topLabel(d)).toBe("b");
  });

  it("auc is 1 for perfect separation and 0.5 for none", () => {
    expect(auc([0.9, 0.8], [0.1, 0.2])).toBe(1);
    expect(auc([0.5], [0.5])).toBe(0.5);
    expect(auc([0.1], [0.9])).toBe(0);
  });

  it("percentile uses the nearest rank", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
  });

  it("probability std is 0 when repeats agree", () => {
    expect(
      meanProbabilityStd([
        { a: 0.3, b: 0.7 },
        { a: 0.3, b: 0.7 },
      ]),
    ).toBe(0);
    expect(
      meanProbabilityStd([
        { a: 0.2, b: 0.8 },
        { a: 0.4, b: 0.6 },
      ]),
    ).toBeGreaterThan(0.1);
  });
});
