/**
 * Function-form reference for soak and coat (soak-rules.test.ts).
 * C0 intentionally revises two historical contracts: soak requires a positive supplied dose,
 * and dousing uses only its aqueous fraction. Other formulas are unchanged.
 * Nothing in the engine reads this; independent C0 regressions test the revised behavior.
 */
import {
  baseline,
  type Change,
  clamp,
  effective,
  isLiquid,
  type Manner,
  type MatterWorld,
  meltingPoint,
  ORDINARY,
  type Thing,
} from "../../../src/matter/index.ts";

interface SoakActWas {
  process: "soak";
  liquid: string;
  target: string;
  /** How much of the liquid is used, in the liquid's own units. */
  amount: number;
}

interface CoatActWas {
  process: "coat";
  substance: string;
  target: string;
  amount?: number;
  manner?: Manner;
}

/** How wet a thing can get: a film on anything, more the more it drinks. */
const holds = (absorbency: number) => 1 + absorbency * 0.8;

function douse(target: Thing, amount: number): Change[] {
  const burning = target.state.burning;
  if (!burning || amount <= 0) return [];
  const out = amount * 20 >= burning.fuel;
  return [
    {
      kind: "state",
      thing: target.id,
      set: out ? { burning: null, temperature: Math.min(target.state.temperature, 3) } : {},
      because: ["X4", "S3", "S14"],
      note: out ? "the water puts it out" : "there is not enough water: it hisses and burns on",
    },
    {
      kind: "signal",
      place: target.place,
      channel: "smoke",
      source: target.id,
      strength: 3,
      because: ["X3", "S6", "E9"],
      note: "steam",
    },
  ];
}

/** A coat lifts when the liquid can get under it: like dissolves like, and cleansing bridges. */
function wash(world: MatterWorld, liquid: Thing, target: Thing): Change[] {
  const coat = target.state.coating;
  if (!coat) return [];
  const solvent = effective(world, liquid);
  const lifted = baseline(world.elements[coat.element]);
  // Like dissolves like; cleansing bridges; what dissolves readily comes away readily.
  const power =
    5 - Math.abs(solvent.oiliness - lifted.oiliness) + solvent.cleansing + lifted.solubility * 0.5;
  if (power - coat.bond < 3.5)
    return [
      {
        kind: "nothing",
        because: ["P21", "P24", "S7"],
        note: "the coat does not lift: the liquid cannot get under it",
      },
    ];
  return [
    {
      kind: "state",
      thing: target.id,
      set: { coating: null },
      because: ["X4", "P21", "P24", "S7"],
      note: "the coat washes off",
    },
  ];
}

export function soakOracle(world: MatterWorld, act: SoakActWas): Change[] {
  const liquid = world.things[act.liquid];
  const target = world.things[act.target];
  if (!(liquid && target) || liquid.id === target.id || !isLiquid(world, liquid))
    return [{ kind: "nothing", because: ["S6"], note: "there is nothing there to wet it with" }];
  const p = effective(world, target);
  const used = Math.min(act.amount, liquid.state.amount);
  // C0 correction: no supplied dose admits no soak transformations.
  if (!(used > 0))
    return [{ kind: "nothing", because: ["S6"], note: "there is nothing there to wet it with" }];
  const water = used * clamp(1 - effective(world, liquid).oiliness / 5, 0, 1);
  const own = world.elements[target.element]?.moist ?? 0;
  const mixed = (mine: number, theirs: number) =>
    (mine * target.state.amount + theirs * used) / (target.state.amount + used || 1);
  const wetness = clamp(Math.min(holds(p.absorbency) + own, target.state.wetness + used * 5));
  return [
    {
      kind: "state",
      thing: target.id,
      set: {
        wetness,
        wetWith: liquid.element === "water" ? null : liquid.element,
        // What a liquid carries is a quantity: it is spread over what it lands in.
        contamination: mixed(target.state.contamination, liquid.state.contamination),
        taint: mixed(target.state.taint, liquid.state.taint),
      },
      because: ["X4", "P9", "S2", "S9", "S13"],
      note: wetness > target.state.wetness ? "it takes up the liquid" : "the liquid runs off it",
    },
    ...douse(target, water),
    ...wash(world, liquid, target),
    {
      kind: "consume",
      thing: liquid.id,
      amount: used,
      because: ["E4"],
      note: "the liquid is used",
    },
  ];
}

/** Only what flows can be spread: a liquid, grains, or something softened near its melting. */
function spreads(world: MatterWorld, substance: Thing): boolean {
  const element = world.elements[substance.element];
  const forms = element?.forms ?? [];
  if (forms.includes("liquid") || forms.includes("granular")) return true;
  return substance.state.temperature >= meltingPoint(element?.props.meltsAt ?? 0) - 1.5;
}

/**
 * Smearing, pouring on, oiling, tarring, salting: a substance becomes a coat (S7). How much
 * of the surface it covers is bounded by how much there is against the size of the thing;
 * care only decides how evenly it goes on (principle 5). More of the same adds to the coat.
 */
export function coatOracle(world: MatterWorld, act: CoatActWas): Change[] {
  const substance = world.things[act.substance];
  const target = world.things[act.target];
  if (!(substance && target))
    return [{ kind: "nothing", because: [], note: "there is nothing there to coat" }];
  if (substance.id === target.id || !spreads(world, substance))
    return [{ kind: "nothing", because: ["X5", "S6", "P8"], note: "it is too hard to spread" }];
  const manner = act.manner ?? ORDINARY;
  const used = Math.min(act.amount ?? 0.2, substance.state.amount);
  const before = target.state.coating;
  const same = before?.element === substance.element ? before : null;
  // What is already on it stays on it: a second substance does not make the first vanish.
  if (before && !same && before.amount >= used * 0.25)
    return [
      {
        kind: "consume",
        thing: substance.id,
        amount: used,
        because: ["E4"],
        note: "it is used up",
      },
      { kind: "nothing", because: ["S7"], note: "it goes on over the coat already there" },
    ];
  const amount = used + (same?.amount ?? 0);
  const surface = 0.02 * (1 + effective(world, target).size) ** 2;
  const even = clamp(0.6 + manner.care * 0.1 - manner.haste * 0.05, 0.3, 1);
  const coverage = clamp((amount / surface) * even, 0, 1);
  return [
    {
      kind: "state",
      thing: target.id,
      set: { coating: { element: substance.element, amount, coverage, bond: same?.bond ?? 0 } },
      because: ["X5", "S7", "S14", "P2", "M6"],
      note: "it is coated",
    },
    { kind: "consume", thing: substance.id, amount: used, because: ["E4"], note: "it is used up" },
  ];
}
