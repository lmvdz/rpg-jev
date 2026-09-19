/**
 * Rows and places for the held-out "clever" chains of batch B, beyond the shared ones. Written
 * once from the anchors of `spikes/vocabulary/VOCABULARY.md`, before any test was run, and not
 * tuned to make an outcome derive.
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      // A fist-sized river stone. The shared stone row leaves conductivity at wool's level;
      // stone passes heat far better than wool and far worse than iron.
      id: "cobble",
      name: "a fist-sized stone",
      kind: "material",
      forms: ["round"],
      props: { mass: 3, size: 1, hardness: 4, toughness: 1, conductivity: 2 },
    },
    {
      // A fresh hide, staked out as a bowl: leather's row, still moist and still perishable.
      id: "rawhide",
      name: "a fresh hide",
      kind: "thing",
      forms: ["sheet", "hollow"],
      moist: 2,
      props: {
        mass: 1,
        size: 2,
        hardness: 1,
        toughness: 4,
        flexibility: 4,
        flammability: 2,
        absorbency: 3,
        perishability: 3,
        scent: 2,
      },
    },
    {
      // Green, leafy, freshly cut: P4's own anchor for tough, and full of sap.
      id: "greenwood",
      name: "green branches",
      kind: "plant",
      forms: ["grained", "long"],
      moist: 3,
      props: {
        mass: 1,
        size: 2,
        hardness: 2,
        toughness: 5,
        flexibility: 3,
        flammability: 2,
        absorbency: 2,
      },
      burnsTo: "ash",
    },
    {
      id: "splitwood",
      name: "split firewood",
      kind: "material",
      forms: ["grained", "long"],
      props: {
        mass: 2,
        size: 2,
        hardness: 2,
        toughness: 3,
        flammability: 3,
        absorbency: 3,
      },
      burnsTo: "ash",
    },
    {
      // Heavy enough to kill a fox, light enough for one person to tip up on edge.
      id: "slab",
      name: "a heavy flat stone",
      kind: "material",
      forms: ["flat"],
      props: { mass: 4, size: 3, hardness: 4, toughness: 1, conductivity: 2 },
    },
    {
      // A sound finger-thick stick, not a dry twig.
      id: "stick",
      name: "a thin stick",
      kind: "material",
      forms: ["grained", "long"],
      props: {
        mass: 0,
        size: 1,
        hardness: 2,
        toughness: 2,
        flexibility: 2,
        flammability: 3,
        absorbency: 2,
      },
      burnsTo: "ash",
    },
    {
      id: "carcass",
      name: "a deer carcass",
      kind: "thing",
      forms: [],
      moist: 3,
      props: {
        mass: 4,
        size: 3,
        hardness: 1,
        toughness: 2,
        perishability: 5,
        scent: 3,
      },
      serves: { hunger: 3 },
    },
    {
      // Bank clay as dug: a fine wet earth, like the shared mud but stickier, and it sets.
      id: "riverclay",
      name: "wet bank clay",
      kind: "material",
      forms: ["granular"],
      moist: 3,
      props: {
        mass: 1,
        size: 0,
        hardness: 1,
        toughness: 1,
        flexibility: 3,
        absorbency: 3,
        porosity: 1,
        stickiness: 3,
        setting: 4,
      },
    },
    {
      id: "boulder",
      name: "a boulder",
      kind: "material",
      forms: ["round"],
      props: { mass: 5, size: 4, hardness: 4, toughness: 1, conductivity: 2 },
    },
  ],
  places: [
    // A fast, cold mountain stream: under water, out of the wind.
    placeRow("stream", { temperature: 1, moisture: 5, wind: 0 }),
    // The same camp's warm air in the days ahead.
    placeRow("warmcamp", { temperature: 3, moisture: 2, wind: 1 }),
    placeRow("sun", { temperature: 3, moisture: 1, wind: 1 }),
    placeRow("frostnight", { temperature: 0, moisture: 2, wind: 1 }),
    placeRow("hilltop", { moisture: 1, wind: 3 }),
    placeRow("bank", { moisture: 3, abundance: { riverclay: 4 } }),
    placeRow("trail", { abundance: { riverclay: 0 } }),
  ],
};
