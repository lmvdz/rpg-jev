/**
 * Any verb on anything. "eat the table" is not refused by a list; it is tried,
 * and what the table is decides what happens (core needs.ts). A first try at
 * something too hard finds that out. Insisting is what breaks a tooth, and the
 * room sees it, the way it sees a blow.
 *
 * All numbers are code. The judge is asked nothing here; it is asked later, by
 * the ordinary deed path, how the people who saw it take it.
 */
import {
  attempt,
  ENDS,
  endsOf,
  type LogId,
  MAX_STEP,
  NEED_VERBS,
  type Need,
  type Outcome,
  RELIEF_PER_MAGNITUDE,
  woundWords,
} from "@rpg-jev/core";
import { ACTIVITY_SERVES, PLAYER } from "./content.ts";
import type { Game } from "./game.ts";
import type { Action } from "./parser.ts";
import { reactToDeed } from "./talk.ts";
import { ACTIVITY, cap, nameOf } from "./words.ts";

type Attempt = Extract<Action, { verb: "attempt" }>;

/** How long serving a need takes, and how it reads. */
const SERVED: Record<Need, { minutes: number; line: string }> = {
  hunger: { minutes: 5, line: "You eat. It is hot, or near enough, and it is enough." },
  rest: { minutes: 15, line: "You sit a while and let the day drain out of your legs." },
  warmth: { minutes: 5, line: "You stay by it until the rain is out of your coat." },
  safety: { minutes: 10, line: "You keep still, and the house forgets you for a while." },
  money: { minutes: 1, line: "That is worth something, and now it is yours." },
  company: { minutes: 5, line: "It is good to be among people, even these." },
};

/** Earlier tries at the same thing tonight, read from the log. Insistence is code. */
function insistence(g: Game, action: Attempt, root: LogId): number {
  let count = 0;
  for (let i = g.log.length - 1; i >= 0; i--) {
    const e = g.log[i];
    if (!e || g.world.clock - e.t > 30) break;
    if (e.kind !== "input" || e.id === root) continue;
    const past = e.action as Attempt | null;
    if (
      past?.verb === "attempt" &&
      past.how === action.how &&
      past.target?.id === action.target?.id
    )
      count += 1;
  }
  return count;
}

export async function tryAnything(g: Game, action: Attempt, root: LogId): Promise<number> {
  const need = NEED_VERBS[action.how] ?? null;
  if (!action.target) {
    g.say(
      need
        ? `There is nothing here that would give you ${ENDS[need].word}.`
        : `${cap(action.how)} what?`,
    );
    return 0;
  }
  const thing =
    action.target.place === "item"
      ? g.world.items[action.target.id]
      : g.world.rooms[action.target.id];
  if (!thing) return 0;
  const name = thing.name;
  const outcome = attempt(action.how, thing, insistence(g, action, root));
  return applyOutcome(g, action, name, outcome, root);
}

async function applyOutcome(
  g: Game,
  action: Attempt,
  name: string,
  outcome: Outcome,
  root: LogId,
): Promise<number> {
  const target = action.target;
  if (!target) return 0;
  switch (outcome.kind) {
    case "served": {
      const delta = -Math.min(MAX_STEP, RELIEF_PER_MAGNITUDE * outcome.magnitude);
      g.commit({ kind: "shift_need", npc: PLAYER, need: outcome.need, delta }, root);
      if (outcome.consumed && target.place === "item")
        g.commit({ kind: "transfer", item: target.id, to: { room: "ashes" } }, root);
      g.say(SERVED[outcome.need].line);
      return SERVED[outcome.need].minutes;
    }
    case "nothing":
      g.say(
        outcome.need
          ? `${cap(name)} is no ${ENDS[outcome.need].word} to anyone. You leave it.`
          : `You ${action.how} ${name}. Nothing comes of it but a look from the room.`,
      );
      return 1;
    case "too_hard":
      g.say(`You try. ${cap(name)} is harder than you are, and you find that out in time to stop.`);
      return 1;
    case "harm": {
      const id = g.commit({ kind: "damage", target: PLAYER, amount: outcome.harm }, root);
      const me = g.world.actors[PLAYER];
      const opening = outcome.need ? "You go at it anyway." : `You ${action.how} ${name}.`;
      g.say(
        `${opening} ${outcome.need ? cap(name) : "It"} does not give; you do. You are ${me ? woundWords(me.hp, me.maxHp) : "hurt"}.`,
      );
      // Seen, remembered, and told: the same path as a blow.
      const deed = g.happened(
        { subject: PLAYER, predicate: outcome.deed, object: target.id, severity: 1 },
        id,
      );
      const seen = g.witness(deed, g.playerRoom, id);
      if (seen.length > 0) await reactToDeed(g, deed, seen, id);
      return 2;
    }
  }
}

/** "why stew": what a thing is for, walked down the graph of ends. */
export function explain(g: Game, id: string, place: "item" | "room"): string {
  const thing = place === "item" ? g.world.items[id] : g.world.rooms[id];
  if (!thing) return "Nothing here answers to that.";
  const serves = Object.entries(thing.serves ?? {}).filter(([, m]) => (m ?? 0) !== 0) as [
    Need,
    number,
  ][];
  const lines: string[] = [`WHY ${thing.name.toUpperCase()}`];
  if (serves.length === 0) {
    lines.push(`  ${cap(thing.name)} is for nothing anyone here needs.`);
  }
  for (const [need, magnitude] of serves) {
    const how =
      magnitude < 0
        ? `takes ${ENDS[need].word} away`
        : `is ${ENDS[need].word}${magnitude >= 3 ? ", and plenty of it" : magnitude === 1 ? ", a little" : ""}`;
    lines.push(`  ${cap(thing.name)} ${how}.`);
    lines.push(...chain(need));
  }
  const forced = "forced" in thing ? thing.forced : undefined;
  if (forced && forced.harm > 0)
    lines.push(
      `  Forced, it gives nothing and takes ${forced.harm === 1 ? "a little" : forced.harm === 2 ? "a fair bit" : "a great deal"} of you with it.`,
    );
  return lines.join("\n");
}

/** The chain of ends from a need, as sentences. */
export function chain(need: Need): string[] {
  const out: string[] = [];
  // Three hops is a thought; the whole circle is a sermon.
  const ends = endsOf(need, 3);
  for (const [i, n] of ends.entries()) {
    const e = ENDS[n];
    out.push(
      `    ${cap(e.word)} comes from ${e.restoredBy} and goes with ${e.depletedBy}. Without it, ${e.neglect}. With it, ${e.enables}.`,
    );
    if (e.next && i < ends.length - 1) out.push(`    And that is for ${ENDS[e.next].word}.`);
  }
  return out;
}

/** One line for `why <npc>`: what they are doing now, and what it is for. */
export function doingWhy(g: Game, npc: string): string[] {
  const a = g.world.actors[npc];
  if (!a) return [];
  const purpose = ACTIVITY_SERVES[a.activity];
  if (!purpose) return [];
  const e = ENDS[purpose.need];
  const onward = e.next ? ` and ${e.word} is for ${ENDS[e.next].word}` : "";
  return [
    `  Is ${ACTIVITY[a.activity] ?? a.activity}: that is ${e.word} for ${purpose.whose === "their own" ? nameOf(g.world, npc) : purpose.whose},${onward}.`,
  ];
}
