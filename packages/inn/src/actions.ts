/**
 * What the player's body does: moving, taking, searching, unlocking, giving,
 * hitting. All of it is code (SPEC.md rule 3). The judge is asked only how the
 * people in the room take it, through `reactToDeed` and the combat stub.
 */
import {
  type Actor,
  type Claim,
  COMBAT_RESPONSES,
  type LogId,
  resolveBlow,
  weakened,
  why,
  woundWords,
} from "@rpg-jev/core";
import { compileSlice, type Option, pickAction } from "@rpg-jev/jev";
import { doingWhy, explain, tryAnything } from "./attempts.ts";
import {
  C_TOBIN_OWES,
  EXAMINE_TEACHES,
  KEYS,
  MARA,
  ODO,
  PLAYER,
  RESTRICTED_ROOMS,
  SEARCHABLE,
  TOBINS_DEBT,
} from "./content.ts";
import type { Game } from "./game.ts";
import { type Action, BACK, COINS, HELP, isVisible } from "./parser.ts";
import { describeRoom, lookAtItem, lookAtPerson, lookAtRoom } from "./prose.ts";
import { sceneSlice } from "./slices.ts";
import { greetOnEntry, owe, playerSpeaks, reactToDeed } from "./talk.ts";
import { renderWhy } from "./whytext.ts";
import { clockWords, theirOf } from "./words.ts";

/** Performs the action and returns how many minutes it took. Zero means no time passed. */
export async function performAction(g: Game, action: Action, root: LogId): Promise<number> {
  switch (action.verb) {
    case "look":
      g.say(describeRoom(g.world));
      return 0;
    case "inventory":
      inventory(g);
      return 0;
    case "help":
      g.say(HELP);
      return 0;
    case "quit":
      return 0;
    case "why": {
      const report = why(g.world, g.log, action.npc, PLAYER);
      g.say(
        report
          ? [renderWhy(g.world, report, g.log), ...doingWhy(g, action.npc)].join("\n")
          : "Nobody by that name.",
      );
      return 0;
    }
    case "why_thing":
      g.say(explain(g, action.id, action.place));
      return 0;
    case "attempt":
      return tryAnything(g, action, root);
    case "wait":
      g.say(`You wait. (${clockWords(g.world.clock + action.minutes)})`);
      return action.minutes;
    case "go":
      return go(g, action.room === BACK ? cameFrom(g) : action.room, root);
    case "take": {
      // "take everything" arrives as a comma-separated list.
      let minutes = 0;
      for (const item of action.item.split(",")) minutes += await take(g, item, root);
      return minutes;
    }
    case "drop":
      g.commit({ kind: "transfer", item: action.item, to: { room: g.playerRoom } }, root);
      g.say(`You put down ${g.world.items[action.item]?.name ?? "it"}.`);
      return 1;
    case "examine":
      return examine(g, action.target, root);
    case "use":
      return unlock(g, action.target, action.item, root) ? 1 : 0;
    case "give":
      return give(g, action, root);
    case "show":
      return playerSpeaks(
        g,
        {
          verb: "say",
          act: "tell",
          to: action.to,
          topic: { kind: "none" },
          item: action.item,
          request: null,
        },
        root,
      );
    case "attack":
      return attack(g, action.target, root);
    case "say":
      return playerSpeaks(g, action, root);
  }
}

/** The room the player was in before this one, read from the log. */
function cameFrom(g: Game): string {
  const here = g.playerRoom;
  const exits = g.world.rooms[here]?.exits.map((e) => e.to) ?? [];
  for (let i = g.log.length - 1; i >= 0; i--) {
    const e = g.log[i];
    if (e?.kind !== "effect" || e.effect.kind !== "move" || e.effect.actor !== PLAYER) continue;
    if (e.effect.to !== here && exits.includes(e.effect.to)) return e.effect.to;
  }
  // Nowhere to go back to yet: a room with one way out has an obvious "back".
  return exits.length === 1 ? (exits[0] ?? here) : here;
}

function inventory(g: Game): void {
  const items = Object.values(g.world.items).filter(
    (i) => "holder" in i.at && i.at.holder === PLAYER,
  );
  const coins = g.world.actors[PLAYER]?.coins ?? 0;
  const names = [...items.map((i) => i.name), `${coins} silver`];
  g.say(`You are carrying ${names.join(", ")}. It is ${clockWords(g.world.clock)}.`);
}

function holds(g: Game, item: string): boolean {
  const at = g.world.items[item]?.at;
  return Boolean(at && "holder" in at && at.holder === PLAYER);
}

