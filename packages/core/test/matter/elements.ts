/**
 * Element rows for the matter tests. Rows are data: levels 0 to 5 against the anchors of
 * `spikes/vocabulary/VOCABULARY.md`. Nothing in `src/matter` names any of these.
 */
import type {
  Body,
  Element,
  MatterWorld,
  Place,
  Thing,
  ThingState,
} from "../../src/matter/index.ts";
import { FRESH } from "../../src/matter/index.ts";

export const ELEMENTS: Element[] = [
  {
    id: "bough",
    name: "a bough",
    kind: "plant",
    forms: ["grained", "long"],
    props: { mass: 3, size: 3, hardness: 3, toughness: 4, flammability: 2, absorbency: 2 },
    burnsTo: "ash",
  },
  {
    id: "tinder",
    name: "dry tinder",
    kind: "material",
    forms: [],
    props: { mass: 0, size: 0, flammability: 5, absorbency: 4 },
    burnsTo: "ash",
  },
  {
    id: "leather",
    name: "leather",
    kind: "material",
    forms: ["sheet"],
    props: {
      mass: 1,
      size: 1,
      hardness: 1,
      toughness: 4,
      flexibility: 4,
      flammability: 2,
      absorbency: 3,
    },
  },
  {
    id: "blade",
    name: "a small blade",
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
    id: "blood",
    name: "blood",
    kind: "material",
    forms: ["liquid"],
    props: { mass: 1, stickiness: 2, oiliness: 1, perishability: 4 },
  },
  {
    id: "bread",
    name: "bread",
    kind: "material",
    forms: [],
    moist: 2,
    props: { mass: 1, size: 1, hardness: 1, toughness: 1, absorbency: 4, perishability: 3 },
    serves: { hunger: 2 },
  },
  {
    id: "brine",
    name: "brine",
    kind: "material",
    forms: ["liquid"],
    props: { mass: 2, conductivity: 2 },
  },
  {
    id: "steel",
    name: "steel",
    kind: "material",
    forms: ["long", "edged"],
    props: {
      mass: 2,
      size: 2,
      hardness: 5,
      toughness: 4,
      conductivity: 5,
      meltsAt: 1,
      corrodibility: 4,
    },
  },
  {
    id: "iron",
    name: "iron",
    kind: "material",
    forms: ["long"],
    props: {
      mass: 3,
      size: 2,
      hardness: 4,
      toughness: 4,
      conductivity: 5,
      meltsAt: 1,
      corrodibility: 5,
    },
  },
  {
    id: "oil",
    name: "lamp oil",
    kind: "material",
    forms: ["liquid"],
    props: { mass: 1, flammability: 5, oiliness: 5, stickiness: 1 },
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
    id: "soapy",
    name: "soapy water",
    kind: "material",
    forms: ["liquid"],
    props: { mass: 2, cleansing: 4 },
  },
  { id: "fire", name: "fire", kind: "thing", forms: [], props: { size: 2 } },
  {
    id: "oak",
    name: "oak",
    kind: "plant",
    forms: ["grained", "long"],
    props: { mass: 5, size: 5, hardness: 3, toughness: 4, flammability: 2, absorbency: 2 },
    burnsTo: "ash",
  },
  {
    id: "kindling",
    name: "dry kindling",
    kind: "material",
    forms: ["grained"],
    props: { mass: 1, size: 1, hardness: 2, toughness: 2, flammability: 4, absorbency: 3 },
    burnsTo: "ash",
  },
  {
    id: "ash",
    name: "ash",
    kind: "material",
    forms: ["granular"],
    props: { mass: 1, cleansing: 2 },
  },
  {
    id: "stone",
    name: "stone",
    kind: "material",
    forms: ["round"],
    props: { mass: 3, size: 1, hardness: 4, toughness: 1 },
  },
  {
    id: "flint",
    name: "flint",
    kind: "material",
    forms: ["edged"],
    props: { mass: 1, size: 1, hardness: 5, toughness: 1 },
  },
  {
    id: "glass",
    name: "glass",
    kind: "material",
    forms: ["hollow"],
    props: { mass: 1, size: 1, hardness: 4, toughness: 0 },
  },
  {
    id: "clay",
    name: "clay",
    kind: "material",
    forms: ["hollow"],
    props: {
      mass: 2,
      size: 1,
      hardness: 1,
      toughness: 1,
      flexibility: 3,
      absorbency: 3,
      setting: 4,
    },
  },
  {
    id: "cloth",
    name: "cloth",
    kind: "material",
    forms: ["sheet"],
    props: {
      mass: 1,
      size: 2,
      hardness: 0,
      toughness: 3,
      flexibility: 5,
      flammability: 3,
      absorbency: 5,
      porosity: 4,
    },
  },
  {
    id: "rope",
    name: "rope",
    kind: "thing",
    forms: ["cord"],
    props: {
      mass: 1,
      size: 3,
      hardness: 1,
      toughness: 5,
      flexibility: 5,
      flammability: 3,
      absorbency: 4,
    },
  },
  {
    id: "meat",
    name: "raw meat",
    kind: "material",
    forms: [],
    moist: 3,
    props: { mass: 1, size: 1, hardness: 0, toughness: 2, perishability: 5, scent: 2 },
    serves: { hunger: 3 },
  },
  {
    id: "salt",
    name: "salt",
    kind: "material",
    forms: ["granular"],
    props: { mass: 1, solubility: 5 },
  },
  {
    id: "mushroom",
    name: "pale mushroom",
    kind: "plant",
    forms: [],
    props: { mass: 0, size: 0, noxiousness: 5 },
    serves: { hunger: 1 },
  },
  {
    id: "mud",
    name: "mud",
    kind: "material",
    forms: ["granular"],
    props: { mass: 2, stickiness: 2, solubility: 2 },
  },
  {
    id: "gold",
    name: "gold",
    kind: "material",
    forms: [],
    props: { mass: 4, hardness: 2, toughness: 4 },
  },
];

