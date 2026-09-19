/**
 * Rows for the river scenarios of batch D (`d-river.json`), beside the shared ones. Written
 * once from the anchors of `spikes/vocabulary/VOCABULARY.md`, before any test ran, and not
 * tuned afterwards. The shared `water`, `rope`, `cloth`, `mud`, `blade`, `bough` and `ash` are
 * reused.
 *
 * A row is the thing whole, dry, mild and full grown (principle 1): a hull cut from a green log
 * is the dry hull's row with `moist`, a boat with open seams is a plank boat, and thin ice is
 * the ice with a flaw (S15), as the earlier batches had it. Buoyancy and friction are set where
 * the anchors give them, though no rule reads either.
 *
 * Places: a river's edge is moisture 3, a ford in spate after rain is 4, and what lies under
 * the water is in a place of 5. The engine has no being in the water, so that is the nearest.
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      // A dugout hollowed from a seasoned log: a boat's length of wood, and a heavy one.
      id: "dryhull",
      name: "a dugout of dry timber",
      kind: "thing",
      forms: ["hollow", "grained", "long"],
      props: {
        mass: 4,
        size: 4,
        hardness: 3,
        toughness: 4,
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
      // The same hull cut from a green log. P4's anchor for 5 is green wood; the sap is `moist`.
      id: "greenhull",
      name: "a dugout of green wood",
      kind: "thing",
      forms: ["hollow", "grained", "long"],
      moist: 3,
      props: {
        mass: 4,
        size: 4,
        hardness: 2,
        toughness: 5,
        flexibility: 1,
        flammability: 3,
        absorbency: 2,
        porosity: 1,
        buoyancy: 3,
        friction: 3,
      },
      burnsTo: "ash",
    },
    {
      // A plank-built boat, a rowboat's size. Sound: open seams are the instance's, not the row's.
      id: "plankboat",
      name: "a plank boat",
      kind: "thing",
      forms: ["hollow", "grained"],
      props: {
        mass: 4,
        size: 4,
        hardness: 3,
        toughness: 4,
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
      // Pitch: hard, tacky and brittle when mild, runs when hot. P13 and P21's anchor for 5.
      id: "pitch",
      name: "pitch",
      kind: "material",
      forms: [],
      props: {
        mass: 1,
        size: 1,
        hardness: 1,
        toughness: 1,
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
      // A sack of threshed grain: sackcloth outside, and dry grain keeps well.
      id: "grainsack",
      name: "a sack of grain",
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
    },
    {
      // A flat ferry of logs and decking, big enough for a cart's worth of goods and people.
      id: "ferryraft",
      name: "a ferry raft",
      kind: "thing",
      forms: ["flat", "grained"],
      props: {
        mass: 5,
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
      // A grown person: a weight when a thing, the row of a body when a body's element.
      id: "person",
      name: "a person",
      kind: "person",
      forms: [],
      props: { mass: 4, size: 3, hardness: 1, toughness: 2, flexibility: 2, buoyancy: 2 },
    },
    {
      // A rough wooden post driven into the bed: P14's 5 is rough stone, and this is near it.
      id: "piling",
      name: "a rough wooden piling",
      kind: "thing",
      forms: ["grained", "long"],
      props: {
        mass: 4,
        size: 4,
        hardness: 3,
        toughness: 4,
        flammability: 2,
        absorbency: 2,
        buoyancy: 4,
        friction: 5,
      },
      burnsTo: "ash",
    },
    {
      // A casting net of knotted twine: a wide open mesh, tougher than cloth and short of rope.
      id: "net",
      name: "a fishing net",
      kind: "thing",
      forms: ["sheet"],
      props: {
        mass: 1,
        size: 3,
        hardness: 0,
        toughness: 4,
        flexibility: 5,
        flammability: 3,
        absorbency: 3,
        porosity: 5,
        friction: 3,
      },
    },
    {
      // River fish, a hand's length or two each. The amount is how many.
      id: "fish",
      name: "fish",
      kind: "creature",
      forms: [],
      moist: 3,
      props: { mass: 1, size: 1, hardness: 0, toughness: 2, perishability: 5, scent: 2 },
      serves: { hunger: 3 },
    },
    {
      // A wooden peg tooth of a mill's gearing: hardwood, a finger long.
      id: "geartooth",
      name: "a wooden gear tooth",
      kind: "thing",
      forms: ["grained", "long"],
      props: {
        mass: 1,
        size: 1,
        hardness: 3,
        toughness: 3,
        flammability: 3,
        absorbency: 2,
      },
      burnsTo: "ash",
    },
    {
      // A mill's axle: a seasoned trunk.
      id: "axle",
      name: "a mill axle",
      kind: "thing",
      forms: ["grained", "long"],
      props: {
        mass: 4,
        size: 4,
        hardness: 3,
        toughness: 4,
        flammability: 2,
        absorbency: 2,
      },
      burnsTo: "ash",
    },
    {
      id: "waterwheel",
      name: "a water wheel",
      kind: "thing",
      forms: ["grained", "round"],
      props: {
        mass: 5,
        size: 5,
        hardness: 3,
        toughness: 4,
        flammability: 2,
        absorbency: 2,
      },
      burnsTo: "ash",
    },
    {
      // What a body treads with when it wears nothing on its feet: flesh, as levels.
      id: "foot",
      name: "bare feet",
      kind: "thing",
      forms: [],
      props: { mass: 1, size: 1, hardness: 1, toughness: 2, flexibility: 3 },
    },
    {
      // Melts far below the scale's warmest anchor; 5 is the nearest level P8 has.
      id: "riverice",
      name: "a sheet of river ice",
      kind: "material",
      forms: ["flat", "sheet"],
      props: {
        mass: 3,
        size: 4,
        hardness: 2,
        toughness: 1,
        flexibility: 0,
        conductivity: 2,
        meltsAt: 5,
        buoyancy: 4,
        friction: 0,
      },
    },
    {
      // An iron-headed hand axe.
      id: "handaxe",
      name: "a hand axe",
      kind: "thing",
      forms: ["edged"],
      props: {
        mass: 2,
        size: 1,
        hardness: 4,
        toughness: 4,
        conductivity: 5,
        meltsAt: 1,
        corrodibility: 4,
      },
    },
    {
      id: "bucket",
      name: "a wooden bucket",
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
      // A trunk cut for a raft, seasoned on the bank.
      id: "log",
      name: "a raft log",
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
  ],
  places: [
    // A slow lowland river and its mud bank, in the sun.
    placeRow("lowriver", { temperature: 3, moisture: 3 }),
    // A landing at the water's edge: a boatwright's, a ferry's, a mooring stage.
    placeRow("landing", { moisture: 3 }),
    // An open fishing stretch.
    placeRow("reach", { moisture: 3, wind: 2 }),
    // Inside a mill over its channel: out of the wind, damp, and loud while it runs.
    placeRow("mill", { moisture: 3, wind: 0, noise: 3 }),
    placeRow("shallows", { moisture: 3 }),
    // The ford the day after heavy rain upstream.
    placeRow("ford", { moisture: 4 }),
    // Where a load is set down afterwards: a mild dry day.
    placeRow("farbank"),
    // On the ice after a hard frost.
    placeRow("frozenriver", { temperature: 0 }),
    // In the water under it: ice cold and still liquid.
    placeRow("underice", { temperature: 0.5, moisture: 5, wind: 0 }),
    // A still backwater, for what lies sunk in it.
    placeRow("backwater", { moisture: 5, wind: 0 }),
    placeRow("camp", { moisture: 3 }),
    // Fast water below a bend, on a mild day.
    placeRow("bend", { moisture: 3 }),
  ],
};
