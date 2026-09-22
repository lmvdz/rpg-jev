import { describe, expect, it } from "vitest";
import {
  attempt,
  createMatterSession,
  type MatterAction,
  type MatterSession,
  stepMatterSession,
} from "../../src/matter/session.ts";
import { FRESH } from "../../src/matter/types.ts";
import { Rng } from "../../src/rng.ts";
import { referenceAttempt } from "./food-reference.ts";
import { clearing } from "./held-out-fixture.ts";

function session(rng: Rng): MatterSession {
  const world = clearing();
  const place = world.places.clearing;
  if (place) place.light = 5;
  const body = (id: string, x: number, z: number) => ({
    id,
    place: "clearing",
    where: [x, z] as const,
    health: 5,
    needs: { hunger: 1 + Math.floor(rng.next() * 5) },
    sickness: 0,
    sickensIn: 0,
    wounds: [],
  });
  world.bodies = { a: body("a", 1, 2), b: body("b", 5, 2) };
  world.things = {};
  for (let i = 0; i < 4; i++)
    world.things[`f${i}`] = {
      id: `f${i}`,
      place: "clearing",
      element: "food",
      where: [Math.floor(rng.next() * 8), Math.floor(rng.next() * 6)],
      state: { ...FRESH, amount: 1 + Math.floor(rng.next() * 3) },
    };
  return createMatterSession({
    world,
    controlled: ["a"],
    autonomous: ["b"],
    terrain: { place: "clearing", width: 8, height: 6, walkable: Array(48).fill(true) },
  });
}

function command(rng: Rng, s: MatterSession): MatterAction {
  const roll = rng.next();
  const things = Object.keys(s.world.things);
  const thing = things[Math.floor(rng.next() * things.length)] ?? "none";
  const where = s.world.bodies.a?.where ?? [0, 0];
  const steps = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  const [dx, dz] = steps[Math.floor(rng.next() * 4)] ?? [1, 0];
  if (roll < 0.4) return { kind: "move", to: [where[0] + dx, where[1] + dz] };
  if (roll < 0.6) return { kind: "eat", thing };
  if (roll < 0.75) return { kind: "take", thing };
  if (roll < 0.85) return { kind: "drop", thing };
  return { kind: "wait" };
}

describe("the food session is an adapter over matter acts", () => {
  it("compiles every command to the same changes as the frozen command code", () => {
    const rng = Rng.fromSeed(4242);
    let compared = 0;
    for (let run = 0; run < 60; run++) {
      let s = session(rng);
      for (let turn = 0; turn < 25; turn++) {
        const action = command(rng, s);
        for (const actor of ["a", "b"]) {
          expect(attempt(s, actor, action)).toEqual(referenceAttempt(s, actor, action));
          compared++;
        }
        const step = stepMatterSession(s, { actor: "a", tick: s.tick, action });
        s = step.session;
      }
    }
    expect(compared).toBe(3000);
  });
});
