/**
 * What a person can do about something: the rows the reaction pipeline chooses among
 * (`reactions.ts`, SPEC.md section 9). Each row says how it is offered to the judge, or that
 * it cannot be done now, and how it is carried out through validated effects. Rows work from
 * what the person believes, not from what is true: someone who has not looked does not know
 * the hiding place is empty. No row names a person, a room or a thing; those arrive in the
 * scene, from content.
 */
import { type Belief, beliefIn, type Claim, type LogId } from "@rpg-jev/core";
import { compileSlice, type Option, pickSpeechAct } from "@rpg-jev/jev";
import {
  DISPOSITIONS,
  type Disposition,
  EXAMINE_TEACHES,
  FIRES,
  IMPLICATES,
  NPCS,
  PLAYER,
  POWERS,
  SEARCHABLE,
  TRACKED,
  WRONGDOING,
} from "./content.ts";
import type { Game } from "./game.ts";
import { rankedBeliefs, sceneSlice } from "./slices.ts";
import { afterSpeech, doDeed, keptBack } from "./talk.ts";
import {
  cap,
  claimClause,
  nameOf,
  selfOf,
  theirOf,
  themOf,
  theyOf,
  tieWords,
  whenFor,
} from "./words.ts";

/** A reaction already owed is dropped if the belief behind it has fallen below this. */
export const STILL_HELD = 0.4;

export interface Scene {
  g: Game;
  npc: string;
  disposition: Disposition;
  /** Who it is about. */
  subject: string;
  /** The belief that set it off, if there was one and it is still held. */
  belief: Belief | null;
  place: string | null;
  /** The thing it concerns, if any. */
  thing: string | null;
  /** Presses someone else to do something they are disposed to do, sooner. */
  urge(
    whom: string,
    press: { reaction: string; subject: string; minutes: number },
    cause: LogId,
  ): void;
}

export interface Reaction {
  /** How the judge is offered it, or null when it cannot be done now. */
  offer(s: Scene): string | null;
  /** Carries it out. `not_yet` means they could not get there, and will try again. */
  perform(s: Scene, cause: LogId): Promise<"done" | "not_yet">;
}

const done = Promise.resolve("done" as const);
const notYet = Promise.resolve("not_yet" as const);

// --- Shared by the rows -----------------------------------------------------------

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

const roomOf = (g: Game, who: string): string | undefined => g.world.actors[who]?.room;
const name = (s: Scene, id: string): string => nameOf(s.g.world, id);
const roomName = (s: Scene, room: string): string => s.g.world.rooms[room]?.name ?? "the place";
const thingName = (s: Scene): string =>
  (s.thing ? s.g.world.items[s.thing]?.name : undefined) ?? "it";
const inTheHouse = (g: Game, id: string): boolean =>
  id === PLAYER || Boolean(g.world.actors[id]?.alive && g.world.actors[id]?.present);

/** Walks there, as the disposition's own errand if it has a name for it. False if kept from arriving. */
function reach(s: Scene, room: string | undefined, activity: string, cause: LogId): boolean {
  if (!room) return false;
  if (roomOf(s.g, s.npc) !== room)
    goTo(s.g, s.npc, room, s.disposition.activity ?? activity, 8, cause);
  return roomOf(s.g, s.npc) === room;
}

const hasPower = (g: Game, npc: string, power: string): boolean =>
  POWERS[g.world.actors[npc]?.role ?? ""]?.includes(power) ?? false;

export const holdsHabit = (g: Game, npc: string, d: Disposition): boolean =>
  "role" in d.who ? g.world.actors[npc]?.role === d.who.role : d.who.actor === npc;

/** Someone else in the house who is disposed to do this, if anyone is. */
const whoWould = (g: Game, reaction: string, except: string): string | undefined =>
  NPCS.find(
    (n) =>
      n !== except &&
      inTheHouse(g, n) &&
      DISPOSITIONS.some((d) => holdsHabit(g, n, d) && d.reactions.includes(reaction)),
  );

/** Whoever in the house has powers over it, other than this person. */
const authority = (g: Game, except: string): string | undefined =>
  NPCS.find(
    (n) =>
      n !== except && inTheHouse(g, n) && (POWERS[g.world.actors[n]?.role ?? ""]?.length ?? 0) > 0,
  );

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

