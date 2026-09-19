/**
 * Rows for the winter scenarios of batch D (`d-winter.json`), beside the shared ones. Written
 * once from the anchors of `spikes/vocabulary/VOCABULARY.md`, before any test ran, and not
 * tuned afterwards. The shared `water` and `rope` are reused.
 *
 * A row is the thing whole, dry, mild and full grown (principle 1): a soaked coat is the coat
 * with wetness, thin ice is the ice with a flaw (S15: found by load and never by looking), a
 * warped shutter is the shutter with less than its whole integrity. What lives has a body row.
 * A hand is flesh as levels, because a body has no parts.
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      id: "person",
      name: "a grown person",
      kind: "person",
      forms: [],
      props: { mass: 4, size: 3, hardness: 1, toughness: 2 },
      body: { strength: 2, speed: 2, sight: 3, hearing: 3, smell: 1 },
    },
    {
      // Half the size of the grown one, and a step lighter.
      id: "child",
      name: "a child",
      kind: "person",
      forms: [],
      props: { mass: 3, size: 2, hardness: 1, toughness: 2 },
      body: { strength: 1, speed: 2, sight: 3, hearing: 3, smell: 1 },
    },
    {
      id: "goat",
      name: "a goat",
      kind: "creature",
      forms: [],
      props: { mass: 3, size: 2, hardness: 1, toughness: 2, scent: 2 },
      body: {
        eats: { leaf: 5, seed: 4, fruit: 3 },
        strength: 2,
        speed: 3,
        sight: 3,
        hearing: 3,
        smell: 4,
      },
    },
    {
      id: "ox",
      name: "an ox",
      kind: "creature",
      forms: [],
      props: { mass: 5, size: 4, hardness: 1, toughness: 3, scent: 2 },
      body: {
        eats: { leaf: 5, seed: 4 },
        strength: 5,
        speed: 2,
        sight: 2,
        hearing: 3,
        smell: 3,
      },
    },
    {
      // What a body grips with when it holds nothing: flesh, as levels. It is mostly water.
      id: "hand",
      name: "bare hands",
      kind: "thing",
      forms: [],
      props: { mass: 1, size: 1, hardness: 1, toughness: 2, flexibility: 3, conductivity: 2 },
    },
    {
      // P7's anchor for 0 is wool. A coat, or a set of wool clothes: the same cloth.
      id: "woolcoat",
      name: "a wool coat",
      kind: "thing",
      forms: ["sheet"],
      props: {
        mass: 1,
        size: 2,
        hardness: 0,
        toughness: 3,
        flexibility: 5,
        flammability: 2,
        conductivity: 0,
        absorbency: 4,
        porosity: 3,
        oiliness: 1,
      },
    },
    {
      // The same wool, more of it: blankets rolled to sleep in.
      id: "bedroll",
      name: "a wool bedroll",
      kind: "thing",
      forms: ["sheet"],
      props: {
        mass: 2,
        size: 2,
        hardness: 0,
        toughness: 3,
        flexibility: 5,
        flammability: 2,
        conductivity: 0,
        absorbency: 4,
        porosity: 3,
        oiliness: 1,
      },
    },
    {
      // P9's anchor for 5 is cloth. Thin plant fibre: it drinks at once and holds little air.
      id: "linenshirt",
      name: "a linen shirt",
      kind: "thing",
      forms: ["sheet"],
      props: {
        mass: 0,
        size: 2,
        hardness: 0,
        toughness: 3,
        flexibility: 5,
        flammability: 3,
        conductivity: 2,
        absorbency: 5,
        porosity: 4,
      },
    },
    {
      // P4's anchor for 5 is leather. Thick hide, fleece side in.
      id: "hidecoat",
      name: "a thick hide coat",
      kind: "thing",
      forms: ["sheet"],
      props: {
        mass: 2,
        size: 2,
        hardness: 1,
        toughness: 5,
        flexibility: 3,
        flammability: 2,
        conductivity: 1,
        absorbency: 3,
        porosity: 1,
        oiliness: 1,
      },
    },
    {
      // The same leather scraped thin: a jerkin with nothing under it.
      id: "thinhide",
      name: "a thin leather jerkin",
      kind: "thing",
      forms: ["sheet"],
      props: {
        mass: 1,
        size: 2,
        hardness: 1,
        toughness: 5,
        flexibility: 4,
        flammability: 2,
        conductivity: 1,
        absorbency: 3,
        porosity: 1,
        oiliness: 1,
      },
    },
    {
      // A wide sheet of ice, over a pond or glazing a path. Melts far below the scale's warmest
      // anchor; 5 is the nearest level P8 has. P14's anchor for 0 is wet ice.
      id: "icesheet",
      name: "a sheet of ice",
      kind: "material",
      forms: ["flat", "sheet"],
      props: {
        mass: 4,
        size: 4,
        hardness: 2,
        toughness: 1,
        flexibility: 0,
        conductivity: 2,
        meltsAt: 5,
        buoyancy: 4,
        friction: 0,
      },
    },
    {
      // The same ice, as the skin over a well's mouth.
      id: "iceskin",
      name: "a skin of ice",
      kind: "material",
      forms: ["flat", "sheet"],
      props: {
        mass: 2,
        size: 2,
        hardness: 2,
        toughness: 1,
        flexibility: 0,
        conductivity: 2,
        meltsAt: 5,
        buoyancy: 4,
        friction: 0,
      },
    },
    {
      // Split seasoned logs. The amount is how many.
      id: "firewood",
      name: "firewood",
      kind: "thing",
      forms: ["grained", "long"],
      props: {
        mass: 2,
        size: 2,
        hardness: 3,
        toughness: 3,
        flammability: 3,
        absorbency: 2,
        buoyancy: 4,
      },
      burnsTo: "ash",
    },
    {
      // A sawn round, waiting for the axe.
      id: "log",
      name: "a log",
      kind: "thing",
      forms: ["grained", "long"],
      props: {
        mass: 3,
        size: 2,
        hardness: 3,
        toughness: 3,
        flammability: 2,
        absorbency: 2,
        buoyancy: 4,
      },
      burnsTo: "ash",
    },
    {
      id: "axe",
      name: "a felling axe",
      kind: "thing",
      forms: ["edged", "long"],
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
      // The bail of a bucket: a bent rod of bare iron. P7's anchor for 5 is iron.
      id: "ironhandle",
      name: "an iron bucket handle",
      kind: "thing",
      forms: ["long"],
      props: {
        mass: 1,
        size: 1,
        hardness: 4,
        toughness: 4,
        conductivity: 5,
        meltsAt: 1,
        corrodibility: 5,
      },
    },
    {
      // Cast iron: hard, heavy, and less tough than wrought.
      id: "stove",
      name: "an iron stove",
      kind: "thing",
      forms: ["hollow"],
      props: {
        mass: 4,
        size: 3,
        hardness: 4,
        toughness: 3,
        conductivity: 5,
        meltsAt: 1,
        corrodibility: 4,
      },
    },
    {
      // Staves bound with iron hoops.
      id: "bucket",
      name: "a well bucket",
      kind: "thing",
      forms: ["hollow"],
      props: {
        mass: 2,
        size: 2,
        hardness: 3,
        toughness: 3,
        flammability: 2,
        absorbency: 2,
        buoyancy: 4,
      },
    },
    {
      id: "hay",
      name: "stored hay",
      kind: "material",
      forms: [],
      fare: "leaf",
      serves: { hunger: 2 },
      props: {
        mass: 1,
        size: 2,
        hardness: 0,
        toughness: 1,
        flexibility: 4,
        flammability: 4,
        absorbency: 3,
        porosity: 4,
        perishability: 2,
        scent: 2,
      },
      burnsTo: "ash",
    },
    {
      // A packed earth floor.
      id: "floor",
      name: "a packed earth floor",
      kind: "thing",
      forms: ["flat"],
      props: { mass: 5, size: 4, hardness: 2, toughness: 3, absorbency: 3 },
    },
    {
      // A sack of feed: what one person can just carry.
      id: "feedsack",
      name: "a feed sack",
      kind: "thing",
      forms: [],
      props: {
        mass: 3,
        size: 2,
        hardness: 0,
        toughness: 3,
        flexibility: 3,
        flammability: 3,
        absorbency: 3,
      },
    },
    {
      id: "shutter",
      name: "a plank shutter",
      kind: "thing",
      forms: ["flat", "grained"],
      props: { mass: 2, size: 2, hardness: 3, toughness: 3, flammability: 2, absorbency: 2 },
    },
    {
      id: "wall",
      name: "a timber wall",
      kind: "thing",
      forms: ["flat", "grained"],
      props: { mass: 5, size: 5, hardness: 3, toughness: 4, flammability: 2, absorbency: 2 },
    },
    {
      id: "rail",
      name: "a fence rail",
      kind: "thing",
      forms: ["grained", "long"],
      props: { mass: 3, size: 3, hardness: 3, toughness: 4, flammability: 2, absorbency: 2 },
    },
  ],
  places: [
    // A frozen pond at the edge of the homestead: just under freezing, a breeze over open ice.
    placeRow("pond", { temperature: 0.5, wind: 2 }),
    // A one-room house by day with a fire in it: the air away from the hearth is cool, and still.
    placeRow("house", { temperature: 1.5, wind: 0 }),
    // The same house on a winter night, shuttered tight, lit by the fire and nothing else.
    placeRow("nighthouse", { temperature: 1, wind: 0, light: 1 }),
    // And with a stream of outside air crossing the room.
    placeRow("draughtyhouse", { temperature: 1, wind: 1, light: 1 }),
    // The night outside it, with the wind up.
    placeRow("gale", { temperature: 0, wind: 4, light: 0 }),
    // Near-freezing drizzle turning to sleet; freezing rain is the same yard.
    placeRow("yard", { temperature: 0.5, moisture: 5, wind: 2 }),
    // Piled stone and brush with no door, on a cold night.
    placeRow("shelter", { temperature: 0.5, wind: 1, light: 1 }),
    // Dawn, well below freezing, everything rimed.
    placeRow("wellyard", { temperature: 0 }),
    // Behind the house: cold and still.
    placeRow("woodpile", { temperature: 0.5, wind: 0 }),
    // Cold, damp days about the homestead.
    placeRow("homestead", { temperature: 1, moisture: 3 }),
    // The path to the barn, glazed, under a dusting of snow.
    placeRow("icypath", { temperature: 0.5, moisture: 3 }),
    // A barn in the coldest week: freezing, and not tight.
    placeRow("barn", { temperature: 0, light: 1 }),
    // A light snow falling on the yard and the path to the woodshed.
    placeRow("snowyard", { temperature: 0.5, moisture: 3 }),
    placeRow("barnyard", { temperature: 0.5, light: 1 }),
    // Hours out along the snares, well below freezing, in the open.
    placeRow("trapline", { temperature: 0, wind: 2 }),
  ],
};
