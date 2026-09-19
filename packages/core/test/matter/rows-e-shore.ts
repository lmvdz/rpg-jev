/**
 * Rows for the shore scenarios of batch E (`e-shore.json`), beside the shared ones. Written
 * once from the anchors of `spikes/vocabulary/VOCABULARY.md`, before any test ran, and not
 * tuned afterwards. The shared `water`, `oil`, `blade`, `cloth`, `leather`, `tinder`, `bough`,
 * `salt` and `ash` are reused: sacking is the cloth, shoes are the leather, a gutting knife and
 * a thin-bladed knife are the small blade, fish oil is the oil.
 *
 * A row is the thing whole, dry, mild and full grown (principle 1): a sea-soaked log is the
 * drift log wetted by the sea, a rotten net is the hemp net after its week, a rusted knife is
 * the blade after its nights out. What is counted is one of its kind and the amount is how many
 * (a cockle, a lugworm, a herring); an armful of sticks is one, and the amount is armfuls.
 * Buoyancy and friction are set where the anchors give them, though no rule reads either.
 *
 * Places: the shore in fair weather is moisture 3, what the tide or the waves wet is 4, and what
 * lies in the water is in a place of 5. The engine has no being in the water, so that is the
 * nearest. A cool morning is 1.5, a night-cold cove 1, a muggy week 3.
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      // The sea. Water with salt in it: a little harmful to drink, and nothing else tells it
      // from water, because no row can say what is dissolved in a liquid.
      id: "seawater",
      name: "seawater",
      kind: "material",
      forms: ["liquid"],
      props: { mass: 2, conductivity: 2, swell: 3, noxiousness: 1 },
    },
    {
      // A grown person: a weight when a thing, the row of a body when a body's element.
      id: "person",
      name: "a person",
      kind: "person",
      forms: [],
      props: { mass: 4, size: 3, hardness: 1, toughness: 2, flexibility: 2, buoyancy: 2 },
      body: { strength: 2, speed: 2, sight: 3, hearing: 3, smell: 1 },
    },
    {
      // One cockle, alive in its shell. The amount is how many; thirty or so are a meal.
      id: "cockle",
      name: "a cockle",
      kind: "creature",
      forms: ["round"],
      moist: 3,
      fare: "flesh",
      props: { mass: 0, size: 0, hardness: 3, toughness: 1, perishability: 5, scent: 1 },
      serves: { hunger: 0.1 },
    },
    {
      // Wet beach sand. P24's anchor for 5 is soap, lye and sand.
      id: "sand",
      name: "wet sand",
      kind: "material",
      forms: ["granular"],
      props: { mass: 2, hardness: 1, cleansing: 5 },
    },
    {
      // An armful of small silver-grey driftwood sticks, bleached dry. The amount is armfuls.
      id: "driftsticks",
      name: "an armful of dry driftwood sticks",
      kind: "material",
      forms: ["grained"],
      props: {
        mass: 2,
        size: 2,
        hardness: 2,
        toughness: 2,
        flammability: 4,
        absorbency: 3,
        buoyancy: 5,
      },
      burnsTo: "ash",
    },
    {
      // A big drift log, a trunk's length. Dry: the sea that soaked it is the instance's.
      id: "driftlog",
      name: "a big drift log",
      kind: "thing",
      forms: ["grained", "long"],
      props: {
        mass: 4,
        size: 4,
        hardness: 3,
        toughness: 4,
        flammability: 2,
        absorbency: 2,
        porosity: 1,
        buoyancy: 4,
        friction: 3,
      },
      burnsTo: "ash",
    },
    {
      // A two-gallon pot of bare cast iron. P16's anchor for 5 is bare iron.
      id: "ironpot",
      name: "an iron pot",
      kind: "thing",
      forms: ["hollow"],
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
      // Tallow grease: soft when mild, runs when warm. P21's anchor for 5 is oil, tar and wax.
      id: "grease",
      name: "grease",
      kind: "material",
      forms: [],
      props: {
        mass: 1,
        hardness: 0,
        flammability: 3,
        meltsAt: 5,
        stickiness: 2,
        oiliness: 5,
        scent: 1,
      },
    },
    {
      // A handhold in rotten shale: soft for rock, and it crumbles like a dry twig.
      id: "shalehold",
      name: "a hold in rotten shale",
      kind: "material",
      forms: [],
      props: { mass: 1, size: 1, hardness: 2, toughness: 0 },
    },
    {
      // A herring, a hand's length. The amount is how many.
      id: "herring",
      name: "a herring",
      kind: "creature",
      forms: [],
      moist: 3,
      fare: "flesh",
      props: { mass: 1, size: 1, hardness: 0, toughness: 2, perishability: 5, scent: 2 },
      serves: { hunger: 3 },
    },
    {
      // A herring gull: a bold scavenger with a hawk's eyes and not much of a nose.
      id: "gull",
      name: "a herring gull",
      kind: "creature",
      forms: [],
      props: { mass: 1, size: 1, hardness: 1, toughness: 2 },
      body: {
        eats: { flesh: 5, seed: 2, fruit: 1 },
        strength: 1,
        speed: 4,
        sight: 4,
        hearing: 3,
        smell: 2,
      },
    },
    {
      // A beach pebble of a size to throw.
      id: "pebble",
      name: "a pebble",
      kind: "material",
      forms: ["round"],
      props: { mass: 1, size: 0, hardness: 4, toughness: 1 },
    },
    {
      // A rib of an old wreck: black oak, iron-hard. Sodden is the instance's.
      id: "wreckrib",
      name: "a rib of black oak",
      kind: "thing",
      forms: ["grained", "long"],
      props: {
        mass: 4,
        size: 3,
        hardness: 4,
        toughness: 4,
        flammability: 1,
        absorbency: 2,
        porosity: 1,
        buoyancy: 1,
      },
      burnsTo: "ash",
    },
    {
      // An iron anchor off a ship: more than four men can shift. P1's 5 is a boulder.
      id: "anchor",
      name: "an iron anchor",
      kind: "thing",
      forms: ["long", "pointed"],
      props: {
        mass: 5,
        size: 3,
        hardness: 4,
        toughness: 4,
        conductivity: 5,
        meltsAt: 1,
        corrodibility: 5,
      },
    },
    {
      // A hand saw with a steel blade. How keen its teeth are is the instance's edge.
      id: "saw",
      name: "a hand saw",
      kind: "thing",
      forms: ["edged", "flat"],
      props: {
        mass: 1,
        size: 2,
        hardness: 5,
        toughness: 3,
        flexibility: 2,
        conductivity: 5,
        meltsAt: 1,
        corrodibility: 4,
      },
    },
    {
      // A hemp drift net: a wide open mesh of plant fibre, which rots as plant fibre does.
      id: "hempnet",
      name: "a hemp drift net",
      kind: "thing",
      forms: ["sheet"],
      props: {
        mass: 2,
        size: 4,
        hardness: 0,
        toughness: 4,
        flexibility: 5,
        flammability: 3,
        absorbency: 4,
        porosity: 5,
        friction: 3,
        perishability: 2,
      },
    },
    {
      // A limpet, the size of a child's palm: a hard cone of shell, brittle to a blow.
      id: "limpet",
      name: "a limpet",
      kind: "creature",
      forms: ["round"],
      moist: 2,
      fare: "flesh",
      props: { mass: 0, size: 0, hardness: 3, toughness: 1, perishability: 5, friction: 5 },
      serves: { hunger: 0.2 },
    },
    {
      // The heel of a boot: stacked leather, hard for leather.
      id: "bootheel",
      name: "a boot heel",
      kind: "thing",
      forms: [],
      props: { mass: 1, size: 1, hardness: 2, toughness: 4 },
    },
    {
      // A heavy larch-on-oak fishing boat of eighteen feet: the weight of a carthorse.
      id: "heavyboat",
      name: "a heavy fishing boat",
      kind: "thing",
      forms: ["hollow", "grained"],
      props: {
        mass: 5,
        size: 4,
        hardness: 3,
        toughness: 4,
        flexibility: 1,
        flammability: 2,
        absorbency: 2,
        porosity: 1,
        buoyancy: 4,
        friction: 3,
      },
      burnsTo: "ash",
    },
    {
      id: "oar",
      name: "an oar",
      kind: "thing",
      forms: ["grained", "long", "flat"],
      props: {
        mass: 2,
        size: 3,
        hardness: 3,
        toughness: 4,
        flexibility: 1,
        flammability: 3,
        absorbency: 2,
        buoyancy: 4,
      },
      burnsTo: "ash",
    },
    {
      // A whetstone: stone, and no harder than stone is on this scale.
      id: "whetstone",
      name: "a whetstone",
      kind: "material",
      forms: ["flat"],
      props: { mass: 1, size: 1, hardness: 4, toughness: 1, friction: 5, cleansing: 3 },
    },
    {
      // A wool cloak. P7's anchor for 0 is wool.
      id: "woolcloak",
      name: "a wool cloak",
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
      },
    },
    {
      // A lugworm dug from the flat: soft, smelly bait. The amount is how many.
      id: "lugworm",
      name: "a lugworm",
      kind: "creature",
      forms: [],
      moist: 3,
      fare: "flesh",
      props: { mass: 0, size: 0, hardness: 0, toughness: 1, perishability: 5, scent: 3 },
      serves: { hunger: 1 },
    },
    {
      // A flounder or a plaice: a thing when caught, the row of a body when it swims.
      id: "flatfish",
      name: "a flatfish",
      kind: "creature",
      forms: ["flat"],
      moist: 3,
      fare: "flesh",
      props: { mass: 1, size: 1, hardness: 0, toughness: 2, perishability: 5, scent: 2 },
      serves: { hunger: 3 },
      body: { eats: { flesh: 5 }, strength: 1, speed: 3, sight: 2, hearing: 1, smell: 4 },
    },
    {
      // A small shore crab, that finds its food by smell.
      id: "crab",
      name: "a shore crab",
      kind: "creature",
      forms: [],
      fare: "flesh",
      props: { mass: 0, size: 0, hardness: 3, toughness: 2 },
      serves: { hunger: 1 },
      body: { eats: { flesh: 5 }, strength: 0, speed: 2, sight: 2, hearing: 1, smell: 4 },
    },
    {
      // A weever: a small fish that lies buried and trusts its spines.
      id: "weever",
      name: "a weever",
      kind: "creature",
      forms: [],
      moist: 3,
      fare: "flesh",
      props: { mass: 1, size: 1, hardness: 1, toughness: 2, perishability: 5 },
      serves: { hunger: 2 },
      body: { eats: { flesh: 5 }, strength: 0, speed: 3, sight: 3, hearing: 1, smell: 2 },
    },
    {
      // Its back spines: needles of bone with venom on them. Keenness is the instance's edge.
      id: "spines",
      name: "venomous spines",
      kind: "thing",
      forms: ["pointed"],
      props: { mass: 0, size: 0, hardness: 3, toughness: 2, noxiousness: 4 },
    },
  ],
  places: [
    // An estuary flat at low water on a cool morning: on the cockle bed, and a few paces off it.
    placeRow("cocklebed", {
      temperature: 1.5,
      moisture: 3,
      wind: 2,
      abundance: { cockle: 5 },
      extent: 4,
    }),
    placeRow("offbed", {
      temperature: 1.5,
      moisture: 3,
      wind: 2,
      abundance: { cockle: 1 },
      extent: 4,
    }),
    // Above the tide on the same cool shore, where the fire and the bucket are.
    placeRow("foreshore", { temperature: 1.5, moisture: 3, wind: 2 }),
    // The weed-covered ledges round the foot of the headland, at low water.
    placeRow("ledges", { moisture: 3, wind: 2 }),
    // The far cove after dark: exposed and night-cold.
    placeRow("cove", { temperature: 1, moisture: 3, wind: 3, light: 1 }),
    // A beach camp by the sea.
    placeRow("beachcamp", { moisture: 3, wind: 2 }),
    // A fishing strand on a bright breezy morning.
    placeRow("strand", { wind: 2, light: 5 }),
    // An open beach in a three-day onshore gale, and the same beach in the calm after.
    placeRow("galebeach", { temperature: 1, moisture: 4, wind: 5, noise: 4 }),
    placeRow("wreckbeach", { moisture: 3, wind: 2 }),
    // A windy strand at dusk after a wet week, and a scrape behind stones out of the wind.
    placeRow("duskstrand", { temperature: 1.5, moisture: 3, wind: 3, light: 2 }),
    placeRow("scrape", { temperature: 1.5, moisture: 3, wind: 0, light: 2 }),
    // Where the last tide left things, and the top of the beach above the highest tides.
    placeRow("tideline", { temperature: 1.5, moisture: 5, wind: 3 }),
    placeRow("beachtop", { wind: 3 }),
    // Inside a wet heap in the bottom of a boat in muggy weather; and on the drying poles.
    placeRow("netheap", { temperature: 3, moisture: 4, wind: 0 }),
    placeRow("poles", { temperature: 3, moisture: 3, wind: 2 }),
    // Wave-washed rocks at half tide.
    placeRow("rocks", { moisture: 4, wind: 2 }),
    // A flat sandy beach at dead low water.
    placeRow("flatsand", { moisture: 3, wind: 2 }),
    // A spray-blown fishing station; and a shed inland that is as damp, without the salt.
    placeRow("station", { moisture: 3, wind: 3 }),
    placeRow("inland", { moisture: 3 }),
    // A sand flat that dries for a quarter mile, thick with lugworm; and the same under the flood.
    placeRow("wormflat", { moisture: 3, wind: 2, abundance: { lugworm: 5 }, extent: 10 }),
    placeRow("coveredflat", { moisture: 5, wind: 0, light: 2 }),
    // Warm clear shallows over clean sand on a summer afternoon: nothing stands in the way.
    placeRow("warmshallows", { temperature: 3, moisture: 5, light: 4, cover: 0 }),
  ],
};
