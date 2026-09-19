/**
 * Load is a check, not a process: whatever bears weight against its strength. Strength is
 * read off effective levels, so a soaked plank, a rusted chain, a cracked beam and one with
 * a hidden flaw are all the same rule. What fails becomes force on itself.
 */
import { baseline, effective } from "./effective.ts";
import { type Grown, grownFor } from "./graph/grown.ts";
import {
  changesOf,
  type Env,
  envOf,
  Kernel,
  type Party,
  partyOf,
  type Ready,
  ready,
} from "./graph/kernel.ts";
import { FALL_RULES, LOAD_DERIVED, LOAD_RULES } from "./graph/soak-rules.ts";
import { levelOf, quantity } from "./scale.ts";
import type { Body, Change, MatterWorld, Thing } from "./types.ts";
import { FRESH } from "./types.ts";

export interface LoadAct {
  process: "load";
  support: string;
  /** Things whose mass it is asked to bear. */
  bearing: string[];
}

const GROWN = grownFor("load");
const KERNEL = Kernel.with(LOAD_DERIVED, GROWN);
const STRENGTH = KERNEL.num("d.strength");

const run = (rules: readonly Ready[], env: Env): Change[] =>
  rules.flatMap((rule) => {
    const ran = rule(env);
    return ran ? changesOf(env, ran) : [];
  });

/**
 * What it can bear, on the same scale as mass. It is said once, as data (graph/soak-rules.ts,
 * `strength`), and this reads it off: a steady load is borne by hardness and by how much
 * material there is, less for what is cracked, flawed or rusted.
 */
export function strength(world: MatterWorld, support: Thing): number {
  return STRENGTH(envOf(world, { sup: partyOf(world, support) }, 0, { borne: 0 }));
}

/** Weights add as quantities and are read back as a level, so amount counts (scale.ts). */
export function weight(world: MatterWorld, ids: readonly string[]): number {
  const total = ids.reduce((sum, id) => {
    const thing = world.things[id];
    if (thing) return sum + quantity(effective(world, thing).mass) * thing.state.amount;
    const body = world.bodies[id];
    return body ? sum + quantity(world.elements[body.element ?? ""]?.props.mass ?? 3) : sum;
  }, 0);
  return levelOf(total);
}

/** A body as a party to a fall: how heavy it is, by its own row if it has one. */
function faller(world: MatterWorld, body: Body): Party {
  const thing: Thing = {
    id: body.id,
    element: body.element ?? "",
    place: body.place,
    state: FRESH,
  };
  const mass = world.elements[body.element ?? ""]?.props.mass ?? 3;
  const p = baseline(undefined);
  return { thing, p, place: world.places[body.place], s: FRESH, was: FRESH, x: {}, b: { mass } };
}

/** Load, from the base rows and whatever has grown beside them. */
export function loadFrom(grown: Grown) {
  const kernel = Kernel.with(LOAD_DERIVED, grown);
  const BEARS = [...LOAD_RULES, ...grown.rules].map((rule) => ready(kernel, rule));
  const FALLS = FALL_RULES.map((rule) => ready(kernel, rule));

  /** Load is rows of data: the support bears or gives way, and each body it bore falls. */
  function load(world: MatterWorld, act: LoadAct): Change[] {
    const support = world.things[act.support];
    if (!support)
      return [{ kind: "nothing", because: [], note: "there is nothing there to bear it" }];
    const numbers = { borne: weight(world, act.bearing) };
    const changes = run(BEARS, envOf(world, { sup: partyOf(world, support) }, 0, numbers));
    for (const id of act.bearing) {
      const body = world.bodies[id];
      if (!body) continue;
      const parties = { who: faller(world, body), sup: partyOf(world, support) };
      changes.push(...run(FALLS, envOf(world, parties, 0, numbers)));
    }
    return changes;
  }
  return load;
}

export const load = loadFrom(GROWN);