function unlock(g: Game, room: string, withItem: string | null, root: LogId): boolean {
  const exit = g.world.rooms[g.playerRoom]?.exits.find((e) => e.to === room);
  if (!exit?.door) {
    g.say("There is nothing to unlock that way.");
    return false;
  }
  if (g.world.machines[exit.door]?.node === "unlocked") {
    g.say("It is already unlocked.");
    return false;
  }
  const key = KEYS[exit.door];
  if (!(key && holds(g, key)) || (withItem !== null && withItem !== key)) {
    g.say(withItem ? "That key does not fit." : "It is locked, and you have nothing that fits it.");
    return false;
  }
  g.commit({ kind: "set_node", target: { type: "machine", id: exit.door }, to: "unlocked" }, root);
  g.say(`${g.world.items[key]?.name ?? "The key"} turns. The door is unlocked.`.replace(/^t/, "T"));
  return true;
}

async function go(g: Game, room: string, root: LogId): Promise<number> {
  const from = g.playerRoom;
  const exit = g.world.rooms[from]?.exits.find((e) => e.to === room);
  if (!exit) {
    g.say("You can't go that way.");
    return 0;
  }
  let usedKey = false;
  if (exit.door && g.world.machines[exit.door]?.node === "locked") {
    if (!unlock(g, room, null, root)) return 0;
    usedKey = true;
  }
  const id = g.commit({ kind: "move", actor: PLAYER, to: room }, root);
  g.sightings(PLAYER, from, room, id);
  g.say(describeRoom(g.world));

  if (RESTRICTED_ROOMS.includes(room)) {
    const deed = g.happened(
      {
        subject: PLAYER,
        predicate: "was_near",
        place: room,
        severity: 2,
        ...(usedKey ? { motive: "with_the_key" } : {}),
      },
      id,
    );
    const seen = [...g.witness(deed, from, id), ...g.witness(deed, room, id)];
    if (seen.length > 0) await reactToDeed(g, deed, seen, id);
  }
  await greetOnEntry(g, id);
  return 2;
}

const NOTABLE = ["iron_key", "brass_key", "ledger", "markers", "apron"];

async function take(g: Game, item: string, root: LogId): Promise<number> {
  const thing = g.world.items[item];
  if (!thing?.takeable) {
    g.say("That is not something you can carry off.");
    return 0;
  }
  const id = g.commit({ kind: "transfer", item, to: { holder: PLAYER } }, root);
  g.say(`You take ${thing.name}.`);
  if (item === "ledger") {
    if (g.world.machines.ledger_fate?.node === "hidden")
      g.commit(
        { kind: "set_node", target: { type: "machine", id: "ledger_fate" }, to: "found" },
        id,
      );
    const found = g.happened(
      { subject: PLAYER, predicate: "found", object: item, place: g.playerRoom },
      id,
    );
    g.learn(PLAYER, found, 1, { kind: "witnessed" }, id);
  }
  if (NOTABLE.includes(item)) {
    const severity = item.endsWith("_key") ? 1 : 2;
    const deed = g.happened(
      { subject: PLAYER, predicate: "took", object: item, place: g.playerRoom, severity },
      id,
    );
    const seen = g.witness(deed, g.playerRoom, id);
    if (seen.length > 0) await reactToDeed(g, deed, seen, id);
  }
  return 1;
}

/** A search of a searchable thing: reveals what it holds, and becomes a deed unless it is the latch. */
function search(
  g: Game,
  target: string,
  machine: string,
  root: LogId,
): { id: LogId; deed: Claim | null } {
  const id = g.commit(
    { kind: "set_node", target: { type: "machine", id: machine }, to: "searched" },
    root,
  );
  const revealed = Object.values(g.world.items).filter(
    (i) => "inside" in i.at && i.at.inside === target && isVisible(g.world, i.id),
  );
  if (target === "barrel")
    g.say(
      revealed.length > 0
        ? "You push your arm in to the elbow. Your fingers close on oilcloth: a bundle, buried deep."
        : "You push your arm in to the elbow and find a hollow, freshly dug, and nothing in it. Someone got here first.",
    );
  if (target === "coat") g.say("In the inside pocket, something clicks like teeth.");
  if (revealed.length > 0) g.say(`You find ${revealed.map((i) => i.name).join(" and ")}.`);
  if (target === "latch") return { id, deed: null };
  const deed = g.happened(
    { subject: PLAYER, predicate: "searched", object: target, severity: target === "coat" ? 2 : 1 },
    id,
  );
  return { id, deed };
}

/** What examining certain things teaches you outright, from your own eyes. */
function learnFromExamine(g: Game, target: string, id: LogId): void {
  const teaches = EXAMINE_TEACHES[target];
  if (teaches) g.learn(PLAYER, teaches, 1, { kind: "witnessed" }, id);
}

