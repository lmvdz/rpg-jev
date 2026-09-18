/**
 * From a belief to something done about it (SPEC.md section 9).
 *
 * Content declares dispositions: whose habit, which beliefs set it off, and the closed set of
 * reactions they would choose among. This module does the rest. When someone comes to
 * believe something, `considerReacting` checks their dispositions and leaves a debt with a
 * short fuse. When the debt comes due, `react` builds the option set from the reactions that
 * are possible at that moment, asks the judge only if there is a choice to make, and carries
 * the reaction out through validated effects. Reactions are rows in `REACTIONS`; none names
 * a person, a room or a thing.
 */
import {
  type Belief,
  type BeliefSource,
  beliefIn,
  type Claim,
  type Debt,
  type LogId,
} from "@rpg-jev/core";
import { compileSlice, type Option, pickAction, pickSpeechAct } from "@rpg-jev/jev";
import {
  DISPOSITIONS,
  type Disposition,
  EXAMINE_TEACHES,
  IMPLICATES,
  PLAYER,
  POWERS,
  SEARCHABLE,
  TRACKED,
  WRONGDOING,
} from "./content.ts";
import type { Game } from "./game.ts";
import { rankedBeliefs, sceneSlice, trustIn } from "./slices.ts";
import { doDeed } from "./talk.ts";
import { claimClause, nameOf, selfOf, theirOf, theyOf, tieWords, whenFor } from "./words.ts";

/** A belief held at least this firmly is acted on; below it, only a trusted word is. */
const BELIEVED = 0.6;
/** A reaction already owed is dropped if the belief behind it has fallen below this. */
const STILL_HELD = 0.4;
const TRUSTED = 0.8;
/** How long someone keeps meaning to do it, and how soon they try again if they cannot yet. */
const KEEPS_FOR = 120;
const TRIES_AGAIN_IN = 3;

// --- Walking and choosing, shared with the agenda ------------------------------

export function goTo(
  g: Game,
  npc: string,
  room: string,
  activity: string,
  minutes: number,
  cause: LogId,
): void {
  g.commit(
    {
      kind: "add_commitment",
      npc,
      entry: {
        id: `${activity}_${cause}`,
        activity,
        at_location: room,
        at: g.world.clock,
        until: g.world.clock + minutes,
        cause: null,
      },
    },
    cause,
  );
  g.runSchedules(cause);
}

/** Ask one NPC to choose among feasible acts. `none_of_these` and outages fall to `fallback`. */
export async function choose(
  g: Game,
  npc: string,
  situation: string,
  options: Option[],
  fallback: string,
  cause: LogId,
): Promise<{ choice: string | null; id: LogId }> {
  const slice = compileSlice(sceneSlice, {
    world: g.world,
    parts: [{ npc, extra: { situation } }],
  });
  const decision = await g.decide(
    slice,
    { act: pickAction(`npcs.${npc}`, options, fallback) },
    [{ kind: "alive", actor: npc }],
    cause,
  );
  if (!decision) return { choice: null, id: cause };
  const choice = g.sampleChoice(decision.answers.act, `${npc} acts`, decision.id);
  return { choice: options.some((o) => o.id === choice) ? choice : fallback, id: decision.id };
}

// --- From a belief to a debt ----------------------------------------------------

const mine = (g: Game, npc: string, d: Disposition): boolean =>
  "role" in d.who ? g.world.actors[npc]?.role === d.who.role : d.who.actor === npc;

function setsOff(g: Game, holder: string, d: Disposition, claim: Claim): boolean {
  const { when } = d;
  if (!when.predicates.includes(claim.predicate)) return false;
  const aboutStranger = claim.subject === PLAYER;
  if (when.about === "stranger" ? !aboutStranger : aboutStranger || claim.subject === holder)
    return false;
  if (when.placed && !(claim.place && g.world.rooms[claim.place])) return false;
  const them = g.world.actors[claim.subject];
  return !(when.inTheHouse && !(them?.kind === "npc" && them.present));
}

const keyFor = (d: Disposition, claim: Claim): string => {
  if (d.once === "claim") return claim.id;
  return d.once === "place" ? (claim.place ?? claim.subject) : claim.subject;
};

