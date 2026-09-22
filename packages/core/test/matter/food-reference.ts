/**
 * Frozen copy of the food session's command code before it became an adapter over matter
 * acts (`src/matter/food.ts`). Keep independent of the adapter: the oracle test compares them.
 */
import { ingest } from "../../src/matter/body.ts";
import { feeds } from "../../src/matter/diet.ts";
import { able, move, take } from "../../src/matter/living.ts";
import type { MatterAction, MatterSession } from "../../src/matter/session.ts";
import { openTile, tileDistance, tileReach } from "../../src/matter/session-terrain.ts";
import type { Change } from "../../src/matter/types.ts";

export function referenceAttempt(
  session: MatterSession,
  actor: string,
  action: MatterAction,
): Change[] | null {
  const { world, terrain } = session;
  const body = world.bodies[actor];
  if (!body?.where || body.health <= 0 || body.attention === "asleep") return null;
  if (action.kind === "wait") return [];
  if (action.kind === "move") {
    const speed = able(world, body).speed;
    if (
      !openTile(terrain, action.to) ||
      tileDistance(body.where, action.to) !== 1 ||
      !Number.isFinite(speed) ||
      speed <= 0
    )
      return null;
    return move(world, {
      process: "move",
      body: actor,
      to: action.to,
      minutes: 2 / (speed * 4),
    });
  }
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
    return ingest(world, { process: "ingest", body: actor, thing: thing.id, amount: 1 });
  }
  return take(world, {
    process: "take",
    body: actor,
    thing: thing.id,
    ...(action.kind === "drop" ? { drop: true as const } : {}),
  });
}
