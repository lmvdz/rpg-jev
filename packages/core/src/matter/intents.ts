/**
 * What a creature or a person may choose to do. An intent is a row: when it can be offered
 * and how much it matters now (its salience, a number only code sees), the words it is offered
 * in, and the act it becomes. The list is the measured one (spikes/minds/intents.json), closed
 * and grown by a person. Code offers the handful that matter most, always with nothing among
 * them (SPEC.md rule 4); the judge chooses when someone is watching, and `routine` takes the
 * first when nobody is (rule 10). Both choose among the same offers.
 *
 * No row names a kind of creature. What a row reads is the situation: needs felt (its own and
 * its wards'), what menaces it, what it has near to stand over, how the ground lies, what it
 * feels, what custom says. A new factor is a new field of the situation or a new structure
 * behind one, never a new branch here.
 */
import {
  apart,
  bondTo,
  bound,
  cannotCome,
  cornered,
  type Felt,
  feltNeeds,
  fromHome,
  precedes,
} from "./bonds.ts";
import { effective } from "./effective.ts";
import { blaze } from "./heat.ts";
import { able, canTake } from "./living.ts";
import { handles } from "./names.ts";
import type { Act } from "./resolve.ts";
import type { Body, BodyRow, Feeling, MatterWorld, Thing } from "./types.ts";

export interface Offer {
  id: string;
  intent: string;
  /** What it is toward, if anything: always something this body has noticed. */
  toward?: string;
  description: string;
  salience: number;
  act?: Act;
}

/** One thing or body this one has noticed, as far as choosing cares. All of it is derived. */
interface Target {
  id: string;
  name: string;
  gap: number;
  thing: Thing | null;
  other: Body | null;
  /** How much it menaces this body now: what is feared, armed or stronger, by how near. */
  threat: number;
  /** What burns, by how near. */
  heat: number;
  /** How dear it is to this body, 0 to 1. */
  dear: number;
  feeling: Feeling;
  /** The most urgent need of its own that this would meet, and of a ward that cannot come. */
  servesOwn: number;
  servesWard: number;
  ward: Body | null;
  held: boolean;
  /** Another has hold of it. */
  kept: boolean;
  /** Noticed, and not by sight: something is there and it does not know what. */
  strange: boolean;
  hurt: number;
  /** How much stronger than this body it is. */
  stronger: number;
  /** Custom here gives it the first turn. */
  first: boolean;
  /** It wants what this body wants: both hungry, with food in reach of it. */
  contests: boolean;
}

interface Situation {
  world: MatterWorld;
  body: Body;
  can: BodyRow;
  felt: Felt[];
  /** The most urgent need felt, and how hurt and wet it is. */
  urgent: number;
  hurt: number;
  cornered: boolean;
  cover: number;
  /** The worst menace noticed. */
  threat: number;
  /** What it has near to stand over: a ward, the place it keeps, food it holds. */
  stake: number;
  /** Those bound to it that could come if called. */
  allies: number;
  targets: Target[];
}

const NO_FEELING: Feeling = { fear: 0, anger: 0, trust: 0 };
const NEAR = 1.5;

const armed = (world: MatterWorld, other: Body) =>
  (other.holds ?? []).some((id) => {
    const held = world.things[id];
    return held !== undefined && (held.state.edge > 0 || effective(world, held).hardness >= 3);
  });

function threatOf(world: MatterWorld, body: Body, other: Body, gap: number): number {
  if (bound(world, body.id, other.id) || cannotCome(world, other)) return 0;
  const f = body.feels?.[other.id] ?? NO_FEELING;
  const stronger = Math.max(0, able(world, other).strength - able(world, body).strength);
  const menace = f.fear + f.anger * 0.3 + (armed(world, other) ? 1 : 0) + stronger * 0.5;
  return menace / (1 + gap / 8);
}

/** The most urgent of these needs that the thing would meet. */
function meets(world: MatterWorld, thing: Thing, felt: readonly Felt[]): Felt | null {
  const serves = world.elements[thing.element]?.serves ?? {};
  return felt.find((f) => (serves[f.need] ?? 0) > 0) ?? null;
}

