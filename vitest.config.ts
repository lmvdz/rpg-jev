import { availableParallelism } from "node:os";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "spikes/*/test/**/*.test.ts"],
    // Bound contention between the combined renderer and simulation suites.
    // Keep the existing per-test timeout and every invariant sample unchanged.
    maxWorkers: Math.min(4, availableParallelism()),
  },
});
