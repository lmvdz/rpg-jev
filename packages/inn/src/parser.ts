/**
 * Stage one of the two-stage parser (SPEC.md section 5): a deterministic
 * matcher for obvious verbs and scopes. It never calls a model, so it keeps
 * working when the judge is down. What it cannot read goes to the judge.
 *
 * An ambiguous noun ("grab the key" with two keys in reach) is caught here,
 * before any call, and answered with a question that names the candidates.
 */
import type { SpeechAct, World } from "@rpg-jev/core";
import { C_TOBIN_OWES, NPCS, ODO, PLAYER } from "./content.ts";

export type PlayerTopic =
  | { kind: "claim"; id: string }
  | { kind: "deny" }
  | { kind: "alibi" }
  | { kind: "blame"; npc: string }
  | { kind: "entity"; id: string }
  | { kind: "whereabouts"; id: string }
  | { kind: "none" };

export const REQUESTS = ["speak_to_mara", "confess", "keep_quiet"] as const;
export type Request = (typeof REQUESTS)[number];

export type Action =
  | { verb: "look" }
  | { verb: "inventory" }
  | { verb: "help" }
  | { verb: "quit" }
  | { verb: "why"; npc: string }
  | { verb: "go"; room: string }
  | { verb: "take"; item: string }
  | { verb: "drop"; item: string }
  | { verb: "examine"; target: string }
  | { verb: "use"; target: string; item: string | null }
  | { verb: "give"; item: string; to: string; topic: PlayerTopic }
  | { verb: "show"; item: string; to: string }
  | { verb: "attack"; target: string }
  | { verb: "wait"; minutes: number }
  | {
      verb: "say";
      act: SpeechAct;
      to: string;
      topic: PlayerTopic;
      item: string | null;
      request: Request | null;
    };

export interface Named {
  id: string;
  name: string;
  aliases: string[];
  kind: "person" | "thing" | "carried" | "room";
  takeable?: boolean;
}

export interface Scope {
  people: Named[];
  things: Named[];
  carried: Named[];
  exits: Named[];
  rooms: Named[];
}

export const COINS = "coins";
/** Stands for "the room I was in before this one". */
export const BACK = "@back";

export function isVisible(world: World, itemId: string): boolean {
  const item = world.items[itemId];
  if (!item) return false;
  if (!item.visibleFrom) return true;
  return world.machines[item.visibleFrom.machine]?.node === item.visibleFrom.node;
}

/** What the player can act on right now. Every judge option list is built from this. */
export function scopeOf(world: World): Scope {
  const here = world.actors[PLAYER]?.room ?? "";
  const people = Object.values(world.actors)
    .filter((a) => a.kind === "npc" && a.present && a.alive && a.room === here)
    .map(
      (a): Named => ({ id: a.id, name: a.name, aliases: [a.name.toLowerCase()], kind: "person" }),
    );
  const things: Named[] = [];
  const carried: Named[] = [];
  for (const item of Object.values(world.items)) {
    if (!isVisible(world, item.id)) continue;
    const named = { id: item.id, name: item.name, aliases: item.aliases, takeable: item.takeable };
    if ("holder" in item.at && item.at.holder === PLAYER)
      carried.push({ ...named, kind: "carried" });
    else if ("room" in item.at && item.at.room === here) things.push({ ...named, kind: "thing" });
    else if ("inside" in item.at) {
      const container = world.items[item.at.inside];
      if (container && "room" in container.at && container.at.room === here)
        things.push({ ...named, kind: "thing" });
    }
  }
  if ((world.actors[PLAYER]?.coins ?? 0) > 0)
    carried.push({
      id: COINS,
      name: "your purse of silver",
      aliases: ["coins", "silver", "purse", "money", "coin"],
      kind: "carried",
    });
  const toNamed = (id: string): Named => {
    const room = world.rooms[id];
    return { id, name: room?.name ?? id, aliases: room?.aliases ?? [], kind: "room" };
  };
  const exits = (world.rooms[here]?.exits ?? []).map((e) => toNamed(e.to));
  return { people, things, carried, exits, rooms: Object.keys(world.rooms).map(toNamed) };
}

export type Resolution =
  | { kind: "one"; id: string }
  | { kind: "many"; candidates: Named[] }
  | { kind: "none" };

const words = (s: string) => ` ${s} `;

