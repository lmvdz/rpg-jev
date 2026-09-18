/**
 * The Gilded Carp as data, from `docs/world-bible.md`. Everything here is
 * initial state or static vocabulary; nothing in this file decides anything.
 */
import {
  type Actor,
  type Claim,
  type Debt,
  type Edge,
  makeClaim,
  type Need,
  Rng,
  type Schedule,
  type ScheduleEntry,
  type World,
} from "@rpg-jev/core";

export const CONTENT_VERSION = "gilded-carp-1";

export const PLAYER = "player";
export const MARA = "mara";
export const TOBIN = "tobin";
export const ODO = "odo";
/** Stands in as the subject of a claim about nobody in particular. Never present. */
export const SOMEONE = "someone";
export const NPCS = [MARA, ODO, TOBIN] as const;

export const at = (hour: number, minute = 0) => hour * 60 + minute;
export const START = at(19);
export const DUSK = at(18, 30);
export const MIDNIGHT = at(24);
/** What Tobin owes Odo, in silver. The player starts with a little more than that. */
export const TOBINS_DEBT = 8;

export const RESTRICTED_ROOMS = ["office", "cellar"];

/** Predicates that accuse their subject of something. Nobody volunteers these about themselves. */
export const WRONGDOING = [
  "took",
  "hid",
  "carried_bundle_to",
  "gambles",
  "was_near",
  "searched",
  "attacked",
  "threatened",
  "insulted",
  "forced",
  "forced_latch",
  "burned",
];

/** Predicates that point at their subject as the one behind the missing ledger. */
export const IMPLICATES = [
  "took",
  "hid",
  "carried_bundle_to",
  "gambles",
  "burned",
  "fled",
  "apron_is_odos",
  "dodged",
  "slipped",
];

/** Predicates that bear on who took the ledger; these feed the quest guard's slice. */
export const LEDGER_MATTER = [
  "took",
  "hid",
  "carried_bundle_to",
  "gambles",
  "was_near",
  "forced_latch",
  "found",
  "apron_is_odos",
  "handed_over",
  "showed",
  "denied_taking",
  "accused",
  "threatened",
  "insulted",
  "forced",
  "attacked",
  "searched",
  "burned",
  "had_in_pack",
  "pack_was_clean",
  "fled",
  "in_plain_view",
  "dodged",
  "slipped",
];

const npc = (a: Partial<Actor> & Pick<Actor, "id" | "name" | "room" | "activity">): Actor => ({
  kind: "npc",
  hp: 6,
  maxHp: 6,
  alive: true,
  present: true,
  role: "guest",
  traits: [],
  goals: [],
  motives: [],
  circumstances: [],
  drives: { trust: 0.3, fear: 0.2, greed: 0.3, suspicion: 0.4, obligation: 0 },
  needs: { hunger: 0, rest: 0, warmth: 0, money: 0, safety: 0, company: 0 },
  coins: 0,
  ...a,
});

const entry = (e: Omit<ScheduleEntry, "cause">): ScheduleEntry => ({ ...e, cause: null });

const SCHEDULES: Record<string, Schedule> = {
  [MARA]: {
    overrides: [],
    commitments: [],
    role: [
      entry({
        id: "mara_kitchen_round",
        activity: "checking_kitchen",
        at_location: "kitchen",
        every: { period: 70, offset: at(19, 20) },
        until: 8,
      }),
    ],
    home: { at_location: "common_room", activity: "tending_bar" },
  },
  [ODO]: {
    overrides: [],
    commitments: [],
    role: [
      entry({
        id: "odo_serve",
        activity: "serving_stew",
        at_location: "common_room",
        at: at(20, 30),
        until: at(20, 42),
        busy: true,
      }),
      entry({
        id: "odo_clear",
        activity: "clearing_tables",
        at_location: "common_room",
        after: "odo_serve",
        until: 8,
      }),
    ],
    home: { at_location: "kitchen", activity: "cooking" },
  },
  [TOBIN]: {
    overrides: [],
    commitments: [],
    role: [
      entry({
        id: "tobin_firewood",
        activity: "bringing_firewood",
        at_location: "common_room",
        every: { period: 50, offset: at(19, 50) },
        until: 8,
        busy: true,
      }),
    ],
    home: { at_location: "yard", activity: "tending_horses" },
  },
};

/** Activities that keep hands and eyes busy; the conversation scheduler defers their remarks. */
export const BUSY_ACTIVITIES = ["cooking", "serving_stew", "bringing_firewood"];

