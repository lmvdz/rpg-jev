/**
 * A dirty set over drift (X7), built for milestone J's authority-scale spike
 * (`docs/authority-scale.md`). `drift.ts`'s rules read only their own party (thing or body)
 * and that party's place (`graph/kernel.ts`'s `partyOf`/`envOf`; no rule reads another thing),
 * so a thing left untouched keeps the exact state it had, and `report` in `drift.ts` already
 * treats an untouched thing as unchanged. That is what makes skipping safe: leaving a settled
 * thing out of a step call cannot change what the caller sees, only how much work it costs to
 * find that out (`drift.ts`'s `step` takes the same `active` set this cache computes).
 *
 * A thing is marked settled only after its own drift call is observed to produce no change
 * for it, at its exact current state, place and element. Every rule here is closed-form over
 * `minutes` (SPEC.md rule 10): a rate that is exactly zero at a state stays zero at that same
 * state, so the mark holds until the thing's fingerprint moves, which the cache checks on
 * every call before trusting it. Nothing here is authoritative: the cache is never part of
 * `SharedState`, never logged, and a world replayed with an empty cache reaches the same
 * changes as one replayed with a warm one (`packages/server/test/authority-scale.test.ts`).
 */

import type { DriftAct } from "./drift.ts";
import { drift } from "./drift.ts";
import type { Body, Change, MatterWorld, Thing } from "./types.ts";

/** Opaque between calls; only this module reads its shape. */
export interface DriftCache {
  readonly settled: ReadonlyMap<string, string>;
}

export const EMPTY_DRIFT_CACHE: DriftCache = { settled: new Map() };

function thingFingerprint(world: MatterWorld, thing: Thing, minutes: number): string {
  return JSON.stringify([
    thing.state,
    world.places[thing.place],
    world.elements[thing.element],
    minutes,
  ]);
}

function bodyFingerprint(world: MatterWorld, body: Body, minutes: number): string {
  return JSON.stringify([
    body,
    world.places[body.place],
    body.element ? world.elements[body.element] : undefined,
    minutes,
  ]);
}

function fingerprintsOf(world: MatterWorld, minutes: number): Map<string, string> {
  const out = new Map<string, string>();
  for (const thing of Object.values(world.things))
    out.set(thing.id, thingFingerprint(world, thing, minutes));
  for (const body of Object.values(world.bodies))
    out.set(body.id, bodyFingerprint(world, body, minutes));
  return out;
}

/** Ids named by a change: what `step` actually touched, whether reported quiet or not. */
function movedIds(changes: readonly Change[]): Set<string> {
  const ids = new Set<string>();
  for (const change of changes) {
    if (change.kind === "state" || change.kind === "consume") ids.add(change.thing);
    else if (change.kind === "body" || change.kind === "treat" || change.kind === "wound")
      ids.add(change.body);
    else if (change.kind === "create") ids.add(change.thing.id);
  }
  return ids;
}

/**
 * `drift`, but a thing or body whose fingerprint matches a prior settled mark is left out of
 * this call's rule evaluation. Returns the same changes `drift(world, act)` would, and a cache
 * to pass into the next call on the resulting world. Bodies rarely settle (needs drift every
 * call while below their caps), but most authored and generated scenery does once it reaches
 * its element's rest state, which is where a populated world's numbers come from.
 */
export function driftDirty(
  world: MatterWorld,
  act: DriftAct,
  cache: DriftCache = EMPTY_DRIFT_CACHE,
): { changes: Change[]; cache: DriftCache } {
  const fingerprints = fingerprintsOf(world, act.minutes);
  const active = new Set<string>();
  for (const [id, print] of fingerprints) if (cache.settled.get(id) !== print) active.add(id);
  const changes = drift(world, act, active);
  const moved = movedIds(changes);
  const settled = new Map(cache.settled);
  for (const id of active) {
    if (moved.has(id)) settled.delete(id);
    else settled.set(id, fingerprints.get(id) ?? "");
  }
  // A thing this call never re-evaluated is trusted only while its fingerprint still matches;
  // drop any mark whose party no longer exists in this world (consumed, spawned over, etc).
  for (const id of settled.keys()) if (!fingerprints.has(id)) settled.delete(id);
  return { changes, cache: { settled } };
}