function owe(
  g: Game,
  npc: string,
  d: Disposition,
  key: string,
  data: Record<string, string>,
  minutes: number,
  cause: LogId,
): void {
  const id = `${d.id}_${npc}_${key}`;
  if (g.world.debts[id]) return;
  const due = g.world.clock + minutes;
  const debt: Debt = {
    id,
    cause,
    stakeholder: npc,
    kind: "react",
    magnitude: 3,
    fuse: { due, expires: due + KEEPS_FOR },
    status: "pending",
    data: { disposition: d.id, ...data },
  };
  g.commit({ kind: "create_debt", debt }, cause);
}

/** Someone has just taken a claim in. If it is the kind of thing they do something about, they now mean to. */
export function considerReacting(
  g: Game,
  holder: string,
  claim: Claim,
  credence: number,
  source: BeliefSource,
  cause: LogId,
): void {
  if (g.world.actors[holder]?.kind !== "npc") return;
  const believed = credence >= BELIEVED;
  const trustedWord = source.kind === "told" && trustIn(g.world, holder, source.from) >= TRUSTED;
  for (const d of DISPOSITIONS) {
    if (!(believed || (d.when.onTrustedWord && trustedWord))) continue;
    if (!(mine(g, holder, d) && setsOff(g, holder, d, claim))) continue;
    const minutes = source.kind === "witnessed" ? d.after.seen : d.after.heard;
    const data = { subject: claim.subject, claim: claim.id, ...placeOf(claim) };
    owe(g, holder, d, keyFor(d, claim), data, minutes, cause);
  }
}

const placeOf = (claim: Claim): Record<string, string> =>
  claim.place ? { place: claim.place } : {};

const habitWith = (g: Game, npc: string, reaction: string): Disposition | undefined =>
  DISPOSITIONS.find((d) => mine(g, npc, d) && d.reactions.includes(reaction));

/** Is this something this person does? Used to decide whether they may promise it. */
export const canReact = (g: Game, npc: string, reaction: string): boolean =>
  habitWith(g, npc, reaction) !== undefined;

/** Said aloud, it is owed: a promised reaction is the same debt the belief would have left. */
export function promiseReaction(
  g: Game,
  npc: string,
  reaction: string,
  subject: string,
  minutes: number,
  cause: LogId,
): void {
  const d = habitWith(g, npc, reaction);
  if (d) owe(g, npc, d, subject, { subject, only: reaction }, minutes, cause);
}

// --- The reactions ----------------------------------------------------------------

interface Scene {
  g: Game;
  npc: string;
  disposition: Disposition;
  /** Who the belief is about. */
  subject: string;
  /** The belief that set it off, if it is still held. */
  belief: Belief | null;
  place: string | null;
}

interface Reaction {
  /** How the judge is offered it, or null when it cannot be done now. */
  offer(s: Scene): string | null;
  /** Carries it out. `not_yet` means they could not get there, and will try again. */
  perform(s: Scene, cause: LogId): Promise<"done" | "not_yet">;
}

const roomOf = (g: Game, who: string): string | undefined => g.world.actors[who]?.room;

/** Walks to where someone is. False if something kept them from arriving. */
function reach(s: Scene, room: string | undefined, activity: string, cause: LogId): boolean {
  if (!room) return false;
  if (roomOf(s.g, s.npc) !== room) goTo(s.g, s.npc, room, activity, 8, cause);
  return roomOf(s.g, s.npc) === room;
}

const said = (g: Game, speaker: string, listener: string, request: string): boolean =>
  g.log.some(
    (e) =>
      e.kind === "effect" &&
      e.effect.kind === "say" &&
      e.effect.intent.speaker === speaker &&
      e.effect.intent.listener === listener &&
      e.effect.intent.topic.kind === "request" &&
      e.effect.intent.topic.id === request,
  );

/** Whether the player is near enough to notice what goes on in a room: in it, or next door. */
const withinHearing = (g: Game, room: string): boolean =>
  g.playerRoom === room || (g.world.rooms[room]?.exits.some((e) => e.to === g.playerRoom) ?? false);