/** How fast needs rise per minute. Only hunger moves anyone in the inn. */
export const NEED_RATES: Record<string, { hunger: number; eating: number }> = {
  [TOBIN]: { hunger: 0.006, eating: -0.04 },
};

// --- Seeded claims: what is believed before the player types anything ----------

export const C_LIE = makeClaim({
  subject: PLAYER,
  predicate: "was_near",
  place: "office",
  when: DUSK,
  severity: 1,
  origin: null,
});
export const C_ACCUSATION = makeClaim({
  subject: PLAYER,
  predicate: "took",
  object: "ledger",
  when: DUSK,
  severity: 2,
  origin: null,
});
export const C_TOBIN_SAW = makeClaim({
  subject: ODO,
  predicate: "carried_bundle_to",
  place: "cellar",
  when: DUSK,
  severity: 1,
  origin: null,
});
export const C_ODO_TOOK = makeClaim({
  subject: ODO,
  predicate: "took",
  object: "ledger",
  when: DUSK,
  severity: 2,
  origin: null,
});
export const C_ODO_HID = makeClaim({
  subject: ODO,
  predicate: "hid",
  object: "ledger",
  place: "cellar",
  when: DUSK,
  severity: 2,
  origin: null,
});
export const C_ODO_GAMBLES = makeClaim({
  subject: ODO,
  predicate: "gambles",
  when: at(12),
  severity: 2,
  origin: null,
});
export const C_TOBIN_OWES = makeClaim({
  subject: TOBIN,
  predicate: "owes",
  to: ODO,
  when: at(12),
  severity: 2,
  origin: null,
});
export const C_TOBIN_CELLAR = makeClaim({
  subject: TOBIN,
  predicate: "was_near",
  place: "cellar",
  when: at(15),
  severity: 2,
  motive: "was_asked",
  origin: null,
});

/** Facts anyone who looks will find. Fixed claims, so two people who look hold one row. */
export const C_APRON = makeClaim({
  subject: ODO,
  predicate: "apron_is_odos",
  when: DUSK,
  severity: 1,
  origin: null,
});
export const C_LATCH = makeClaim({
  subject: SOMEONE,
  predicate: "forced_latch",
  place: "office",
  when: DUSK,
  severity: 2,
  origin: null,
});

const SEEDED: Claim[] = [
  C_LIE,
  C_ACCUSATION,
  C_TOBIN_SAW,
  C_ODO_TOOK,
  C_ODO_HID,
  C_ODO_GAMBLES,
  C_TOBIN_OWES,
  C_TOBIN_CELLAR,
];

const believes = (
  src: string,
  claim: Claim,
  credence: number,
  source: NonNullable<Edge["source"]>,
): Edge => ({
  src,
  dst: claim.id,
  kind: "believes",
  valid_from: claim.when,
  valid_to: null,
  known_from: claim.when,
  cause_id: 0,
  credence,
  source,
});

const stance = (src: string, node: string): Edge => ({
  src,
  dst: PLAYER,
  kind: "stance",
  valid_from: at(16),
  valid_to: null,
  known_from: at(16),
  cause_id: 0,
  node,
});

const debt = (d: Omit<Debt, "cause" | "status" | "magnitude" | "data"> & Partial<Debt>): Debt => ({
  cause: null,
  status: "pending",
  magnitude: 2,
  data: {},
  ...d,
});

/** The agenda: what each of the three will do tonight if nobody changes their mind. */
const AGENDA: Debt[] = [
  debt({ id: "odo_check", stakeholder: ODO, kind: "check_hiding_place", fuse: { due: at(21) } }),
  debt({ id: "mara_search", stakeholder: MARA, kind: "search_pack", fuse: { due: at(21, 30) } }),
  debt({ id: "tobin_conscience", stakeholder: TOBIN, kind: "conscience", fuse: { due: at(22) } }),
  debt({ id: "odo_burn", stakeholder: ODO, kind: "burn_ledger", fuse: { due: at(22, 40) } }),
  debt({ id: "mara_verdict", stakeholder: MARA, kind: "verdict", fuse: { due: at(23, 30) } }),
];

