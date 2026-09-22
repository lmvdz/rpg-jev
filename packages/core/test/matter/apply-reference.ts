/**
 * Frozen pre-copy-on-write implementation. Keep independent of production helpers:
 * equivalence tests use this as the original ordered rewrite semantics.
 */
import type { Change, MatterWorld } from "../../src/matter/types.ts";

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
  create: (world, c) => {
    const id = c.thing.id in world.things ? `${c.thing.id}.${world.next}` : c.thing.id;
    const things = { ...world.things, [id]: { ...c.thing, id } };
    return { ...world, things, next: world.next + 1 };
  },
  consume: (world, c) => {
    const thing = world.things[c.thing];
    if (!(thing && Number.isFinite(c.amount)) || c.amount <= 0) return world;
    const left = thing.state.amount - c.amount;
    if (left > 0) {
      const next = { ...thing, state: { ...thing.state, amount: left } };
      return { ...world, things: { ...world.things, [c.thing]: next } };
    }
    const { [c.thing]: _gone, ...things } = world.things;
    const bodies = Object.fromEntries(
      Object.entries(world.bodies).map(([id, body]) => [
        id,
        (body.holds ?? []).includes(c.thing)
          ? { ...body, holds: body.holds?.filter((held) => held !== c.thing) ?? [] }
          : body,
      ]),
    );
    return { ...world, things, bodies };
  },
  carried: (world, c) => {
    const thing = world.things[c.thing];
    if (!thing) return world;
    return { ...world, things: { ...world.things, [c.thing]: { ...thing, where: c.where } } };
  },
  signal: (world) => world,
  percept: (world, c) => {
    const body = world.bodies[c.body];
    if (!body) return world;
    return { ...world, bodies: { ...world.bodies, [c.body]: { ...body, aware: c.aware } } };
  },
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

export function referenceApply(world: MatterWorld, changes: readonly Change[]): MatterWorld {
  let next = world;
  for (const change of changes) {
    const applier = APPLIERS[change.kind] as Applier<typeof change.kind>;
    next = applier(next, change);
  }
  return next;
}
