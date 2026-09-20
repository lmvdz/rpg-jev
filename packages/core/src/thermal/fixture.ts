/** Pinned initial conditions only; no scenario branches in execution. */
import { Rng } from "../rng.ts";
import type { Actor, World } from "../types.ts";
import { MECHANICS } from "./contract.ts";
import { type ThermalPart, validatePhysics } from "./physics.ts";

export const CONTENT = "thermal-bench-v1";

function actor(id: string): Actor {
  return {
    id,
    name: id,
    kind: "player",
    room: "bench",
    activity: "experiment",
    hp: 1,
    maxHp: 1,
    alive: true,
    present: true,
    role: "",
    traits: [],
    goals: [],
    motives: [],
    circumstances: [],
    coins: 0,
    drives: { trust: 0, fear: 0, greed: 0, suspicion: 0, obligation: 0 },
    needs: { hunger: 0, rest: 0, warmth: 0, money: 0, safety: 0, company: 0 },
  };
}

function part(id: string, kelvin: number, conductivity: number, slot: number | null): ThermalPart {
  return {
    id,
    label: id,
    slot,
    massKg: 0.02,
    specificHeatJPerKgK: 1000,
    conductivityWPerMK: conductivity,
    energyJ: 20 * kelvin,
  };
}

/** A fixture reset is a new test world, never regeneration in an established one. */
export function benchWorld(): World {
  const world: World = {
    def: { fsms: {}, predicates: [], motives: [], needs: {}, roles: [], debtKinds: [] },
    clock: 0,
    rng: Rng.fromSeed(1).state,
    actors: { ada: actor("ada"), bo: actor("bo") },
    rooms: { bench: { id: "bench", name: "Insulated contact bench", aliases: [], exits: [] } },
    items: {},
    machines: {},
    claims: {},
    edges: [],
    schedules: {},
    debts: {},
    conversation: { beat: 0, queue: [], lastSpokeBeat: {}, lastSpeaker: null },
    thermal: {
      mechanics: MECHANICS,
      room: "bench",
      revision: 0,
      physics: {
        columns: 3,
        rows: 3,
        parts: [
          part("A", 370, 60, 0),
          part("B", 290, 60, 2),
          part("C", 290, 0.1, null),
          part("D", 290, 60, null),
        ],
        probe: { energyJ: 5 * 290, capacityJPerK: 5, conductanceWPerK: 0.05, target: null },
      },
    },
  };
  const errors = world.thermal ? validatePhysics(world.thermal.physics) : ["missing fixture"];
  if (errors.length > 0) throw new Error(errors.join("; "));
  return world;
}
