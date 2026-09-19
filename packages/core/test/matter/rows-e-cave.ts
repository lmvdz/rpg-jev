/**
 * Rows for the cave scenarios of batch E (`e-cave.json`), beside the shared ones. Written once
 * from the anchors of `spikes/vocabulary/VOCABULARY.md`, before any test ran, and not tuned
 * afterwards. The shared `oil`, `rope`, `tinder`, `water`, `stone`, `iron`, `steel`, `flint`,
 * `cloth`, `meat` and `ash` are reused, and the shared `cellar` is the farmhouse cellar.
 *
 * A row is the thing whole, dry, mild and full grown (principle 1). An oil lamp is its fired
 * clay, and the oil in it is a coat of the shared `oil` on the instance: the engine has no
 * contents (S8), and a coat is the only oil a thing can carry and burn. Candles are so many of
 * `tallow`, and the grease on a rope is a coat of the same. A level of mass is a step of four
 * (scale.ts) with a grown person at 4, so a ewe of fifty kilos is nearer 4 than 3, and a sack
 * of ore that a climber can carry is 3. Buoyancy and friction are set where the anchors give
 * them, though no rule reads either.
 *
 * Places: underground is cold (1), still (wind 0) and dark (light 0). Seeping rock is moisture
 * 4, a damp level or a streamside chamber 3, a dry cave 2, under water 5. Air is R6 for the
 * place: 5 open, 2 a blind heading, 0 the foul air pooled in a well. A shaft and the ground at
 * its head are two places, since one place has one light and one air.
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      // A grown person: a weight when borne, the row of a body when a body's element.
      id: "person",
      name: "a person",
      kind: "person",
      forms: [],
      props: { mass: 4, size: 3, hardness: 1, toughness: 2, flexibility: 2, buoyancy: 2 },
    },
    {
      // A small open lamp of fired clay, carried in the hand.
      id: "lamp",
      name: "an oil lamp",
      kind: "thing",
      forms: ["hollow"],
      props: { mass: 1, size: 1, hardness: 3, toughness: 1, conductivity: 1 },
    },
    {
      // A spare lamp wick, dry: a twist of soft cord, all thirst.
      id: "wick",
      name: "a dry lamp wick",
      kind: "thing",
      forms: ["cord"],
      props: { mass: 0, size: 0, toughness: 2, flexibility: 5, flammability: 4, absorbency: 5 },
      burnsTo: "ash",
    },
    {
      // A round oak prop set under a mine roof, seasoned. Wood does rot, slowly.
      id: "pitprop",
      name: "an oak pit prop",
      kind: "thing",
      forms: ["grained", "long"],
      props: {
        mass: 3,
        size: 3,
        hardness: 3,
        toughness: 4,
        flammability: 2,
        absorbency: 2,
        perishability: 1,
      },
      burnsTo: "ash",
    },
    {
      // A slab of slabby roof rock the size of a cart.
      id: "roofslab",
      name: "a slab of roof rock",
      kind: "material",
      forms: ["flat"],
      props: { mass: 5, size: 4, hardness: 4, toughness: 1, conductivity: 1 },
    },
    {
      // A plank wheelbarrow.
      id: "barrow",
      name: "a wooden wheelbarrow",
      kind: "thing",
      forms: ["hollow", "grained"],
      props: { mass: 3, size: 3, hardness: 3, toughness: 3, flammability: 3, absorbency: 2 },
      burnsTo: "ash",
    },
    {
      // Limestone in the mass: a ledge, a lip, a wall. Softer than the shared stone.
      id: "limestone",
      name: "limestone",
      kind: "material",
      forms: ["flat"],
      props: { mass: 5, size: 4, hardness: 3, toughness: 1, conductivity: 1, friction: 4 },
    },
    {
      // The walls of a squeeze, set with sharp flakes: the same rock, with an edge to it.
      id: "sharprock",
      name: "a wall of sharp rock flakes",
      kind: "material",
      forms: ["edged"],
      props: { mass: 5, size: 4, hardness: 3, toughness: 1, conductivity: 1, friction: 5 },
    },
    {
      id: "jackdaw",
      name: "a jackdaw",
      kind: "creature",
      forms: [],
      props: { mass: 1, size: 1, hardness: 1, toughness: 2 },
      body: {
        eats: { seed: 4, flesh: 3, fruit: 3 },
        strength: 1,
        speed: 5,
        sight: 4,
        hearing: 3,
        smell: 1,
      },
    },
    {
      // Poor eyes, a good ear and a better nose, and it eats nearly anything.
      id: "rat",
      name: "a rat",
      kind: "creature",
      forms: [],
      props: { mass: 1, size: 1, hardness: 1, toughness: 2, scent: 2 },
      body: {
        eats: { seed: 5, fruit: 4, flesh: 3, leaf: 2 },
        strength: 1,
        speed: 3,
        sight: 1,
        hearing: 4,
        smell: 4,
      },
    },
    {
      // A rodent's incisors gnaw wood and lead. Their keenness is the instance's edge.
      id: "ratteeth",
      name: "a rat's teeth",
      kind: "thing",
      forms: ["pointed", "edged"],
      props: { mass: 0, size: 0, hardness: 4, toughness: 2 },
    },
    {
      // Rendered fat: a candle, or the grease on a rope. It feeds what eats flesh, and P8 and
      // P21's anchors for 5 are this kind of thing. The amount is how many candles.
      id: "tallow",
      name: "tallow",
      kind: "material",
      forms: ["long"],
      props: {
        mass: 0,
        size: 1,
        hardness: 1,
        toughness: 1,
        flammability: 3,
        meltsAt: 5,
        stickiness: 1,
        perishability: 2,
        scent: 2,
        oiliness: 5,
        buoyancy: 4,
      },
      serves: { hunger: 2 },
      fare: "flesh",
    },
    {
      // Dry oat bread: it smells a little, as bread does. The amount is how many loaves.
      id: "oatbread",
      name: "oat bread",
      kind: "material",
      forms: [],
      moist: 1,
      props: {
        mass: 1,
        size: 1,
        hardness: 1,
        toughness: 1,
        absorbency: 4,
        perishability: 3,
        scent: 1,
      },
      serves: { hunger: 2 },
      fare: "seed",
    },
    {
      // A candle box of thin deal boards: softer than oak.
      id: "dealbox",
      name: "a deal box",
      kind: "thing",
      forms: ["hollow", "grained"],
      props: { mass: 1, size: 2, hardness: 2, toughness: 3, flammability: 3, absorbency: 2 },
      burnsTo: "ash",
    },
    {
      // A lidded tin of tinned iron sheet.
      id: "tin",
      name: "a tin",
      kind: "thing",
      forms: ["hollow"],
      props: {
        mass: 1,
        size: 1,
        hardness: 4,
        toughness: 4,
        conductivity: 5,
        meltsAt: 1,
        corrodibility: 3,
      },
    },
    {
      // A canvas pack on a frame of sticks.
      id: "pack",
      name: "a framed canvas pack",
      kind: "thing",
      forms: [],
      props: {
        mass: 2,
        size: 2,
        hardness: 1,
        toughness: 3,
        flexibility: 2,
        flammability: 3,
        absorbency: 3,
      },
    },
    {
      // A sack of wheat flour: sackcloth outside, and dry flour keeps.
      id: "floursack",
      name: "a sack of flour",
      kind: "thing",
      forms: [],
      props: {
        mass: 3,
        size: 2,
        hardness: 0,
        toughness: 3,
        flexibility: 3,
        flammability: 3,
        absorbency: 4,
        porosity: 2,
        buoyancy: 1,
        perishability: 2,
      },
      serves: { hunger: 2 },
      fare: "seed",
    },
    {
      // A sack of broken ore, as much as a climber can carry.
      id: "oresack",
      name: "a sack of ore",
      kind: "thing",
      forms: [],
      props: { mass: 3, size: 2, hardness: 2, toughness: 3, flexibility: 2 },
    },
    {
      // Dry split wood. The amount is how many.
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
      // The face of a level in hard quartzy rock: as hard as the scale goes, and brittle.
      id: "quartzface",
      name: "a face of quartzy rock",
      kind: "material",
      forms: ["flat"],
      props: { mass: 5, size: 5, hardness: 5, toughness: 1, conductivity: 1 },
    },
    {
      id: "pick",
      name: "an iron pick",
      kind: "thing",
      forms: ["pointed", "long"],
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
      id: "hammer",
      name: "a miner's hammer",
      kind: "thing",
      forms: [],
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
      // Solid country rock between two levels.
      id: "minerock",
      name: "solid rock",
      kind: "material",
      forms: [],
      props: { mass: 5, size: 5, hardness: 4, toughness: 1, conductivity: 1 },
    },
    {
      // A block of fallen rock, more than a person lifts.
      id: "block",
      name: "a block of fallen rock",
      kind: "material",
      forms: [],
      props: { mass: 5, size: 3, hardness: 4, toughness: 1 },
    },
    {
      id: "ewe",
      name: "a ewe",
      kind: "creature",
      forms: [],
      props: { mass: 4, size: 2, hardness: 1, toughness: 2, scent: 3 },
      body: { eats: { leaf: 5 }, strength: 1, speed: 3, sight: 3, hearing: 3, smell: 3 },
      serves: { hunger: 3 },
      fare: "flesh",
    },
    {
      // A stand of bracken, waist high and green.
      id: "bracken",
      name: "bracken",
      kind: "plant",
      forms: [],
      moist: 2,
      props: {
        mass: 1,
        size: 2,
        hardness: 1,
        toughness: 3,
        flexibility: 3,
        flammability: 2,
        absorbency: 2,
      },
      fare: "leaf",
    },
    {
      // An oak bucket with iron hoops and a bail: the iron takes from the oak's lift.
      id: "bucket",
      name: "an oak bucket",
      kind: "thing",
      forms: ["hollow", "grained"],
      props: {
        mass: 1,
        size: 2,
        hardness: 3,
        toughness: 3,
        flammability: 3,
        absorbency: 2,
        buoyancy: 3,
      },
      burnsTo: "ash",
    },
  ],
  places: [
    // cave-01: the ground at the well head, the open shaft, the last of the air above the foul
    // layer, and the foul air pooled over black water and rotting leaves.
    placeRow("wellhead"),
    placeRow("wellshaft", { temperature: 1, moisture: 3, wind: 0, air: 3, light: 1 }),
    placeRow("wellmid", { temperature: 1, moisture: 3, wind: 0, air: 1, light: 0 }),
    placeRow("wellbottom", { temperature: 1, moisture: 4, wind: 0, air: 0, light: 0 }),
    // cave-02: a worked-out level, wet-walled and close.
    placeRow("tinlevel", { temperature: 1, moisture: 4, wind: 0, air: 2, light: 0 }),
    // cave-03: the moor at the lip, and the pothole under it.
    placeRow("moor", { wind: 2 }),
    placeRow("pothole", { temperature: 1, moisture: 3, wind: 0, light: 0, noise: 0 }),
    // cave-04: a dry store in the side of an adit, at night.
    placeRow("adit", { temperature: 1, wind: 0, light: 0, noise: 0 }),
    // cave-05: a dry rift in limestone.
    placeRow("rift", { temperature: 1, wind: 0, light: 0, noise: 0 }),
    // cave-06: the moor in heavy rain, the low crawl by the stream, the chamber beyond it.
    placeRow("rainmoor", { moisture: 5, wind: 2 }),
    placeRow("crawl", { temperature: 1, moisture: 4, wind: 1, light: 0, noise: 2 }),
    placeRow("chamber", { temperature: 1, moisture: 3, wind: 1, light: 0, noise: 2 }),
    // cave-07: a long dry cave, an hour from daylight.
    placeRow("drycave", { temperature: 1, wind: 0, light: 0, noise: 0 }),
    // cave-09: the head of a pitch inside a cave.
    placeRow("pitchhead", { temperature: 1, moisture: 3, wind: 0, light: 0 }),
    // cave-10: the blind end of a copper level, a rill in the gutter.
    placeRow("copperlevel", { temperature: 1, moisture: 3, wind: 0, air: 2, light: 0 }),
    // cave-11: hill grazing in warm weather, the shaft under it, the fields, the spring.
    placeRow("hill", { temperature: 3, wind: 2 }),
    placeRow("sheepshaft", { moisture: 3, wind: 0, light: 1 }),
    placeRow("fields", { temperature: 3, wind: 2 }),
    placeRow("spring", { moisture: 3 }),
    // cave-13: a level choked by a fall, a draught over the heap.
    placeRow("chokedlevel", { temperature: 1, moisture: 3, wind: 1, light: 0 }),
    // cave-14: the head of a draw-well, and its black water.
    placeRow("drawwell"),
    placeRow("wellwater", { temperature: 1, moisture: 5, wind: 0, light: 0 }),
    // cave-15: two levels side by side through solid rock, one closed by a fall.
    placeRow("closedlevel", { temperature: 1, moisture: 3, wind: 0, air: 2, light: 0, noise: 0 }),
    placeRow("nextlevel", { temperature: 1, moisture: 3, wind: 0, light: 0, noise: 0 }),
  ],
};