const throwOut: Reaction = {
  offer: (s) => {
    const role = s.g.world.actors[s.npc]?.role ?? "";
    if (s.subject !== PLAYER || !POWERS[role]?.includes("throw_out")) return null;
    return `Has ${nameOf(s.g.world, s.subject)} thrown out into the rain at once`;
  },
  perform: (s, cause) => {
    doDeed(s.g, s.npc, "throw_out", cause);
    return Promise.resolve("done");
  },
};

const warn: Reaction = {
  // A warning is a promise. Given once, it is not on offer again.
  offer: (s) => {
    const line = s.disposition.says?.warn;
    if (!line || said(s.g, s.npc, s.subject, line)) return null;
    return `Warns ${nameOf(s.g.world, s.subject)} that it will not be borne a second time`;
  },
  perform: (s, cause) => {
    const line = s.disposition.says?.warn;
    if (!line) return Promise.resolve("done");
    if (!reach(s, roomOf(s.g, s.subject), "seeing_to_it", cause)) return Promise.resolve("not_yet");
    s.g.intent(s.npc, s.subject, "threaten", { kind: "request", id: line }, 3, cause);
    return Promise.resolve("done");
  },
};

/** What is inside the fixtures of a room, fixture by fixture. */
function fixturesIn(g: Game, room: string): { fixture: string; machine: string }[] {
  return Object.entries(SEARCHABLE)
    .filter(([fixture]) => {
      const at = g.world.items[fixture]?.at;
      return Boolean(at && "room" in at && at.room === room);
    })
    .map(([fixture, machine]) => ({ fixture, machine }));
}

/** A tracked thing has come to light, and may be back where it belongs. */
function recover(g: Game, item: string, by: string, cause: LogId): LogId {
  const tracked = TRACKED[item];
  if (!tracked) return cause;
  const target = { type: "machine", id: tracked.machine } as const;
  let id = cause;
  if (g.world.machines[tracked.machine]?.node === "hidden")
    id = g.commit({ kind: "set_node", target, to: "found" }, id);
  if (by === tracked.owner && g.world.machines[tracked.machine]?.node === "found")
    id = g.commit({ kind: "set_node", target, to: "returned" }, id);
  return id;
}

/** Goes through one fixture as anyone would: what it holds comes out, and what it shows is seen. */
function goThrough(s: Scene, fixture: string, machine: string, cause: LogId): string[] {
  const { g, npc } = s;
  let id = cause;
  if (g.world.machines[machine]?.node === "unsearched")
    id = g.commit(
      { kind: "set_node", target: { type: "machine", id: machine }, to: "searched" },
      id,
    );
  const shows = EXAMINE_TEACHES[fixture];
  if (shows) g.learn(npc, shows, 1, { kind: "witnessed" }, id);
  const inside = Object.values(g.world.items).filter(
    (i) => "inside" in i.at && i.at.inside === fixture && i.takeable,
  );
  for (const item of inside) {
    id = recover(g, item.id, npc, id);
    id = g.commit({ kind: "transfer", item: item.id, to: { holder: npc } }, id);
    const deed = g.happened(
      { subject: npc, predicate: "found", object: item.id, place: s.place ?? "", severity: 2 },
      id,
    );
    g.learn(npc, deed, 1, { kind: "witnessed" }, id);
    const teaches = EXAMINE_TEACHES[item.id];
    if (teaches) g.learn(npc, teaches, 1, { kind: "witnessed" }, id);
  }
  return inside.map((i) => i.name);
}

const goLook: Reaction = {
  offer: (s) =>
    s.place
      ? `Goes to ${s.g.world.rooms[s.place]?.name ?? "the place"} to look for themselves`
      : null,
  perform: (s, cause) => {
    const { g, npc, place } = s;
    if (!place) return Promise.resolve("done");
    if (!reach(s, place, "searching", cause)) return Promise.resolve("not_yet");
    const found = fixturesIn(g, place).flatMap((f) => goThrough(s, f.fixture, f.machine, cause));
    if (withinHearing(g, place)) {
      const name = nameOf(g.world, npc);
      const where = g.world.rooms[place]?.name ?? "the place";
      g.say(
        found.length > 0
          ? `${name} goes through ${where} with a lantern, and takes a long time about it. When ${theyOf(npc)} is done ${theyOf(npc)} has ${found.join(" and ")} in ${theirOf(npc)} hands.`
          : `${name} goes through ${where} with a lantern, and comes away with nothing.`,
      );
    }
    return Promise.resolve("done");
  },
};

