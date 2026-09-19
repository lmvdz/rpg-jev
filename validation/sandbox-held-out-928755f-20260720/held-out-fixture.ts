/**
 * Independent clearing fixtures. These rows are not copied from the training batches.
 * Amounts and levels are fixed before running the held-out assertions; no production
 * rules or fixture values are tuned to make a scenario pass.
 */
import { FRESH, type MatterWorld, type ThingState } from "../../src/matter/index.ts";

export function clearing(): MatterWorld {
  return {
    elements: {
      water: {
        id: "water",
        name: "clear water",
        kind: "material",
        forms: ["liquid"],
        props: { mass: 1, conductivity: 3 },
      },
      oil: {
        id: "oil",
        name: "seed oil",
        kind: "material",
        forms: ["liquid"],
        props: { mass: 1, oiliness: 5, flammability: 5, stickiness: 1 },
      },
      soap: {
        id: "soap",
        name: "washing liquid",
        kind: "material",
        forms: ["liquid"],
        props: { mass: 1, cleansing: 5 },
      },
      reed: {
        id: "reed",
        name: "dry reeds",
        kind: "plant",
        forms: ["long"],
        props: { mass: 1, size: 1, flammability: 4, absorbency: 3, porosity: 3 },
      },
      metal: {
        id: "metal",
        name: "metal scraper",
        kind: "thing",
        forms: ["edged"],
        props: { mass: 2, size: 1, hardness: 4, toughness: 4, conductivity: 4 },
      },
      food: {
        id: "food",
        name: "cooked roots",
        kind: "material",
        forms: [],
        props: { mass: 1, size: 1, perishability: 4, absorbency: 2 },
        serves: { hunger: 2 },
      },
      pebble: {
        id: "pebble",
        name: "pebble",
        kind: "material",
        forms: ["round"],
        props: { mass: 1, size: 1, hardness: 4, toughness: 2 },
      },
    },
    things: {},
    bodies: {
      player: {
        id: "player",
        place: "clearing",
        needs: { hunger: 5 },
        health: 5,
        wounds: [],
        sickness: 0,
        sickensIn: 0,
      },
    },
    places: {
      clearing: {
        id: "clearing",
        temperature: 2,
        moisture: 2,
        wind: 0,
        air: 5,
        abundance: { pebble: 1 },
        searched: {},
      },
    },
    next: 0,
  };
}

export function put(
  world: MatterWorld,
  id: string,
  element: string,
  state: Partial<ThingState> = {},
): void {
  world.things[id] = { id, element, place: "clearing", state: { ...FRESH, ...state } };
}

/** Missing targets must fail loudly, not make a numeric assertion pass via a default. */
export function stateOf(world: MatterWorld, id: string): ThingState {
  const thing = world.things[id];
  if (!thing) throw new Error(`Expected surviving thing: ${id}`);
  return thing.state;
}