function thingTarget(world: MatterWorld, body: Body, thing: Thing, felt: readonly Felt[]) {
  const own = meets(
    world,
    thing,
    felt.filter((f) => f.whose === body.id),
  );
  const wards = felt.filter((f) => {
    const ward = world.bodies[f.whose];
    return f.whose !== body.id && ward !== undefined && cannotCome(world, ward);
  });
  const forWard = meets(world, thing, wards);
  const ward = world.bodies[forWard?.whose ?? ""] ?? null;
  const kept = Object.values(world.bodies).some(
    (b) => b.id !== body.id && (b.holds ?? []).includes(thing.id),
  );
  // What already lies beside the ward needs no carrying.
  const held = (body.holds ?? []).includes(thing.id);
  const there = ward !== null && !held && apart(ward.where, thing.where) <= NEAR;
  return {
    kept,
    servesOwn: own?.urgency ?? 0,
    servesWard: there ? 0 : (forWard?.urgency ?? 0),
    ward: there ? null : ward,
    heat: blaze(world, thing) / (1 + apart(body.where, thing.where) / 4),
  };
}

function otherTarget(world: MatterWorld, body: Body, other: Body, gap: number) {
  const hungry = (other.needs.hunger ?? 0) >= 2 && (body.needs.hunger ?? 0) >= 2;
  const food = Object.keys(body.aware ?? {}).some((id) => {
    const thing = world.things[id];
    const feeds = (world.elements[thing?.element ?? ""]?.serves?.hunger ?? 0) > 0;
    return feeds && apart(other.where, thing?.where) <= 8;
  });
  return {
    threat: threatOf(world, body, other, gap),
    dear: bondTo(world, body.id, other.id) / 5,
    hurt: other.wounds.reduce((n, w) => n + w.depth, 0),
    stronger: able(world, other).strength - able(world, body).strength,
    first: precedes(world, other, body, "food"),
    contests: hungry && food,
  };
}

function targetOf(s: Omit<Situation, "targets" | "threat" | "stake">, id: string, name: string) {
  const { world, body } = s;
  const thing = world.things[id] ?? null;
  const other = world.bodies[id] ?? null;
  const gap = apart(body.where, (thing ?? other)?.where);
  const blank = { threat: 0, heat: 0, dear: 0, servesOwn: 0, servesWard: 0, ward: null };
  const target: Target = {
    id,
    name,
    gap,
    thing,
    other,
    ...blank,
    hurt: 0,
    stronger: 0,
    first: false,
    contests: false,
    feeling: body.feels?.[id] ?? NO_FEELING,
    held: (body.holds ?? []).includes(id),
    kept: false,
    strange: body.aware?.[id]?.channel !== "sight" && !(id in (body.feels ?? {})),
    ...(thing ? thingTarget(world, body, thing, s.felt) : {}),
    ...(other ? otherTarget(world, body, other, gap) : {}),
  };
  return target;
}

/** What it has near that is its own to stand over. */
function stakeOf(world: MatterWorld, body: Body, felt: readonly Felt[]): number {
  const wards = (world.bonds ?? []).filter((b) => b.from === body.id);
  const near = wards.map((b) => {
    const ward = world.bodies[b.to];
    const close = ward !== undefined && ward.place === body.place;
    return close && apart(body.where, ward.where) <= 12 ? (b.weight / 5) * 3 : 0;
  });
  const home = fromHome(body);
  const holdsFood = (body.holds ?? []).some((id) => {
    const held = world.things[id];
    return held !== undefined && meets(world, held, felt) !== null;
  });
  return Math.max(0, ...near, home !== null && home <= 8 ? 1.5 : 0, holdsFood ? 1 : 0);
}