/** What the asked person holds against themselves, and whom they could blame instead. */
function waysOut(
  g: Game,
  asker: string,
  target: string,
): { own: Belief[]; blame: Belief | undefined } {
  const held = rankedBeliefs(g.world, target);
  return {
    own: held.filter((b) => b.claim.subject === target && IMPLICATES.includes(b.claim.predicate)),
    blame: held.find(
      (b) =>
        b.claim.subject !== target &&
        b.claim.subject !== asker &&
        WRONGDOING.includes(b.claim.predicate),
    ),
  };
}

/** The strongest thing the asker holds against someone: what they will put to them. */
const chargeAgainst = (s: Scene): Belief | undefined =>
  (s.belief && s.belief.credence >= STILL_HELD ? s.belief : undefined) ??
  rankedBeliefs(s.g.world, s.npc).find(
    (b) =>
      b.claim.subject === s.subject &&
      b.credence >= STILL_HELD &&
      IMPLICATES.includes(b.claim.predicate),
  );

const haveItOut: Reaction = {
  offer: (s) => {
    const them = s.g.world.actors[s.subject];
    if (!(them?.kind === "npc" && them.alive && them.present && chargeAgainst(s))) return null;
    return `Goes to ${them.name} and puts it to them, to their face`;
  },
  perform: async (s, cause) => {
    const { g, npc: asker, subject: target } = s;
    const charge = chargeAgainst(s);
    const there = roomOf(g, target);
    if (!(charge && there && g.world.actors[target]?.present)) return "done";
    if (!reach(s, there, "confronting", cause)) return "not_yet";

    const clause = `${claimClause(g.world, charge.claim)}${whenFor(charge.claim, g.world.clock)}`;
    const { own, blame } = waysOut(g, asker, target);
    const options: Option[] = [
      ...(blame
        ? [
            {
              id: "turn_it_around",
              description: `Turns it around: says ${nameOf(g.world, blame.claim.subject)} is the one to blame and is trying to shift it`,
            },
          ]
        : []),
      { id: "refuse", description: "Laughs it off and will not dignify it with an answer" },
      ...(own[0]
        ? [
            {
              id: "confess",
              description: `Admits it to ${nameOf(g.world, asker)}: that ${claimClause(g.world, own[0].claim)}`,
            },
          ]
        : []),
    ];
    const others = [...g.npcsIn(there), ...(g.playerRoom === there ? [PLAYER] : [])].filter(
      (id) => id !== asker && id !== target,
    );
    const hears = {
      said_by: `${nameOf(g.world, asker)}, ${tieWords(g.world, target, asker)}`,
      what: `${nameOf(g.world, asker)} asks ${nameOf(g.world, target)} to ${theirOf(target)} face whether it is true that ${clause}`,
      in_front_of:
        others.length > 0 ? others.map((id) => nameOf(g.world, id)).join(" and ") : "nobody else",
    };
    const decision = await g.decide(
      compileSlice(sceneSlice, { world: g.world, parts: [{ npc: target, extra: { hears } }] }),
      {
        reply: pickSpeechAct({
          npc: `npcs.${target}`,
          options,
          fallback: blame ? "turn_it_around" : "refuse",
        }),
      },
      [{ kind: "in_room", actor: target, room: there }],
      cause,
    );
    if (!decision) return "done";
    const reply = g.sampleChoice(decision.answers.reply, `${target} answers`, decision.id);
    const audible = g.playerRoom === there;
    const name = nameOf(g.world, target);
    if (audible)
      g.say(
        `${nameOf(g.world, asker)} plants ${selfOf(asker)} in front of ${name} and asks, flat out, whether it is true that ${clause}.`,
      );
    if (reply === "confess" && own.length > 0) {
      // A confession is everything they hold against themselves, from their own mouth.
      for (const b of own) g.learn(asker, b.claim, 1, { kind: "told", from: target }, decision.id);
      if (audible)
        g.say(
          `${name} opens ${theirOf(target)} mouth, shuts it, and then it all comes out: that ${own.map((b) => claimClause(g.world, b.claim)).join("; that ")}.`,
        );
      return "done";
    }
    // Asked one thing, they answered another. That is what the asker saw.
    const deed = g.happened(
      { subject: target, predicate: "dodged", to: asker, severity: 2 },
      decision.id,
    );
    g.learn(asker, deed, 1, { kind: "witnessed" }, decision.id);
    if (audible && blame && reply === "turn_it_around")
      g.intent(target, asker, "tell", { kind: "claim", id: blame.claim.id }, 3, decision.id);
    else if (audible) g.say(`${name} laughs, a little too long.`);
    return "done";
  },
};