const WORLD_DEF: World["def"] = {
  fsms: {
    stance: {
      hostile: ["wary"],
      wary: ["hostile", "curious", "indebted"],
      curious: ["wary", "indebted", "loyal"],
      indebted: ["wary", "curious", "loyal"],
      loyal: ["indebted", "curious"],
    },
    door: { locked: ["unlocked"], unlocked: ["locked"] },
    search: { unsearched: ["searched"], searched: [] },
    ledger: {
      hidden: ["found", "burned"],
      found: ["returned", "burned"],
      returned: [],
      burned: [],
    },
    quest: {
      suspected: ["cleared", "resolved", "condemned", "thrown_out"],
      cleared: ["resolved", "thrown_out"],
      resolved: [],
      condemned: [],
      thrown_out: [],
    },
  },
  predicates: [
    ...new Set([...WRONGDOING, ...LEDGER_MATTER, "owes", "paid_debt", "is_in", "was_asked_about"]),
  ],
  motives: ["was_asked", "struck_first", "with_the_key"],
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
  roles: ["innkeeper", "cook", "stablehand", "guest"],
  debtKinds: [
    "check_hiding_place",
    "search_pack",
    "conscience",
    "burn_ledger",
    "verdict",
    "report",
    "testify",
    "confront",
    "retaliate",
    "eject",
    "search_cellar",
    "face_stranger",
  ],
};

const ACTORS: World["actors"] = {
  [PLAYER]: npc({
    id: PLAYER,
    name: "the stranger",
    kind: "player",
    room: "common_room",
    activity: "idle",
    hp: 8,
    maxHp: 8,
    coins: 12,
  }),
  [MARA]: npc({
    id: MARA,
    name: "Mara",
    room: "common_room",
    activity: "tending_bar",
    role: "innkeeper",
    traits: ["cautious", "fair-minded", "proud"],
    goals: ["the ledger back before dawn", "not to be made a fool of in her own house"],
    motives: ["the assessor reads the ledger at first light; without it the inn is finished"],
    circumstances: [
      "behind on her debts",
      "trusts Tobin's word",
      "has never had cause to doubt Odo",
    ],
    drives: { trust: 0.25, fear: 0.1, greed: 0.3, suspicion: 0.7, obligation: 0.1 },
    coins: 30,
  }),
  [ODO]: npc({
    id: ODO,
    name: "Odo",
    room: "kitchen",
    activity: "cooking",
    role: "cook",
    traits: ["genial", "greedy", "quick-tongued", "embellishes every story"],
    goals: ["the blame for the ledger to stay on the stranger", "his own thefts never to come out"],
    motives: ["the ledger would show the assessor two years of skimming"],
    circumstances: ["owes money to river gamblers", "means to burn the ledger tonight"],
    drives: { trust: 0.2, fear: 0.3, greed: 0.8, suspicion: 0.5, obligation: 0 },
    coins: 3,
  }),
  [TOBIN]: npc({
    id: TOBIN,
    name: "Tobin",
    room: "yard",
    activity: "tending_horses",
    role: "stablehand",
    traits: ["quiet", "observant", "timid", "loyal to Mara"],
    goals: ["to keep his place", "to stay out of trouble", "the inn not to close"],
    motives: ["his sister's medicine is paid for with borrowed money"],
    circumstances: [],
    drives: { trust: 0.35, fear: 0.5, greed: 0.2, suspicion: 0.4, obligation: 0.2 },
    needs: { hunger: 0.55, rest: 0, warmth: 0, money: 0, safety: 0, company: 0 },
    coins: 1,
  }),
  [SOMEONE]: npc({ id: SOMEONE, name: "someone", room: "yard", activity: "idle", present: false }),
};

const ROOMS: World["rooms"] = {
  common_room: {
    id: "common_room",
    name: "the common room",
    aliases: ["common room", "common", "bar", "taproom", "hall"],
    exits: [{ to: "kitchen" }, { to: "yard" }, { to: "office", door: "office_door" }],
    serves: { warmth: 1, company: 1 },
  },
  kitchen: {
    id: "kitchen",
    name: "the kitchen",
    aliases: ["kitchen"],
    exits: [{ to: "common_room" }, { to: "yard" }, { to: "cellar", door: "cellar_door" }],
    serves: { warmth: 2 },
  },
  cellar: {
    id: "cellar",
    name: "the cellar",
    aliases: ["cellar", "downstairs", "down"],
    exits: [{ to: "kitchen", door: "cellar_door" }],
    serves: { safety: 2, warmth: -1 },
  },
  office: {
    id: "office",
    name: "the office",
    aliases: ["office"],
    exits: [{ to: "common_room", door: "office_door" }],
  },
  // Where burned things go. It has no exits, so nobody ever stands in it.
  ashes: { id: "ashes", name: "the hearth", aliases: [], exits: [] },
  yard: {
    id: "yard",
    name: "the stable yard",
    aliases: ["yard", "stable yard", "stable", "stables", "outside"],
    exits: [{ to: "common_room" }, { to: "kitchen" }],
  },
};