/** What someone holds against themselves, and the strongest thing they hold against anyone else. */
function waysOut(g: Game, asker: string, target: string): { own: Belief[]; blame?: Belief } {
  const held = rankedBeliefs(g.world, target).filter((b) => b.credence >= STILL_HELD);
  const blame = held.find(
    (b) =>
      b.claim.subject !== target &&
      b.claim.subject !== asker &&
      inTheHouse(g, b.claim.subject) &&
      WRONGDOING.includes(b.claim.predicate),
  );
  return {
    own: held.filter((b) => b.claim.subject === target && IMPLICATES.includes(b.claim.predicate)),
    ...(blame ? { blame } : {}),
  };
}

/** A confession is everything they hold against themselves, from their own mouth. */
function confessTo(g: Game, who: string, to: string, own: Belief[], cause: LogId): void {
  for (const b of own) g.learn(to, b.claim, 1, { kind: "told", from: who }, cause);
  if (g.playerRoom === roomOf(g, to))
    g.say(
      `${nameOf(g.world, who)} opens ${theirOf(who)} mouth, shuts it, and then it all comes out: that ${own.map((b) => claimClause(g.world, b.claim)).join("; that ")}.`,
    );
}

// --- Powers of a role ---------------------------------------------------------------

const throwOut: Reaction = {
  offer: (s) =>
    s.subject === PLAYER && hasPower(s.g, s.npc, "throw_out")
      ? `Has ${name(s, s.subject)} thrown out into the rain at once`
      : null,
  perform: (s, cause) => {
    doDeed(s.g, s.npc, "throw_out", cause);
    return done;
  },
};

const handToLaw: Reaction = {
  offer: (s) =>
    s.subject === PLAYER && hasPower(s.g, s.npc, "hand_to_law")
      ? `Sends for the constable and holds ${name(s, s.subject)} until he comes`
      : null,
  perform: (s, cause) => {
    s.g.commit(
      { kind: "set_node", target: { type: "machine", id: "quest" }, to: "condemned" },
      cause,
    );
    return done;
  },
};

const searchPerson: Reaction = {
  offer: (s) =>
    hasPower(s.g, s.npc, "search_person") && inTheHouse(s.g, s.subject)
      ? `Goes to ${name(s, s.subject)} and demands they turn out their pack`
      : null,
  perform: (s, cause) => {
    const { g, npc, subject } = s;
    if (!reach(s, roomOf(g, subject), "searching_pack", cause)) return notYet;
    const line = s.disposition.says?.search_person;
    const turn = line
      ? g.intent(npc, subject, "request", { kind: "request", id: line }, 3, cause)
      : null;
    g.speak((t, sid) => afterSpeech(g, t, sid));
    const at = turn?.cause ?? cause;
    // What is found on them is whatever the story follows that is not theirs to carry.
    const theirs = Object.values(g.world.items).filter((i) => {
      const owner = TRACKED[i.id]?.owner;
      return (
        "holder" in i.at && i.at.holder === subject && owner !== undefined && owner !== subject
      );
    });
    const room = roomOf(g, subject) ?? "";
    if (theirs.length === 0) {
      if (subject === PLAYER)
        g.say(
          "You turn out your pack on the nearest table: a spare shirt, a heel of bread, a whetstone. It is gone through twice, and nothing in it is anyone else's.",
        );
      g.witness(g.happened({ subject, predicate: "pack_was_clean" }, at), room, at);
      return done;
    }
    for (const item of theirs) {
      const took = g.commit({ kind: "transfer", item: item.id, to: { holder: npc } }, at);
      const id = recover(g, item.id, npc, took);
      if (subject === PLAYER)
        g.say(
          `There is no hiding ${item.name}. ${cap(name(s, npc))} lifts it out of your pack with both hands, and ${theirOf(npc)} face closes like a door.`,
        );
      g.witness(
        g.happened({ subject, predicate: "had_in_pack", object: item.id, severity: 3 }, id),
        room,
        id,
      );
    }
    return done;
  },
};

// --- Words ---------------------------------------------------------------------------

const warn: Reaction = {
  // A warning is a promise. Given once, it is not on offer again.
  offer: (s) => {
    const line = s.disposition.says?.warn;
    if (!line || said(s.g, s.npc, s.subject, line)) return null;
    return `Warns ${name(s, s.subject)} that it will not be borne a second time`;
  },
  perform: (s, cause) => {
    const line = s.disposition.says?.warn;
    if (!line) return done;
    if (!reach(s, roomOf(s.g, s.subject), "seeing_to_it", cause)) return notYet;
    s.g.intent(s.npc, s.subject, "threaten", { kind: "request", id: line }, 3, cause);
    return done;
  },
};

