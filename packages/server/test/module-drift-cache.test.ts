/**
 * Milestone-J follow-up (`docs/authority-scale.md`): the module's drift-dirty cache
 * (`module/src/drift-cache.ts`) is never world state (SPEC.md rules 1 and 9). A module that
 * restarts mid-run loses it and must reach the exact state a module that never restarted would.
 * This test runs the same sequence of ticks three ways on the same seeded world: with the cache
 * reset before every tick (worst-case cold, as if the module restarted every publish), with the
 * cache left warm across the whole run (as a long-lived module would), and with no cache at all
 * (`matter.ENGINE`, the pre-existing path) as the reference. All three must reach byte-identical
 * world state at every tick.
 */
import { matter } from "@rpg-jev/core";
import { describe, expect, it } from "vitest";
import { offSettle, resetDriftCaches } from "../module/src/drift-cache.ts";
import { admitActor, initialWorld, populated, terrainAllows } from "../module/src/world.ts";

function grownWorld(total: number, seed: number) {
  let state = initialWorld();
  for (let i = 1; i <= 8; i++) state = admitActor(state, `player-${i}`).state;
  return populated(state, total, seed).state;
}

function run(settleOf: () => matter.Settle, initial: matter.SharedState, ticks: number) {
  const canStep = (from: readonly [number, number], to: readonly [number, number]) =>
    terrainAllows(initial.world, from, to);
  let state = initial;
  const worlds: matter.MatterWorld[] = [];
  for (let i = 0; i < ticks; i++) {
    const step = matter.sharedTick(state, [], canStep, 100 / 60000, settleOf());
    state = step.state;
    worlds.push(state.world);
  }
  return worlds;
}

describe("module drift cache", () => {
  it("gives the same world cold, warm or absent, over several ticks", () => {
    const initial = grownWorld(400, 23);
    const generation = "test-generation-drift-cache";

    const reference = run(() => matter.ENGINE, initial, 6);

    resetDriftCaches();
    const cold = run(
      () => {
        resetDriftCaches();
        return offSettle(generation);
      },
      initial,
      6,
    );

    resetDriftCaches();
    const settle = offSettle(generation);
    const warm = run(() => settle, initial, 6);

    expect(cold).toEqual(reference);
    expect(warm).toEqual(reference);
    resetDriftCaches();
  });

  it("keeps two generations' caches apart", () => {
    const a = grownWorld(200, 29);
    const b = grownWorld(200, 31);
    resetDriftCaches();
    const runA = run(() => offSettle("generation-a"), a, 4);
    const runB = run(() => offSettle("generation-b"), b, 4);
    const referenceA = run(() => matter.ENGINE, a, 4);
    const referenceB = run(() => matter.ENGINE, b, 4);
    expect(runA).toEqual(referenceA);
    expect(runB).toEqual(referenceB);
    resetDriftCaches();
  });
});
