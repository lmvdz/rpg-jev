/**
 * Rows for the world and odd-tool scenarios of batch B (`b-world-odd.json`), beside the shared
 * ones. Written once from the anchors of `spikes/vocabulary/VOCABULARY.md`, before any test
 * ran, and not tuned afterwards. The shared `water`, `stone`, `leather`, `ash` and `meat` are
 * reused. No odd tool's row says what job it will be asked to do: a pot is a hard hollow round
 * thing, a coin a small flat soft-metal one, a bone a hard splintery long one.
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      // A river bank of clay, as one big lump. P23's anchor for 5 is clay. Damp as it lies.
      id: "claybank",
      name: "a clay bank",
      kind: "material",
      forms: [],
      moist: 2,
      props: {
        mass: 5,
        size: 5,
        hardness: 1,
        toughness: 1,
        flexibility: 3,
        absorbency: 3,
        porosity: 1,
        solubility: 1,
        stickiness: 2,
        setting: 5,
      },
    },
    {
      // Seasoned split wood: no longer green, so less tough than a bough. Wood barely perishes.
      id: "rail",
      name: "a fence rail",
      kind: "thing",
      forms: ["grained", "long"],
      props: {
        mass: 2,
        size: 3,
        hardness: 3,
        toughness: 3,
        flammability: 3,
        absorbency: 2,
        porosity: 1,
        buoyancy: 4,
        perishability: 1,
        swell: 2,
      },
      burnsTo: "ash",
    },
    {
      id: "goat",
      name: "a goat, as a weight",
      kind: "creature",
      forms: [],
      props: { mass: 3, size: 3, hardness: 1, toughness: 2 },
    },
    {
      id: "carcass",
      name: "a deer carcass",
      kind: "thing",
      forms: [],
      moist: 3,
      props: { mass: 3, size: 3, hardness: 1, toughness: 2, perishability: 5, scent: 2 },
      serves: { hunger: 3 },
    },
    {
      id: "rat",
      name: "a dead rat",
      kind: "thing",
      forms: [],
      moist: 3,
      props: { mass: 1, size: 1, hardness: 0, toughness: 2, perishability: 5, scent: 2 },
      serves: { hunger: 1 },
    },
    {
      // Pine is softer than oak. Fallen and whole.
      id: "pinetrunk",
      name: "a fallen pine trunk",
      kind: "plant",
      forms: ["grained", "long", "round"],
      props: {
        mass: 5,
        size: 5,
        hardness: 2,
        toughness: 4,
        flammability: 3,
        absorbency: 2,
        porosity: 1,
        buoyancy: 4,
        perishability: 1,
      },
      burnsTo: "ash",
    },
    {
      // Long dead and dry: brittle, and readier to burn than living wood.
      id: "deadtree",
      name: "a dead standing tree",
      kind: "plant",
      forms: ["grained", "long"],
      props: {
        mass: 5,
        size: 5,
        hardness: 2,
        toughness: 2,
        flammability: 3,
        absorbency: 3,
        porosity: 1,
        perishability: 1,
      },
      burnsTo: "ash",
    },
    {
      // The anchor for flammability 5 is dry tinder, which is what this is.
      id: "drygrass",
      name: "summer-dry grass",
      kind: "plant",
      forms: ["long"],
      props: {
        mass: 0,
        size: 1,
        hardness: 0,
        toughness: 1,
        flexibility: 4,
        flammability: 5,
        absorbency: 3,
        porosity: 3,
      },
      burnsTo: "ash",
    },
    {
      // Woody and still holding water of its own.
      id: "scrub",
      name: "scrub brush",
      kind: "plant",
      forms: ["long"],
      moist: 2,
      props: {
        mass: 1,
        size: 2,
        hardness: 2,
        toughness: 3,
        flexibility: 3,
        flammability: 3,
        absorbency: 2,
        porosity: 2,
      },
      burnsTo: "ash",
    },
    {
      id: "ironpot",
      name: "an iron cooking pot",
      kind: "thing",
      forms: ["hollow", "round"],
      props: {
        mass: 2,
        size: 2,
        hardness: 4,
        toughness: 4,
        conductivity: 5,
        meltsAt: 1,
        corrodibility: 5,
      },
    },
    {
      // Cooking fat gone cold: the anchors for oiliness 5 are oil, tar and wax.
      id: "grease",
      name: "cooking grease",
      kind: "material",
      forms: [],
      props: {
        mass: 1,
        hardness: 0,
        flammability: 4,
        meltsAt: 5,
        stickiness: 2,
        perishability: 2,
        scent: 1,
        oiliness: 5,
      },
    },
    {
      // Wood ash wetted to a paste: a mild lye with grit in it. Soap, lye and sand are 5; the
      // shared dry ash is 2; wetted and gritty it is between, and it bites skin a little.
      id: "ashpaste",
      name: "wet ash paste",
      kind: "material",
      forms: ["liquid", "granular"],
      props: { mass: 2, solubility: 3, stickiness: 1, friction: 3, noxiousness: 1, cleansing: 3 },
    },
    {
      id: "legbone",
      name: "a split sliver of leg bone",
      kind: "material",
      forms: ["grained", "long", "pointed"],
      props: { mass: 0, size: 1, hardness: 3, toughness: 2, perishability: 1 },
    },
    {
      id: "whetstone",
      name: "a whetstone",
      kind: "thing",
      forms: ["flat"],
      props: { mass: 1, size: 1, hardness: 4, toughness: 1, friction: 5 },
    },
    {
      id: "needle",
      name: "a steel needle",
      kind: "thing",
      forms: ["long", "pointed"],
      props: {
        mass: 0,
        size: 0,
        hardness: 5,
        toughness: 3,
        conductivity: 5,
        meltsAt: 1,
        corrodibility: 4,
      },
    },
    {
      // Planks made to take blows, with a smooth face.
      id: "shield",
      name: "a wooden shield",
      kind: "thing",
      forms: ["flat", "round", "grained"],
      props: {
        mass: 2,
        size: 2,
        hardness: 3,
        toughness: 4,
        flammability: 2,
        absorbency: 2,
        buoyancy: 4,
        friction: 1,
      },
    },
    {
      id: "outcrop",
      name: "a rock outcrop",
      kind: "thing",
      forms: [],
      props: { mass: 5, size: 4, hardness: 4, toughness: 1, friction: 5 },
    },
    {
      // Copper: harder than gold, softer than iron, and it bends before it breaks.
      id: "coin",
      name: "a copper coin",
      kind: "thing",
      forms: ["flat", "round"],
      props: {
        mass: 0,
        size: 0,
        hardness: 3,
        toughness: 4,
        conductivity: 5,
        meltsAt: 1,
        corrodibility: 1,
      },
    },
    {
      id: "screw",
      name: "a steel screw",
      kind: "thing",
      forms: ["long", "pointed"],
      props: {
        mass: 0,
        size: 0,
        hardness: 5,
        toughness: 4,
        conductivity: 5,
        meltsAt: 1,
        corrodibility: 4,
      },
    },
  ],
  places: [
    placeRow("winter", { temperature: 0, moisture: 3, wind: 2 }),
    placeRow("drybank", { temperature: 3, moisture: 1, wind: 2 }),
    // A rainy autumn: the air is damp, but what stands up in the wind dries between showers.
    placeRow("pasture", { temperature: 1.5, moisture: 3, wind: 2 }),
    // Ground that never dries.
    placeRow("dampground", { temperature: 1.5, moisture: 5, wind: 0 }),
    placeRow("gully", { temperature: 3, moisture: 1, wind: 2 }),
    placeRow("well", { temperature: 1, moisture: 4, wind: 0, air: 3 }),
    placeRow("grassland", { temperature: 3, moisture: 0, wind: 3 }),
    placeRow("downpour", { temperature: 2, moisture: 5, wind: 3 }),
  ],
};