/** Speaking up with what one has kept back: to whoever runs the house, or to the one it would help. */
const speakUp = (to: (s: Scene) => string | undefined, how: string): Reaction => {
  const plan = (s: Scene) => {
    const listener = to(s);
    const tale = listener ? keptBack(s.g, s.npc, [listener, s.subject]) : undefined;
    if (!(listener && tale && inTheHouse(s.g, listener))) return null;
    return beliefIn(s.g.world, listener, tale.claim.id) ? null : { listener, tale };
  };
  return {
    offer: (s) => {
      const p = plan(s);
      return p
        ? `${how} ${name(s, p.listener)} and tells them that ${claimClause(s.g.world, p.tale.claim)}`
        : null;
    },
    perform: (s, cause) => {
      const p = plan(s);
      if (!p) return done;
      // Owed from now on: they walk over and say it, by the road every tale takes.
      s.g.commit(
        {
          kind: "create_debt",
          debt: {
            id: `testify_${cause}`,
            cause,
            stakeholder: s.npc,
            kind: "testify",
            magnitude: 3,
            fuse: { due: s.g.world.clock, expires: s.g.world.clock + 90 },
            status: "pending",
            data: { to: p.listener, claim: p.tale.claim.id },
          },
        },
        cause,
      );
      return done;
    },
  };
};

/** The strongest thing the asker holds against someone: what they will put to them. */
const chargeAgainst = (s: Scene): Belief | undefined =>
  (s.belief && s.belief.credence >= STILL_HELD ? s.belief : undefined) ??
  rankedBeliefs(s.g.world, s.npc).find(
    (b) =>
      b.claim.subject === s.subject &&
      b.credence >= STILL_HELD &&
      IMPLICATES.includes(b.claim.predicate),
  );

function waysToAnswer(g: Game, asker: string, own: Belief[], blame: Belief | undefined): Option[] {
  const first = own[0];
  return [
    ...(blame
      ? [
          {
            id: "turn_it_around",
            description: `Turns it around: says ${nameOf(g.world, blame.claim.subject)} is the one to blame and is trying to shift it`,
          },
        ]
      : []),
    { id: "refuse", description: "Laughs it off and will not dignify it with an answer" },
    ...(first
      ? [
          {
            id: "confess",
            description: `Admits it to ${nameOf(g.world, asker)}: that ${claimClause(g.world, first.claim)}`,
          },
        ]
      : []),
  ];
}

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
    const others = [...g.npcsIn(there), ...(g.playerRoom === there ? [PLAYER] : [])].filter(
      (id) => id !== asker && id !== target,
    );
    const hears = {
      said_by: `${name(s, asker)}, ${tieWords(g.world, target, asker)}`,
      what: `${name(s, asker)} asks ${name(s, target)} to ${theirOf(target)} face whether it is true that ${clause}`,
      in_front_of:
        others.length > 0 ? others.map((id) => name(s, id)).join(" and ") : "nobody else",
    };
    const decision = await g.decide(
      compileSlice(sceneSlice, { world: g.world, parts: [{ npc: target, extra: { hears } }] }),
      {
        reply: pickSpeechAct({
          npc: `npcs.${target}`,
          options: waysToAnswer(g, asker, own, blame),
          fallback: blame ? "turn_it_around" : "refuse",
        }),
      },
      [{ kind: "in_room", actor: target, room: there }],
      cause,
    );
    if (!decision) return "done";
    const reply = g.sampleChoice(decision.answers.reply, `${target} answers`, decision.id);
    const audible = g.playerRoom === there;
    if (audible)
      g.say(
        `${name(s, asker)} plants ${selfOf(asker)} in front of ${name(s, target)} and asks, flat out, whether it is true that ${clause}.`,
      );
    if (reply === "confess" && own.length > 0) {
      confessTo(g, target, asker, own, decision.id);
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
    else if (audible) g.say(`${name(s, target)} laughs, a little too long.`);
    return "done";
  },
};

/** Goes to whoever was wronged, or whoever runs the house, and says it all. */
const comeClean: Reaction = {
  offer: (s) => {
    const to = confessor(s);
    if (!to || waysOut(s.g, to, s.npc).own.length === 0) return null;
    return `Goes to ${name(s, to)} and admits what ${theyOf(s.npc)} did`;
  },
  perform: (s, cause) => {
    const to = confessor(s);
    if (!to) return done;
    if (!reach(s, roomOf(s.g, to), "reporting", cause)) return notYet;
    confessTo(s.g, s.npc, to, waysOut(s.g, to, s.npc).own, cause);
    return done;
  },
};

