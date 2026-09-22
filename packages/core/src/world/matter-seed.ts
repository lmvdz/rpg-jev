/** Pure conversion of the clearing's authored rows into initial matter.
 * Shared by the client's local adapter and the host; no renderer, I/O or outcomes.
 */
import * as matter from "../matter/index.ts";
import type { ThingView } from "./scene-thing.ts";

export const CLEARING_PLACE = "clearing";
export const INITIAL_HERO = "hero";
export const INITIAL_HANDS = "hands";
const ABUNDANCE = { stone: 2, flint: 1, branch: 3, berries: 1 };
const TILES_PER_PATCH = 40;
const WHOLE = { place: CLEARING_PLACE, health: 5, wounds: [], sickness: 0, sickensIn: 0 };

function stateOf(thing: ThingView, element: matter.Element): matter.ThingState {
  const { temperature, amount, wetness, integrity, contamination, corrosion } = thing.states;
  return {
    ...matter.FRESH,
    wetness: wetness ?? element.moist ?? matter.FRESH.wetness,
    ...(temperature === undefined ? {} : { temperature }),
    ...(amount === undefined ? {} : { amount }),
    ...(integrity === undefined ? {} : { integrity }),
    ...(contamination === undefined ? {} : { contamination }),
    ...(corrosion === undefined ? {} : { corrosion }),
  };
}

function embody(world: matter.MatterWorld, thing: ThingView): void {
  const mass = Math.min(Math.max(Math.round(thing.baseline?.mass ?? 2), 0), 5);
  world.elements[thing.element] ??= {
    id: thing.element,
    name: thing.name,
    kind: "creature",
    forms: [],
    props: { mass, size: mass, hardness: thing.baseline?.hardness ?? 1 },
    body: { strength: mass, speed: 5 - mass, sight: 2, hearing: 3, smell: 5 - mass },
  };
  world.bodies[thing.id] = {
    ...WHOLE,
    id: thing.id,
    element: thing.element,
    where: [thing.x, thing.z],
    needs: { hunger: 3, rest: 0 },
  };
}

export function seedMatterWorld(things: readonly ThingView[], tiles: number): matter.MatterWorld {
  const extent = Math.max(1, Math.round(tiles / TILES_PER_PATCH));
  const world = matter.worldOf(matter.POOL, [
    matter.placeOf(CLEARING_PLACE, { abundance: ABUNDANCE, extent }),
  ]);
  for (const thing of things) {
    const element = world.elements[thing.element];
    if (!element) {
      if (thing.kind === "creature") embody(world, thing);
      continue;
    }
    const made = {
      id: thing.id,
      element: thing.element,
      place: CLEARING_PLACE,
      state: stateOf(thing, element),
      where: [thing.x, thing.z] as const,
    };
    world.things[thing.id] = (thing.states.burning ?? 0) > 0 ? matter.alight(world, made) : made;
  }
  world.things[INITIAL_HANDS] = {
    id: INITIAL_HANDS,
    element: "hand",
    place: CLEARING_PLACE,
    state: { ...matter.FRESH },
  };
  world.bodies[INITIAL_HERO] = {
    ...WHOLE,
    id: INITIAL_HERO,
    needs: { hunger: 1, rest: 1, warmth: 0 },
  };
  return world;
}