function situationOf(world: MatterWorld, body: Body): Situation {
  const felt = feltNeeds(world, body);
  const base = {
    world,
    body,
    can: able(world, body),
    felt,
    urgent: felt[0]?.urgency ?? 0,
    hurt: body.wounds.reduce((n, w) => n + w.depth + w.bleeding, 0),
    cornered: cornered(world, body),
    cover: world.places[body.place]?.cover ?? 0,
    allies: (world.bonds ?? []).filter((b) => {
      const ally = world.bodies[b.from];
      return b.to === body.id && ally !== undefined && !cannotCome(world, ally);
    }).length,
  };
  const names = handles(world, body);
  const targets = Object.keys(body.aware ?? {})
    .sort()
    .map((id) => targetOf(base, id, names[id] ?? "something"));
  const threat = Math.max(0, ...targets.map((t) => t.threat));
  return { ...base, targets, threat, stake: stakeOf(world, body, felt) };
}

interface IntentRow {
  /** What it can be toward. */
  toward: "other" | "thing" | "any" | "nothing";
  /** How much it matters now. At or below nothing, it is not offered. */
  when: (s: Situation, t: Target) => number;
  /** The words it is offered in. */
  says: (name: string) => string;
  act?: (s: Situation, t: Target) => Act | undefined;
  /** The structure this row cannot be offered without, and which does not exist yet. */
  waitsOn?: string;
}

const waits = (waitsOn: string, says: string): IntentRow => ({
  toward: "nothing",
  when: () => 0,
  says: () => says,
  waitsOn,
});

const near = (t: Target) => t.gap <= NEAR;
const gate = (open: boolean, salience: number) => (open ? salience : 0);

/** Carrying is take, then go, then set down: which, by where things stand. */
function carrying(s: Situation, t: Target): Act | undefined {
  const body = s.body.id;
  if (!t.held) return { process: "take", body, thing: t.id };
  if (t.ward && apart(s.body.where, t.ward.where) > NEAR)
    return { process: "move", body, toward: t.ward.id, minutes: 1 };
  return { process: "take", body, thing: t.id, drop: true };
}

function striking(s: Situation, t: Target): Act | undefined {
  const instrument = (s.body.holds ?? [])[0] ?? `${s.body.id}.hands`;
  if (!(instrument in s.world.things)) return undefined;
  const manner = { effort: 4, care: 1, haste: 4 };
  return { process: "force", by: s.body.id, instrument, patient: t.id, manner };
}