function confessor(s: Scene): string | undefined {
  const owner = s.thing ? TRACKED[s.thing]?.owner : undefined;
  const to = owner && owner !== s.npc ? owner : authority(s.g, s.npc);
  return to && inTheHouse(s.g, to) ? to : undefined;
}

/** Presses the blame on someone else, to whoever could search them. */
const pressBlame: Reaction = {
  offer: (s) => {
    const to = whoWould(s.g, "search_person", s.npc);
    const blame = to ? waysOut(s.g, to, s.npc).blame : undefined;
    if (!(to && blame)) return null;
    return `Goes to ${name(s, to)} and insists ${name(s, blame.claim.subject)} has ${thingName(s)} and must be searched at once`;
  },
  perform: (s, cause) => {
    const { g, npc, thing } = s;
    const to = whoWould(g, "search_person", npc);
    const blame = to ? waysOut(g, to, npc).blame : undefined;
    if (!(to && blame)) return done;
    if (!reach(s, roomOf(g, to), "reporting", cause)) return notYet;
    const blamed = blame.claim.subject;
    const here = g.playerRoom === roomOf(g, to);
    const at = thing ? g.world.items[thing]?.at : undefined;
    // The thing is already back in the listener's hands: insisting someone else has it shows
    // the speaker knew where it was not.
    if (at && "holder" in at && at.holder === to) {
      const slip = g.happened({ subject: npc, predicate: "slipped", to, severity: 3 }, cause);
      g.learn(to, slip, 1, { kind: "witnessed" }, cause);
      if (here) {
        g.say(
          `${cap(name(s, npc))} comes through at a trot, red in the face, and tells ${name(s, to)} to search ${name(s, blamed)} at once: they have ${thingName(s)}, ${theyOf(npc)} would stake ${theirOf(npc)} life on it.`,
        );
        g.say(
          `${cap(name(s, to))} does not look at ${name(s, blamed)}. ${cap(theyOf(to))} looks at ${name(s, npc)}, and then down at ${thingName(s)} under ${theirOf(to)} own hand, which nobody has told ${themOf(npc)} about.`,
        );
        g.learn(PLAYER, slip, 1, { kind: "witnessed" }, cause);
      }
      return done;
    }
    s.urge(to, { reaction: "search_person", subject: blamed, minutes: 4 }, cause);
    if (here)
      g.say(
        `${cap(name(s, npc))} comes through at a trot, red in the face, and says something low and urgent in ${name(s, to)}'s ear. ${cap(theyOf(to))} looks straight at ${name(s, blamed)}.`,
      );
    return done;
  },
};

// --- Going, looking, getting rid ---------------------------------------------------------

/** What is inside the fixtures of a room, fixture by fixture. */
function fixturesIn(g: Game, room: string): { fixture: string; machine: string }[] {
  return Object.entries(SEARCHABLE)
    .filter(([fixture]) => {
      const at = g.world.items[fixture]?.at;
      return Boolean(at && "room" in at && at.room === room);
    })
    .map(([fixture, machine]) => ({ fixture, machine }));
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
  offer: (s) => (s.place ? `Goes to ${roomName(s, s.place)} to look for themselves` : null),
  perform: (s, cause) => {
    const { g, npc, place } = s;
    if (!place) return done;
    if (!reach(s, place, "searching", cause)) return notYet;
    const found = fixturesIn(g, place).flatMap((f) => goThrough(s, f.fixture, f.machine, cause));
    if (withinHearing(g, place))
      g.say(
        found.length > 0
          ? `${name(s, npc)} goes through ${roomName(s, place)} with a lantern, and takes a long time about it. When ${theyOf(npc)} is done ${theyOf(npc)} has ${found.join(" and ")} in ${theirOf(npc)} hands.`
          : `${name(s, npc)} goes through ${roomName(s, place)} with a lantern, and comes away with nothing.`,
      );
    return done;
  },
};

/** The fixture in this room that holds the thing, if it is still where it was left. */
function hidingPlace(g: Game, thing: string, place: string): string | undefined {
  const at = g.world.items[thing]?.at;
  if (!(at && "inside" in at)) return undefined;
  const fixture = g.world.items[at.inside]?.at;
  return fixture && "room" in fixture && fixture.room === place ? at.inside : undefined;
}

const believes = (s: Scene, predicate: string): boolean =>
  rankedBeliefs(s.g.world, s.npc).some(
    (b) =>
      b.claim.predicate === predicate && b.claim.object === s.thing && b.credence >= STILL_HELD,
  );

