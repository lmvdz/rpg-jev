/**
 * What the tooltip says about a tile: the thing on it, then the ground. Like
 * the look, the words come from data and from one rule per visible state,
 * never from knowing what the thing is: anything with a growth stage can be
 * "a seedling", anything burning can be "burning low".
 */
import { LEVEL, SHAPE, type TileGrid } from "../terrain/grid.ts";
import { kindAt } from "../terrain/kinds.ts";
import type { ThingView, VisibleStates } from "./things.ts";

const GROWTH = ["a seed", "a sprout", "still growing", "full grown", "bearing", "dormant", "dead"];
const BURNING = ["", "smouldering", "burning low", "burning", "burning well", "blazing"];
const AMOUNT = ["none left", "a little", "some", "a fair amount", "plenty", "a great deal"];
const TEMPERATURE = ["frozen", "cold", "", "warm", "hot", "scorching"];
const WETNESS = ["", "damp", "damp", "wet", "wet", "soaked"];
const INTEGRITY = ["in pieces", "broken", "badly cracked", "cracked", "chipped", ""];
const CORROSION = ["", "tarnished", "tarnished", "corroded", "corroded", "eaten away"];
const CONTAMINATION = ["", "", "gone off", "spoiled", "rotten", "putrid"];
const SLANTS: Readonly<Record<number, string>> = {
  [SHAPE.slantN]: "a slope up to the north",
  [SHAPE.slantE]: "a slope up to the east",
  [SHAPE.slantS]: "a slope up to the south",
  [SHAPE.slantW]: "a slope up to the west",
  [SHAPE.hole]: "a hole",
};

/** One row per visible state: the words for its level, or nothing. */
const STATE_WORDS: readonly ((states: VisibleStates) => string | undefined)[] = [
  (states) => (states.burning ? BURNING[Math.round(states.burning)] : undefined),
  (states) => (states.growth === undefined ? undefined : GROWTH[states.growth]),
  (states) => (states.amount === undefined ? undefined : AMOUNT[Math.round(states.amount)]),
  (states) =>
    states.temperature === undefined ? undefined : TEMPERATURE[Math.round(states.temperature)],
  (states) => (states.wetness === undefined ? undefined : WETNESS[Math.round(states.wetness)]),
  (states) =>
    states.integrity === undefined ? undefined : INTEGRITY[Math.round(states.integrity)],
  (states) => CORROSION[Math.round(states.corrosion ?? 0)],
  (states) => CONTAMINATION[Math.round(states.contamination ?? 0)],
];

export function describeThing(thing: ThingView): string {
  const words = STATE_WORDS.map((row) => row(thing.states)).filter((word) => word);
  return words.length > 0 ? `${thing.name}: ${words.join(", ")}` : thing.name;
}

export function describeGround(grid: TileGrid, index: number): string {
  const x = index % grid.width;
  const z = Math.floor(index / grid.width);
  const shape = SLANTS[grid.shapeAt(x, z)];
  const height = grid.heightAt(x, z) * LEVEL;
  const parts = [kindAt(grid.kindAt(x, z)).name, shape, `${height} m up`];
  return parts.filter((part) => part).join(", ");
}

export interface TileReport {
  index: number;
  thing: ThingView | null;
  /** Whether the hero stands here. */
  hero: boolean;
}

/** The tooltip's lines, most particular first. */
export function describeTile(grid: TileGrid, report: TileReport): string[] {
  const lines: string[] = [];
  if (report.hero) lines.push("you");
  if (report.thing) lines.push(describeThing(report.thing));
  lines.push(describeGround(grid, report.index));
  return lines;
}
