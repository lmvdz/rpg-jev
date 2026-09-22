/**
 * The TypeScript runtime against PyTorch: an exported checkpoint's parity file holds validation
 * observations and the probabilities PyTorch gave them; the runtime must reproduce them.
 * Checkpoints live outside the repository; the test runs on every one it is pointed at by
 * JEPA_RUNS (a directory of runs), and on the committed release checkpoint when present.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseModel, score, scorerOf } from "../src/runtime.ts";

const RELEASE = join(import.meta.dirname, "..", "checkpoints");
const roots = [process.env.JEPA_RUNS, RELEASE].filter((r): r is string => !!r && existsSync(r));
const runs = roots.flatMap((root) =>
  readdirSync(root)
    .map((name) => join(root, name))
    .filter((dir) => existsSync(join(dir, "runtime.json")) && existsSync(join(dir, "parity.json"))),
);

describe("runtime parity with PyTorch", () => {
  it.skipIf(runs.length === 0)("reproduces every exported checkpoint's probabilities", () => {
    for (const dir of runs) {
      const model = parseModel(JSON.parse(readFileSync(join(dir, "runtime.json"), "utf8")));
      const parity = JSON.parse(readFileSync(join(dir, "parity.json"), "utf8")) as {
        observations: number[][];
        probabilities: number[][];
      };
      let worst = 0;
      parity.observations.forEach((obs, i) => {
        const p = score(model, Float64Array.from(obs));
        (parity.probabilities[i] ?? []).forEach((q, k) => {
          worst = Math.max(worst, Math.abs((p[k] ?? 0) - q));
        });
      });
      expect(worst, dir).toBeLessThan(1e-5);
    }
  });

  it.skipIf(runs.length === 0)("gives up past its deadline, and remembers what it saw", () => {
    const dir = runs[0] as string;
    const model = parseModel(JSON.parse(readFileSync(join(dir, "runtime.json"), "utf8")));
    const parity = JSON.parse(readFileSync(join(dir, "parity.json"), "utf8")) as {
      observations: number[][];
    };
    const obs = parity.observations.map((o) => Float64Array.from(o));
    let t = 0;
    // Each reading of this clock is 10 ms later: the first check is already past the deadline.
    const late = scorerOf(model, { deadlineMs: 5, now: () => (t += 10) });
    expect(late(obs, [])).toBeNull();
    const ok = scorerOf(model, { deadlineMs: 1e9, now: () => 0 });
    ok(obs, []);
    const before = ok.stats.cached;
    ok(obs, []);
    expect(ok.stats.cached - before).toBe(obs.length);
  });
});
