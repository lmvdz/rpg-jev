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
import { effective, isLiquid } from "./effective.ts";
import { quantity } from "./scale.ts";
import type { Burning, Change, MatterWorld, Properties, Thing, ThingState } from "./types.ts";
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

function toward(from: number, to: number, rate: number, minutes: number): number {
  return from + (to - from) * (1 - Math.exp(-rate * minutes));
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

interface Meeting {
  source: Thing;
  target: Thing;
  p: Properties;
  to: number;
  liquid: boolean;
  act: HeatAct;
}

function ignition(world: MatterWorld, m: Meeting, next: ThingState, surface: number): Change[] {
  if (next.burning) return [];
  const glowing = !m.liquid && surfaceTemperature(m.source) >= 4.5;
  const air = world.places[m.target.place]?.air ?? 5;
  const p = effective(world, { ...m.target, state: next });
  if (!(m.source.state.burning || glowing) || air <= 0) return [];
  if (surface < ignitionPoint(p.flammability)) return [];
  const burning = fuelFor(world, { ...m.target, state: next }, p);
  if (burning.fuel <= 0) return [];
  return [
    {
      kind: "state",
      thing: m.target.id,
      set: { burning },
      because: ["P6", "S1", "R6", burning.of === "coating" ? "M6" : "S3"],
      note: burning.of === "coating" ? "its coat takes light" : "it takes light",
    },
  ];
}

/**
 * Sudden change cracks what is not tough; cooled fast from hot, a meltable thing tempers. It
 * is the gap at the moment of the plunge that does it, so it does not matter how the minutes
 * after are counted.
 */
function shock({ target, p, source, liquid }: Meeting): Change[] {
  const gap = target.state.temperature - source.state.temperature;
  if (gap < 2 || !liquid) return [];
  if (p.toughness <= 1.5 && p.meltsAt <= 0)
    return [
      {
        kind: "state",
        thing: target.id,
        set: { integrity: Math.min(target.state.integrity, 3) },
        because: ["P4", "S1", "X3"],
        note: "it cracks from the sudden cold",
      },
    ];
  if (p.meltsAt > 0 && target.state.temperature >= 4)
    return [
      {
        kind: "state",
        thing: target.id,
        set: { temper: clamp(target.state.temper + 1, 0, 2) },
        because: ["M2", "S1", "X3"],
        note: "cooled fast from hot, it comes out harder and less tough",
      },
    ];
  return [];
}

/**
 * What the source gives up or takes in, so that the two together hold no more heat than
 * before: a hot stone cools in the pot, and a quench trough warms. What burns does not cool;
 * the minutes it gives come out of its fuel.
 */
function drawn(source: Thing, held: number, given: number, minutes: number): Change[] {
  const fire = source.state.burning;
  if (fire) {
    const fuel = fire.fuel - minutes;
    const spent = fuel <= 1e-9;
    const coatGone = spent && fire.of === "coating" ? { coating: null } : {};
    return [
      {
        kind: "state",
        thing: source.id,
        set: { burning: spent ? null : { ...fire, fuel }, ...coatGone },
        because: ["S3", "S14", "X3"],
        note: spent ? "it burns out" : "it burns down",
        ...(spent ? {} : { quiet: true as const }),
      },
    ];
  }
  if (given === 0) return [];
  return [
    {
      kind: "state",
      thing: source.id,
      set: { temperature: clamp(source.state.temperature - given / held) },
      because: ["X3", "P1", "S14", "S1"],
      note: given > 0 ? "it cools as it gives up its heat" : "it warms as it takes the heat",
    },
  ];
}

export function heat(world: MatterWorld, act: HeatAct): Change[] {
  const source = world.things[act.source];
  const target = world.things[act.target];
  if (!(source && target) || source.id === target.id)
    return [{ kind: "nothing", because: [], note: "there is nothing there to heat" }];
  const p = effective(world, target);
  const contact = act.contact ?? 1;
  const liquid = isLiquid(world, source) || isLiquid(world, target);
  const held = capacity(effective(world, source), source, true);
  const holds = capacity(p, target);
  const was = target.state.temperature;
  // What burns keeps its heat for as long as it burns, and gives it by its size: a spark
  // lasts seconds and warms little, a hearth lasts hours. What does not burn shares what it holds.
  const fire = source.state.burning;
  const minutes = fire ? Math.min(act.minutes, fire.fuel) : act.minutes;
  const power = fire ? Math.min(1, held / holds) : 1;
  const shared = fire ? 5 : (held * surfaceTemperature(source) + holds * was) / (held + holds);
  const around = world.places[target.place]?.temperature ?? 2;
  const to = around + (shared - around) * contact;
  // Plunged in a liquid, a thing gives up its heat many times faster than in air.
  const rate =
    ((0.1 + p.conductivity * 0.06) * contact * power * (liquid ? 8 : 1)) / (1 + p.mass * 0.3);
  const temperature = clamp(toward(was, to, rate, minutes));
  const meeting: Meeting = { source, target, p, to, liquid, act };
  const flame = source.state.burning ? 5 : surfaceTemperature(source);
  const reach = around + (flame - around) * contact;
  const surface = toward(
    was + target.state.surfaceAbove,
    reach,
    (1 + p.flammability * 1.5) * contact,
    minutes,
  );
  // A liquid wets rather than dries, and nothing dries below what its place keeps in it.
  const warm = Math.max(0, (was + temperature) / 2 - 2.5);
  const dried = isLiquid(world, source) ? 0 : warm * 0.05 * minutes;
  const wetness = Math.max(
    Math.min(target.state.wetness, keptWet(world, target, p)),
    target.state.wetness - dried,
  );
  const next: ThingState = {
    ...target.state,
    temperature,
    surfaceAbove: Math.max(0, clamp(surface) - temperature),
    wetness: clamp(wetness),
    contamination: temperature >= 4.5 ? 0 : target.state.contamination,
    set: target.state.set || (p.setting > 0 && temperature >= 4.5),
  };
  return [
    {
      kind: "state",
      thing: target.id,
      set: next,
      because: ["X3", "P7", "P1", "S14", "S1", "S2"],
      note: temperature > was ? "it heats" : "it cools",
    },
    ...drawn(source, held, holds * (temperature - was), minutes),
    ...ignition(world, meeting, next, surface),
    ...shock(meeting),
  ];
}
