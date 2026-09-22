/**
 * X3, heat. Heat is a quantity. Two things in contact exchange it toward a balance weighted by
 * how much each holds (mass and amount), and what one gains the other loses: a hot stone
 * warms a cupful and barely touches a pond, and it cools as it does so. Only what is burning
 * gives without end, and even that is bounded by its size. How close the two are weighs the
 * balance against the place, so distance caps how hot a thing gets.
 *
 * A flame lights a surface long before it warms the bulk, so the surface's lead over the
 * bulk is carried as state: a minute in the flame is the same as sixty seconds of it.
 * Only what is burning or glowing can light a thing; hot water cannot.
 */
import { effective } from "./effective.ts";
import { type Grown, grownFor } from "./graph/grown.ts";
import { HEAT_DERIVED, HEAT_RULES } from "./graph/heat-rules.ts";
import { changesOf, envOf, Kernel, partyOf, type Ready, ready } from "./graph/kernel.ts";
import { quantity } from "./scale.ts";
import type { Burning, Change, MatterWorld, Properties, Thing } from "./types.ts";
import { clamp } from "./types.ts";

export interface HeatAct {
  process: "heat";
  source: string;
  target: string;
  minutes: number;
  /** 0 to 1: held in the flame is 1, standing near it is less, across the room is near 0. */
  contact?: number;
}

/** A flame is scorching whatever the fuel is; otherwise the surface leads the bulk. */
export function surfaceTemperature(thing: Thing): number {
  return thing.state.burning ? 5 : clamp(thing.state.temperature + thing.state.surfaceAbove);
}

/**
 * How hard a thing burns, 0 to 5, for whoever draws it. Derived, never stored: by how readily
 * what is burning burns, how much of it there is, and whether it is near its end. Fuel is how
 * long it will last, which is a different question.
 */
export function blaze(world: MatterWorld, thing: Thing): number {
  const burning = thing.state.burning;
  if (!burning) return 0;
  const p = effective(world, thing);
  const coat = thing.state.coating;
  const spread = burning.of === "coating" ? (coat?.coverage ?? 0.5) * 0.6 : 0.4 + p.size * 0.12;
  const dying = Math.min(1, burning.fuel / 3);
  return clamp(p.flammability * spread * (0.4 + 0.6 * dying) + 0.5, 0.5, 5);
}

/**
 * The temperature at which a surface of this flammability lights. Anything that can burn at
 * all lights at a heat a fire reaches; what is hard to light costs time and drying.
 */
export function ignitionPoint(flammability: number): number {
  return flammability <= 0 ? Number.POSITIVE_INFINITY : 5 - flammability * 0.3;
}

/** How much heat a thing holds per level: levels of mass are doublings, and amount counts. */
export function capacity(p: Properties, thing: Thing, giving = false): number {
  // What burns gives far more than the heat it holds, but still by its size.
  return quantity(p.mass) * thing.state.amount * (giving && thing.state.burning ? 20 : 1);
}

/** Minutes of burning in what would burn: the coat if that is what lit, else the thing. */
export function fuelFor(world: MatterWorld, thing: Thing, p: Properties): Burning {
  const coat = thing.state.coating;
  const own = clamp((world.elements[thing.element]?.props.flammability ?? 0) - thing.state.wetness);
  const rate = Math.max(1, p.flammability);
  if (coat && p.flammability > own) return { of: "coating", fuel: (coat.amount * 60) / rate };
  return { of: "self", fuel: ((1 + p.mass) * (1 + p.size) * 20 * thing.state.amount) / rate };
}

/** What the air of the place keeps in a thing: nothing dries below it, whatever heats it. */
export function keptWet(world: MatterWorld, thing: Thing, p: Properties): number {
  const air = Math.max(0, (world.places[thing.place]?.moisture ?? 2) - 2);
  const inside = p.absorbency * 0.8 + (world.elements[thing.element]?.moist ?? 0);
  return Math.max(air, Math.min(air * 1.6, 1 + inside));
}

/**
 * Heat between two things is four rows of data (graph/heat-rules.ts): the target warms, the
 * source pays, the target may take light, a plunge may crack or temper it. Each rule that acts
 * is one change, said about the party the row names.
 */
/** Heat, from the base rows and whatever has grown beside them. */
export function heatFrom(grown: Grown) {
  const kernel = Kernel.with(HEAT_DERIVED, grown);
  const rules = [...HEAT_RULES, ...grown.rules].map((rule) => ready(kernel, rule));
  return (world: MatterWorld, act: HeatAct): Change[] => heatBy(rules, world, act);
}

export const heat = heatFrom(grownFor("heat"));

function heatBy(rules: readonly Ready[], world: MatterWorld, act: HeatAct): Change[] {
  const source = world.things[act.source];
  const target = world.things[act.target];
  if (!(source && target) || source.id === target.id)
    return [{ kind: "nothing", because: [], note: "there is nothing there to heat" }];
  const parties = { tgt: partyOf(world, target), src: partyOf(world, source) };
  const env = envOf(world, parties, act.minutes, {
    minutes: act.minutes,
    contact: act.contact ?? 1,
  });
  const changes: Change[] = [];
  for (const rule of rules) {
    const ran = rule(env);
    if (ran) changes.push(...changesOf(env, ran));
  }
  return changes;
}
