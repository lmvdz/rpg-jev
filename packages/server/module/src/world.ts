/** The existing seeded clearing, hosted rather than reconstructed from client commands. */
import { matter, Rng } from "@rpg-jev/core";
import {
  buildClearing,
  canStep,
  glyphOfChar,
  INK,
  NOTHING_BLOCKS,
  seedMatterWorld,
  standable,
} from "@rpg-jev/core/world";

export const SEED = 1;
export const MAX_PLAYERS = 8;
export const clearing = buildClearing(SEED);
const scenery = new Map(clearing.things.map((thing) => [thing.id, thing]));

export function initialWorld(): matter.SharedState {
  const world = seedMatterWorld(clearing.things, clearing.grid.width * clearing.grid.depth);
  delete world.bodies.hero;
  delete world.things.hands;
  world.places.unadmitted = matter.placeOf("unadmitted", { light: 0, abundance: {} });
  const place = world.places.clearing;
  if (place) place.light = 5;
  world.elements.traveller = {
    id: "traveller",
    name: "a traveller",
    kind: "creature",
    forms: [],
    props: { size: 3, mass: 3 },
    body: { strength: 3, speed: 2, sight: 5, smell: 2, hearing: 2 },
    look: { glyph: glyphOfChar("@"), ink: INK.lamp, scale: 18, sways: false },
  };
  for (let i = 1; i <= MAX_PLAYERS; i++) {
    const id = `player-${i}`;
    world.bodies[id] = {
      id,
      element: "traveller",
      place: "unadmitted",
      health: 5,
      wounds: [],
      sickness: 0,
      sickensIn: 0,
      needs: { hunger: 1, rest: 0, warmth: 0 },
      holds: [],
    };
  }
  for (const thing of clearing.things) {
    const element = world.elements[thing.element];
    if (element && thing.look) element.look = { scale: 18, sways: false, ...thing.look };
  }
  return matter.createSharedState(world, SEED);
}

/** Terrain is supplied by the host's seed, never by a client's claim of walkability. */
export function terrainAllows(
  world: matter.MatterWorld,
  from: readonly [number, number],
  to: readonly [number, number],
  solids = true,
): boolean {
  const blocked = (index: number) => {
    if (!solids) return false;
    const x = index % clearing.grid.width;
    const z = Math.floor(index / clearing.grid.width);
    for (const thing of Object.values(world.things)) {
      if (thing.where?.[0] !== x || thing.where[1] !== z) continue;
      if ((world.elements[thing.element]?.props.size ?? 0) >= 4) return true;
    }
    return clearing.things.some(
      (t) => t.solid && t.x === x && t.z === z && !world.elements[t.element],
    );
  };
  return canStep(clearing.grid, blocked, from[0], from[1], to[0], to[1]);
}

export function admitActor(state: matter.SharedState, actor: string): matter.SharedStep {
  const hands = `${actor}.hands`;
  const changes: matter.Change[] = [
    {
      kind: "body",
      body: actor,
      set: {
        place: "clearing",
        where: clearing.start,
        holds: [hands],
        health: 5,
        sickness: 0,
        sickensIn: 0,
        needs: { hunger: 1, rest: 0, warmth: 0 },
      },
      because: ["admission"],
      note: "A traveller joins the clearing.",
    },
    {
      kind: "create",
      thing: {
        id: hands,
        element: "hand",
        place: "clearing",
        where: clearing.start,
        state: { ...matter.FRESH },
      },
      because: ["admission"],
      note: "The traveller's hands.",
      quiet: true,
    },
  ];
  let world = matter.apply(state.world, changes);
  const percepts = matter.perceive(world, changes);
  world = matter.apply(world, percepts);
  return {
    state: { ...state, world },
    ok: true,
    reason: "joined",
    changes: [...changes, ...percepts],
    draws: [],
  };
}

export function lookOf(id: string) {
  return scenery.get(id);
}

/**
 * Milestone J's load (J2): grow the world to `total` things on open tiles, from elements it
 * already holds, never bodies. Seeded, so the same call grows the same things; logged as an event.
 */
export function populated(
  state: matter.SharedState,
  total: number,
  seed: number,
): matter.SharedStep {
  const rng = Rng.fromSeed(seed);
  const world = state.world;
  const kinds = Object.values(world.elements).filter(
    (e) => !e.body && e.kind !== "creature" && e.kind !== "person" && e.id !== "hand",
  );
  const taken = new Set(
    Object.values(world.things).flatMap((t) => (t.where ? [`${t.where[0]},${t.where[1]}`] : [])),
  );
  const changes: matter.Change[] = [];
  let count = Object.keys(world.things).length;
  for (let tries = 0; count < total && tries < total * 50 && kinds.length > 0; tries++) {
    const x = Math.floor(rng.next() * clearing.grid.width);
    const z = Math.floor(rng.next() * clearing.grid.depth);
    const element = kinds[Math.floor(rng.next() * kinds.length)];
    if (!element || taken.has(`${x},${z}`) || !standable(clearing.grid, NOTHING_BLOCKS, x, z))
      continue;
    taken.add(`${x},${z}`);
    const thing: matter.Thing = {
      id: `extra-${count}`,
      element: element.id,
      place: "clearing",
      where: [x, z],
      state: { ...matter.FRESH, wetness: element.moist ?? 0 },
    };
    changes.push({ kind: "create", thing, because: ["J2"], note: "", quiet: true });
    count++;
  }
  return {
    state: { ...state, world: matter.apply(world, changes) },
    ok: true,
    reason: "populated",
    changes,
    draws: [],
  };
}
