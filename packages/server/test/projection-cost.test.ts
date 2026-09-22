import { performance } from "node:perf_hooks";
import { decodeSharedView, encodeSharedView } from "@rpg-jev/core/world";
import { expect, it } from "vitest";
import { project } from "../module/src/projection.ts";
import { admitActor, initialWorld } from "../module/src/world.ts";

const p95 = (values: number[]) => values.sort((a, b) => a - b)[94] ?? Infinity;

it("profiles the bounded clearing projection offline", () => {
  const state = admitActor(initialWorld(), "player-1").state;
  const times: number[] = [];
  const serial: number[] = [];
  const encoded: number[] = [];
  const decoded: number[] = [];
  const combined: number[] = [];
  const view = project(state, "player-1", 1, 0);
  for (let i = 0; i < 120; i++) {
    const start = performance.now();
    const next = project(state, "player-1", i, i);
    const projected = performance.now();
    JSON.stringify(next);
    const serialized = performance.now();
    const wire = encodeSharedView(next);
    const compressed = performance.now();
    decodeSharedView(wire);
    const expanded = performance.now();
    if (i >= 20) {
      times.push(projected - start);
      serial.push(serialized - projected);
      encoded.push(compressed - serialized);
      decoded.push(expanded - compressed);
      combined.push(projected - start + compressed - serialized);
    }
  }
  const wireBytes = Buffer.byteLength(encodeSharedView(view));
  const bytes = Buffer.byteLength(JSON.stringify(view));
  console.log(
    JSON.stringify({
      profile: "self-contained dictionary",
      things: view.things.length,
      bytes,
      wireBytes,
      fields: Object.fromEntries(
        Object.entries(view).map(([key, value]) => [key, Buffer.byteLength(JSON.stringify(value))]),
      ),
      projectP95: p95(times),
      stringifyP95: p95(serial),
      encodeP95: p95(encoded),
      decodeP95: p95(decoded),
      projectEncodeP95: p95(combined),
    }),
  );
  expect(decodeSharedView(encodeSharedView(view))).toEqual(view);
  expect(wireBytes).toBeLessThanOrEqual(bytes * 0.7);
  // Wall-clock budgets are opt-in so a contended CI runner is not a flaky correctness test.
  if (process.env.SHARED_WIRE_BENCH === "1") {
    expect(p95(encoded)).toBeLessThanOrEqual(10);
    expect(p95(decoded)).toBeLessThanOrEqual(10);
    expect(p95(combined)).toBeLessThanOrEqual(25);
  }
});
