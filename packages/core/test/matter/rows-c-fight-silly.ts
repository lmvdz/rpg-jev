/**
 * Rows and places for batch C's fight and silly scenarios, beyond the shared ones. Written
 * once from the anchors of `spikes/vocabulary/VOCABULARY.md`, before any test was run, and not
 * tuned to make an outcome derive. Reused from the shared rows: `blade` (the knives), `iron`
 * (the plain sword), `leather` (the hide face), `cloth`, `stone`, `bough`, `mushroom`.
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      // An iron head on a short haft: light in the hand, harder than wood, not sword steel.
      id: "handaxe",
      name: "a hand axe",
      kind: "thing",
      forms: ["edged"],
      props: {
        mass: 2,
        size: 2,
        hardness: 4,
        toughness: 4,
        conductivity: 3,
        meltsAt: 1,
        corrodibility: 4,
      },
    },
    {
      // The shared steel, a size and a weight up: a heavy two-edged sword.
      id: "broadsword",
      name: "a broadsword",
      kind: "thing",
      forms: ["long", "edged", "pointed"],
      props: {
        mass: 3,
        size: 3,
        hardness: 5,
        toughness: 4,
        conductivity: 5,
        meltsAt: 1,
        corrodibility: 4,
      },
    },
    {
      // Leather boiled hard and shaped to the chest: a step harder than hide, as tough, stiff.
      id: "cuirass",
      name: "a boiled-leather cuirass",
      kind: "thing",
      forms: ["hollow", "sheet"],
      props: {
        mass: 2,
        size: 3,
        hardness: 2,
        toughness: 4,
        flexibility: 1,
        flammability: 2,
        absorbency: 2,
      },
    },
    {
      // A shield board of light wood: softer than a seasoned bough and less tough.
      id: "plank",
      name: "a shield plank",
      kind: "thing",
      forms: ["flat", "grained"],
      props: { mass: 2, size: 3, hardness: 2, toughness: 3, flammability: 2, absorbency: 2 },
      burnsTo: "ash",
    },
    {
      id: "staff",
      name: "a wooden staff",
      kind: "thing",
      forms: ["long", "grained"],
      props: { mass: 2, size: 3, hardness: 3, toughness: 4, flammability: 2, absorbency: 2 },
      burnsTo: "ash",
    },
    {
      id: "cudgel",
      name: "a cudgel",
      kind: "thing",
      forms: ["long", "grained"],
      props: { mass: 2, size: 2, hardness: 3, toughness: 4, flammability: 2, absorbency: 2 },
      burnsTo: "ash",
    },
    {
      // A light shaft with an iron head: nearly no weight, all point.
      id: "arrow",
      name: "an arrow",
      kind: "thing",
      forms: ["long", "pointed"],
      props: { mass: 0, size: 2, hardness: 4, toughness: 2, flammability: 2 },
    },
    {
      // Thin branches laid across a pit to carry a skin of needles: long, slight, not tough.
      id: "lattice",
      name: "a lattice of thin branches",
      kind: "thing",
      forms: ["long", "grained"],
      props: { mass: 1, size: 3, hardness: 2, toughness: 2, flammability: 3, absorbency: 2 },
      burnsTo: "ash",
    },
    {
      id: "needles",
      name: "pine needles",
      kind: "material",
      forms: ["granular"],
      props: { mass: 0, size: 0, flammability: 4, absorbency: 2, scent: 1 },
      burnsTo: "ash",
    },
    {
      // A grown person as a weight: load asks only for mass.
      id: "man",
      name: "a grown man",
      kind: "person",
      forms: [],
      props: { mass: 4, size: 3, hardness: 1, toughness: 2, flexibility: 2 },
    },
    {
      // Packed footpath earth: dry soil drinks, feeds nothing, and is faintly bad for you.
      id: "dirt",
      name: "packed earth",
      kind: "material",
      forms: ["granular"],
      props: {
        mass: 2,
        hardness: 0,
        absorbency: 5,
        porosity: 3,
        solubility: 1,
        perishability: 1,
        noxiousness: 1,
      },
    },
    {
      // A bear's forepaw: the weight of the arm behind it, claws of horn, not steel.
      id: "paw",
      name: "a bear's paw",
      kind: "thing",
      forms: ["pointed"],
      props: { mass: 3, size: 1, hardness: 2, toughness: 3 },
    },
    {
      // What a body strikes and grabs with when it holds nothing: flesh, as levels.
      id: "hand",
      name: "bare hands",
      kind: "thing",
      forms: [],
      props: { mass: 1, size: 1, hardness: 1, toughness: 2, flexibility: 3 },
    },
    {
      // A stick with a head of wound cloth.
      id: "torch",
      name: "a torch",
      kind: "thing",
      forms: ["long", "grained"],
      props: { mass: 1, size: 2, hardness: 2, toughness: 3, flammability: 4, absorbency: 3 },
      burnsTo: "ash",
    },
    {
      id: "straw",
      name: "dry floor straw",
      kind: "material",
      forms: ["cord"],
      props: {
        mass: 0,
        size: 1,
        hardness: 0,
        toughness: 1,
        flexibility: 4,
        flammability: 4,
        absorbency: 3,
      },
      burnsTo: "ash",
    },
  ],
  places: [
    placeRow("road", { moisture: 3 }),
    placeRow("doorway"),
    placeRow("scree"),
    placeRow("heath", { wind: 4 }),
    placeRow("path"),
    placeRow("dooryard"),
    placeRow("camp", { temperature: 1 }),
    placeRow("field", { moisture: 1 }),
    placeRow("riverbank"),
    placeRow("hall", { wind: 0, air: 4 }),
  ],
};