const place = (id: string, set: Partial<Place> = {}): Place => ({
  id,
  temperature: 2,
  moisture: 2,
  wind: 1,
  air: 5,
  abundance: {},
  searched: {},
  ...set,
});

export const PLACES: Place[] = [
  place("hearth"),
  place("grass", { abundance: { stone: 1, flint: 0, gold: 0 } }),
  place("quarry", { abundance: { stone: 5, flint: 2, gold: 0 } }),
  place("cellar", { temperature: 1, moisture: 3 }),
  place("pit", { air: 0 }),
  place("rain", { moisture: 5 }),
  place("sheath", { moisture: 4, wind: 0 }),
  place("warm", { temperature: 3, moisture: 3 }),
];

export const thing = (
  id: string,
  element: string,
  at = "hearth",
  set: Partial<ThingState> = {},
): Thing => ({
  id,
  element,
  place: at,
  state: { ...FRESH, ...set },
});

export const body = (id: string, set: Partial<Body> = {}): Body => ({
  id,
  place: "hearth",
  needs: { hunger: 3 },
  health: 5,
  wounds: [],
  sickness: 0,
  sickensIn: 0,
  ...set,
});

/** Rows and places a test file brings of its own, beside the shared ones. */
export interface Extra {
  elements?: Element[];
  places?: Place[];
}

export const placeRow = place;

export function world(things: Thing[], bodies: Body[] = [], extra: Extra = {}): MatterWorld {
  const elements = [...ELEMENTS, ...(extra.elements ?? [])];
  const moist = new Map(elements.map((e) => [e.id, e.moist ?? 0]));
  // A thing is born as wet as its element is moist, unless the test says how wet it is.
  const born = things.map((t) =>
    t.state.wetness === 0 ? { ...t, state: { ...t.state, wetness: moist.get(t.element) ?? 0 } } : t,
  );
  const places = [...PLACES, ...(extra.places ?? [])];
  return {
    elements: Object.fromEntries(elements.map((e) => [e.id, e])),
    things: Object.fromEntries(born.map((t) => [t.id, t])),
    bodies: Object.fromEntries(bodies.map((b) => [b.id, b])),
    places: Object.fromEntries(places.map((p) => [p.id, p])),
    next: 0,
  };
}