const ITEMS: World["items"] = {
  iron_key: {
    id: "iron_key",
    name: "the iron key",
    aliases: ["iron key", "heavy key", "cellar key", "key"],
    at: { room: "kitchen" },
    takeable: true,
  },
  brass_key: {
    id: "brass_key",
    name: "the brass key",
    aliases: ["brass key", "small key", "office key", "key"],
    at: { room: "kitchen" },
    takeable: true,
  },
  coat: {
    id: "coat",
    name: "Odo's coat",
    aliases: ["coat", "odo's coat", "odos coat", "pockets"],
    at: { room: "kitchen" },
    takeable: false,
    serves: { warmth: 1 },
    forced: { harm: 0, deed: "forced" },
  },
  markers: {
    id: "markers",
    name: "the gambling markers",
    aliases: ["markers", "gambling markers", "ious", "slips", "tokens"],
    at: { inside: "coat" },
    takeable: true,
    visibleFrom: { machine: "coat_search", node: "searched" },
  },
  barrel: {
    id: "barrel",
    name: "the flour barrel",
    aliases: ["flour barrel", "barrel", "flour"],
    at: { room: "cellar" },
    takeable: false,
    serves: { safety: 1 },
    forced: { harm: 1, deed: "forced" },
  },
  ledger: {
    id: "ledger",
    name: "the ledger",
    aliases: ["ledger", "account ledger", "book", "accounts"],
    at: { inside: "barrel" },
    takeable: true,
    visibleFrom: { machine: "barrel_search", node: "searched" },
  },
  apron: {
    id: "apron",
    name: "the floury apron",
    aliases: ["apron", "floury apron", "odo's apron", "wrapping"],
    at: { inside: "barrel" },
    takeable: true,
    visibleFrom: { machine: "barrel_search", node: "searched" },
  },
  latch: {
    id: "latch",
    name: "the window latch",
    aliases: ["latch", "window", "window latch", "sill", "windowsill"],
    at: { room: "office" },
    takeable: false,
    forced: { harm: 1, deed: "forced" },
  },
  strongbox: {
    id: "strongbox",
    name: "the strongbox",
    aliases: ["strongbox", "box", "desk"],
    at: { room: "office" },
    takeable: false,
    forced: { harm: 2, deed: "forced" },
  },
  tankard: {
    id: "tankard",
    name: "a pewter tankard",
    aliases: ["tankard", "mug", "ale", "beer"],
    at: { room: "common_room" },
    takeable: true,
    serves: { hunger: 1 },
  },
  // Things that are for something. Nothing below is in the plot; all of it can be
  // eaten, sat on, climbed or kicked, and the outcome follows from the numbers.
  pot: {
    id: "pot",
    name: "the stew pot",
    aliases: ["pot", "stew", "stew pot", "soup", "food", "supper", "dinner"],
    at: { room: "kitchen" },
    takeable: false,
    serves: { hunger: 3 },
    forced: { harm: 2, deed: "forced" },
  },
  bread: {
    id: "bread",
    name: "a heel of bread",
    aliases: ["bread", "heel", "loaf", "crust"],
    at: { room: "common_room" },
    takeable: true,
    serves: { hunger: 1 },
    consumable: true,
  },
  table: {
    id: "table",
    name: "the long table",
    aliases: ["table", "long table", "board"],
    at: { room: "common_room" },
    takeable: false,
    forced: { harm: 1, deed: "forced" },
  },
  bench: {
    id: "bench",
    name: "the bench by the hearth",
    aliases: ["bench", "seat", "chair", "stool"],
    at: { room: "common_room" },
    takeable: false,
    serves: { rest: 1, warmth: 1 },
    forced: { harm: 1, deed: "forced" },
  },
  hearth: {
    id: "hearth",
    name: "the hearth",
    aliases: ["hearth", "fire", "flames", "fireplace", "embers"],
    at: { room: "common_room" },
    takeable: false,
    serves: { warmth: 3 },
    forced: { harm: 3, deed: "forced" },
  },
  straw: {
    id: "straw",
    name: "a heap of straw",
    aliases: ["straw", "hay", "heap"],
    at: { room: "yard" },
    takeable: false,
    serves: { rest: 2, warmth: 1, safety: 1 },
    forced: { harm: 0, deed: "forced" },
  },
};

const MACHINES: World["machines"] = {
  office_door: { id: "office_door", fsm: "door", node: "locked" },
  cellar_door: { id: "cellar_door", fsm: "door", node: "locked" },
  barrel_search: { id: "barrel_search", fsm: "search", node: "unsearched" },
  coat_search: { id: "coat_search", fsm: "search", node: "unsearched" },
  latch_search: { id: "latch_search", fsm: "search", node: "unsearched" },
  ledger_fate: { id: "ledger_fate", fsm: "ledger", node: "hidden" },
  quest: { id: "quest", fsm: "quest", node: "suspected" },
};