async function examine(g: Game, target: string, root: LogId): Promise<number> {
  if (g.world.actors[target]) {
    const a = g.world.actors[target];
    g.say(`${lookAtPerson(target)} ${a ? `They look ${woundWords(a.hp, a.maxHp)}.` : ""}`);
    return 1;
  }
  if (g.world.rooms[target]) {
    g.say(lookAtRoom(target));
    return 2;
  }
  g.say(lookAtItem(target));
  const machine = SEARCHABLE[target];
  let id = root;
  let deed: Claim | null = null;
  if (machine && g.world.machines[machine]?.node === "unsearched")
    ({ id, deed } = search(g, target, machine, root));
  learnFromExamine(g, target, id);
  if (deed) {
    const seen = g.witness(deed, g.playerRoom, id);
    if (seen.length > 0) await reactToDeed(g, deed, seen, id);
  }
  return machine ? 4 : 2;
}

function give(g: Game, action: Extract<Action, { verb: "give" }>, root: LogId): Promise<number> {
  const to = g.world.actors[action.to];
  if (!to) return Promise.resolve(0);
  if (action.item === COINS) {
    const owes = action.topic.kind === "claim" && action.topic.id === C_TOBIN_OWES.id;
    const amount = owes ? TOBINS_DEBT : 2;
    if ((g.world.actors[PLAYER]?.coins ?? 0) < amount) {
      g.say("You have not got that much.");
      return Promise.resolve(0);
    }
    const id = g.commit({ kind: "pay", from: PLAYER, to: action.to, coins: amount }, root);
    if (owes && action.to === ODO) {
      g.say(`You count ${amount} silver into Odo's palm. "For what Tobin owes you. All of it."`);
      g.say("Odo weighs the coins, and for once has nothing clever to say.");
      const deed = g.happened(
        { subject: PLAYER, predicate: "paid_debt", to: "tobin", severity: 2 },
        id,
      );
      g.learn(PLAYER, deed, 1, { kind: "witnessed" }, id);
      g.retire(ODO, C_TOBIN_OWES.id, id);
      g.witness(deed, g.playerRoom, id);
      // Whether Odo ever tells Tobin he is free of the debt is Odo's to decide, later.
      if (!g.npcsIn(g.playerRoom).includes("tobin"))
        g.commit(
          {
            kind: "create_debt",
            debt: {
              id: `odo_owes_tobin_the_news_${id}`,
              cause: id,
              stakeholder: ODO,
              kind: "report",
              magnitude: 1,
              fuse: { due: g.world.clock + 10, expires: g.world.clock + 180 },
              status: "pending",
              data: { claim: deed.id, to: "tobin" },
            },
          },
          id,
        );
    } else {
      g.say(`You press ${amount} silver on ${to.name}, who takes it without a word.`);
      g.nudge(action.to, { obligation: 0.1, trust: 0.05 }, id);
    }
    return Promise.resolve(2);
  }
  if (action.item === "ledger" && action.to === MARA)
    return playerSpeaks(
      g,
      { verb: "say", act: "tell", to: MARA, topic: { kind: "none" }, item: null, request: null },
      root,
      true,
    );
  g.commit({ kind: "transfer", item: action.item, to: { holder: action.to } }, root);
  g.say(`You hand ${g.world.items[action.item]?.name ?? "it"} to ${to.name}.`);
  return Promise.resolve(1);
}

const RESPONSE_WORDS: Record<(typeof COMBAT_RESPONSES)[number], string> = {
  strike: "Hits back",
  shove: "Shoves the stranger away and puts distance between them",
  flee: "Runs for another room",
  call_for_help: "Shouts for help",
  do_nothing: "Stands there and takes it",
};

/** Neglect is a rule, not a line: a body that has not eaten or slept takes blows harder. */
function harderFrom(g: Game, who: string): number {
  const body = g.world.actors[who];
  return body && weakened(body) ? 1 : 0;
}

/** The player's blow lands or doesn't; either way it is a deed, and everyone who saw it owes Mara the tale. */
function landBlow(
  g: Game,
  target: string,
  victim: Actor,
  root: LogId,
): { blow: ReturnType<typeof resolveBlow>; id: LogId } {
  const blow = resolveBlow(
    g.store.draw("player hit", root),
    g.store.draw("player damage", root),
    false,
  );
  g.say(blow.hit ? `You hit ${victim.name}. It lands.` : `You swing at ${victim.name} and miss.`);
  const id = blow.hit
    ? g.commit({ kind: "damage", target, amount: blow.damage + harderFrom(g, target) }, root)
    : root;
  const deed = g.happened({ subject: PLAYER, predicate: "attacked", to: target, severity: 2 }, id);
  for (const npc of g.witness(deed, g.playerRoom, id)) owe(g, npc, { ...deed, severity: 3 }, id);
  return { blow, id };
}