export const INTENT_ROWS: Record<string, IntentRow> = {
  go_to: {
    toward: "thing",
    when: (s, t) =>
      gate(
        !(near(t) || t.held),
        Math.max(t.servesOwn, t.servesWard) - t.gap * 0.02 - s.threat * 0.5,
      ),
    says: (n) => `go toward ${n}`,
    act: (s, t) => ({ process: "move", body: s.body.id, toward: t.id, minutes: 1 }),
  },
  keep_away: {
    toward: "any",
    when: (s, t) => gate(!s.cornered && s.can.speed > 0, t.threat + t.heat),
    says: (n) => `get away from ${n}`,
    act: (s, t) => ({ process: "move", body: s.body.id, away: t.id, minutes: 1 }),
  },
  hide: {
    toward: "other",
    when: (s, t) => gate(s.cover >= 2, (t.threat * s.cover) / 5),
    says: (n) => `go still and keep out of sight of ${n}`,
  },
  wait_watch: {
    toward: "other",
    when: (_s, t) => gate(t.dear <= 0 && !t.strange, 1 + t.threat * 0.3),
    says: (n) => `stay where it is and watch ${n}`,
  },
  give_up: {
    toward: "nothing",
    when: (s) => gate(s.body.doing !== undefined, (s.body.needs.rest ?? 0) * 0.4 + s.threat * 0.4),
    says: () => "leave off what it was doing and move on",
  },
  carry_on: {
    toward: "nothing",
    when: (s) => gate(s.body.doing !== undefined, 1.2 - s.threat * 0.3),
    says: () => "go on with what it was doing",
  },
  rest: {
    toward: "nothing",
    when: (s) => {
      const tired = s.body.needs.rest ?? 0;
      return gate(tired >= 2 || s.hurt >= 2, Math.max(tired, s.hurt * 0.8) - s.threat);
    },
    says: () => "lie down and rest",
  },
  take: {
    toward: "thing",
    when: (s, t) =>
      gate(near(t) && !t.held && !t.kept && canTake(s.world, s.body, t.id), t.servesOwn * 0.5),
    says: (n) => `take ${n}`,
    act: (s, t) => ({ process: "take", body: s.body.id, thing: t.id }),
  },
  eat_drink: {
    toward: "thing",
    when: (s, t) => gate(near(t) && !t.kept, t.servesOwn - s.threat * 0.3),
    says: (n) => `eat or drink ${n}`,
    act: (s, t) => ({ process: "ingest", body: s.body.id, thing: t.id, amount: 1 }),
  },
  carry_to: {
    toward: "thing",
    when: (s, t) =>
      gate(
        t.ward !== null && !t.kept && (t.held || (near(t) && canTake(s.world, s.body, t.id))),
        t.servesWard,
      ),
    says: (n) => `carry ${n} to its own that cannot come for it`,
    act: carrying,
  },
  store: {
    toward: "thing",
    when: (s, t) => {
      const feeds = (s.world.elements[t.thing?.element ?? ""]?.serves?.hunger ?? 0) > 0;
      return gate(near(t) && feeds && s.urgent < 2 && s.threat <= 0, 0.8);
    },
    says: (n) => `put ${n} by for later`,
  },
  guard: {
    toward: "other",
    when: (s, t) => gate(t.threat > 0 && s.stake > 0, s.stake + t.threat),
    says: (n) => `put itself between ${n} and what is its own`,
  },
  warn_off: {
    toward: "other",
    when: (s, t) => {
      const cause = s.stake > 0 || s.cornered || t.feeling.anger > 0;
      const push = s.stake * 0.8 + t.feeling.anger * 0.5 + (s.cornered ? 2 : 0);
      return gate(t.threat > 0 && t.gap <= 15 && cause, push + t.threat * 0.5);
    },
    says: (n) => `threaten ${n} without striking`,
  },
  attack: {
    toward: "other",
    when: (s, t) => {
      const cause = t.feeling.anger >= 2 || (s.cornered && t.threat > 0);
      const push = t.feeling.anger + (s.cornered ? 2 : 0) + s.stake * 0.5;
      return gate(t.gap <= 8 && cause, push - Math.max(0, t.stronger) - 1);
    },
    says: (n) => `use force on ${n}`,
    act: striking,
  },
  defer: {
    toward: "other",
    when: (_s, t) => gate(t.contests && (t.first || t.stronger >= 2), t.first ? 2 : 1.5),
    says: (n) => `give way to ${n}`,
  },
  let_go: {
    toward: "other",
    when: (s, t) => {
      const beaten = t.hurt >= 2 || (t.other !== null && cannotCome(s.world, t.other));
      return gate(t.feeling.anger > 0 && beaten, 1);
    },
    says: (n) => `leave ${n} be, though it could press`,
  },
  demand: waits("claims: whose a thing is and what is owed", "press a claim"),
  give: {
    toward: "other",
    when: (s, t) => {
      const has = (s.body.holds ?? []).some((id) => {
        const held = s.world.things[id];
        const wants = t.other ? feltNeeds(s.world, t.other).filter((f) => f.urgency >= 2) : [];
        return held !== undefined && meets(s.world, held, wants) !== null;
      });
      return gate(has && t.gap <= 3 && t.threat <= 0, t.dear * 2 + t.feeling.trust * 0.3 + 0.5);
    },
    says: (n) => `give what it holds to ${n}`,
    act: (s) => {
      const thing = (s.body.holds ?? [])[0];
      return thing ? { process: "take", body: s.body.id, thing, drop: true } : undefined;
    },
  },
  help: {
    toward: "other",
    when: (_s, t) =>
      gate(t.hurt >= 1 && t.gap <= 10 && t.threat <= 0, t.dear * 3 + t.feeling.trust * 0.5 + 0.3),
    says: (n) => `tend ${n}`,
  },
  offer_trade: waits("offers made between bodies", "propose an exchange"),
  accept: waits("offers made between bodies", "agree to what was offered"),
  refuse: waits("offers made between bodies", "decline what was offered"),
  ask: waits("speech and claims", "ask for something"),
  tell: waits("speech and claims", "say what it knows"),
  deceive: waits("speech and claims", "make another believe what is not so"),
  keep_quiet: waits("speech and claims", "know it and say nothing"),
  call: {
    toward: "nothing",
    when: (s) => gate(s.threat > 0 && (s.allies > 0 || s.stake > 0), 1 + s.threat * 0.5),
    says: () => "call to its own",
  },
  lead: waits("a group with a task", "direct the others"),
  court: waits("seasons and pairing", "seek a mate"),
  work_on: waits("purposes: what a thing is wanted for", "work on a thing"),
  play: {
    toward: "other",
    when: (s, t) => gate(t.dear > 0 && t.gap <= 6 && s.urgent < 2 && s.threat <= 0, 0.9),
    says: (n) => `play with ${n}`,
  },
  tend_self: {
    toward: "nothing",
    when: (s) => s.hurt * 0.7 + Math.max(0, (s.body.wetness ?? 0) - 2) * 0.3 - s.threat,
    says: () => "see to its own body",
  },
  express: {
    toward: "nothing",
    when: (s) => gate(s.urgent >= 4, 0.6),
    says: () => "give voice to what it feels",
  },
  examine: {
    toward: "any",
    when: (_s, t) => gate(t.strange && t.servesOwn <= 0 && t.dear <= 0, 1 - t.threat),
    says: (n) => `look into ${n}`,
  },
};

