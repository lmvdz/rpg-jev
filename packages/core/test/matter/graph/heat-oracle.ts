/**
 * Heat between two things as it was when it was one function, kept word for word as the oracle
 * for the rows that replaced it (heat-rules.test.ts). Nothing in the engine reads this. When a
 * rule is changed on purpose, change the row and this together, or retire both.
 */

import { capacity, fuelFor, keptWet } from "../../../src/matter/heat.ts";
import {
  type Change,
  clamp,
  effective,
  type HeatAct,
  ignitionPoint,
  isLiquid,
  type MatterWorld,
  type Properties,
  surfaceTemperature,
  type Thing,
  type ThingState,
} from "../../../src/matter/index.ts";

function toward(from: number, to: number, rate: number, minutes: number): number {
  return from + (to - from) * (1 - Math.exp(-rate * minutes));
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

export function heatOracle(world: MatterWorld, act: HeatAct): Change[] {
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
