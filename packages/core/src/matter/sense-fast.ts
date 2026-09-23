/**
 * A dirty set over `sourcesOf` (X8, `sense.ts`), for the same reason and by the same shape as
 * `drift-dirty.ts`. `emits` reads only a thing's own state, its element's row and its place's
 * light (`sense.ts`'s `emits`, `effective.ts`); no thing's emitted sources depend on another
 * thing. So the list of sources a settled thing contributes cannot have moved since the last
 * call that saw it settle, and can be reused instead of rebuilt.
 *
 * This does not shrink the O(bodies x sources) reach pass in `sensedFrom`: every body must
 * still be tested against every source, because a body's own move changes what it is close
 * to. What it removes is the O(things) sweep through `emits` that builds the source list in
 * the first place, which `validation/authority-scale/bench.mjs` shows is most of `sensed`'s
 * cost on a populated world.
 */
import type { Heard, Source } from "./sense.ts";
import { sensedFrom, sourcesOf } from "./sense.ts";
import type { MatterWorld, Percept, Thing } from "./types.ts";

interface Cached {
  readonly fingerprint: string;
  readonly at: readonly Source[];
}

export interface SenseCache {
  readonly things: ReadonlyMap<string, Cached>;
}

export const EMPTY_SENSE_CACHE: SenseCache = { things: new Map() };

/** Everything a thing's own emitted sources can depend on: never another thing or body. */
function thingFingerprint(world: MatterWorld, thing: Thing): string {
  return JSON.stringify([
    thing.state,
    thing.where,
    world.elements[thing.element],
    world.places[thing.place]?.light,
  ]);
}

/**
 * What every body is aware of now, and a cache to pass into the next call on the resulting
 * world. Bodies and events are always rebuilt fresh, cheaply (there are few bodies, and a
 * body's own position moves on nearly every act); only the things' contribution to the
 * source list is reused when a thing's fingerprint has not moved.
 */
export function sensedDirty(
  world: MatterWorld,
  events: readonly Heard[] = [],
  cache: SenseCache = EMPTY_SENSE_CACHE,
): { aware: Map<string, Record<string, Percept>>; cache: SenseCache } {
  const dirty: Record<string, Thing> = {};
  const reused: Source[] = [];
  const nextThings = new Map<string, Cached>();
  for (const thing of Object.values(world.things)) {
    const fingerprint = thingFingerprint(world, thing);
    const cached = cache.things.get(thing.id);
    if (cached && cached.fingerprint === fingerprint) {
      reused.push(...cached.at);
      nextThings.set(thing.id, cached);
    } else {
      dirty[thing.id] = thing;
    }
  }
  // `sourcesOf` still walks every body and every event; only its `things` table is narrowed.
  const fresh = sourcesOf({ ...world, things: dirty }, events);
  for (const thing of Object.values(dirty))
    nextThings.set(thing.id, {
      fingerprint: thingFingerprint(world, thing),
      at: fresh.filter((s) => s.id === thing.id),
    });
  return { aware: sensedFrom(world, [...reused, ...fresh]), cache: { things: nextThings } };
}
