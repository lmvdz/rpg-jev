/**
 * The starting pool: hand-written element rows for the first slice, standing in for the pool
 * that births will fill (docs/sandbox-direction.md). Rows are data. Each level is set against
 * the anchors of `spikes/vocabulary/VOCABULARY.md`, and no rule in this module names any of
 * them. When an element can be born, these become its first rows and nothing else changes.
 */
import { effective } from "./effective.ts";
import { fuelFor } from "./heat.ts";
import type { Element, MatterWorld, Place, Thing } from "./types.ts";

export const POOL: readonly Element[] = [
  {
    id: "oak",
    name: "an oak",
    kind: "plant",
    forms: ["grained", "long"],
    props: { mass: 5, size: 5, hardness: 3, toughness: 4, flammability: 2, absorbency: 2 },
    moist: 1,
    burnsTo: "ash",
  },
  {
    id: "pine",
    name: "a pine",
    kind: "plant",
    forms: ["grained", "long"],
    props: {
      mass: 4,
      size: 5,
      hardness: 2,
      toughness: 3,
      flammability: 3,
      absorbency: 2,
      scent: 2,
    },
    moist: 1,
    burnsTo: "ash",
  },
  {
    id: "bramble",
    name: "a bramble",
    kind: "plant",
    forms: ["cord", "pointed"],
    props: { mass: 1, size: 2, hardness: 1, toughness: 3, flexibility: 4, flammability: 3 },
    moist: 2,
    burnsTo: "ash",
  },
  {
    id: "reeds",
    name: "reeds",
    kind: "plant",
    forms: ["long", "cord"],
    props: {
      mass: 1,
      size: 2,
      hardness: 1,
      toughness: 2,
      flexibility: 4,
      flammability: 3,
      absorbency: 3,
    },
    moist: 3,
    burnsTo: "ash",
  },
  {
    id: "grass",
    name: "dry grass",
    kind: "plant",
    forms: ["cord"],
    props: {
      mass: 0,
      size: 1,
      hardness: 0,
      toughness: 1,
      flexibility: 5,
      flammability: 4,
      absorbency: 3,
    },
    burnsTo: "ash",
  },
  {
    id: "branch",
    name: "a fallen branch",
    kind: "thing",
    forms: ["grained", "long"],
    props: { mass: 2, size: 2, hardness: 2, toughness: 3, flammability: 3, absorbency: 3 },
    burnsTo: "ash",
  },
  {
    id: "stone",
    name: "a stone",
    kind: "material",
    forms: ["round"],
    props: { mass: 3, size: 1, hardness: 4, toughness: 1 },
  },
  {
    id: "flint",
    name: "a flint",
    kind: "material",
    forms: ["edged"],
    props: { mass: 1, size: 1, hardness: 5, toughness: 1 },
  },
  {
    id: "ash",
    name: "ash",
    kind: "material",
    forms: ["granular"],
    props: { mass: 1, cleansing: 2 },
  },
  {
    id: "water",
    name: "water",
    kind: "material",
    forms: ["liquid"],
    props: { mass: 2, conductivity: 2, swell: 3 },
    serves: { hunger: 1 },
  },
  {
    id: "oil",
    name: "lamp oil",
    kind: "material",
    forms: ["liquid"],
    props: { mass: 1, flammability: 5, oiliness: 5, stickiness: 1 },
  },
  {
    id: "blade",
    name: "a blade",
    kind: "thing",
    forms: ["edged", "pointed"],
    props: {
      mass: 1,
      size: 1,
      hardness: 5,
      toughness: 3,
      conductivity: 5,
      meltsAt: 1,
      corrodibility: 4,
    },
  },
  {
    id: "berries",
    name: "berries",
    kind: "plant",
    forms: [],
    props: { mass: 0, size: 0, hardness: 0, toughness: 1, perishability: 4, scent: 1 },
    moist: 3,
    serves: { hunger: 1 },
    fare: "fruit",
  },
  {
    // What a body strikes and works with when it holds nothing: flesh, as levels.
    id: "hand",
    name: "bare hands",
    kind: "thing",
    forms: [],
    props: { mass: 1, size: 1, hardness: 1, toughness: 2, flexibility: 3 },
  },
];

/**
 * A fire is not an element. It is fuel, burning: a thing of some element that can burn, with
 * as much burning time as there is of it. This sets one alight without a spark, for building
 * a world that already has a hearth in it.
 */
export function alight(world: MatterWorld, thing: Thing): Thing {
  const burning = fuelFor(world, thing, effective(world, thing));
  if (burning.fuel <= 0) return thing;
  return { ...thing, state: { ...thing.state, burning, temperature: 5 } };
}

/** A place as it is on a mild dry day with nothing looked for yet. */
export function placeOf(id: string, set: Partial<Place> = {}): Place {
  return {
    id,
    temperature: 2,
    moisture: 2,
    wind: 1,
    air: 5,
    abundance: {},
    searched: {},
    ...set,
  };
}

/** An empty world over some rows and places. The caller adds the things and the bodies. */
export function worldOf(elements: readonly Element[], places: readonly Place[]): MatterWorld {
  return {
    elements: Object.fromEntries(elements.map((e) => [e.id, e])),
    things: {},
    bodies: {},
    places: Object.fromEntries(places.map((p) => [p.id, p])),
    next: 0,
  };
}