/** Longest alias wins. Two different things tied on the same alias is an ambiguity. */
export function resolveNoun(phrase: string, candidates: readonly Named[]): Resolution {
  const text = words(phrase);
  let best = 0;
  let hits: Named[] = [];
  for (const c of candidates) {
    let score = 0;
    for (const alias of c.aliases)
      if (text.includes(words(alias))) score = Math.max(score, alias.length);
    if (score === 0) continue;
    if (score > best) {
      best = score;
      hits = [c];
    } else if (score === best && !hits.some((h) => h.id === c.id)) hits.push(c);
  }
  const first = hits[0];
  if (!first) return nearMiss(phrase, candidates);
  return hits.length === 1 ? { kind: "one", id: first.id } : { kind: "many", candidates: hits };
}

/** Edit distance of at most one: a swapped, dropped, added or wrong letter. */
function oneOff(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || a === b) return a === b;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const rest = (s: string, n: number) => s.slice(n);
  return (
    rest(a, i + 1) === rest(b, i + 1) ||
    rest(a, i + 1) === rest(b, i) ||
    rest(a, i) === rest(b, i + 1) ||
    (a[i] === b[i + 1] && a[i + 1] === b[i] && rest(a, i + 2) === rest(b, i + 2))
  );
}

/** "celler" for "cellar": a first-playtest finding. Only words of five letters or more. */
function nearMiss(phrase: string, candidates: readonly Named[]): Resolution {
  const said = phrase.split(" ").filter((w) => w.length >= 5);
  const hits = candidates.filter((c) =>
    c.aliases.some((alias) => alias.split(" ").some((w) => said.some((s) => oneOff(s, w)))),
  );
  const only = hits[0];
  return hits.length === 1 && only ? { kind: "one", id: only.id } : { kind: "none" };
}

const ANSWER_FILLER = new Set(["one", "ones", "that", "this", "i", "mean", "meant", "first", "it"]);

/**
 * Reads the answer to "the iron key or the brass key?". "the iron one" names
 * no alias in full, so this looks for a word that only one candidate owns.
 */
export function resolveAnswer(text: string, candidates: readonly Named[]): Resolution {
  const exact = resolveNoun(normalise(text), candidates);
  if (exact.kind === "one") return exact;
  const wordsOf = (c: Named) =>
    new Set([c.name, ...c.aliases].flatMap((s) => normalise(s).split(" ")).filter(Boolean));
  const said = new Set(normalise(text).split(" "));
  // An answer is made of the candidates' words. "tel mara she's fat" after "that Mara took
  // the ledger, or...?" shares a name with one candidate and is still not an answer to it.
  const known = new Set(candidates.flatMap((c) => [...wordsOf(c)]));
  const strangers = [...said].filter((w) => !known.has(w) && !ANSWER_FILLER.has(w));
  if (strangers.length > 0) return { kind: "none" };
  const owners = candidates.filter((c) => {
    const mine = wordsOf(c);
    const others = candidates.filter((o) => o.id !== c.id).map(wordsOf);
    return [...mine].some((w) => said.has(w) && !others.some((o) => o.has(w)));
  });
  const only = owners[0];
  return owners.length === 1 && only ? { kind: "one", id: only.id } : { kind: "none" };
}

export type Matched =
  | { kind: "action"; action: Action }
  | { kind: "clarify"; question: string; candidates: Named[]; complete: (id: string) => Action }
  | { kind: "error"; message: string }
  /** Not an obvious command: stage two (the judge) should read it. */
  | { kind: "unmatched" };

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\b(the|a|an|my|please)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function orList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/** The question that names the candidates (SPEC.md section 5): never "please rephrase". */
export function whichOne(verb: string, candidates: readonly Named[]): string {
  return `Which do you mean to ${verb}: ${orList(candidates.map((c) => c.name))}?`;
}

const NOBODY = "There is nobody by that name here.";

/** "Mara is not here" beats "nobody by that name" when the name is one the player knows. */
function missingPerson(phrase: string, world: World): string {
  const known = NPCS.find((id) => words(phrase).includes(words(id)));
  return known ? `${world.actors[known]?.name ?? known} is not here.` : NOBODY;
}

function pick(
  phrase: string,
  candidates: readonly Named[],
  verb: string,
  missing: string,
  complete: (id: string) => Action,
): Matched {
  const r = resolveNoun(phrase, candidates);
  if (r.kind === "one") return { kind: "action", action: complete(r.id) };
  if (r.kind === "many")
    return {
      kind: "clarify",
      question: whichOne(verb, r.candidates),
      candidates: r.candidates,
      complete,
    };
  return { kind: "error", message: missing };
}

