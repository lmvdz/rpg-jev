/**
 * Rows for the beast and folk scenarios (`a-beast-folk.test.ts`). Written once, from the
 * anchors of `spikes/vocabulary/VOCABULARY.md`, before anything was run. A sack is the
 * shared `cloth`, a carcass the shared `meat`, a knife the shared `blade`.
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      id: "firewood",
      name: "a split log",
      kind: "material",
      forms: ["grained", "long"],
      props: { mass: 2, size: 2, hardness: 3, toughness: 3, flammability: 3, absorbency: 2 },
      burnsTo: "ash",
    },
    {
      id: "jerky",
      name: "dried meat",
      kind: "material",
      forms: [],
      props: { mass: 1, size: 1, hardness: 1, toughness: 3, perishability: 1, scent: 2 },
      serves: { hunger: 3 },
    },
    {
      id: "tooth",
      name: "a small predator's teeth",
      kind: "thing",
      forms: ["pointed", "edged"],
      props: { mass: 0, size: 0, hardness: 3, toughness: 2 },
    },
    {
      id: "tusk",
      name: "a tusk",
      kind: "thing",
      forms: ["pointed"],
      props: { mass: 1, size: 1, hardness: 3, toughness: 3 },
    },
    {
      id: "beak",
      name: "a small bird's beak",
      kind: "thing",
      forms: ["pointed"],
      props: { mass: 0, size: 0, hardness: 2, toughness: 2 },
    },
    {
      id: "deer",
      name: "a deer",
      kind: "creature",
      forms: [],
      props: { mass: 4, size: 3, hardness: 1, toughness: 2 },
    },
    {
      id: "rabbit",
      name: "a rabbit",
      kind: "creature",
      forms: [],
      props: { mass: 2, size: 1, hardness: 1, toughness: 2 },
    },
    {
      id: "person",
      name: "a grown person",
      kind: "person",
      forms: [],
      props: { mass: 4, size: 3, hardness: 1, toughness: 2 },
    },
    {
      id: "snareline",
      name: "a snare of thin cord",
      kind: "thing",
      forms: ["cord"],
      props: {
        mass: 0,
        size: 1,
        hardness: 1,
        toughness: 3,
        flexibility: 5,
        flammability: 3,
        absorbency: 3,
      },
    },
    {
      id: "thong",
      name: "a leather purse string",
      kind: "thing",
      forms: ["cord"],
      props: { mass: 0, size: 1, hardness: 1, toughness: 4, flexibility: 5, absorbency: 3 },
    },
    {
      id: "egg",
      name: "a small bird's egg",
      kind: "thing",
      forms: ["hollow", "round"],
      moist: 3,
      props: { mass: 0, size: 0, hardness: 2, toughness: 0, perishability: 4 },
      serves: { hunger: 1 },
    },
    {
      id: "hand",
      name: "a hand",
      kind: "thing",
      forms: [],
      props: { mass: 1, size: 1, hardness: 1, toughness: 2, flexibility: 3 },
    },
    {
      id: "cheese",
      name: "cheese",
      kind: "material",
      forms: [],
      props: { mass: 1, size: 1, hardness: 1, toughness: 1, perishability: 2, scent: 2 },
      serves: { hunger: 2 },
    },
    {
      id: "plank",
      name: "a floor plank",
      kind: "thing",
      forms: ["flat", "long", "grained"],
      props: { mass: 2, size: 2, hardness: 3, toughness: 4, flammability: 2, absorbency: 2 },
    },
  ],
  places: [placeRow("clearing"), placeRow("camp", { temperature: 1 }), placeRow("street")],
};
