/**
 * Rows and places for the grow and find scenarios of batch A, written once from the anchors
 * of `spikes/vocabulary/VOCABULARY.md` before anything was run. Shared rows are reused where
 * they fit (stone, iron, water, cloth, the grass and quarry places).
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      // A whole fruit: keeps far better than meat or bread, and still rots.
      id: "apple",
      name: "apple",
      kind: "plant",
      forms: ["round"],
      moist: 2,
      props: {
        mass: 1,
        size: 1,
        hardness: 1,
        toughness: 1,
        absorbency: 1,
        perishability: 3,
        scent: 1,
      },
      serves: { hunger: 1 },
    },
    {
      // Dry seed: close to the bottom of perishability, since kept dry it keeps for years.
      id: "seed",
      name: "dry seed",
      kind: "plant",
      forms: ["granular"],
      props: { mass: 0, size: 0, hardness: 2, toughness: 2, absorbency: 2, perishability: 1 },
    },
    {
      // A bed of clay-heavy soil: bulky, soft as mud, thirsty, and dense so little gets through.
      id: "claysoil",
      name: "clay soil",
      kind: "material",
      forms: ["granular"],
      props: {
        mass: 5,
        size: 4,
        hardness: 0,
        toughness: 0,
        absorbency: 4,
        porosity: 1,
        stickiness: 2,
      },
    },
    {
      // Stone in the mass: the shared stone's hardness and toughness at the size of a rock face.
      id: "bedrock",
      name: "living rock",
      kind: "material",
      forms: [],
      props: { mass: 5, size: 5, hardness: 4, toughness: 1 },
    },
    {
      id: "morel",
      name: "field mushroom",
      kind: "plant",
      forms: [],
      moist: 3,
      props: { mass: 0, size: 0, hardness: 0, toughness: 1, perishability: 4, scent: 1 },
      serves: { hunger: 1 },
    },
    {
      id: "worm",
      name: "earthworm",
      kind: "creature",
      forms: ["long"],
      moist: 3,
      props: { mass: 0, size: 0, hardness: 0, toughness: 1, flexibility: 4, perishability: 4 },
      serves: { hunger: 1 },
    },
    {
      id: "bone",
      name: "old bone",
      kind: "material",
      forms: ["long"],
      props: { mass: 1, size: 1, hardness: 3, toughness: 2, porosity: 1 },
    },
    {
      id: "fish",
      name: "river fish",
      kind: "creature",
      forms: [],
      moist: 3,
      props: { mass: 1, size: 1, hardness: 0, toughness: 2, perishability: 5, scent: 2 },
      serves: { hunger: 3 },
    },
  ],
  places: [
    // Tilled, damp garden ground in a mild season.
    placeRow("garden", { moisture: 3 }),
    // A kitchen garden bed in ordinary air: nothing but the soil holds the water.
    placeRow("beanrow"),
    // A dry cellar shelf: cold, and not damp.
    placeRow("shelf", { temperature: 1 }),
    // Early winter ground: cold, dry, not frozen.
    placeRow("coldbed", { temperature: 1 }),
    // Open grassland with scattered half-buried stones: uncommon, not absent.
    placeRow("turf", { abundance: { stone: 2 } }),
    // A known mushroom patch after rain: fairly common this week, easy to walk past.
    placeRow("forest", { moisture: 4, abundance: { morel: 3 } }),
    // A farmland stream: gravel in plenty, and never any gold.
    placeRow("stream", { moisture: 5, abundance: { stone: 3, gold: 0 } }),
    // Damp soil by an old compost pit: worms are common; a buried bone is a rare thing.
    placeRow("wormbed", { moisture: 3, abundance: { worm: 4, bone: 1 } }),
    // A slow bend that holds some fish.
    placeRow("river", { moisture: 5, abundance: { fish: 2 } }),
    // A pool known locally as reliable.
    placeRow("pool", { moisture: 5, abundance: { fish: 4 } }),
  ],
};
