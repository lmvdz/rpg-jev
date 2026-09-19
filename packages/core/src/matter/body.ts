/**
 * X6, ingest, and X8's search. What is eaten passes into the body: what it serves, and
 * whatever harm it carries, with a delay before the harm shows. A search settles a latent
 * fact: how common the thing is here is a level the judge scored once for this kind of
 * place; the odds, the time and the draw are code.
 */
import { feeds } from "./diet.ts";
import { effective } from "./effective.ts";
import { born } from "./scale.ts";
import type { Change, MatterWorld } from "./types.ts";
import { clamp } from "./types.ts";

export interface IngestAct {
  process: "ingest";
  body: string;
  thing: string;
  amount?: number;
}

export interface SearchAct {
  process: "search";
  place: string;
  element: string;
  /** Effort is time: a glance is a minute, a thorough search is an hour. */
  minutes: number;
  /** A draw in [0, 1) that the caller made and logged. */
  draw: number;
}

export function ingest(world: MatterWorld, act: IngestAct): Change[] {
  const body = world.bodies[act.body];
  const thing = world.things[act.thing];
  if (!(body && thing))
    return [{ kind: "nothing", because: [], note: "there is nothing there to eat" }];
  const p = effective(world, thing);
  const eaten = Math.min(act.amount ?? 1, thing.state.amount);
  // What it gets from it is by what it is to this eater (diet.ts).
  const serves = feeds(world, body, thing.element);
  const needs = { ...body.needs };
  for (const [need, gives] of Object.entries(serves) as [keyof typeof needs, number][])
    needs[need] = clamp((needs[need] ?? 0) - gives * eaten);
  // What lives in it harms by how much of it this eater shrugs off; a poison harms all alike.
  const living = Math.max(0, thing.state.contamination * 0.8 - (body.tolerates ?? 0));
  const harm = (p.noxiousness - thing.state.contamination * 0.8 + living) * eaten;
  // A trace does nothing; doses add, the second counting for half.
  const sick = harm >= 0.3;
  const sickness = clamp(Math.max(body.sickness, harm) + Math.min(body.sickness, harm) * 0.5);
  return [
    {
      kind: "body",
      body: body.id,
      set: sick ? { needs, sickness, sickensIn: Math.max(20, 240 - harm * 40) } : { needs },
      because: ["X6", "P20", "B1", ...(sick ? ["P17", "S9", "S13", "M4", "B4"] : [])],
      note: sick ? "it goes down, and something in it will tell later" : "it goes down",
    },
    { kind: "consume", thing: thing.id, amount: eaten, because: ["E4"], note: "it is eaten" },
  ];
}

/** What one minute on fresh ground turns up, by abundance level. */
const PER_MINUTE = [0, 0.004, 0.02, 0.08, 0.25, 0.7];
/** How many the level stands for in one place. Rare is a couple; everywhere is past counting. */
const STOCK = [0, 2, 8, 40, 200, 1000];

/**
 * How many a search should turn up. Ground gone over gives less, by total minutes, so the
 * answer is the same however the time is cut into acts. What has been taken is gone, in
 * proportion to the stock the level stands for: a patch of grass gives out after a stone or
 * two, and nobody empties a quarry by hand.
 */
export function searchYield(world: MatterWorld, act: SearchAct): number {
  const place = world.places[act.place];
  const before = place?.searched[act.element] ?? { minutes: 0, found: 0 };
  const level = Math.floor(clamp(place?.abundance[act.element] ?? 0));
  // A bigger place holds more and takes longer to go over.
  const extent = Math.max(1, place?.extent ?? 1);
  // A density fills a bigger place with more. A rare thing is a couple in the whole place,
  // however big: more ground only makes them harder to come on.
  const rare = level <= 1;
  const stock = (STOCK[level] ?? 0) * (rare ? 1 : extent);
  const rate = (PER_MINUTE[level] ?? 0) / (rare ? extent : 1);
  if (stock <= 0 || act.minutes <= 0) return 0;
  const patch = 30 * extent;
  // What all the minutes so far should have turned up, as one curve: ground gone over gives
  // less, and the stock runs down as it is found. An act's yield is a stretch of that curve.
  const upTo = (minutes: number) =>
    stock * (1 - Math.exp((-rate * patch * Math.log((patch + minutes) / patch)) / stock));
  const expected = upTo(before.minutes + act.minutes) - upTo(before.minutes);
  return Math.max(0, Math.min(stock - before.found, expected));
}

/** The odds of finding at least one. */
export function searchOdds(world: MatterWorld, act: SearchAct): number {
  return Math.min(1, searchYield(world, act));
}

export function search(world: MatterWorld, act: SearchAct): Change[] {
  const expected = searchYield(world, act);
  const whole = Math.floor(expected);
  const found = whole + (act.draw < expected - whole ? 1 : 0);
  const settle: Change = {
    kind: "settle",
    place: act.place,
    element: act.element,
    minutes: act.minutes,
    found,
    because: ["X8", "E11"],
    note: found ? "the search turns one up" : "the search turns up nothing",
  };
  if (!found) return [settle];
  return [
    settle,
    {
      kind: "create",
      thing: born(
        world,
        { id: `${act.element}.${world.next}`, element: act.element, place: act.place },
        { amount: found },
      ),
      because: ["X8", "E11", "E3"],
      note: "what was latent is now there",
    },
  ];
}
