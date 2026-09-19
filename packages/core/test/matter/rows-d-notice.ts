/**
 * Rows for the noticing scenarios of batch D (`d-notice.json`), beside the shared ones. Written
 * once from the anchors of `spikes/vocabulary/VOCABULARY.md`, before any test ran, and not
 * tuned afterwards. The shared `oil`, `blade` and `rope` are reused.
 *
 * A row is the thing whole, dry, mild and full grown (principle 1). What lives has a body row:
 * strength, speed, and the acuity of sight, hearing and smell, 0 to 5, a person being the
 * measure the sensing tests already use (2, 2, 3, 3, 1). Scent is P19, what a nose finds at a
 * distance, whoever's nose it is: raw meat is 2 in the shared rows, so a living, sweating
 * beast or person is 2, and what is rank (a boar, a sheep in its grease, a hyena) is 3. What
 * is eaten as flesh says so (`serves`, `fare`); what is not hunted for food does not.
 *
 * A place's `light` runs 0 dark to 5 noon (night with stars is 1, as the sensing tests have
 * it, dusk, dawn and a bright moon 2, under trees at midday 4), `noise` 0 to 5 (a still night
 * 1, a river in a gorge 3, a rainstorm 4) and `cover` 0 to 5 (open ground 0, grass or scrub to
 * creep in 1, the rooms of a house 2, woods 3). Fog has no state of its own: it is written as
 * the most that can stand in the way, cover 5.
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      id: "person",
      name: "a person",
      kind: "person",
      forms: [],
      props: { mass: 4, size: 3, hardness: 1, toughness: 2, scent: 2 },
      body: { strength: 2, speed: 2, sight: 3, hearing: 3, smell: 1 },
    },
    {
      // Too young to go anywhere or lift anything.
      id: "infant",
      name: "an infant",
      kind: "person",
      forms: [],
      props: { mass: 2, size: 1, hardness: 0, toughness: 1, scent: 1 },
      body: { strength: 0, speed: 0, sight: 2, hearing: 3, smell: 2 },
    },
    {
      id: "wolf",
      name: "a wolf",
      kind: "creature",
      forms: [],
      props: { mass: 3, size: 3, hardness: 1, toughness: 3, scent: 2 },
      body: { eats: { flesh: 5 }, strength: 3, speed: 4, sight: 3, hearing: 4, smell: 5 },
    },
    {
      id: "dog",
      name: "a farm dog",
      kind: "creature",
      forms: [],
      props: { mass: 3, size: 2, hardness: 1, toughness: 3, scent: 2 },
      body: { eats: { flesh: 5, seed: 2 }, strength: 2, speed: 4, sight: 3, hearing: 5, smell: 5 },
    },
    {
      // All nose and ears, and fast: it lives by noticing first.
      id: "deer",
      name: "a deer",
      kind: "creature",
      forms: [],
      props: { mass: 4, size: 3, hardness: 1, toughness: 2, scent: 2 },
      body: { eats: { leaf: 5, fruit: 3 }, strength: 2, speed: 5, sight: 3, hearing: 4, smell: 5 },
      serves: { hunger: 3 },
      fare: "flesh",
    },
    {
      // Poor eyes, a good ear and a better nose.
      id: "boar",
      name: "a wild boar",
      kind: "creature",
      forms: [],
      props: { mass: 4, size: 3, hardness: 1, toughness: 3, scent: 3 },
      body: { strength: 3, speed: 3, sight: 2, hearing: 4, smell: 5 },
      serves: { hunger: 3 },
      fare: "flesh",
    },
    {
      // Sheep on a moor, as one body: the engine has no group with a count.
      id: "sheep",
      name: "sheep",
      kind: "creature",
      forms: [],
      props: { mass: 3, size: 2, hardness: 1, toughness: 2, scent: 3 },
      body: { eats: { leaf: 5 }, strength: 1, speed: 3, sight: 3, hearing: 3, smell: 3 },
      serves: { hunger: 3 },
      fare: "flesh",
    },
    {
      // A carrion bird of the kind that finds its food by nose, with a hawk's eye besides.
      id: "vulture",
      name: "a vulture",
      kind: "creature",
      forms: [],
      props: { mass: 2, size: 2, hardness: 1, toughness: 2, scent: 2 },
      body: { eats: { flesh: 5 }, strength: 1, speed: 4, sight: 5, hearing: 2, smell: 5 },
    },
    {
      id: "hyena",
      name: "a hyena",
      kind: "creature",
      forms: [],
      props: { mass: 3, size: 3, hardness: 1, toughness: 3, scent: 3 },
      body: { eats: { flesh: 5 }, strength: 3, speed: 4, sight: 3, hearing: 4, smell: 4 },
    },
    {
      // A whole fallen elk: raw meat by the hundredweight.
      id: "elkcarcass",
      name: "an elk carcass",
      kind: "material",
      forms: [],
      moist: 3,
      props: { mass: 5, size: 4, hardness: 0, toughness: 2, perishability: 5, scent: 2 },
      serves: { hunger: 3 },
      fare: "flesh",
    },
    {
      // Dried meat and meal in a sack, hung at the edge of a camp.
      id: "foodcache",
      name: "a food cache",
      kind: "thing",
      forms: [],
      props: { mass: 2, size: 1, hardness: 1, toughness: 2, perishability: 1, scent: 2 },
      serves: { hunger: 3 },
      fare: "flesh",
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
      // Tin and horn round a wick. It does not burn; the oil on its wick does (a coat, M6).
      id: "lantern",
      name: "a lantern",
      kind: "thing",
      forms: ["hollow"],
      props: { mass: 1, size: 1, hardness: 3, toughness: 2, conductivity: 4, meltsAt: 1 },
    },
    {
      // The lantern's shutter: a small sheet of tin.
      id: "shutter",
      name: "a lantern shutter",
      kind: "thing",
      forms: ["sheet", "flat"],
      props: { mass: 0, size: 1, hardness: 3, toughness: 3, conductivity: 5, meltsAt: 1 },
    },
    {
      // P4's anchor for 0 is a dry twig.
      id: "drytwig",
      name: "a dry fallen twig",
      kind: "thing",
      forms: ["grained", "long"],
      props: { mass: 0, size: 1, hardness: 2, toughness: 0, flammability: 4, absorbency: 3 },
      burnsTo: "ash",
    },
    {
      // What a walker comes down on things with: flesh in a leather boot.
      id: "foot",
      name: "a booted foot",
      kind: "thing",
      forms: [],
      props: { mass: 1, size: 1, hardness: 1, toughness: 3, flexibility: 2 },
    },
    {
      id: "hand",
      name: "a hand",
      kind: "thing",
      forms: [],
      props: { mass: 1, size: 1, hardness: 1, toughness: 2, flexibility: 3 },
    },
    {
      // A farmyard gate of planks on an old iron hinge.
      id: "gate",
      name: "a wooden gate",
      kind: "thing",
      forms: ["flat", "grained"],
      props: { mass: 3, size: 3, hardness: 3, toughness: 4, flammability: 2, absorbency: 2 },
    },
    {
      // Cast bronze, hung at a crossing to be heard.
      id: "bell",
      name: "a bronze bell",
      kind: "thing",
      forms: ["hollow", "round"],
      props: { mass: 3, size: 2, hardness: 4, toughness: 4, conductivity: 4, meltsAt: 1 },
    },
    {
      id: "clapper",
      name: "an iron clapper",
      kind: "thing",
      forms: ["round"],
      props: {
        mass: 1,
        size: 1,
        hardness: 4,
        toughness: 4,
        conductivity: 5,
        meltsAt: 1,
        corrodibility: 5,
      },
    },
  ],
  places: [
    // A wooded valley under a ridge, well after dark with no moon; and the same at clear noon.
    placeRow("valleynight", { light: 0, cover: 3, noise: 1, extent: 16 }),
    placeRow("valleyday", { light: 5, cover: 3, noise: 1, extent: 16 }),
    // Open scrubland round a hunting camp, by night and by day.
    placeRow("scrubnight", { light: 1, cover: 1, noise: 1, extent: 8 }),
    placeRow("scrubday", { light: 5, cover: 1, noise: 1, extent: 8 }),
    // Open grassland at dusk, a light breeze: grass enough to creep in.
    placeRow("grassdusk", { light: 2, cover: 1, noise: 1, wind: 1, extent: 8 }),
    // A farmyard at night, and the house on it, shut and dark.
    placeRow("farmyard", { light: 1, cover: 1, noise: 1 }),
    placeRow("farmhouse", { light: 0, cover: 2, noise: 1, wind: 0 }),
    // A dry forest floor at midday in still air; and open ground in the same light.
    placeRow("dryforest", { light: 4, cover: 3, noise: 1, wind: 0, moisture: 1, extent: 8 }),
    placeRow("openground", { light: 4, cover: 0, noise: 1, wind: 0, moisture: 1, extent: 8 }),
    // The cleared ground before a palisade gate, at night.
    placeRow("palisade", { light: 1, cover: 0, noise: 1 }),
    // A riverside camp among reeds: in a steady rainstorm with gusting wind, and in still weather.
    placeRow("stormcamp", { moisture: 5, wind: 4, noise: 4, cover: 1 }),
    placeRow("stillcamp", { moisture: 2, wind: 0, noise: 1, cover: 1 }),
    // A moor at dawn, thick with fog; and the same moor on a clear day.
    placeRow("moorfog", { temperature: 1, moisture: 4, light: 2, cover: 5, noise: 1, extent: 8 }),
    placeRow("moorclear", { temperature: 1, light: 5, cover: 0, noise: 1, extent: 8 }),
    // A river gorge with steep rock walls; and open quiet country, for the same distance.
    placeRow("gorge", { noise: 3, cover: 1, moisture: 3, extent: 8 }),
    placeRow("opencountry", { noise: 1, cover: 0, extent: 8 }),
    // Open plains at midday with the sun high; and the same plains in the cold.
    placeRow("plains", { temperature: 4, moisture: 1, wind: 2, light: 5, cover: 0, extent: 16 }),
    placeRow("coldplains", {
      temperature: 1,
      moisture: 1,
      wind: 2,
      light: 5,
      cover: 0,
      extent: 16,
    }),
    // A small house of two rooms at midday, and the street outside it.
    placeRow("house", { light: 3, cover: 2, noise: 1, wind: 0 }),
    placeRow("street", { light: 5, cover: 1, noise: 2 }),
  ],
};
