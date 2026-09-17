/**
 * World tables (SPEC.md section 4). Everything here is plain JSON so the world
 * can be cloned, compared and, later, ported to server tables row for row.
 * Nothing in this file changes state; `effects.ts` is the only write path.
 */
import type { RngState } from "./rng.ts";

export type ActorId = string;
export type RoomId = string;
export type ItemId = string;
export type ClaimId = string;
export type DebtId = string;
/** Index of an entry in the event log. Every state change points at one. */
export type LogId = number;
/** Game time in minutes since midnight. */
export type Minute = number;

export const DRIVES = ["trust", "fear", "greed", "suspicion", "obligation"] as const;
export type Drive = (typeof DRIVES)[number];
export const NEEDS = ["hunger", "rest", "money", "safety", "company"] as const;
export type Need = (typeof NEEDS)[number];

export interface Actor {
  id: ActorId;
  name: string;
  kind: "player" | "npc";
  room: RoomId;
  /** What the schedule has them doing; a key into the prose tables. */
  activity: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** False once retired from the world. */
  present: boolean;
  role: string;
  traits: string[];
  goals: string[];
  motives: string[];
  circumstances: string[];
  drives: Record<Drive, number>;
  needs: Record<Need, number>;
  coins: number;
}

export type Place = { room: RoomId } | { holder: ActorId } | { inside: ItemId };

export interface Item {
  id: ItemId;
  name: string;
  aliases: string[];
  at: Place;
  takeable: boolean;
  /** Set when the item can only be seen once its machine reaches this node. */
  visibleFrom?: { machine: string; node: string };
}

export interface Exit {
  to: RoomId;
  /** Machine id of a door; passable only while its node is `unlocked`. */
  door?: string;
}

export interface Room {
  id: RoomId;
  name: string;
  aliases: string[];
  exits: Exit[];
}

/** A finite state machine instance: a quest, a door, a hidden thing. */
export interface Machine {
  id: string;
  fsm: string;
  node: string;
}

/**
 * A structured claim (SPEC.md section 6): who did what to whom. Claims are
 * immutable rows. A retelling that changes a detail is a new row pointing at
 * the one it was derived from.
 */
export interface Claim {
  id: ClaimId;
  subject: ActorId;
  predicate: string;
  /** What the act was done to or with. */
  object?: string;
  /** To whom (SPEC.md section 6: who, did, to whom). */
  to?: ActorId;
  place?: RoomId;
  /** When the claimed thing happened (valid time). */
  when: Minute;
  severity: 1 | 2 | 3;
  motive?: string;
  /** Log entry of the root event, or null for a claim nobody witnessed (a lie, a guess). */
  origin: LogId | null;
  derivedFrom?: ClaimId;
  distortion?: string;
}

export type BeliefSource =
  | { kind: "witnessed" }
  | { kind: "told"; from: ActorId }
  | { kind: "shown"; from: ActorId }
  | { kind: "inferred" };

export type EdgeKind = "believes" | "stance" | "told" | "derived";

/**
 * One row of the bitemporal graph: `edge(src, dst, kind, valid_from, valid_to,
 * known_from, cause_id)`. Rows are never overwritten; a change closes the old
 * row by setting `valid_to` and inserts a new one.
 */
export interface Edge {
  src: string;
  dst: string;
  kind: EdgeKind;
  valid_from: Minute;
  valid_to: Minute | null;
  known_from: Minute;
  cause_id: LogId;
  credence?: number;
  source?: BeliefSource;
  node?: string;
  claim?: ClaimId;
}

/**
 * A schedule entry built only from the legal primitives of SPEC.md section 7:
 * `at`, `every`, `after`, `until` and `at_location`. Exactly one of `at`,
 * `every` and `after` says when it starts. `until` is an absolute minute for
 * an `at` entry and a length in minutes for `every` and `after` entries.
 */
export interface ScheduleEntry {
  id: string;
  activity: string;
  at_location: RoomId;
  at?: Minute;
  every?: { period: Minute; offset: Minute };
  after?: string;
  until: Minute;
  /** Too occupied for idle talk; the conversation scheduler defers remarks. */
  busy?: boolean;
  cause: LogId | null;
}

export const LAYERS = ["overrides", "commitments", "needs", "role"] as const;
export type Layer = (typeof LAYERS)[number];

/** The `needs` layer is derived from need floats, so it is not stored. */
export interface Schedule {
  overrides: ScheduleEntry[];
  commitments: ScheduleEntry[];
  role: ScheduleEntry[];
  /** Where the NPC is when no entry is active. */
  home: { at_location: RoomId; activity: string };
}

/** A pending consequence (SPEC.md section 9). */
export interface Debt {
  id: DebtId;
  cause: LogId | null;
  stakeholder: ActorId;
  kind: string;
  magnitude: 1 | 2 | 3;
  fuse: { due: Minute; expires?: Minute };
  status: "pending" | "fired" | "cancelled";
  data: Record<string, string>;
}

export const SPEECH_ACTS = [
  "greet",
  "ask",
  "tell",
  "accuse",
  "offer",
  "threaten",
  "insult",
  "remark",
  "confide",
  "request",
  "refuse",
  "promise",
] as const;
export type SpeechAct = (typeof SPEECH_ACTS)[number];

export type Topic =
  | { kind: "claim"; id: ClaimId }
  | { kind: "entity"; id: string }
  | { kind: "whereabouts"; id: ActorId }
  | { kind: "request"; id: string }
  | { kind: "none" };

/** All conversation is structured (SPEC.md section 5). */
export interface SpeechIntent {
  id: string;
  speaker: ActorId;
  listener: ActorId;
  act: SpeechAct;
  topic: Topic;
  /** 3 answers a direct address, 2 may interrupt, 1 is a remark that can wait. */
  priority: 1 | 2 | 3;
  createdBeat: number;
  cause: LogId;
}

export interface Conversation {
  beat: number;
  queue: SpeechIntent[];
  lastSpokeBeat: Record<ActorId, number>;
  lastSpeaker: ActorId | null;
}

/** Static data the rules need. Set once by content and never changed by effects. */
export interface WorldDef {
  /** fsm name -> node -> legal successor nodes. */
  fsms: Record<string, Record<string, string[]>>;
  /** Known claim predicates; an unknown one fails validation. */
  predicates: string[];
  motives: string[];
  needs: Partial<Record<Need, { threshold: number; satisfied: number; entry: ScheduleEntry }>>;
  roles: string[];
  debtKinds: string[];
}

export interface World {
  def: WorldDef;
  clock: Minute;
  rng: RngState;
  actors: Record<ActorId, Actor>;
  rooms: Record<RoomId, Room>;
  items: Record<ItemId, Item>;
  machines: Record<string, Machine>;
  claims: Record<ClaimId, Claim>;
  edges: Edge[];
  schedules: Record<ActorId, Schedule>;
  debts: Record<DebtId, Debt>;
  conversation: Conversation;
}
