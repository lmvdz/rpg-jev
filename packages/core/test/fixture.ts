import { type Actor, Rng, type ScheduleEntry, type World } from "../src/index.ts";

const actor = (id: string, kind: Actor["kind"], room: string): Actor => ({
  id,
  name: id,
  kind,
  room,
  activity: "idle",
  hp: 5,
  maxHp: 5,
  alive: true,
  present: true,
  role: kind === "npc" ? "cook" : "guest",
  traits: [],
  goals: [],
  motives: [],
  circumstances: [],
  drives: { trust: 0.5, fear: 0.2, greed: 0.3, suspicion: 0.4, obligation: 0.1 },
  needs: { hunger: 0.2, rest: 0, warmth: 0, money: 0, safety: 0, company: 0 },
  coins: 10,
});

export const entry = (
  e: Partial<ScheduleEntry> & { id: string; until: number },
): ScheduleEntry => ({
  activity: "working",
  at_location: "kitchen",
  cause: null,
  ...e,
});

/** A two-room world with a player, two NPCs, a key and a locked door. */
export function tinyWorld(seed = 7): World {
  return {
    def: {
      fsms: {
        stance: {
          wary: ["curious", "hostile"],
          curious: ["wary", "loyal"],
          hostile: [],
          loyal: [],
        },
        door: { locked: ["unlocked"], unlocked: ["locked"] },
        quest: { suspected: ["cleared", "condemned"], cleared: [], condemned: [] },
      },
      predicates: ["took", "was_near"],
      motives: ["to_fetch_ale"],
      needs: {
        hunger: {
          threshold: 0.7,
          satisfied: 0.2,
          entry: entry({
            id: "need_hunger",
            activity: "eating",
            at_location: "kitchen",
            at: 0,
            until: 1,
          }),
        },
      },
      roles: ["cook", "stablehand"],
      debtKinds: ["report"],
    },
    clock: 600,
    rng: Rng.fromSeed(seed).state,
    actors: {
      player: actor("player", "player", "hall"),
      ann: actor("ann", "npc", "hall"),
      bo: actor("bo", "npc", "kitchen"),
    },
    rooms: {
      hall: {
        id: "hall",
        name: "hall",
        aliases: [],
        exits: [{ to: "kitchen", door: "kitchen_door" }],
      },
      kitchen: {
        id: "kitchen",
        name: "kitchen",
        aliases: [],
        exits: [{ to: "hall", door: "kitchen_door" }],
      },
    },
    items: {
      key: { id: "key", name: "iron key", aliases: ["key"], at: { room: "hall" }, takeable: true },
    },
    machines: {
      kitchen_door: { id: "kitchen_door", fsm: "door", node: "locked" },
      quest: { id: "quest", fsm: "quest", node: "suspected" },
    },
    claims: {},
    edges: [
      {
        src: "ann",
        dst: "player",
        kind: "stance",
        valid_from: 0,
        valid_to: null,
        known_from: 0,
        cause_id: 0,
        node: "wary",
      },
    ],
    schedules: {
      ann: {
        overrides: [],
        commitments: [],
        role: [],
        home: { at_location: "hall", activity: "idle" },
      },
      bo: {
        overrides: [],
        commitments: [],
        role: [],
        home: { at_location: "kitchen", activity: "idle" },
      },
    },
    debts: {},
    conversation: { beat: 0, queue: [], lastSpokeBeat: {}, lastSpeaker: null },
  };
}