/** Looks where the thing was left. Finding it gone is something learned, and may be acted on. */
function lookForIt(s: Scene, cause: LogId): string | undefined {
  const { g, npc, thing, place } = s;
  if (!(thing && place)) return undefined;
  const fixture = hidingPlace(g, thing, place);
  if (fixture || believes(s, "found_gone")) return fixture;
  const gone: Partial<Claim> & Pick<Claim, "subject" | "predicate"> = {
    subject: npc,
    predicate: "found_gone",
    object: thing,
    place,
    severity: 2,
  };
  g.learn(npc, g.happened(gone, cause), 1, { kind: "witnessed" }, cause);
  return undefined;
}

const checkOn: Reaction = {
  offer: (s) =>
    s.thing && s.place && !believes(s, "found_gone") && !believes(s, "burned")
      ? `Goes to ${roomName(s, s.place)} to see that ${thingName(s)} is still where it was left`
      : null,
  perform: (s, cause) => {
    if (!reach(s, s.place ?? undefined, "checking_on_it", cause)) return notYet;
    lookForIt(s, cause);
    return done;
  },
};

const destroy: Reaction = {
  offer: (s) => {
    const fire = Object.keys(FIRES)[0];
    if (!(s.thing && s.place && fire) || believes(s, "found_gone") || believes(s, "burned"))
      return null;
    return `Fetches ${thingName(s)} and burns it in ${roomName(s, fire)}`;
  },
  perform: (s, cause) => {
    const { g, npc, thing, place } = s;
    const [fire, ashes] = Object.entries(FIRES)[0] ?? [];
    if (!(thing && place && fire && ashes)) return done;
    if (!reach(s, place, "checking_on_it", cause)) return notYet;
    const fixture = lookForIt(s, cause);
    if (!fixture) return done;
    // The whole bundle goes: whatever was put away with it.
    const bundle = Object.values(g.world.items).filter(
      (i) => "inside" in i.at && i.at.inside === fixture && i.takeable,
    );
    let id = cause;
    for (const item of bundle)
      id = g.commit({ kind: "transfer", item: item.id, to: { room: ashes } }, id);
    const machine = TRACKED[thing]?.machine;
    if (machine)
      id = g.commit(
        { kind: "set_node", target: { type: "machine", id: machine }, to: "burned" },
        id,
      );
    goTo(g, npc, fire, "burning", 10, id);
    const deed = g.happened(
      { subject: npc, predicate: "burned", object: thing, place: fire, severity: 3 },
      id,
    );
    g.learn(npc, deed, 1, { kind: "witnessed" }, id);
    g.witness(deed, fire, id, [npc]);
    if (g.playerRoom === fire || g.playerRoom === place) {
      g.say(
        `${cap(name(s, npc))} comes in with a floury bundle, glances at you, and feeds it to the fire anyway. Pages curl. It is ${thingName(s)}.`,
      );
      g.learn(PLAYER, deed, 1, { kind: "witnessed" }, id);
    }
    return done;
  },
};

const flee: Reaction = {
  offer: (s) => `Takes ${theirOf(s.npc)} coat and slips out into the rain, abandoning the inn`,
  perform: (s, cause) => {
    const { g, npc } = s;
    if (g.playerRoom === roomOf(g, npc))
      g.say(
        `${cap(name(s, npc))} takes ${theirOf(npc)} coat off its peg, looks once round the room, and goes out into the rain without a word.`,
      );
    const gone = g.commit({ kind: "retire", actor: npc }, cause);
    const deed = g.happened({ subject: npc, predicate: "fled", severity: 3 }, gone);
    // A door banging at the back of the house is heard by everyone in it.
    for (const other of NPCS)
      if (other !== npc && inTheHouse(g, other))
        g.learn(other, deed, 1, { kind: "witnessed" }, gone);
    g.learn(PLAYER, deed, 0.9, { kind: "witnessed" }, gone);
    g.say("Somewhere at the back of the house a door bangs, and does not bang again.");
    return done;
  },
};

const letItLie: Reaction = {
  offer: () => "Does nothing about it for now, and carries on as before",
  perform: () => done,
};

/** One row per thing a person can do about something. A new reaction is a new row. */
export const REACTIONS: Record<string, Reaction> = {
  throw_out: throwOut,
  hand_to_law: handToLaw,
  search_person: searchPerson,
  warn,
  tell_the_house: speakUp((s) => authority(s.g, s.npc), "Goes to"),
  tell_the_accused: speakUp((s) => s.subject, "Finds"),
  have_it_out: haveItOut,
  come_clean: comeClean,
  press_blame: pressBlame,
  go_look: goLook,
  check_on: checkOn,
  destroy,
  flee,
  let_it_lie: letItLie,
};
