/**
 * Milestone-J follow-up (`docs/authority-scale.md`): a dirty-set cache over drift's tick step,
 * kept only in this module's own memory, one map entry per world (keyed by the world's own
 * `generation`, so two databases sharing one running module process cannot cross-contaminate
 * each other's marks even if their thing ids happened to collide).
 *
 * This cache is never part of `SharedState`, never serialized into `worldState.json`, never
 * logged in an event, and never read on replay: replay re-derives every world from the logged
 * `changes` arrays alone (`validation/shared-world/replay.mjs`'s `replayChanges`), never by
 * calling a `Settle` again. A module reload (a fresh publish, or SpacetimeDB restarting this
 * process) loses this map and starts every world's cache empty again; nothing about
 * correctness depends on it surviving that restart, only on how much rule-evaluation work a
 * tick has to redo to find out that a settled thing is still settled
 * (`packages/core/src/matter/drift-dirty.ts`'s own invariant).
 * `packages/server/test/module-drift-cache.test.ts` proves a cold cache and a warm one commit
 * byte-identical state over several ticks.
 */
import { matter } from "@rpg-jev/core";

const caches = new Map<string, matter.DriftCache>();

/** Test-only: forget every world's cache, so one test's cache cannot leak into another's. */
export function resetDriftCaches(): void {
  caches.clear();
}

/**
 * `matter.ENGINE`, but a drift act first consults and updates this world's dirty-set cache.
 * Every other act's process delegates to `matter.ENGINE` unchanged. This mirrors `resolve()`'s
 * own drift dispatch exactly (compute changes, `apply`, `perceive`, `apply` again, `felt`,
 * `apply` again), so the world and changes this reaches are the same `resolve()` would reach;
 * only which things' drift rules got re-run to find that out differs.
 */
export function offSettle(generation: string): matter.Settle {
  return (world, act, rng) => {
    if (act.process !== "drift") return matter.ENGINE(world, act, rng);
    const before = caches.get(generation) ?? matter.EMPTY_DRIFT_CACHE;
    const { changes, cache } = matter.driftDirty(world, act, before);
    caches.set(generation, cache);
    const after = matter.apply(world, changes);
    const noticed = matter.perceive(after, changes);
    const seen = matter.apply(after, noticed);
    const taken = matter.felt(seen, act, changes);
    return {
      outcome: { world: matter.apply(seen, taken), changes: [...changes, ...noticed, ...taken] },
      rng,
      draws: [],
    };
  };
}
