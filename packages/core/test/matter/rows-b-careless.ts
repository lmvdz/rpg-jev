/**
 * Rows and places for batch B's careless, malice and exploit scenarios, beyond the shared
 * ones. Written once from the anchors of `spikes/vocabulary/VOCABULARY.md`, before any test
 * was run, and not tuned to make an outcome derive.
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      // A split, seasoned log: readier to light than a green bough, slower than kindling.
      id: "firewood",
      name: "a split dry log",
      kind: "material",
      forms: ["grained", "long"],
      props: { mass: 2, size: 2, hardness: 3, toughness: 3, flammability: 3, absorbency: 2 },
      burnsTo: "ash",
    },
    {
      // Late-summer grass after weeks without rain: a step short of tinder.
      id: "drygrass",
      name: "dry standing grass",
      kind: "plant",
      forms: ["long"],
      props: {
        mass: 0,
        size: 1,
        hardness: 0,
        toughness: 1,
        flexibility: 3,
        flammability: 4,
        absorbency: 2,
      },
      burnsTo: "ash",
    },
    {
      // Ripe wheat ready to cut: the same stuff as dry grass, standing taller.
      id: "wheat",
      name: "ripe standing wheat",
      kind: "plant",
      forms: ["long"],
      props: {
        mass: 0,
        size: 2,
        hardness: 0,
        toughness: 1,
        flexibility: 3,
        flammability: 4,
        absorbency: 2,
      },
      burnsTo: "ash",
    },
    {
      // A glowing coal small enough for the wind to lift.
      id: "ember",
      name: "an ember",
      kind: "material",
      forms: [],
      props: { mass: 0, size: 0, hardness: 1, toughness: 0, flammability: 3 },
      burnsTo: "ash",
    },
    {
      id: "barnwall",
      name: "a weathered plank wall",
      kind: "thing",
      forms: ["flat", "grained"],
      props: { mass: 4, size: 4, hardness: 3, toughness: 4, flammability: 2, absorbency: 2 },
      burnsTo: "ash",
    },
    {
      // A grown person as a weight: load asks only for mass.
      id: "person",
      name: "a grown person",
      kind: "person",
      forms: [],
      props: { mass: 4, size: 3, hardness: 1, toughness: 2, flexibility: 2 },
    },
    {
      // Horn, not steel: harder than leather, softer than seasoned wood.
      id: "claw",
      name: "a claw",
      kind: "thing",
      forms: ["pointed"],
      props: { mass: 0, size: 0, hardness: 2, toughness: 3 },
    },
    {
      id: "door",
      name: "a plank door",
      kind: "thing",
      forms: ["flat", "grained"],
      props: { mass: 3, size: 3, hardness: 3, toughness: 4, flammability: 2, absorbency: 2 },
    },
    {
      // Melts far below the scale's warmest anchor; 5 is the nearest level P8 has.
      id: "pondice",
      name: "a sheet of pond ice",
      kind: "material",
      forms: ["flat", "sheet"],
      props: {
        mass: 3,
        size: 4,
        hardness: 2,
        toughness: 1,
        conductivity: 2,
        meltsAt: 5,
        buoyancy: 4,
        friction: 0,
      },
    },
    {
      // Crushed poison berries: a step short of the deadly mushroom, and it washes into water.
      id: "nightshade",
      name: "crushed nightshade",
      kind: "material",
      forms: ["liquid"],
      props: { mass: 1, noxiousness: 4, solubility: 4 },
    },
    {
      // A bridge's anchor rope: the shared rope, thicker and heavier.
      id: "hawser",
      name: "an anchor rope",
      kind: "thing",
      forms: ["cord"],
      props: {
        mass: 3,
        size: 3,
        hardness: 1,
        toughness: 5,
        flexibility: 4,
        flammability: 3,
        absorbency: 4,
      },
    },
    {
      id: "mule",
      name: "a mule",
      kind: "creature",
      forms: [],
      props: { mass: 5, size: 3, hardness: 1, toughness: 3 },
    },
    {
      id: "sack",
      name: "a sack of grain",
      kind: "thing",
      forms: [],
      props: { mass: 3, size: 2, hardness: 0, toughness: 3, absorbency: 4, buoyancy: 3 },
    },
    {
      id: "ingot",
      name: "an iron ingot",
      kind: "material",
      forms: [],
      props: {
        mass: 3,
        size: 1,
        hardness: 4,
        toughness: 4,
        conductivity: 5,
        meltsAt: 1,
        corrodibility: 5,
      },
    },
    {
      id: "pack",
      name: "a leather pack",
      kind: "thing",
      forms: ["hollow"],
      props: {
        mass: 1,
        size: 2,
        hardness: 1,
        toughness: 4,
        flexibility: 4,
        flammability: 2,
        absorbency: 3,
      },
    },
    {
      id: "supplies",
      name: "a day's supplies",
      kind: "thing",
      forms: [],
      props: { mass: 2, size: 1, hardness: 1, toughness: 2 },
    },
    {
      // A stick with a head of wound cloth, not yet dipped in anything.
      id: "torch",
      name: "an unlit torch",
      kind: "thing",
      forms: ["long", "grained"],
      props: { mass: 1, size: 2, hardness: 2, toughness: 3, flammability: 4, absorbency: 3 },
      burnsTo: "ash",
    },
  ],
  places: [
    placeRow("meadow", { temperature: 3, moisture: 0, wind: 3 }),
    placeRow("field", { moisture: 1, wind: 3 }),
    placeRow("stillfield", { moisture: 1, wind: 0 }),
    placeRow("valley", { temperature: 1, moisture: 3, wind: 1 }),
    placeRow("hut", { temperature: 3, wind: 0, air: 4 }),
    placeRow("pond", { temperature: 0, wind: 1 }),
    placeRow("village"),
    placeRow("gorge", { wind: 2 }),
    placeRow("patch", { abundance: { stone: 1 } }),
    placeRow("kitchen"),
    placeRow("road"),
    placeRow("streambed", { temperature: 1, moisture: 5, wind: 0, air: 0 }),
    placeRow("bank"),
  ],
};