const EDGES: Edge[] = [
  stance(MARA, "wary"),
  stance(TOBIN, "wary"),
  stance(ODO, "curious"),
  believes(MARA, C_LIE, 0.7, { kind: "told", from: ODO }),
  believes(MARA, C_ACCUSATION, 0.7, { kind: "inferred" }),
  believes(TOBIN, C_TOBIN_SAW, 1, { kind: "witnessed" }),
  believes(TOBIN, C_TOBIN_OWES, 1, { kind: "witnessed" }),
  believes(ODO, C_LIE, 1, { kind: "inferred" }),
  believes(ODO, C_ODO_TOOK, 1, { kind: "witnessed" }),
  believes(ODO, C_ODO_HID, 1, { kind: "witnessed" }),
  believes(ODO, C_ODO_GAMBLES, 1, { kind: "witnessed" }),
  believes(ODO, C_TOBIN_OWES, 1, { kind: "witnessed" }),
  believes(ODO, C_TOBIN_CELLAR, 1, { kind: "witnessed" }),
];

export function initialWorld(seed: number): World {
  return {
    def: structuredClone(WORLD_DEF),
    clock: START,
    rng: Rng.fromSeed(seed).state,
    actors: structuredClone(ACTORS),
    rooms: structuredClone(ROOMS),
    items: structuredClone(ITEMS),
    machines: structuredClone(MACHINES),
    claims: Object.fromEntries(SEEDED.map((c) => [c.id, c])),
    edges: structuredClone(EDGES),
    schedules: structuredClone(SCHEDULES),
    debts: Object.fromEntries(AGENDA.map((d) => [d.id, structuredClone(d)])),
    conversation: { beat: 0, queue: [], lastSpokeBeat: {}, lastSpeaker: null },
  };
}

/** Which key opens which door. */
export const KEYS: Record<string, string> = { cellar_door: "iron_key", office_door: "brass_key" };

/** What each activity is for: the need it serves, and whose. */
export const ACTIVITY_SERVES: Record<string, { need: Need; whose: string }> = {
  tending_bar: { need: "money", whose: "the house" },
  checking_kitchen: { need: "money", whose: "the house" },
  cooking: { need: "hunger", whose: "the house" },
  serving_stew: { need: "hunger", whose: "the guests" },
  clearing_tables: { need: "money", whose: "the house" },
  tending_horses: { need: "money", whose: "Tobin, in wages" },
  bringing_firewood: { need: "warmth", whose: "the house" },
  eating: { need: "hunger", whose: "their own" },
  burning: { need: "safety", whose: "Odo's own" },
  idle: { need: "rest", whose: "their own" },
  searching_pack: { need: "money", whose: "the house, if the ledger is in it" },
  testifying: { need: "company", whose: "their own standing with Mara" },
  confronting: { need: "money", whose: "the house, which needs its ledger" },
  searching_cellar: { need: "money", whose: "the house, which needs its ledger" },
  checking_cellar: { need: "safety", whose: "Odo's own" },
  reporting: { need: "company", whose: "their own standing with Mara" },
  keeping_clear: { need: "safety", whose: "their own" },
  answering_call: { need: "safety", whose: "whoever shouted" },
};

/** What searching a fixture reveals, and the machine that remembers it was searched. */
export const SEARCHABLE: Record<string, string> = {
  barrel: "barrel_search",
  coat: "coat_search",
  latch: "latch_search",
};

/** How far an NPC trusts a source before hearing the claim; the fallback for the believe Noul. */
export const TRUST: Record<string, Record<string, number>> = {
  [MARA]: { [TOBIN]: 0.85, [ODO]: 0.7, [PLAYER]: 0.2 },
  [TOBIN]: { [MARA]: 0.9, [ODO]: 0.6, [PLAYER]: 0.35 },
  [ODO]: { [MARA]: 0.7, [TOBIN]: 0.6, [PLAYER]: 0.3 },
};

/** Stored retelling habits: the fallback for the distortion Choice (SPEC.md section 9). */
export const RETELLING_HABIT: Record<string, Record<string, number>> = {
  [MARA]: { faithful: 0.8, keep_quiet: 0.2 },
  [TOBIN]: { faithful: 0.5, keep_quiet: 0.5 },
  [ODO]: { exaggerate_severity: 0.6, faithful: 0.2, swap_culprit: 0.2 },
};
