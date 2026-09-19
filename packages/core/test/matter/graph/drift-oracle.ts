/**
 * Function-form reference for the drift rows (drift-rules.test.ts).
 * C0 intentionally revises the historical contract: initial suppression, all interval rows,
 * then fuel settlement. Splitting the old burning function makes ten rows. Thermal
 * integration covers only the active fuel interval, then cools for the remainder.
 * All other rules retain their historical formulas. Nothing in the engine reads this.
 */
import type {
  MatterWorld,
  Place,
  Properties,
  Thing,
  ThingState,
} from "../../../src/matter/index.ts";
import { clamp } from "../../../src/matter/index.ts";

export interface Ctx {
  world: MatterWorld;
  thing: Thing;
  p: Properties;
  place: Place | undefined;
  minutes: number;
}

export type Drift = (
  ctx: Ctx,
  state: ThingState,
) => { set: Partial<ThingState>; because: string[]; spent?: boolean };

const NONE = { set: {}, because: [] as string[] };

export const DRIFTS: readonly Drift[] = [
  // Already-due exhaustion is distinct from suppressing a flame with remaining fuel.
  ({ p, place }, s) => {
    if (!s.burning) return NONE;
    if (s.burning.fuel <= 0) {
      const coatGone = s.burning.of === "coating" ? { coating: null } : {};
      return { set: { burning: null, ...coatGone }, because: ["S3", "X7"], spent: true };
    }
    const out = (place?.air ?? 5) <= 0 || p.flammability <= 0;
    if (out) return { set: { burning: null, surfaceAbove: 0 }, because: ["S3", "R6", "S2", "X7"] };
    return NONE;
  },
  // C0 correction: heat during the fueled interval, before settling exhaustion.
  ({ p, place, minutes }, s) => {
    const active = s.burning && (place?.air ?? 5) > 0 && p.flammability > 0;
    const burningMinutes = active ? Math.max(0, Math.min(minutes, s.burning?.fuel ?? 0)) : 0;
    const rate = (0.02 * (1 + p.conductivity * 0.2)) / (1 + p.mass * 0.3);
    const heated = s.temperature + (5 - s.temperature) * (1 - Math.exp(-rate * burningMinutes));
    const toward = place?.temperature ?? 2;
    const temperature = clamp(
      heated + (toward - heated) * (1 - Math.exp(-rate * (minutes - burningMinutes))),
    );
    return { set: { temperature }, because: ["S1", "P7", "X7"] };
  },
  // A surface that ran ahead of the bulk falls back to it within minutes.
  ({ minutes }, s) => {
    if (s.surfaceAbove <= 0) return NONE;
    return { set: { surfaceAbove: s.surfaceAbove * Math.exp(-minutes) }, because: ["S1", "X7"] };
  },
  // Wetness moves toward what the air holds. In rain a thing wets again as far as it can
  // drink. Drying goes in two speeds: a film on the surface is gone within the hour, and
  // water held inside (soaked in, or the thing's own) leaves slowly, through pores, against
  // bulk. So wet steel dries before it rusts much, cloth takes a day, and flesh takes days.
  ({ world, thing, p, place, minutes }, s) => {
    const air = Math.max(0, (place?.moisture ?? 2) - 2);
    const inside = p.absorbency * 0.8 + (world.elements[thing.element]?.moist ?? 0);
    const holds = Math.min(air * 1.6, 1 + inside);
    if (s.wetness < holds)
      return {
        set: { wetness: Math.min(holds, s.wetness + 0.2 * minutes), wetWith: null },
        because: ["S2", "P9", "X7"],
      };
    // In rain or damp air nothing dries below what that air keeps in it.
    const floor = Math.max(air, holds);
    if (s.wetness <= floor) return NONE;
    const exposed = 1 + Math.max(0, s.temperature - 2) + (place?.wind ?? 0) * 0.3;
    const film = Math.max(0, s.wetness - inside);
    const filmLeft = Math.max(0, film - exposed * 0.0015 * minutes);
    const open = 0.1 + p.porosity * 0.4;
    // Bulk counts by powers: a timber takes weeks where a pot takes days.
    const bulk = 1.5 ** (p.mass + p.size - 1) + p.absorbency * 0.2;
    const heldLeft = Math.max(0, s.wetness - film - (exposed * open * 0.0045 * minutes) / bulk);
    return {
      set: { wetness: Math.max(floor, heldLeft + filmLeft) },
      because: ["S2", "P1", "P9", "P10", "X7"],
    };
  },
  // A coat of something that dissolves readily draws the water out of what it covers.
  ({ world, minutes }, s) => {
    const coat = s.coating ? world.elements[s.coating.element] : undefined;
    const thirst = coat?.forms.includes("granular") ? (coat.props.solubility ?? 0) : 0;
    if (!s.coating || thirst < 3 || s.wetness <= 0) return NONE;
    const drawn = (thirst / 5) * s.coating.coverage * 0.01 * minutes;
    return { set: { wetness: Math.max(0, s.wetness - drawn) }, because: ["S7", "P12", "S2", "X7"] };
  },
  // Living contamination grows in what is perishable, warm and damp; a cleansing coat slows it.
  ({ world, thing, p, minutes }, s) => {
    if (p.perishability <= 0 || s.temperature >= 4.5) return NONE;
    // Cold slows it by degrees; it never quite stops above freezing.
    const warmth = clamp((s.temperature - 0.5) / 2, 0.05, 1);
    // It needs water to live in: what is dried through keeps, whatever it is.
    const oily = world.elements[s.wetWith ?? ""]?.props.oiliness ?? 0;
    const flows = world.elements[thing.element]?.forms.includes("liquid") ?? false;
    const water = flows ? 1 : clamp((s.wetness * (1 - oily / 5)) / 2, 0, 1);
    // A coat of something that dissolves readily ties the water up: it is there and not to be had.
    const salt = s.coating ? world.elements[s.coating.element] : undefined;
    const tied = salt?.forms.includes("granular")
      ? ((salt.props.solubility ?? 0) / 5) * (s.coating?.coverage ?? 0)
      : 0;
    const damp = water * (1 - tied);
    const coat = s.coating ? world.elements[s.coating.element]?.props : undefined;
    const kept = (coat?.cleansing ?? 0) + (coat?.potency ?? 0) >= 3 ? 0.2 : 1;
    // What barely perishes barely rots: the rate falls off faster than the level.
    const feeds = (p.perishability / 5) ** 1.5;
    const growth = feeds * warmth * damp * kept * 0.25 * (minutes / 60);
    return {
      set: { contamination: clamp(s.contamination + growth) },
      because: ["S9", "P15", "X7"],
    };
  },
  // Rust: corrodible, wet, and not kept off by an oily coat (already in the effective level).
  ({ p, minutes }, s) => {
    if (p.corrodibility <= 0 || s.wetness <= 0) return NONE;
    const growth = (p.corrodibility / 5) * (s.wetness / 5) * 0.1 * (minutes / 60);
    return { set: { corrosion: clamp(s.corrosion + growth) }, because: ["S10", "P16", "S2", "X7"] };
  },
  // Setting: once dry, a thing that sets is hard for good.
  ({ p }, s) => {
    if (s.set || p.setting <= 0 || s.wetness > 0.2) return NONE;
    return { set: { set: true }, because: ["P23", "M5", "X7"] };
  },
  // A coat bonds as it dries into something that drinks, if it is the kind of thing that
  // clings: sticky or perishable. What dissolves, or is only grains, stays loose.
  ({ world, p, minutes }, s) => {
    if (!s.coating || s.burning) return NONE;
    const coat = world.elements[s.coating.element];
    const c = coat?.props ?? {};
    const loose = (c.solubility ?? 0) + (coat?.forms.includes("granular") ? 2 : 0);
    const clings = Math.max(0, (c.stickiness ?? 0) + (c.perishability ?? 0) * 0.5 - loose) / 5;
    const bond = clamp(s.coating.bond + (p.absorbency / 5) * clings * 0.03 * minutes);
    return { set: { coating: { ...s.coating, bond } }, because: ["S7", "P9", "P13", "P12", "X7"] };
  },
  // Settlement uses start fuel, not a flame that an endpoint weather row may have removed.
  ({ thing, p, place, minutes }, s) => {
    const burning = thing.state.burning;
    if (!burning || burning.fuel <= 0 || (place?.air ?? 5) <= 0 || p.flammability <= 0) return NONE;
    const fuel = burning.fuel - minutes;
    if (fuel > 1e-9) {
      const set = s.burning ? { burning: { ...s.burning, fuel } } : {};
      return { set, because: ["S3", "X7"] };
    }
    const coatGone = burning.of === "coating" ? { coating: null } : {};
    return { set: { burning: null, ...coatGone }, because: ["S3", "X7"], spent: true };
  },
];