const RULES: [RegExp, (m: RegExpMatchArray, scope: Scope, world: World) => Matched][] = [
  [/^(l|look|look around)$/, () => ({ kind: "action", action: { verb: "look" } })],
  [
    // "check pockets" means the player's own, never the coat on the peg.
    /^(i|inv|inventory|pack|(?:(?:check|look in|search|open) )?(?:my |the )?(?:pockets?|backpack|pack|bag|purse|inventory))$/,
    () => ({ kind: "action", action: { verb: "inventory" } }),
  ],
  [/^(help|\?|commands)$/, () => ({ kind: "action", action: { verb: "help" } })],
  [/^(q|quit|exit)$/, () => ({ kind: "action", action: { verb: "quit" } })],
  [
    /^(?:wait|z|rest)(?: (\d+))?(?: minutes?)?$/,
    (m) => ({
      kind: "action",
      action: { verb: "wait", minutes: Math.min(60, Math.max(1, Number(m[1] ?? 10))) },
    }),
  ],
  [
    /^why (.+)$/,
    (m, _scope, world) => {
      const npcs = NPCS.map((id): Named => {
        const name = world.actors[id]?.name ?? id;
        return { id, name, aliases: [name.toLowerCase()], kind: "person" };
      });
      return pick(m[1] ?? "", npcs, "ask about", "Why who? Try: why mara", (npc) => ({
        verb: "why",
        npc,
      }));
    },
  ],
  [
    // The way you came. The room is looked up in the log when the action runs.
    /^(?:go |head |walk )?back$|^return$|^leave$/,
    () => ({ kind: "action", action: { verb: "go", room: BACK } }),
  ],
  [
    /^(?:go|walk|head|enter|climb|run)(?: back)?(?: (?:to|into|in|through|down to|up to|out to))? (.+)$/,
    (m, scope) => goTo(m[1] ?? "", scope),
  ],
  [
    /^(?:take|get|grab|pick up) (?:all|everything)$/,
    (_m, scope) => {
      const loose = scope.things.filter((t) => t.takeable !== false);
      const first = loose[0];
      if (!first) return { kind: "error", message: "There is nothing here to take." };
      return { kind: "action", action: { verb: "take", item: loose.map((t) => t.id).join(",") } };
    },
  ],
  [
    /^(?:take|get|grab|pick up|pocket|snatch) (.+)$/,
    (m, scope) =>
      pick(m[1] ?? "", scope.things, "take", "You see nothing like that to take.", (item) => ({
        verb: "take",
        item,
      })),
  ],
  [
    /^(?:drop|put down|leave) (.+)$/,
    (m, scope) =>
      pick(m[1] ?? "", scope.carried, "drop", "You are not carrying that.", (item) => ({
        verb: "drop",
        item,
      })),
  ],
  [
    /^(?:x|examine|inspect|search|look at|look in|look inside|look through|check|rummage through|rummage in) (.+)$/,
    (m, scope) =>
      pick(
        m[1] ?? "",
        [...scope.things, ...scope.carried, ...scope.people],
        "look at",
        "You see nothing like that here.",
        (target) => ({ verb: "examine", target }),
      ),
  ],
  [
    /^(?:unlock|open) (.+?)(?: with (.+))?$/,
    (m, scope) => {
      const doors = scope.exits.map((e) => ({
        ...e,
        aliases: [...e.aliases, `${e.aliases[0]} door`],
      }));
      const tool = m[2] ? resolveNoun(m[2], scope.carried) : null;
      if (tool && tool.kind !== "one")
        return { kind: "error", message: "You are not carrying that." };
      return pick(m[1] ?? "", doors, "unlock", "There is no such door here.", (target) => ({
        verb: "use",
        target,
        item: tool?.kind === "one" ? tool.id : null,
      }));
    },
  ],
  [
    // Paying someone's debt is a thing a player says plainly once they know of it.
    /^pay\b.*\btobin'?s?\b.*\b(?:debt|owes|owed)\b.*$/,
    (_m, scope, world) => {
      const knows = world.edges.some(
        (e) =>
          e.kind === "believes" &&
          e.src === PLAYER &&
          e.dst === C_TOBIN_OWES.id &&
          e.valid_to === null,
      );
      if (!knows) return { kind: "error", message: "You know of no such debt." };
      if (!scope.people.some((p) => p.id === ODO))
        return { kind: "error", message: "Odo is the one he owes, and Odo is not here." };
      return {
        kind: "action",
        action: {
          verb: "give",
          item: COINS,
          to: ODO,
          topic: { kind: "claim", id: C_TOBIN_OWES.id },
        },
      };
    },
  ],
  [
    /^(give|hand|show|pay) (.+?) (?:to|for) (.+)$/,
    (m, scope, world) => {
      const verb = m[1] === "show" ? "show" : "give";
      const to = resolveNoun(m[3] ?? "", scope.people);
      if (to.kind !== "one") return { kind: "error", message: missingPerson(m[3] ?? "", world) };
      return pick(m[2] ?? "", scope.carried, verb, "You are not carrying that.", (item) =>
        verb === "show"
          ? { verb: "show", item, to: to.id }
          : { verb: "give", item, to: to.id, topic: { kind: "none" } },
      );
    },
  ],
  [
    /^(?:attack|hit|punch|strike|kick|fight|kill|stab) (.+)$/,
    (m, scope, world) =>
      pick(m[1] ?? "", scope.people, "attack", missingPerson(m[1] ?? "", world), (target) => ({
        verb: "attack",
        target,
      })),
  ],
  [
    /^(?:talk to|talk with|speak to|speak with|greet|hail|hello|hi) (.+)$/,
    (m, scope, world) =>
      pick(m[1] ?? "", scope.people, "talk to", missingPerson(m[1] ?? "", world), (to) => ({
        verb: "say",
        act: "greet",
        to,
        topic: { kind: "none" },
        item: null,
        request: null,
      })),
  ],
];

