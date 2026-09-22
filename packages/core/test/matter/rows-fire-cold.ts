/**
 * Rows and places for the fire and cold scenarios of batch A, beyond the shared ones. Written
 * once from the anchors of `spikes/vocabulary/VOCABULARY.md`, before any test was run, and
 * not tuned to make an outcome derive.
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      // Knee-high late-summer grass, brittle: close to dry kindling, lighter and finer.
      id: "grass",
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
      // A living hedge: green wood, as hard to light as a log.
      id: "hedge",
      name: "a hedge",
      kind: "plant",
      forms: ["grained"],
      props: {
        mass: 4,
        size: 4,
        hardness: 2,
        toughness: 4,
        flexibility: 2,
        flammability: 2,
        absorbency: 2,
      },
      burnsTo: "ash",
    },
    {
      id: "hay",
      name: "a haystack",
      kind: "thing",
      forms: [],
      props: {
        mass: 4,
        size: 4,
        hardness: 0,
        toughness: 1,
        flexibility: 3,
        flammability: 4,
        absorbency: 4,
      },
      burnsTo: "ash",
    },
    {
      // A hide with the fur on: leather's row, and hair takes a flame more readily than hide.
      id: "pelt",
      name: "a pelt",
      kind: "thing",
      forms: ["sheet"],
      moist: 2,
      props: {
        mass: 1,
        size: 2,
        hardness: 1,
        toughness: 4,
        flexibility: 4,
        flammability: 3,
        absorbency: 3,
        perishability: 3,
        scent: 2,
      },
    },
    {
      id: "fat",
      name: "cooking fat",
      kind: "material",
      forms: ["liquid"],
      props: {
        mass: 1,
        flammability: 4,
        meltsAt: 5,
        stickiness: 2,
        perishability: 3,
        scent: 3,
        oiliness: 5,
      },
      serves: { hunger: 2 },
    },
    {
      // A packed earth floor or path.
      id: "dirt",
      name: "packed earth",
      kind: "material",
      forms: ["granular"],
      props: {
        mass: 3,
        size: 1,
        hardness: 2,
        toughness: 1,
        absorbency: 3,
        porosity: 2,
        friction: 4,
      },
    },
    {
      // Ploughed soil: loose, and it drinks like the dry soil of P9's anchor.
      id: "tilth",
      name: "ploughed soil",
      kind: "material",
      forms: ["granular"],
      props: {
        mass: 3,
        size: 1,
        hardness: 1,
        toughness: 0,
        absorbency: 5,
        porosity: 4,
        friction: 3,
      },
    },
    {
      id: "root",
      name: "root vegetables",
      kind: "plant",
      forms: ["round"],
      props: {
        mass: 1,
        size: 1,
        hardness: 2,
        toughness: 2,
        absorbency: 1,
        perishability: 1,
        scent: 1,
      },
      serves: { hunger: 2 },
    },
    {
      // Melts far below the scale's warmest anchor; 5 is the nearest level P8 has.
      id: "ice",
      name: "an ice sheet",
      kind: "material",
      forms: ["flat", "sheet"],
      props: {
        mass: 2,
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
      // A grown person as a weight: load asks only for mass.
      id: "person",
      name: "a person",
      kind: "person",
      forms: [],
      props: { mass: 4, size: 3, hardness: 1, toughness: 2, flexibility: 2 },
    },
  ],
  places: [
    placeRow("stillfield", { moisture: 1, wind: 0 }),
    placeRow("hillside", { moisture: 1, wind: 4 }),
    placeRow("shelter", { air: 1, wind: 0 }),
    placeRow("lee", { temperature: 1, wind: 0 }),
    placeRow("pass", { temperature: 1, wind: 5 }),
    placeRow("frost", { temperature: 0, moisture: 3 }),
    placeRow("pitmild", { temperature: 2, moisture: 3 }),
    placeRow("cool", { temperature: 1.5, moisture: 3, wind: 2 }),
  ],
};
