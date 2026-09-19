/**
 * Rows for the food and body scenarios of batch A, beyond the shared ones. Written once from
 * the anchors of `spikes/vocabulary/VOCABULARY.md`, before anything was run, and not tuned.
 */
import { type Extra, placeRow } from "./elements.ts";

export const EXTRA: Extra = {
  elements: [
    {
      // Meat cut thin for drying: light, small, takes up and gives off water readily.
      id: "strips",
      name: "thin strips of raw meat",
      kind: "material",
      forms: ["flat"],
      moist: 3,
      props: {
        mass: 0,
        size: 0,
        hardness: 0,
        toughness: 2,
        flexibility: 3,
        absorbency: 2,
        perishability: 5,
        scent: 2,
      },
      serves: { hunger: 2 },
    },
    {
      // A bitter weed that sickens what grazes it and does not kill: the middle of P17.
      id: "weed",
      name: "a bitter dark-leaved weed",
      kind: "plant",
      forms: [],
      props: { mass: 0, size: 1, toughness: 1, flexibility: 3, noxiousness: 3, scent: 1 },
      serves: { hunger: 1 },
    },
    {
      id: "milk",
      name: "milk",
      kind: "material",
      forms: ["liquid"],
      props: { mass: 2, conductivity: 2, perishability: 4, oiliness: 1, scent: 1 },
      serves: { hunger: 1 },
    },
    {
      // Crushed berries and honey: sugary, watery, sticky, and food for whatever lives.
      id: "mash",
      name: "crushed berries and honey",
      kind: "material",
      forms: ["liquid"],
      props: { mass: 1, stickiness: 3, perishability: 4, solubility: 3, scent: 1 },
      serves: { hunger: 2 },
    },
    {
      id: "carcass",
      name: "a dead deer",
      kind: "thing",
      forms: [],
      moist: 3,
      props: {
        mass: 4,
        size: 3,
        hardness: 0,
        toughness: 2,
        flexibility: 2,
        absorbency: 1,
        perishability: 5,
        scent: 2,
      },
      serves: { hunger: 3 },
    },
  ],
  places: [
    // A dry, open campsite in summer sun, with a breeze.
    placeRow("sun", { temperature: 3, moisture: 0, wind: 2 }),
    // A larder shelf: mild, still, closed in.
    placeRow("larder", { temperature: 2, moisture: 2, wind: 0, air: 2 }),
  ],
};
