/**
 * Means and ends (SPEC.md section 4, "Means and ends"). The world answers "what
 * is this for?" by walking a small graph of needs: what restores each, what
 * neglecting it costs, and what satisfying it makes possible. Every thing and
 * place is described against that graph, in numbers, so any verb can be tried
 * on anything and the outcome follows from what the thing is. Nothing here
 * knows about tables or stew; it knows about nourishment and hardness.
 *
 * The judge is not consulted: for authored things the numbers are content, and
 * for things nobody wrote, the author thread will fill the same fields later,
 * one ratified hop at a time. Pure code, no clock, no randomness.
 */
import type { Actor, Item, Need, Room } from "./types.ts";

export interface NeedEnd {
  /** The need in a word a player would use. */
  word: string;
  restoredBy: string;
  depletedBy: string;
  /** What going without does, in words and as a rule (see `weakened`). */
  neglect: string;
  /** What having enough makes possible. */
  enables: string;
  /** The need that `enables` serves in turn; the chain `why` walks. */
  next: Need | null;
}

export const ENDS: Record<Need, NeedEnd> = {
  hunger: {
    word: "nourishment",
    restoredBy: "food and drink",
    depletedBy: "time and labour",
    neglect: "a body that has not eaten grows weak: blows land harder and work goes slower",
    enables: "an able body, which can work",
    next: "money",
  },
  rest: {
    word: "rest",
    restoredBy: "sleep, or sitting a while",
    depletedBy: "the hours and the work",
    neglect: "a body that has not rested grows slow and clumsy",
    enables: "a clear head and steady hands, which can work",
    next: "money",
  },
  warmth: {
    word: "warmth",
    restoredBy: "a fire, a roof, dry clothes",
    depletedBy: "rain and the night",
    neglect: "cold gets into the bones and then into the chest",
    enables: "a body that keeps its strength for other things",
    next: "hunger",
  },
  money: {
    word: "coin",
    restoredBy: "wages and trade",
    depletedBy: "rent, food, and what is owed",
    neglect: "no coin means no roof, no supper and creditors at the door",
    enables: "a roof, a supper, and debts kept quiet",
    next: "safety",
  },
  safety: {
    word: "safety",
    restoredBy: "a roof, a locked door, and nobody with a grudge",
    depletedBy: "fights, threats, and enemies made",
    neglect: "a body that is not safe cannot sleep, and a name that is not safe cannot work",
    enables: "sleep, and a place in the house",
    next: "rest",
  },
  company: {
    word: "company",
    restoredBy: "talk, and being in good standing with the house",
    depletedBy: "being shunned, or shut away",
    neglect: "a person nobody speaks to hears nothing and is trusted by no one",
    enables: "news, favours, and a hand when one is needed",
    next: "safety",
  },
};

/** The chain of ends from a need, walked until it closes on itself. */
export function endsOf(need: Need, limit = 4): Need[] {
  const chain: Need[] = [];
  let at: Need | null = need;
  while (at && !chain.includes(at) && chain.length < limit) {
    chain.push(at);
    at = ENDS[at].next;
  }
  return chain;
}

/** How much a thing gives toward each need, −3 to 3; absent means nothing. */
export type Service = Partial<Record<Need, number>>;

/** What a thing does when forced: bitten, kicked, climbed, broken. */
export interface Forced {
  /** Harm to the one forcing it, 0 to 3. Oak is 1; a hearth is 2. */
  harm: number;
  /** What the forcing looks like to a witness, as a predicate: "gnawed", "kicked". */
  deed: string;
}

export interface Described {
  serves?: Service;
  forced?: Forced;
  /** Gone once it has served: a loaf, not a pot. */
  consumable?: boolean;
}

export type Describable = (Item | Room) & Described;

/** Verbs that reach for a need, and the need each reaches for. */
export const NEED_VERBS: Record<string, Need> = {
  eat: "hunger",
  drink: "hunger",
  bite: "hunger",
  taste: "hunger",
  chew: "hunger",
  lick: "hunger",
  sleep: "rest",
  rest: "rest",
  sit: "rest",
  warm: "warmth",
  hide: "safety",
  join: "company",
  mingle: "company",
};

/** Verbs that only force a thing. */
export const FORCE_VERBS = [
  "break",
  "smash",
  "kick",
  "punch",
  "hit",
  "throw",
  "climb",
  "push",
  "pull",
  "lift",
  "shake",
];

export type Outcome =
  /** The thing gave what was reached for. */
  | { kind: "served"; need: Need; magnitude: number; consumed: boolean }
  /** It gave nothing, and it could not be forced into giving. */
  | { kind: "nothing"; need: Need | null }
  /** It gave nothing and would hurt to force; a first try stops here. */
  | { kind: "too_hard"; need: Need | null; harm: number }
  /** Forced anyway, and it hurt. */
  | { kind: "harm"; need: Need | null; harm: number; deed: string };

/**
 * What happens when `verb` is tried on `thing`, given how many times it has
 * already been tried lately. The first try at something too hard only finds
 * that out; insisting is what breaks a tooth.
 */
export function attempt(verb: string, thing: Described, insistence: number): Outcome {
  const need = NEED_VERBS[verb] ?? null;
  const forced = thing.forced ?? { harm: 0, deed: "forced" };
  if (need !== null) {
    const magnitude = thing.serves?.[need] ?? 0;
    if (magnitude > 0)
      return { kind: "served", need, magnitude, consumed: thing.consumable === true };
  }
  const forcing = need === null || insistence > 0;
  if (forced.harm <= 0) return { kind: "nothing", need };
  if (!forcing) return { kind: "too_hard", need, harm: forced.harm };
  return { kind: "harm", need, harm: forced.harm, deed: forced.deed };
}

/** How far a served need moves, per unit of magnitude. Numbers live here, not in prose. */
export const RELIEF_PER_MAGNITUDE = 0.25;

/** Neglect, as a rule: a body this hungry or this tired takes blows harder. */
export function weakened(actor: Pick<Actor, "needs">): boolean {
  return actor.needs.hunger >= 0.8 || actor.needs.rest >= 0.8;
}
