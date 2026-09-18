import { describe, expect, it } from "vitest";
import { beliefSql, heldAt, OPEN } from "../src/lib/bitemporal.ts";
import { judgeLatencyMs, seeded } from "../src/lib/judge.ts";
import { meanMsBetween, reducerTime, tableSize } from "../src/lib/metrics.ts";
import { inversions, percentile, summarize } from "../src/lib/stats.ts";

describe("stats", () => {
  it("takes nearest-rank percentiles", () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile(sorted, 99)).toBe(99);
    expect(percentile(sorted, 100)).toBe(100);
    expect(percentile(sorted, 0)).toBe(1);
  });

  it("summarizes unsorted input", () => {
    expect(summarize([3, 1, 2])).toMatchObject({ n: 3, min: 1, p50: 2, max: 3, mean: 2 });
  });

  it("counts out-of-order neighbours", () => {
    expect(inversions([1n, 2n, 3n])).toBe(0);
    expect(inversions([1, 3, 2, 4, 0])).toBe(2);
  });
});

describe("fake judge", () => {
  it("draws latencies near the M0 distribution", () => {
    const rng = seeded(7);
    const draws = Array.from({ length: 20_000 }, () => judgeLatencyMs(rng));
    const s = summarize(draws);
    expect(s.p50).toBeGreaterThan(155);
    expect(s.p50).toBeLessThan(171);
    expect(s.p99).toBeGreaterThan(420);
    expect(s.p99).toBeLessThan(505);
  });

  it("is reproducible from its seed", () => {
    expect(judgeLatencyMs(seeded(1))).toBe(judgeLatencyMs(seeded(1)));
  });
});

describe("bitemporal predicate", () => {
  const closed = { validFrom: 1000n, validTo: 2000n, knownFrom: 1030n };
  const open = { validFrom: 2000n, validTo: OPEN, knownFrom: 2030n };

  it("holds inside the valid interval once known", () => {
    expect(heldAt(closed, 1500n, 1500n)).toBe(true);
    expect(heldAt(open, 5000n, 5000n)).toBe(true);
  });

  it("excludes the closing instant and anything not yet learned", () => {
    expect(heldAt(closed, 2000n, 9000n)).toBe(false);
    expect(heldAt(closed, 1010n, 1010n)).toBe(false);
    expect(heldAt(open, 2010n, 2020n)).toBe(false);
  });

  it("renders the same predicate as SQL over the snake_case columns", () => {
    expect(beliefSql(7n, 1500n, 1600n)).toBe(
      "SELECT * FROM edge WHERE src = 7 AND kind = 'believes' " +
        "AND valid_from <= 1500 AND valid_to > 1500 AND known_from <= 1600",
    );
  });
});

describe("server metrics", () => {
  it("turns two cumulative readings into a mean per call", () => {
    expect(meanMsBetween({ calls: 10, seconds: 1 }, { calls: 30, seconds: 1.5 })).toBe(25);
    expect(meanMsBetween({ calls: 10, seconds: 1 }, { calls: 10, seconds: 1 })).toBeNaN();
  });

  it("reads a reducer and a table out of a scrape", () => {
    const values = new Map([
      ['spacetime_reducer_plus_query_duration_sec_sum{db="x",reducer="ping"}', 0.5],
      ['spacetime_reducer_plus_query_duration_sec_count{db="x",reducer="ping"}', 100],
      ['spacetime_data_size_bytes_used_by_rows{db="x",table_name="edge"}', 1280],
      ['spacetime_data_size_table_num_rows{db="x",table_name="edge"}', 10],
    ]);
    expect(reducerTime(values, "ping")).toEqual({ calls: 100, seconds: 0.5 });
    expect(tableSize(values, "edge")).toEqual({ rows: 10, rowBytes: 1280, indexKeyBytes: 0 });
  });
});
