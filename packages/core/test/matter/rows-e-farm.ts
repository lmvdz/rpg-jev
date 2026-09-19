/**
 * Rows for the farm scenarios of batch E (`e-farm.json`), beside the shared ones. Written once
 * from the anchors of `spikes/vocabulary/VOCABULARY.md`, before any test ran, and not tuned
 * afterwards. The shared `iron`, `oak`, `water`, `salt`, `meat`, `mud`, `stone`, `blade` and
 * `ash` are reused.
 *
 * A row is the thing whole, dry, mild and full grown (principle 1): hay carted damp is the hay's
 * row and an instance's wetness, green ash is the pole's row with `moist`, a nervous heifer is a
 * cow's row and what she feels toward a stranger (B6). Where size decides (a mow against a
 * haycock, a stook against a sheaf, a ham against a flitch) each is its own row, because bulk is
 * read from the row and never from the amount. The body rows follow the earlier batches: a
 * person is strength 2, an ox 5, a sheep 1, an infant 0; nothing here has anchors of its own.
 * What bites or kicks is a thing, as the earlier batches had it: teeth, a hoof.
 *
 * Places: an ordinary day is moisture 2, muggy or dewy air and damp earth 3, drizzle, sleet and
 * ground after days of rain 4. Inside a sound roof the rain is kept off: a barn is 2 in a
 * showery season. First light indoors and a windowless loft are light 1, a night outdoors 0.
 * Beasts tied by the neck and birds shut in a house have no way out: `exits` 0.
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      // A barn bay filled to the tie beams with meadow hay, trodden tight. P6's 5 is dry tinder.
      id: "haymow",
      name: "a mow of meadow hay",
      kind: "material",
      forms: [],
      props: {
        mass: 5,
        size: 5,
        hardness: 0,
        toughness: 2,
        flexibility: 4,
        flammability: 4,
        absorbency: 4,
        porosity: 3,
        perishability: 2,
        scent: 1,
      },
      serves: { hunger: 2 },
      fare: "leaf",
      burnsTo: "ash",
    },
    {
      // The same hay in a small loose heap, as it stands in the field.
      id: "haycock",
      name: "a haycock",
      kind: "material",
      forms: [],
      props: {
        mass: 2,
        size: 2,
        hardness: 0,
        toughness: 2,
        flexibility: 4,
        flammability: 4,
        absorbency: 4,
        porosity: 4,
        perishability: 2,
        scent: 1,
      },
      serves: { hunger: 2 },
      fare: "leaf",
      burnsTo: "ash",
    },
    {
      // A barn roof of straw thatch.
      id: "thatch",
      name: "a thatched roof",
      kind: "thing",
      forms: ["flat"],
      props: {
        mass: 4,
        size: 5,
        hardness: 0,
        toughness: 2,
        flexibility: 2,
        flammability: 4,
        absorbency: 3,
        porosity: 2,
      },
      burnsTo: "ash",
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
      id: "person",
      name: "a person",
      kind: "person",
      forms: [],
      props: { mass: 4, size: 3, hardness: 1, toughness: 2, scent: 2 },
      body: { strength: 2, speed: 2, sight: 3, hearing: 3, smell: 1 },
    },
    {
      id: "cow",
      name: "a cow",
      kind: "creature",
      forms: [],
      props: { mass: 5, size: 4, hardness: 1, toughness: 3, scent: 2 },
      body: { eats: { leaf: 5, seed: 4 }, strength: 4, speed: 2, sight: 2, hearing: 3, smell: 3 },
    },
    {
      id: "calf",
      name: "a calf",
      kind: "creature",
      forms: [],
      props: { mass: 3, size: 2, hardness: 1, toughness: 2, scent: 2 },
      body: { eats: { leaf: 3, seed: 2 }, strength: 1, speed: 2, sight: 2, hearing: 3, smell: 3 },
    },
    {
      // A cow's hind hoof, with the leg behind it: horn, about as hard as wood.
      id: "hoof",
      name: "a hind hoof",
      kind: "thing",
      forms: [],
      props: { mass: 2, size: 1, hardness: 3, toughness: 4 },
    },
    {
      // A measure of loose grain or meal: barley in a bin, crushed oats, threshed wheat. The
      // amount is how many measures; one is about a beast's ration.
      id: "grain",
      name: "loose grain",
      kind: "material",
      forms: ["granular"],
      props: {
        mass: 1,
        size: 1,
        hardness: 2,
        toughness: 1,
        absorbency: 3,
        perishability: 2,
        scent: 1,
      },
      serves: { hunger: 2 },
      fare: "seed",
    },
    {
      id: "pail",
      name: "a wooden pail",
      kind: "thing",
      forms: ["hollow", "grained"],
      props: {
        mass: 1,
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
      // A fat pig of twenty stone: heavier than a person, short of an ox.
      id: "pig",
      name: "a fat pig",
      kind: "creature",
      forms: [],
      props: { mass: 4, size: 3, hardness: 1, toughness: 3, scent: 3 },
      body: { strength: 3, speed: 2, sight: 2, hearing: 3, smell: 5 },
    },
    {
      // A whole ham: a thick joint on the bone. P15's 5 is raw meat.
      id: "ham",
      name: "a ham",
      kind: "material",
      forms: [],
      moist: 3,
      props: { mass: 2, size: 2, hardness: 0, toughness: 2, perishability: 5, scent: 2 },
      serves: { hunger: 3 },
      fare: "flesh",
    },
    {
      // A flitch: a side of the same pig, broad and no thicker than a hand.
      id: "flitch",
      name: "a flitch of bacon",
      kind: "material",
      forms: ["flat"],
      moist: 3,
      props: { mass: 2, size: 3, hardness: 0, toughness: 2, perishability: 5, scent: 2 },
      serves: { hunger: 3 },
      fare: "flesh",
    },
    {
      id: "rat",
      name: "a rat",
      kind: "creature",
      forms: [],
      props: { mass: 1, size: 1, hardness: 1, toughness: 2, scent: 2 },
      serves: { hunger: 2 },
      fare: "flesh",
      body: {
        eats: { seed: 5, fruit: 3, flesh: 2, leaf: 1 },
        strength: 0,
        speed: 3,
        sight: 1,
        hearing: 4,
        smell: 4,
      },
    },
    {
      // Gnawing teeth, as the earlier batches had them: harder than wood, and edged.
      id: "gnawteeth",
      name: "gnawing teeth",
      kind: "thing",
      forms: ["edged"],
      props: { mass: 0, size: 0, hardness: 4, toughness: 3 },
    },
    {
      // A seasoned inch board of a loft floor: less tough than a bough.
      id: "floorboard",
      name: "a floorboard",
      kind: "thing",
      forms: ["flat", "long", "grained"],
      props: {
        mass: 2,
        size: 3,
        hardness: 3,
        toughness: 3,
        flammability: 3,
        absorbency: 2,
        porosity: 1,
      },
      burnsTo: "ash",
    },
    {
      // A full sack of wheat: sackcloth outside, and dry grain keeps well.
      id: "wheatsack",
      name: "a sack of wheat",
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
        perishability: 2,
        scent: 1,
      },
      serves: { hunger: 2 },
      fare: "seed",
    },
    {
      id: "cat",
      name: "a farm cat",
      kind: "creature",
      forms: [],
      props: { mass: 2, size: 1, hardness: 1, toughness: 2, scent: 1 },
      body: { eats: { flesh: 5 }, strength: 1, speed: 4, sight: 4, hearing: 5, smell: 3 },
    },
    {
      id: "fox",
      name: "a vixen",
      kind: "creature",
      forms: [],
      props: { mass: 2, size: 2, hardness: 1, toughness: 2, scent: 3 },
      body: {
        eats: { flesh: 5, fruit: 2 },
        strength: 1,
        speed: 4,
        sight: 3,
        hearing: 5,
        smell: 5,
      },
    },
    {
      // A small predator's teeth, as the earlier batches had them.
      id: "fangs",
      name: "a small predator's teeth",
      kind: "thing",
      forms: ["pointed", "edged"],
      props: { mass: 0, size: 0, hardness: 3, toughness: 2 },
    },
    {
      id: "hen",
      name: "a hen",
      kind: "creature",
      forms: [],
      props: { mass: 2, size: 1, hardness: 1, toughness: 1, scent: 2 },
      serves: { hunger: 3 },
      fare: "flesh",
      body: {
        eats: { seed: 5, leaf: 2, flesh: 1 },
        strength: 0,
        speed: 2,
        sight: 3,
        hearing: 3,
        smell: 1,
      },
    },
    {
      id: "sheep",
      name: "a sheep",
      kind: "creature",
      forms: [],
      props: { mass: 3, size: 2, hardness: 1, toughness: 2, scent: 3 },
      body: { eats: { leaf: 5 }, strength: 1, speed: 3, sight: 3, hearing: 3, smell: 3 },
    },
    {
      // A pole cut green from the hedge and set as a fence post. P4's 5 is green wood; the sap
      // is `moist`. Ash does not last in the ground.
      id: "ashpost",
      name: "a green ash post",
      kind: "thing",
      forms: ["grained", "long"],
      moist: 3,
      props: {
        mass: 3,
        size: 3,
        hardness: 2,
        toughness: 5,
        flexibility: 1,
        flammability: 2,
        absorbency: 2,
        porosity: 1,
        perishability: 1,
      },
      burnsTo: "ash",
    },
    {
      // Eight bound sheaves stood together, ears up.
      id: "stook",
      name: "a stook of wheat",
      kind: "plant",
      forms: [],
      props: {
        mass: 3,
        size: 3,
        hardness: 0,
        toughness: 2,
        flexibility: 3,
        flammability: 4,
        absorbency: 3,
        porosity: 3,
        perishability: 2,
      },
      serves: { hunger: 1 },
      fare: "seed",
      burnsTo: "ash",
    },
    {
      // One bound sheaf: an armful.
      id: "sheaf",
      name: "a wheat sheaf",
      kind: "plant",
      forms: [],
      props: {
        mass: 2,
        size: 2,
        hardness: 0,
        toughness: 2,
        flexibility: 3,
        flammability: 4,
        absorbency: 3,
        porosity: 3,
        perishability: 2,
      },
      serves: { hunger: 1 },
      fare: "seed",
      burnsTo: "ash",
    },
    {
      // The twisted straw that binds a sheaf.
      id: "strawband",
      name: "a straw band",
      kind: "thing",
      forms: ["cord"],
      props: {
        mass: 0,
        size: 1,
        hardness: 0,
        toughness: 2,
        flexibility: 4,
        flammability: 4,
        absorbency: 3,
        perishability: 2,
      },
      burnsTo: "ash",
    },
    {
      // Pigeons and rooks, as one body: the engine has no group with a count.
      id: "pigeon",
      name: "a pigeon",
      kind: "creature",
      forms: [],
      props: { mass: 1, size: 1, hardness: 1, toughness: 1, scent: 1 },
      serves: { hunger: 2 },
      fare: "flesh",
      body: { eats: { seed: 5, leaf: 2 }, strength: 0, speed: 5, sight: 4, hearing: 3, smell: 1 },
    },
    {
      // A flail: an ash handstaff and a holly swingle on a thong.
      id: "flail",
      name: "a flail",
      kind: "thing",
      forms: ["long", "grained"],
      props: { mass: 1, size: 3, hardness: 3, toughness: 4, flammability: 3, absorbency: 2 },
      burnsTo: "ash",
    },
    {
      // Husks and awns: P1's 0 is a feather.
      id: "chaff",
      name: "chaff",
      kind: "material",
      forms: ["granular"],
      props: { mass: 0, size: 0, flammability: 4, absorbency: 2, buoyancy: 4 },
      burnsTo: "ash",
    },
    {
      id: "tipcart",
      name: "a tip cart",
      kind: "thing",
      forms: ["hollow", "grained"],
      props: {
        mass: 4,
        size: 4,
        hardness: 3,
        toughness: 4,
        flammability: 2,
        absorbency: 2,
        friction: 2,
      },
      burnsTo: "ash",
    },
    {
      // A cartload of turnips, about a ton. Half a load is half the amount.
      id: "turnips",
      name: "a load of turnips",
      kind: "plant",
      forms: ["round"],
      moist: 3,
      props: { mass: 5, size: 4, hardness: 2, toughness: 2, perishability: 2 },
      serves: { hunger: 1 },
      fare: "leaf",
    },
    {
      // The firm grass headland of a field, as what bears a cart.
      id: "turf",
      name: "firm turf",
      kind: "material",
      forms: ["flat"],
      props: { mass: 5, size: 5, hardness: 2, toughness: 3, absorbency: 4, friction: 3 },
    },
    {
      id: "brushwood",
      name: "hedge brushwood",
      kind: "plant",
      forms: ["long", "grained"],
      props: {
        mass: 2,
        size: 2,
        hardness: 2,
        toughness: 3,
        flexibility: 3,
        flammability: 4,
        absorbency: 2,
        friction: 4,
      },
      burnsTo: "ash",
    },
    {
      id: "horse",
      name: "a horse",
      kind: "creature",
      forms: [],
      props: { mass: 5, size: 4, hardness: 1, toughness: 3, scent: 2 },
      body: { eats: { leaf: 5, seed: 5 }, strength: 5, speed: 4, sight: 3, hearing: 4, smell: 3 },
    },
    {
      id: "whip",
      name: "a whip",
      kind: "thing",
      forms: ["cord"],
      props: { mass: 0, size: 2, hardness: 1, toughness: 4, flexibility: 5 },
    },
    {
      // Fresh hen droppings with a little straw: fierce stuff, and it stinks. It spreads as
      // mud does.
      id: "hendung",
      name: "fresh hen dung",
      kind: "material",
      forms: ["granular"],
      moist: 3,
      props: {
        mass: 2,
        size: 2,
        stickiness: 2,
        solubility: 2,
        absorbency: 3,
        porosity: 2,
        perishability: 4,
        noxiousness: 3,
        scent: 4,
      },
    },
    {
      // A stretch of a row of cabbage and lettuce seedlings, a finger tall.
      id: "seedling",
      name: "seedlings",
      kind: "plant",
      forms: [],
      moist: 3,
      props: {
        mass: 0,
        size: 1,
        hardness: 0,
        toughness: 1,
        flexibility: 3,
        absorbency: 2,
        perishability: 3,
      },
      serves: { hunger: 1 },
      fare: "leaf",
    },
    {
      // A scythe blade: long, thin and fine drawn.
      id: "scythe",
      name: "a scythe",
      kind: "thing",
      forms: ["edged", "long"],
      props: {
        mass: 1,
        size: 3,
        hardness: 5,
        toughness: 3,
        conductivity: 5,
        meltsAt: 1,
        corrodibility: 4,
      },
    },
    {
      // A stroke's width of standing meadow grass, thigh high and in flower.
      id: "grass",
      name: "standing grass",
      kind: "plant",
      forms: ["long"],
      moist: 3,
      props: {
        mass: 1,
        size: 2,
        hardness: 1,
        toughness: 2,
        flexibility: 4,
        flammability: 2,
        absorbency: 1,
        perishability: 3,
      },
      serves: { hunger: 1 },
      fare: "leaf",
    },
    {
      // A newborn lamb: it can barely get about.
      id: "lamb",
      name: "a newborn lamb",
      kind: "creature",
      forms: [],
      props: { mass: 2, size: 1, hardness: 1, toughness: 1, scent: 2 },
      body: { strength: 0, speed: 1, sight: 2, hearing: 2, smell: 3 },
    },
    {
      id: "ewemilk",
      name: "ewe's milk",
      kind: "material",
      forms: ["liquid"],
      props: { mass: 1, perishability: 4, oiliness: 1 },
      serves: { hunger: 2 },
    },
    {
      // A horn lantern with a tallow candle in it.
      id: "lantern",
      name: "a lantern",
      kind: "thing",
      forms: ["hollow"],
      props: { mass: 1, size: 1, hardness: 2, toughness: 2, flammability: 3 },
    },
    {
      // Ripened cream: mostly water, with the fat still in it.
      id: "cream",
      name: "cream",
      kind: "material",
      forms: ["liquid"],
      props: { mass: 2, conductivity: 2, perishability: 4, oiliness: 2 },
      serves: { hunger: 2 },
    },
    {
      // The staff and dasher of a plunger churn.
      id: "plunger",
      name: "a churn plunger",
      kind: "thing",
      forms: ["long", "grained"],
      props: { mass: 1, size: 2, hardness: 3, toughness: 3, flammability: 3, absorbency: 2 },
      burnsTo: "ash",
    },
    {
      // Fresh butter, the buttermilk still in it. P8's 5 is just above a warm day.
      id: "butter",
      name: "butter",
      kind: "material",
      forms: [],
      moist: 1,
      props: {
        mass: 1,
        size: 1,
        hardness: 1,
        toughness: 1,
        flexibility: 2,
        meltsAt: 5,
        oiliness: 4,
        perishability: 3,
      },
      serves: { hunger: 3 },
    },
  ],
  places: [
    // Inside a thatched timber barn in a showery summer: the roof keeps the rain off.
    placeRow("barn", { wind: 0, light: 2 }),
    // The middle of a tight mow: no air gets in.
    placeRow("mowcore", { wind: 0, air: 0, light: 0 }),
    // A cow byre at first light in cold weather: beasts tied by the neck, a calf bawling.
    placeRow("byre", { temperature: 1, wind: 0, light: 1, noise: 2, exits: 0 }),
    // The pantry in this mild muggy spell, and as it ought to be at pig-killing time.
    placeRow("pantry", { moisture: 3, wind: 0, light: 2 }),
    placeRow("coldpantry", { temperature: 1, wind: 0, light: 2 }),
    // The killing place in the yard.
    placeRow("farmyard", { moisture: 3 }),
    // A granary loft in winter, and the cart shed under it, on the far side of a shut door.
    placeRow("loft", { temperature: 1, wind: 0, light: 1, noise: 1 }),
    placeRow("cartshed", { temperature: 1, light: 1, noise: 1 }),
    // A henhouse after midnight in early spring, the birds shut in; and the yard outside it.
    placeRow("henhouse", { temperature: 1, wind: 0, light: 0, noise: 1, exits: 0 }),
    placeRow("nightyard", { temperature: 1, light: 0, noise: 1 }),
    // A pasture, and the damp earth a post stands in.
    placeRow("pasture"),
    placeRow("postground", { moisture: 3, wind: 0 }),
    // A harvest field in a week of warm drizzle and still air, and on a dry windy day.
    placeRow("drizzle", { temperature: 3, moisture: 4, wind: 0 }),
    placeRow("harvestfield", { temperature: 3, wind: 3 }),
    // A threshing floor between two big doors: a still foggy winter morning, and a breezy one.
    placeRow("stillfloor", { temperature: 1, moisture: 3, wind: 0 }),
    placeRow("breezyfloor", { temperature: 1, wind: 3 }),
    // A field headland and its gateway after three days of rain.
    placeRow("headland", { moisture: 4 }),
    placeRow("gateway", { moisture: 4 }),
    // A kitchen garden in spring, and the end of the yard where the old heap lies.
    placeRow("garden"),
    placeRow("yardend"),
    // A feed store and the stable yard outside its latched door, overnight.
    placeRow("feedstore", { wind: 0, light: 1 }),
    placeRow("stableyard", { light: 1 }),
    // A hay meadow from dawn into the morning in June: dew on it, grass thigh high.
    placeRow("meadow", { moisture: 3, light: 4, cover: 1 }),
    // A home field on a night of sleet driven by an east wind, and the kitchen by the hearth.
    placeRow("sleetfield", { temperature: 0.5, moisture: 4, wind: 4, light: 0 }),
    placeRow("kitchen", { wind: 0, light: 2 }),
    // A farmhouse dairy on a frosty morning: stone shelves, sluiced floors, cold and damp.
    placeRow("dairy", { temperature: 1, moisture: 3, wind: 0 }),
  ],
};