function goTo(phrase: string, scope: Scope): Matched {
  const near = resolveNoun(phrase, scope.exits);
  if (near.kind === "one") return { kind: "action", action: { verb: "go", room: near.id } };
  const far = resolveNoun(phrase, scope.rooms);
  if (far.kind === "one") {
    const name = scope.rooms.find((r) => r.id === far.id)?.name ?? "there";
    return { kind: "error", message: `You can't get to ${name} directly from here.` };
  }
  return { kind: "error", message: "You can't go that way." };
}

/** Bare room names and "ask X about Y" with an obvious Y are handled after the verb rules. */
export function match(text: string, world: World): Matched {
  const input = normalise(text);
  if (input === "") return { kind: "error", message: "Say what you do." };
  const scope = scopeOf(world);
  for (const [pattern, build] of RULES) {
    const m = input.match(pattern);
    if (m) return build(m, scope, world);
  }
  const room = resolveNoun(input, scope.exits);
  if (room.kind === "one" && scope.exits.some((e) => e.aliases.includes(input)))
    return { kind: "action", action: { verb: "go", room: room.id } };

  const ask = input.match(/^ask (\w+) (?:about|where) (.+)$/);
  if (ask) {
    const to = resolveNoun(ask[1] ?? "", scope.people);
    if (to.kind !== "one") return { kind: "error", message: missingPerson(ask[1] ?? "", world) };
    const subject = resolveNoun(ask[2] ?? "", askable(world));
    if (subject.kind === "one") {
      const whereabouts = input.includes(" where ") && Boolean(world.actors[subject.id]);
      return {
        kind: "action",
        action: {
          verb: "say",
          act: "ask",
          to: to.id,
          topic: whereabouts
            ? { kind: "whereabouts", id: subject.id }
            : { kind: "entity", id: subject.id },
          item: null,
          request: null,
        },
      };
    }
  }
  return { kind: "unmatched" };
}

/** People and things one can ask about, whether or not they are in the room. */
export function askable(world: World): Named[] {
  const people = NPCS.map((id): Named => {
    const name = world.actors[id]?.name ?? id;
    return { id, name, aliases: [name.toLowerCase()], kind: "person" };
  });
  const things = Object.values(world.items)
    .filter((i) => i.id === "ledger" || isVisible(world, i.id))
    .map((i): Named => ({ id: i.id, name: i.name, aliases: i.aliases, kind: "thing" }));
  return [...people, ...things];
}

export const HELP = [
  "Plain commands always work: look, go <room>, take <thing>, drop <thing>, examine <thing>,",
  "search <thing>, unlock <room> with <key>, give <thing> to <name>, show <thing> to <name>,",
  "talk to <name>, ask <name> about <name or thing>, attack <name>, wait [minutes], inventory.",
  "Anything else, say it as you would: tell mara I never touched her ledger; ask tobin what he",
  "saw at dusk; offer tobin my silver if he will talk to mara; accuse odo of taking the ledger.",
  "Debug: why <name> walks the causes behind what someone believes and does. quit saves and leaves.",
  "If the game got your last line wrong, type huh (or huh <what you meant>): it goes in the playtest log.",
].join("\n");
