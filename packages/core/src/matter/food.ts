/**
 * The food session's commands as matter acts. A command is compiled against the terrain and
 * the actor's senses into one act of the process table (`resolve.ts`), or nothing, so the
 * session is an adapter over matter and not a second simulation. `wait` is a choice boundary
 * with no act. The frozen command code it replaces is the oracle in
 * `test/matter/food-oracle.test.ts`.
 */
import { feeds } from "./diet.ts";
import { able } from "./living.ts";
import type { Act } from "./resolve.ts";
import { type MatterTerrain, openTile, tileDistance, tileReach } from "./session-terrain.ts";
import type { MatterWorld } from "./types.ts";

export type FoodAction =
  | { kind: "move"; to: readonly [number, number] }
  | { kind: "take" | "drop" | "eat"; thing: string }
  | { kind: "wait" };

export type FoodAct = Extract<Act, { process: "move" | "take" | "ingest" }>;

function moveAct(world: MatterWorld, terrain: MatterTerrain, actor: string, to: FoodAction) {
  const body = world.bodies[actor];
  if (to.kind !== "move" || !body?.where) return null;
  const speed = able(world, body).speed;
  if (
    !openTile(terrain, to.to) ||
    tileDistance(body.where, to.to) !== 1 ||
    !Number.isFinite(speed) ||
    speed <= 0
  )
    return null;
  // Supply enough stride to reach the adjacent tile exactly even under roundoff.
  return { process: "move", body: actor, to: to.to, minutes: 2 / (speed * 4) } as const;
}

/** What a command asks of matter: an act, `wait`, or null when it cannot be done here. */
export function foodAct(
  world: MatterWorld,
  terrain: MatterTerrain,
  actor: string,
  action: FoodAction,
): FoodAct | "wait" | null {
  const body = world.bodies[actor];
  if (!body?.where || body.health <= 0 || body.attention === "asleep") return null;
  if (action.kind === "wait") return "wait";
  if (action.kind === "move") return moveAct(world, terrain, actor, action);
  const thing = world.things[action.thing];
  const held = (body.holds ?? []).includes(action.thing);
  if (
    !(
      thing?.where &&
      tileReach(terrain, body.where, thing.where) &&
      (held || body.aware?.[thing.id])
    )
  )
    return null;
  if (action.kind === "eat") {
    if ((body.needs.hunger ?? 0) <= 0 || (feeds(world, body, thing.element).hunger ?? 0) <= 0)
      return null;
    return { process: "ingest", body: actor, thing: thing.id, amount: 1 };
  }
  return {
    process: "take",
    body: actor,
    thing: thing.id,
    ...(action.kind === "drop" ? { drop: true as const } : {}),
  };
}
