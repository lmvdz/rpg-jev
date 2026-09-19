/**
 * Rows and places for batch C's craft scenarios (a settlement's crafts over a year), beyond the
 * shared ones. Written once from the anchors of `spikes/vocabulary/VOCABULARY.md`, before any
 * test was run, and not tuned to make an outcome derive. Reused from the shared rows: `iron`
 * (the bar), `steel` (the blade, the chisel, the axe), `flint` (the scraper), `salt`, `water`,
 * `rope` (the well rope), `stone`.
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      // Dug, wedged potter's clay, and the pot thrown from it: a step stiffer than mud, brittle
      // when dry, and it sets for good (the P23 anchor names clay).
      id: "potclay",
      name: "potter's clay",
      kind: "material",
      forms: ["hollow"],
      moist: 3,
      props: {
        mass: 2,
        size: 1,
        hardness: 1,
        toughness: 1,
        flexibility: 3,
        absorbency: 3,
        porosity: 1,
        stickiness: 2,
        setting: 5,
      },
    },
    {
      // The bank the clay is dug from: the same stuff, by the cartload.
      id: "claybank",
      name: "a bank of clay",
      kind: "material",
      forms: [],
      moist: 3,
      props: {
        mass: 5,
        size: 5,
        hardness: 1,
        toughness: 1,
        flexibility: 3,
        absorbency: 3,
        porosity: 1,
        stickiness: 2,
        setting: 5,
      },
    },
    {
      // A wooden spade shod with iron: the shoe is what meets the ground.
      id: "spade",
      name: "an iron-shod spade",
      kind: "thing",
      forms: ["edged", "flat", "long"],
      props: { mass: 2, size: 3, hardness: 4, toughness: 4, conductivity: 3, corrodibility: 3 },
    },
    {
      // A split, seasoned log.
      id: "firewood",
      name: "a split dry log",
      kind: "material",
      forms: ["grained", "long"],
      props: { mass: 2, size: 2, hardness: 3, toughness: 3, flammability: 3, absorbency: 2 },
      burnsTo: "ash",
    },
    {
      // Light, brittle, and burns readily once it is going.
      id: "charcoal",
      name: "charcoal",
      kind: "material",
      forms: [],
      props: { mass: 1, size: 1, hardness: 1, toughness: 0, flammability: 3, absorbency: 2 },
      burnsTo: "ash",
    },
    {
      // A smith's hammer head: steel, a stone's weight.
      id: "hammer",
      name: "a smith's hammer",
      kind: "thing",
      forms: [],
      props: {
        mass: 3,
        size: 2,
        hardness: 5,
        toughness: 4,
        conductivity: 5,
        meltsAt: 1,
        corrodibility: 4,
      },
    },
    {
      // A fresh deer hide, fleshed or not: leather's toughness, raw meat's appetite for rot less
      // one step, and as wet as flesh is.
      id: "rawhide",
      name: "a fresh hide",
      kind: "material",
      forms: ["sheet"],
      moist: 3,
      props: {
        mass: 2,
        size: 3,
        hardness: 1,
        toughness: 4,
        flexibility: 4,
        flammability: 1,
        absorbency: 3,
        porosity: 1,
        perishability: 4,
        scent: 2,
      },
    },
    {
      // The fat and flesh that cling to the inside of a hide: a coat (S7), greasy and perishable.
      id: "fleshing",
      name: "fat and flesh",
      kind: "material",
      forms: [],
      props: { mass: 1, stickiness: 2, oiliness: 3, perishability: 5, scent: 2 },
    },
    {
      // Sweet wort: water with sugar in it, which is what makes it perish like milk.
      id: "wort",
      name: "sweet wort",
      kind: "material",
      forms: ["liquid"],
      props: { mass: 2, conductivity: 2, stickiness: 1, perishability: 4, scent: 1 },
      serves: { hunger: 1 },
    },
    {
      id: "malt",
      name: "malted grain",
      kind: "material",
      forms: ["granular"],
      props: {
        mass: 1,
        size: 0,
        hardness: 2,
        toughness: 1,
        flammability: 2,
        absorbency: 3,
        porosity: 3,
        perishability: 2,
      },
      serves: { hunger: 1 },
    },
    {
      // Bread dough: soft, sticky, wet, alive, and it sets when baked (the P23 anchor names dough).
      id: "dough",
      name: "bread dough",
      kind: "material",
      forms: [],
      moist: 3,
      props: {
        mass: 1,
        size: 1,
        hardness: 0,
        toughness: 1,
        flexibility: 4,
        flammability: 2,
        conductivity: 1,
        absorbency: 3,
        stickiness: 3,
        perishability: 3,
        setting: 5,
      },
      serves: { hunger: 1 },
    },
    {
      // A masonry dome: heavy, hard, slow to pass heat, which is why it holds it.
      id: "oven",
      name: "a bread oven",
      kind: "thing",
      forms: ["hollow"],
      props: { mass: 5, size: 4, hardness: 4, toughness: 2, conductivity: 1 },
    },
    {
      // One spun woollen warp thread: a cord, less tough than rope, and wool is slow to burn.
      id: "yarn",
      name: "a woollen thread",
      kind: "material",
      forms: ["cord"],
      props: {
        mass: 0,
        size: 1,
        hardness: 0,
        toughness: 3,
        flexibility: 5,
        flammability: 2,
        absorbency: 4,
        porosity: 3,
      },
    },
    {
      // A fired clay ring that hangs on the warp: a loaf's weight.
      id: "loomweight",
      name: "a loom weight",
      kind: "thing",
      forms: ["round"],
      props: { mass: 1, size: 1, hardness: 3, toughness: 1 },
    },
    {
      // A standing oak in leaf: the shared oak, green, so born wet.
      id: "oaktree",
      name: "a standing oak",
      kind: "plant",
      forms: ["grained", "long"],
      moist: 3,
      props: {
        mass: 5,
        size: 5,
        hardness: 3,
        toughness: 4,
        flammability: 2,
        absorbency: 2,
        porosity: 1,
        perishability: 1,
        swell: 3,
      },
      burnsTo: "ash",
    },
    {
      // A hewn oak timber, a size and a weight down from the tree. Green when fresh (moist);
      // seasoned is the same row dried.
      id: "oaktimber",
      name: "an oak timber",
      kind: "material",
      forms: ["grained", "long"],
      moist: 3,
      props: {
        mass: 4,
        size: 4,
        hardness: 3,
        toughness: 4,
        flammability: 2,
        absorbency: 2,
        porosity: 1,
        perishability: 1,
        swell: 3,
      },
      burnsTo: "ash",
    },
    {
      // A seasoned pole: a rafter, an axle. Wood barely perishes, but it does.
      id: "pole",
      name: "a seasoned pole",
      kind: "material",
      forms: ["grained", "long"],
      props: {
        mass: 3,
        size: 3,
        hardness: 3,
        toughness: 4,
        flammability: 2,
        absorbency: 2,
        porosity: 1,
        perishability: 1,
      },
      burnsTo: "ash",
    },
    {
      // A split fence rail: lighter and less tough than a pole.
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
        perishability: 1,
      },
      burnsTo: "ash",
    },
    {
      // Mud and chopped straw, well mixed. It spreads as the shared mud does (grains), it is
      // stickier, and it sets (the P23 anchor names daub). The straw is its toughness.
      id: "daub",
      name: "daub",
      kind: "material",
      forms: ["granular"],
      moist: 3,
      props: {
        mass: 2,
        hardness: 1,
        toughness: 2,
        absorbency: 3,
        solubility: 1,
        stickiness: 3,
        setting: 5,
      },
    },
    {
      // The same with too little straw: nothing to hold it together as it shrinks.
      id: "leandaub",
      name: "daub short of straw",
      kind: "material",
      forms: ["granular"],
      moist: 3,
      props: {
        mass: 2,
        hardness: 1,
        toughness: 0,
        absorbency: 3,
        solubility: 1,
        stickiness: 3,
        setting: 5,
      },
    },
    {
      // A woven hazel panel: springy, open, and it burns.
      id: "wattle",
      name: "a wattle panel",
      kind: "thing",
      forms: ["flat", "grained"],
      props: {
        mass: 3,
        size: 4,
        hardness: 2,
        toughness: 4,
        flexibility: 2,
        flammability: 3,
        absorbency: 2,
        porosity: 4,
      },
      burnsTo: "ash",
    },
    {
      // A reed thatch roof. The row is the dry baseline: a step short of tinder.
      id: "thatch",
      name: "a thatched roof",
      kind: "thing",
      forms: ["sheet"],
      props: {
        mass: 3,
        size: 4,
        hardness: 1,
        toughness: 2,
        flexibility: 3,
        flammability: 4,
        absorbency: 3,
        porosity: 3,
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
      id: "snow",
      name: "fallen snow",
      kind: "material",
      forms: ["granular"],
      props: { mass: 1, size: 2, hardness: 0, toughness: 0, conductivity: 1, meltsAt: 5 },
    },
    {
      // A goat as a weight: load asks only for mass.
      id: "goat",
      name: "a goat, as a weight",
      kind: "creature",
      forms: [],
      props: { mass: 3, size: 3, hardness: 1, toughness: 2 },
    },
    {
      // Threshed grain. The row is the dry baseline; grain brought in damp says so in wetness.
      id: "grain",
      name: "threshed grain",
      kind: "material",
      forms: ["granular"],
      props: {
        mass: 1,
        size: 0,
        hardness: 2,
        toughness: 1,
        flammability: 2,
        absorbency: 2,
        porosity: 3,
        perishability: 2,
      },
      serves: { hunger: 2 },
    },
    {
      id: "bucket",
      name: "a wooden bucket",
      kind: "thing",
      forms: ["hollow"],
      props: { mass: 2, size: 2, hardness: 2, toughness: 3, absorbency: 2, buoyancy: 4 },
    },
    {
      // The cart's body, as the weight the axle carries.
      id: "cartbody",
      name: "a cart body",
      kind: "thing",
      forms: ["hollow"],
      props: { mass: 4, size: 4, hardness: 3, toughness: 4 },
    },
    {
      // A rutted road: packed earth and stone, as what a falling pot lands on.
      id: "road",
      name: "a rutted road",
      kind: "place",
      forms: ["flat"],
      props: { mass: 5, size: 5, hardness: 3, toughness: 2, friction: 4 },
    },
  ],
  places: [
    // A wet pit by the stream, clay-bearing.
    placeRow("claypit", { moisture: 3, abundance: { potclay: 4 } }),
    // A tanning yard in a close, warm spell: soaking pits keep its air a step damp.
    placeRow("tanyard", { temperature: 3, moisture: 3 }),
    // The same warm spell on a dry, breezy rack, for comparison.
    placeRow("dryrack", { temperature: 3, moisture: 1, wind: 2 }),
    // By the brewhouse hearth in midsummer.
    placeRow("hearthside", { temperature: 3 }),
    // A bakehouse on a cold morning, and on a warm one.
    placeRow("coldbake", { temperature: 1 }),
    placeRow("warmbake", { temperature: 3 }),
    // A house frame standing in the open from late spring: mild, a breeze.
    placeRow("frameyard", { wind: 2 }),
    // A hot, dry week on a house wall.
    placeRow("hotweek", { temperature: 3, moisture: 1, wind: 2 }),
    // Under thin thatch through a wet winter, and under a sound roof in the same winter.
    placeRow("leakyroof", { temperature: 1, moisture: 4 }),
    placeRow("soundroof", { temperature: 1 }),
    // A row of thatch after weeks without rain, in wind; the same row in still air; and the
    // same row after rain.
    placeRow("dryrow", { temperature: 3, moisture: 0, wind: 4 }),
    placeRow("stillrow", { temperature: 3, moisture: 0, wind: 0 }),
    placeRow("wetrow", { moisture: 5 }),
    // A shut grain bin in an undercroft kept dry: still air, little of it.
    placeRow("bin", { wind: 0, air: 1 }),
  ],
};