/** The judge picks the response from the closed list; every number stays in code. */
async function chooseResponse(
  g: Game,
  target: string,
  victim: Actor,
  blow: ReturnType<typeof resolveBlow>,
  id: LogId,
): Promise<{ response: string | null; cause: LogId }> {
  const options: Option[] = COMBAT_RESPONSES.map((r) => ({
    id: r,
    description: RESPONSE_WORDS[r],
  }));
  const others = g.npcsIn(g.playerRoom).filter((n) => n !== target);
  const situation = `The stranger has just ${blow.hit ? "struck" : "swung at"} ${victim.name} in ${g.world.rooms[g.playerRoom]?.name}. ${victim.name} is ${woundWords(victim.hp, victim.maxHp)}. ${others.length > 0 ? `${others.map((o) => g.world.actors[o]?.name).join(" and ")} can see it.` : "Nobody else is in the room."}`;
  const slice = compileSlice(sceneSlice, {
    world: g.world,
    parts: [{ npc: target, extra: { situation } }],
  });
  const decision = await g.decide(
    slice,
    { respond: pickAction(`npcs.${target}`, options.slice(0, 4), "flee") },
    [
      { kind: "alive", actor: target },
      { kind: "in_room", actor: target, room: g.playerRoom },
    ],
    id,
  );
  const response = decision
    ? g.sampleChoice(decision.answers.respond, "combat response", decision.id)
    : null;
  return { response, cause: decision?.id ?? id };
}

/** The victim strikes back, and a knockdown ends the night. */
function strikeBack(g: Game, victim: Actor, cause: LogId): void {
  const back = resolveBlow(
    g.store.draw("npc hit", cause),
    g.store.draw("npc damage", cause),
    false,
  );
  g.say(
    back.hit
      ? `${victim.name} hits you back, hard.`
      : `${victim.name} swings back wildly and misses.`,
  );
  if (back.hit)
    g.commit(
      { kind: "damage", target: PLAYER, amount: back.damage + harderFrom(g, PLAYER) },
      cause,
    );
  if ((g.world.actors[PLAYER]?.hp ?? 1) <= 0) {
    g.say("The floor comes up to meet you.");
    g.commit(
      { kind: "set_node", target: { type: "machine", id: "quest" }, to: "thrown_out" },
      cause,
    );
  }
}

/** The victim (or Mara, called for) leaves the room, and the schedule keeps them clear of it. */
function runOff(
  g: Game,
  target: string,
  victim: Actor,
  response: "flee" | "call_for_help",
  cause: LogId,
): void {
  if (response === "call_for_help")
    g.say(`${victim.name} shouts for Mara at the top of their lungs.`);
  const refuge = target === MARA ? "kitchen" : "common_room";
  const to = g.playerRoom === refuge ? "yard" : refuge;
  if (response === "flee") g.say(`${victim.name} bolts.`);
  g.commit(
    {
      kind: "apply_override",
      group: response === "flee" ? [target] : [MARA],
      entry: {
        id: `after_blow_${cause}`,
        activity: response === "flee" ? "keeping_clear" : "answering_call",
        at_location: response === "flee" ? to : g.playerRoom,
        at: g.world.clock,
        until: g.world.clock + (response === "flee" ? 40 : 12),
        cause: null,
      },
    },
    cause,
  );
}

/** What the room does about the blow, once the judge has picked from the list. */
function applyResponse(
  g: Game,
  target: string,
  victim: Actor,
  response: string | null,
  cause: LogId,
): void {
  if (response === "strike") {
    strikeBack(g, victim, cause);
    return;
  }
  if (response === "shove") {
    g.say(`${victim.name} shoves you off and backs away, hands up.`);
    return;
  }
  if (response === "flee" || response === "call_for_help") {
    runOff(g, target, victim, response, cause);
    return;
  }
  g.say(`${victim.name} just stares at you, a hand to ${theirOf(target)} face.`);
}

async function attack(g: Game, target: string, root: LogId): Promise<number> {
  const victim = g.world.actors[target];
  if (!victim) return 0;
  const { blow, id } = landBlow(g, target, victim, root);
  if (!g.world.actors[target]?.alive) {
    g.say(`${victim.name} goes down and does not get up.`);
    g.commit({ kind: "set_node", target: { type: "machine", id: "quest" }, to: "condemned" }, id);
    return 1;
  }
  const { response, cause } = await chooseResponse(g, target, victim, blow, id);
  applyResponse(g, target, victim, response, cause);
  return 1;
}
