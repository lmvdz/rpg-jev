/**
 * Only code writes world state (SPEC.md rule 1). Processes return changes; `apply` is the
 * one place a matter world is rewritten. It never mutates: a new world comes back. A kind
 * of change is a row in `APPLIERS`, not an arm of a switch.
 */
import type { Change, MatterWorld } from "./types.ts";

type Applier<K extends Change["kind"]> = (
  world: MatterWorld,
  change: Extract<Change, { kind: K }>,
) => MatterWorld;

const APPLIERS: { [K in Change["kind"]]: Applier<K> } = {
  state: (world, c) => {
    const thing = world.things[c.thing];
    if (!thing) return world;
    const next = { ...thing, state: { ...thing.state, ...c.set } };
    return { ...world, things: { ...world.things, [c.thing]: next } };
  },
  body: (world, c) => {
    const body = world.bodies[c.body];
    if (!body) return world;
    return { ...world, bodies: { ...world.bodies, [c.body]: { ...body, ...c.set } } };
  },
  wound: (world, c) => {
    const body = world.bodies[c.body];
    if (!body) return world;
    const next = { ...body, wounds: [...body.wounds, c.wound] };
    return { ...world, bodies: { ...world.bodies, [c.body]: next } };
  },
  treat: (world, c) => {
    const body = world.bodies[c.body];
    if (!body) return world;
    const wounds = body.wounds.map((w, i) => (i === c.index ? { ...w, ...c.set } : w));
    return { ...world, bodies: { ...world.bodies, [c.body]: { ...body, wounds } } };
  },
  // A born thing takes its id from the world's counter, so it can never overwrite another.
  create: (world, c) => {
    const id = c.thing.id in world.things ? `${c.thing.id}.${world.next}` : c.thing.id;
    const things = { ...world.things, [id]: { ...c.thing, id } };
    return { ...world, things, next: world.next + 1 };
  },
  consume: (world, c) => {
    const thing = world.things[c.thing];
    if (!thing) return world;
    const left = thing.state.amount - c.amount;
    if (left > 0) {
      const next = { ...thing, state: { ...thing.state, amount: left } };
      return { ...world, things: { ...world.things, [c.thing]: next } };
    }
    const { [c.thing]: _gone, ...things } = world.things;
    return { ...world, things };
  },
  // A signal is heard or not by whoever is sensing; it leaves no state of its own here.
  signal: (world) => world,
  settle: (world, c) => {
    const place = world.places[c.place];
    if (!place) return world;
    const before = place.searched[c.element] ?? { minutes: 0, found: 0 };
    const searched = {
      ...place.searched,
      [c.element]: { minutes: before.minutes + c.minutes, found: before.found + c.found },
    };
    return { ...world, places: { ...world.places, [c.place]: { ...place, searched } } };
  },
  nothing: (world) => world,
};

export function apply(world: MatterWorld, changes: readonly Change[]): MatterWorld {
  let next = world;
  for (const change of changes) {
    const applier = APPLIERS[change.kind] as Applier<typeof change.kind>;
    next = applier(next, change);
  }
  return next;
}
