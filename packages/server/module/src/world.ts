/** The existing seeded clearing, hosted rather than reconstructed from client commands. */
import { matter } from "@rpg-jev/core";
import { glyphOfChar } from "../../../client/src/glyph/font.ts";
import { INK } from "../../../client/src/palette.ts";
import { buildClearing } from "../../../client/src/scene/clearing.ts";
import { seedMatterWorld } from "../../../client/src/scene/matter-seed.ts";
import { canStep } from "../../../client/src/scene/steps.ts";

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
