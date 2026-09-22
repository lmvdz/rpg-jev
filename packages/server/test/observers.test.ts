import { expect, it } from "vitest";
import {
  isObserving,
  OBSERVE_INTERVAL_MS,
  observesUntil,
  VIEW_LEASE_MICROS,
} from "../module/src/observers.ts";

it("bounds projection interest independently from actor admission and simulation state", () => {
  const now = 1_000_000_000n;
  expect(observesUntil(now)).toBe(now + 15_000_000n);
  expect(isObserving(0n, now)).toBe(false);
  expect(isObserving(observesUntil(now), now + VIEW_LEASE_MICROS - 1n)).toBe(true);
  expect(isObserving(observesUntil(now), now + VIEW_LEASE_MICROS)).toBe(false);
  expect(BigInt(OBSERVE_INTERVAL_MS) * 1000n * 3n).toBe(VIEW_LEASE_MICROS);
});
