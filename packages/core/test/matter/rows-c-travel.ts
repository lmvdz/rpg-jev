/**
 * Rows for the travel scenarios of batch C (`c-travel.json`), beside the shared ones. Written
 * once from the anchors of `spikes/vocabulary/VOCABULARY.md`, before any test ran, and not
 * tuned afterwards. The shared `water`, `stone`, `rope`, `mud` and `ash` are reused.
 *
 * A row is the thing whole, dry, mild and full grown (principle 1): green wood is wood with
 * `moist`, not a wood that burns badly. A person and a pack animal appear only as weights,
 * because the engine has no body row: their levels are mass and bulk and nothing else.
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      // A seasoned walking staff: chosen wood, as thick as a thumb and as tall as its owner.
      id: "staff",
      name: "a walking staff",
      kind: "thing",
      forms: ["grained", "long"],
      props: {
        mass: 2,
        size: 3,
        hardness: 3,
        toughness: 4,
        flexibility: 1,
        flammability: 3,
        absorbency: 2,
        buoyancy: 4,
        friction: 3,
      },
      burnsTo: "ash",
    },
    {
      // The skin of matted grass and reed over a pool: a wide wet sheet, soft and not strong.
      id: "reedmat",
      name: "a mat of grass and reed",
      kind: "plant",
      forms: ["sheet"],
      moist: 3,
      props: {
        mass: 1,
        size: 3,
        hardness: 0,
        toughness: 2,
        flexibility: 4,
        flammability: 3,
        absorbency: 4,
        porosity: 3,
        buoyancy: 4,
        perishability: 1,
      },
      burnsTo: "ash",
    },
    {
      // What a body digs and strikes with when it holds nothing: flesh, as levels.
      id: "hand",
      name: "bare hands",
      kind: "thing",
      forms: [],
      props: { mass: 1, size: 1, hardness: 1, toughness: 2, flexibility: 3 },
    },
    {
      id: "person",
      name: "a person, as a weight",
      kind: "person",
      forms: [],
      props: { mass: 4, size: 3, hardness: 1, toughness: 2 },
    },
    {
      id: "mule",
      name: "a pack animal, as a weight",
      kind: "creature",
      forms: [],
      props: { mass: 5, size: 4, hardness: 1, toughness: 3 },
    },
    {
      // The same cordage as the shared rope, a tree's height of it: only the length differs.
      id: "longrope",
      name: "a long rope",
      kind: "thing",
      forms: ["cord"],
      props: {
        mass: 2,
        size: 5,
        hardness: 1,
        toughness: 5,
        flexibility: 5,
        flammability: 3,
        absorbency: 4,
      },
    },
    {
      // A short length of the same cordage, tying a pack to a saddle.
      id: "lashing",
      name: "a lashing",
      kind: "thing",
      forms: ["cord"],
      props: {
        mass: 0,
        size: 2,
        hardness: 1,
        toughness: 5,
        flexibility: 5,
        flammability: 3,
        absorbency: 4,
      },
    },
    {
      // Water with salt in it: nothing alive in it, and it harms a little whoever drinks it.
      id: "seawater",
      name: "sea water",
      kind: "material",
      forms: ["liquid"],
      props: { mass: 2, conductivity: 2, swell: 3, noxiousness: 2, corrodibility: 0 },
    },
    {
      id: "driftwood",
      name: "driftwood",
      kind: "thing",
      forms: ["grained", "long"],
      props: {
        mass: 2,
        size: 2,
        hardness: 2,
        toughness: 2,
        flammability: 3,
        absorbency: 3,
        porosity: 2,
        buoyancy: 4,
      },
      burnsTo: "ash",
    },
    {
      // A canvas pack with what is in it, as one thing: the engine has no contents.
      id: "pack",
      name: "a supply pack",
      kind: "thing",
      forms: ["hollow"],
      props: {
        mass: 3,
        size: 2,
        hardness: 0,
        toughness: 3,
        flexibility: 3,
        flammability: 3,
        absorbency: 3,
        porosity: 2,
        buoyancy: 2,
      },
    },
    {
      // What a search for water turns up, if it turns anything up: water, where it rises.
      id: "spring",
      name: "a spring",
      kind: "material",
      forms: ["liquid"],
      props: { mass: 2, conductivity: 2, swell: 3 },
      serves: { hunger: 1 },
    },
    {
      // A patch of streambed sand, damp below the crust: grains, soft, nothing holding them.
      id: "bedsand",
      name: "a patch of streambed sand",
      kind: "material",
      forms: ["granular"],
      moist: 1,
      props: { mass: 4, size: 3, hardness: 1, toughness: 0, absorbency: 3, porosity: 4 },
    },
    {
      // A brand wrapped in pitched rag: it is made to take light and to burn.
      id: "torch",
      name: "a torch",
      kind: "thing",
      forms: ["grained", "long"],
      props: {
        mass: 1,
        size: 2,
        hardness: 2,
        toughness: 2,
        flammability: 4,
        absorbency: 2,
        stickiness: 2,
        oiliness: 2,
        scent: 2,
      },
      burnsTo: "ash",
    },
    {
      id: "toolcache",
      name: "a cache of miners' tools",
      kind: "thing",
      forms: [],
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
      // Boughs cut living. P4's anchor for 5 is green wood. The sap is `moist`, not the row.
      id: "greenwood",
      name: "green wood",
      kind: "plant",
      forms: ["grained", "long"],
      moist: 3,
      props: {
        mass: 2,
        size: 2,
        hardness: 2,
        toughness: 5,
        flexibility: 2,
        flammability: 3,
        absorbency: 2,
        scent: 1,
      },
      burnsTo: "ash",
    },
    {
      // P7's anchor for 0 is wool.
      id: "woolblanket",
      name: "a wool blanket",
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
      id: "cookpot",
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
        corrodibility: 4,
      },
    },
    {
      // Food and gear for days, as one weight.
      id: "provisions",
      name: "provisions",
      kind: "thing",
      forms: [],
      props: { mass: 3, size: 2, hardness: 1, toughness: 2, perishability: 2 },
    },
  ],
  places: [
    placeRow("swamp", { moisture: 4 }),
    // Above the treeline: cold, dry, thin air, and the wind getting up.
    placeRow("pass", { temperature: 1, moisture: 1, wind: 4, air: 3 }),
    // The same height out of the wind.
    placeRow("lee", { temperature: 1, moisture: 1, wind: 0, air: 3 }),
    placeRow("shore", { moisture: 3, wind: 2 }),
    // A ring of old stones in a wide dry country, where a spring is rare if it is there at all.
    placeRow("desertedge", {
      temperature: 4,
      moisture: 0,
      wind: 2,
      extent: 4,
      abundance: { spring: 1 },
    }),
    // The same country where the spring was only ever a story.
    placeRow("storyring", {
      temperature: 4,
      moisture: 0,
      wind: 2,
      extent: 4,
      abundance: { spring: 0 },
    }),
    // Old workings: an entrance chamber and passages beyond it.
    placeRow("cave", {
      temperature: 1,
      moisture: 3,
      wind: 0,
      air: 4,
      extent: 4,
      abundance: { toolcache: 1 },
    }),
    // One chamber of the same, with the same rumour about it.
    placeRow("chamber", {
      temperature: 1,
      moisture: 3,
      wind: 0,
      air: 4,
      abundance: { toolcache: 1 },
    }),
    placeRow("ford", { temperature: 1, moisture: 4 }),
    // Waist-high grass with standing water in the low spots, and a lot of it.
    placeRow("meadow", { moisture: 4, extent: 8 }),
    // A clear frosty night on open ground, with dew.
    placeRow("hillside", { temperature: 0.5, moisture: 3 }),
    placeRow("ridge", { wind: 2 }),
  ],
};
