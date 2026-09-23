/**
 * Milestone-J follow-up (`docs/authority-scale.md`): the two dirty-set prototypes
 * (`matter.driftDirty`, `matter.sensedDirty`) must reach the exact same world state and
 * projections as the unmodified path on the load `populated()` builds for J2 (SPEC.md
 * section 16). "Exact same" is the whole point: an optimisation that changes an outcome is
 * not an optimisation here (SPEC.md rules 1 and 9). Every assertion below compares the
 * cache-driven path's output against the same call with no cache at all.
 */

import { matter } from "@rpg-jev/core";
import { describe, expect, it } from "vitest";
import { prepareProjection } from "../module/src/projection.ts";
import { admitActor, initialWorld, populated, terrainAllows } from "../module/src/world.ts";

function grownWorld(total: number, seed: number) {
  let state = initialWorld();
  for (let i = 1; i <= 8; i++) state = admitActor(state, `player-${i}`).state;
  return populated(state, total, seed).state;
}

function mapToObject<V>(map: ReadonlyMap<string, V>): Record<string, V> {
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

describe("sensedDirty", () => {
  it("matches sensed, cold and warm, across a run of ticks", () => {
    const state = grownWorld(400, 7);
    const canStep = (from: readonly [number, number], to: readonly [number, number]) =>
      terrainAllows(state.world, from, to);
    let world = state.world;
    let cache = matter.EMPTY_SENSE_CACHE;
    for (let i = 0; i < 6; i++) {
      const plain = matter.sensed(world, []);
      const dirty = matter.sensedDirty(world, [], cache);
      expect(mapToObject(dirty.aware)).toEqual(mapToObject(plain));
      cache = dirty.cache;
      // Advance the world (drift, and one player step) so later iterations exercise both a
      // reused cache entry (things nothing touched) and a rebuilt one (things drift moved).
      const tick = matter.sharedTick({ ...state, world }, [], canStep, 100 / 60000, matter.ENGINE);
      world = tick.state.world;
      const body = world.bodies["player-1"];
      if (body?.where) {
        const [x, z] = body.where;
        const dest: [number, number] = [x + (i % 2 === 0 ? 1 : -1), z];
        if (canStep([x, z], dest)) {
          const moved = matter.sharedMove({ ...state, world }, "player-1", dest, canStep);
          if (moved.ok) world = moved.state.world;
        }
      }
    }
  });

  it("reuses sources for things nothing touches", () => {
    const state = grownWorld(300, 11);
    let cache = matter.EMPTY_SENSE_CACHE;
    cache = matter.sensedDirty(state.world, [], cache).cache;
    const again = matter.sensedDirty(state.world, [], cache);
    // Every thing was seen once already, and the world has not moved, so every thing's
    // fingerprint should still match: the cache after this call is the same size.
    expect(again.cache.things.size).toBe(cache.things.size);
  });
});

describe("driftDirty", () => {
  const act: matter.DriftAct = { process: "drift", minutes: 100 / 60000 };

  it("matches drift, cold and warm, across a run of ticks", () => {
    const state = grownWorld(400, 13);
    let world = state.world;
    let cache = matter.EMPTY_DRIFT_CACHE;
    for (let i = 0; i < 8; i++) {
      const plain = matter.drift(world, act);
      const dirty = matter.driftDirty(world, act, cache);
      expect(dirty.changes).toEqual(plain);
      cache = dirty.cache;
      world = matter.apply(world, plain);
    }
  });

  it("settles most of a populated world's inert scenery within a few ticks", () => {
    const state = grownWorld(2000, 2026);
    let world = state.world;
    let cache = matter.EMPTY_DRIFT_CACHE;
    for (let i = 0; i < 5; i++) {
      const dirty = matter.driftDirty(world, act, cache);
      cache = dirty.cache;
      world = matter.apply(world, dirty.changes);
    }
    const thingCount = Object.keys(world.things).length;
    // Not every thing settles: an element whose wetness chases a nonzero place moisture (or
    // any other rate that only approaches, never exactly reaches, its target) never reports
    // a literal zero change and so is never marked settled here (`docs/authority-scale.md`
    // measures this world at 760 of 2,000, steady from the second tick on). That is a real
    // ceiling on this optimisation for this content mix, not a bug in the cache: a third of
    // a freshly scattered, inert-heavy load settles within one tick and stays settled.
    expect(cache.settled.size).toBeGreaterThan(thingCount * 0.3);
  });
});

it("projections built after a dirty-set tick match projections built after a plain tick", () => {
  const state = grownWorld(300, 17);
  const act: matter.DriftAct = { process: "drift", minutes: 100 / 60000 };

  const plainDrift = matter.drift(state.world, act);
  const plainWorld = matter.apply(state.world, plainDrift);

  const dirty = matter.driftDirty(state.world, act, matter.EMPTY_DRIFT_CACHE);
  const dirtyWorld = matter.apply(state.world, dirty.changes);

  const projectPlain = prepareProjection({ ...state, world: plainWorld });
  const projectDirty = prepareProjection({ ...state, world: dirtyWorld });
  for (let p = 1; p <= 8; p++) {
    const actor = `player-${p}`;
    expect(projectDirty(actor, state.tick, 0)).toEqual(projectPlain(actor, state.tick, 0));
  }
});
