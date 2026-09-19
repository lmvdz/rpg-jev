/**
 * Chaining. One-step choices do not make behaviour: fetching food home is take, go, set down,
 * and nobody should have to write that sequence. Here a goal is a row of data, the steps are the
 * engine's own primitive acts, and the model of what a step does is the engine itself
 * (`resolve`): a breadth-first search over a few acts about a few things finds the shortest
 * sequence that makes the goal hold. Nothing here knows what carrying is.
 *
 * Deterministic: acts are tried in a fixed order and the first shortest plan wins.
 */
import { apart } from "../bonds.ts";
import { able } from "../living.ts";
import { type Act, resolve } from "../resolve.ts";
import type { MatterWorld } from "../types.ts";

/** What is wanted, as data. A new kind of goal is a row in `GOALS`. */
export type Goal =
  | {
      readonly kind: "near";
      readonly a: string;
      readonly b: string;
      readonly within: number;
      readonly free?: true;
    }
  | { readonly kind: "holds"; readonly body: string; readonly thing: string };

const whereOf = (world: MatterWorld, id: string) => (world.things[id] ?? world.bodies[id])?.where;

const heldBy = (world: MatterWorld, thing: string) =>
  Object.values(world.bodies).some((b) => (b.holds ?? []).includes(thing));

type Met<K extends Goal["kind"]> = (
  world: MatterWorld,
  goal: Extract<Goal, { kind: K }>,
) => boolean;

const GOALS: { [K in Goal["kind"]]: Met<K> } = {
  // Beside each other, and (if it must be free) in nobody's grip.
  near: (world, g) =>
    apart(whereOf(world, g.a), whereOf(world, g.b)) <= g.within && !(g.free && heldBy(world, g.a)),
  holds: (world, g) => (world.bodies[g.body]?.holds ?? []).includes(g.thing),
};

export function met(world: MatterWorld, goal: Goal): boolean {
  return (GOALS[goal.kind] as Met<typeof goal.kind>)(world, goal);
}

/** Tiles a minute for each level of speed (living.ts). */
const PACE = 4;

/** The primitive acts this body could try about these things, in a fixed order. */
function steps(world: MatterWorld, body: string, about: readonly string[]): Act[] {
  const me = world.bodies[body];
  if (!me) return [];
  const out: Act[] = [];
  for (const id of about) {
    const gap = apart(me.where, whereOf(world, id));
    const speed = able(world, me).speed * PACE;
    // Going is one step however far: as many minutes as it takes to get there.
    if (gap > 1.5 && speed > 0)
      out.push({ process: "move", body, toward: id, minutes: Math.ceil(gap / speed) });
    if (!(id in world.things)) continue;
    const held = (me.holds ?? []).includes(id);
    out.push(
      held
        ? { process: "take", body, thing: id, drop: true }
        : { process: "take", body, thing: id },
    );
  }
  return out;
}

/** What tells two worlds apart, as far as a plan about these things cares. */
function key(world: MatterWorld, body: string, about: readonly string[]): string {
  const spot = (id: string) =>
    (whereOf(world, id) ?? [0, 0]).map((x) => Math.round(x * 2) / 2).join(",");
  const holds = [...(world.bodies[body]?.holds ?? [])].sort().join("+");
  return `${spot(body)}|${holds}|${about.map(spot).join("|")}`;
}

/**
 * The shortest sequence of this body's acts, about these things, after which the goal holds.
 * Null if there is none within `depth`. An empty plan means it already holds.
 */
export function planFor(
  world: MatterWorld,
  body: string,
  goal: Goal,
  about: readonly string[],
  depth = 5,
): Act[] | null {
  let frontier: { world: MatterWorld; plan: Act[] }[] = [{ world, plan: [] }];
  const seen = new Set([key(world, body, about)]);
  for (let d = 0; d <= depth; d++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      if (met(node.world, goal)) return node.plan;
      if (d === depth) continue;
      for (const act of steps(node.world, body, about)) {
        const after = resolve(node.world, act).world;
        const k = key(after, body, about);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ world: after, plan: [...node.plan, act] });
      }
    }
    frontier = next;
  }
  return null;
}