const NOTHING: Target = {
  id: "",
  name: "",
  gap: 0,
  thing: null,
  other: null,
  threat: 0,
  heat: 0,
  dear: 0,
  feeling: NO_FEELING,
  servesOwn: 0,
  servesWard: 0,
  ward: null,
  held: false,
  kept: false,
  strange: false,
  hurt: 0,
  stronger: 0,
  first: false,
  contests: false,
};

const FITS: Record<IntentRow["toward"], (t: Target) => boolean> = {
  other: (t) => t.other !== null,
  thing: (t) => t.thing !== null,
  any: () => true,
  nothing: () => false,
};

/** How many it is offered at once, besides nothing. */
const HANDFUL = 7;

const NONE: Offer = { id: "none", intent: "none", description: "none of these", salience: 0 };

function offerOf(s: Situation, intent: string, row: IntentRow, t: Target): Offer[] {
  const salience = row.when(s, t);
  if (!(salience > 0)) return [];
  const act = row.act?.(s, t);
  return [
    {
      id: t.id ? `${intent}:${t.id}` : `${intent}:`,
      intent,
      ...(t.id ? { toward: t.id } : {}),
      description: row.says(t.name),
      salience: Math.round(salience * 1000) / 1000,
      ...(act ? { act } : {}),
    },
  ];
}

/**
 * What this body could do now, most pressing first, with nothing last. It cannot be offered
 * anything toward what it has not noticed.
 */
export function offers(world: MatterWorld, body: Body): Offer[] {
  const s = situationOf(world, body);
  const made = Object.entries(INTENT_ROWS).flatMap(([intent, row]) =>
    row.toward === "nothing"
      ? offerOf(s, intent, row, NOTHING)
      : s.targets.filter(FITS[row.toward]).flatMap((t) => offerOf(s, intent, row, t)),
  );
  made.sort((a, b) => b.salience - a.salience || a.id.localeCompare(b.id));
  return [...made.slice(0, HANDFUL), NONE];
}

/** What it does when nobody is watching: the most pressing of the same offers, in code. */
export function routine(world: MatterWorld, body: Body): Offer {
  return offers(world, body)[0] ?? NONE;
}