/** One row per thing a person can do about a belief. A new reaction is a new row. */
export const REACTIONS: Record<string, Reaction> = {
  throw_out: throwOut,
  warn,
  go_look: goLook,
  have_it_out: haveItOut,
};

// --- When the debt comes due ------------------------------------------------------

function situationFor(s: Scene): string {
  const { g, npc, belief, disposition } = s;
  const name = nameOf(g.world, npc);
  if (!belief) return `${name} has said they would deal with it. ${disposition.because}`;
  const how = belief.edge.source?.kind === "witnessed" ? "has seen" : "has come to believe";
  return `${name} ${how} that ${claimClause(g.world, belief.claim)}${whenFor(belief.claim, g.world.clock)}. ${disposition.because}`;
}

/** The debt handler for `react`: build what is possible, ask only if there is a choice, do it. */
export async function react(g: Game, debt: Debt, cause: LogId): Promise<void> {
  const settle = (status: "fired" | "cancelled", at: LogId) =>
    g.commit({ kind: "settle_debt", id: debt.id, status }, at);
  const disposition = DISPOSITIONS.find((d) => d.id === debt.data.disposition);
  const npc = debt.stakeholder;
  const belief = debt.data.claim ? (beliefIn(g.world, npc, debt.data.claim) ?? null) : null;
  // They no longer believe it, and this is not something they do on a mere word.
  const lapsed = belief && belief.credence < STILL_HELD && !disposition?.when.onTrustedWord;
  if (!disposition || lapsed) {
    settle("cancelled", cause);
    return;
  }
  const scene: Scene = {
    g,
    npc,
    disposition,
    subject: debt.data.subject ?? "",
    belief,
    place: debt.data.place ?? null,
  };
  const wanted = debt.data.only ? [debt.data.only] : disposition.reactions;
  const options: Option[] = wanted.flatMap((id) => {
    const description = REACTIONS[id]?.offer(scene);
    return description ? [{ id, description }] : [];
  });
  if (options.length === 0) {
    settle("cancelled", cause);
    return;
  }
  let chosen: string | null = options[0]?.id ?? null;
  let at = cause;
  if (options.length > 1) {
    const fallback = options.some((o) => o.id === disposition.fallback)
      ? disposition.fallback
      : (options[0]?.id ?? "");
    ({ choice: chosen, id: at } = await choose(
      g,
      npc,
      situationFor(scene),
      options,
      fallback,
      cause,
    ));
  }
  settle("fired", at);
  const reaction = chosen ? REACTIONS[chosen] : undefined;
  if (!(chosen && reaction)) return;
  // Could not get there yet: what was decided is kept, and tried again shortly.
  if ((await reaction.perform(scene, at)) === "not_yet" && g.world.clock < (debt.fuse.expires ?? 0))
    g.commit(
      {
        kind: "create_debt",
        debt: {
          ...debt,
          id: `${debt.id}+`,
          cause: at,
          status: "pending",
          fuse: { ...debt.fuse, due: g.world.clock + TRIES_AGAIN_IN },
          data: { ...debt.data, only: chosen },
        },
      },
      at,
    );
}
