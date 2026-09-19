/**
 * Rows and places for the water and mixing scenarios of batch A (`a-water-mix.test.ts`).
 * Written once from the anchors of `spikes/vocabulary/VOCABULARY.md`, before anything ran.
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      // Pitch: hard and tacky when mild, runs when hot. The anchor for stickiness and oiliness.
      id: "tar",
      name: "tar",
      kind: "material",
      forms: [],
      props: {
        mass: 2,
        size: 1,
        hardness: 1,
        toughness: 2,
        flexibility: 1,
        flammability: 4,
        conductivity: 1,
        meltsAt: 4,
        stickiness: 5,
        oiliness: 5,
        scent: 3,
        noxiousness: 1,
      },
    },
    {
      // A gate hinge: bare iron, small, metal rubbing on metal.
      id: "hinge",
      name: "an iron hinge",
      kind: "thing",
      forms: ["flat"],
      props: {
        mass: 1,
        size: 1,
        hardness: 4,
        toughness: 4,
        conductivity: 5,
        meltsAt: 1,
        friction: 3,
        corrodibility: 5,
      },
    },
    {
      // A wool blanket over a straw tick: drinks like cloth, and feeds mould a little.
      id: "bedding",
      name: "bedding",
      kind: "thing",
      forms: ["sheet"],
      props: {
        mass: 2,
        size: 3,
        hardness: 0,
        toughness: 3,
        flexibility: 5,
        flammability: 3,
        absorbency: 5,
        porosity: 3,
        perishability: 1,
      },
    },
    {
      // Hide glue: the vocabulary's own anchor for setting; it dissolves in water and softens hot.
      id: "glue",
      name: "hide glue",
      kind: "material",
      forms: [],
      props: {
        mass: 1,
        hardness: 3,
        toughness: 2,
        meltsAt: 4,
        solubility: 4,
        stickiness: 4,
        perishability: 1,
        scent: 1,
        setting: 4,
      },
    },
    {
      // Carved, seasoned wood: a bowl and its handle.
      id: "wood",
      name: "carved wood",
      kind: "material",
      forms: ["grained", "hollow"],
      props: {
        mass: 1,
        size: 1,
        hardness: 3,
        toughness: 3,
        flexibility: 1,
        flammability: 3,
        absorbency: 2,
        porosity: 1,
        buoyancy: 4,
        friction: 3,
      },
      burnsTo: "ash",
    },
    {
      id: "berries",
      name: "dark berries",
      kind: "material",
      forms: ["round"],
      moist: 3,
      props: { mass: 0, size: 0, hardness: 0, toughness: 1, perishability: 4, scent: 1 },
      serves: { hunger: 1 },
    },
    {
      id: "juice",
      name: "berry juice",
      kind: "material",
      forms: ["liquid"],
      props: { mass: 2, conductivity: 2, stickiness: 1, perishability: 3, scent: 1 },
    },
  ],
  places: [
    // A sun-baked ridge in midsummer: hot, bone dry, a steady breeze.
    placeRow("ridge", { temperature: 4, moisture: 0, wind: 2 }),
    // A hollow standing in floodwater through a rainy night.
    placeRow("hollow", { temperature: 1, moisture: 5, wind: 1 }),
    // The same ground the next day, in the sun.
    placeRow("sun", { temperature: 3, moisture: 1, wind: 2 }),
    // A smokehouse shed in humid weather: close and still.
    placeRow("shed", { temperature: 2, moisture: 4, wind: 0 }),
    // In the river: cold, and as wet as a place can be.
    placeRow("river", { temperature: 1, moisture: 5, wind: 1 }),
  ],
};
