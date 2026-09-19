/**
 * Rules as data, part three: the kernel. The one piece of code every data rule shares, however
 * many rules there come to be. Rows are made ready once (paths split, operators looked up,
 * derived quantities remembered until something is written) and then run against an `Env`: the
 * parties to an act, each a thing with its properties, its state now, its state as it was when
 * the act began, and a scratch pad for what one rule leaves for the next.
 *
 * The rows stay the source of truth. Nothing here knows any rule.
 */
import { effective } from "../effective.ts";
import type { Change, MatterWorld, Place, Properties, Thing, ThingState, Wound } from "../types.ts";
import { clamp } from "../types.ts";
import { type Cond, type Expr, OPS, ROOTS } from "./expr.ts";
import type { Alternative, Effect, Rule } from "./rules.ts";

export interface Party {
  thing: Thing;
  /** Effective properties as they were when the act began (effective.ts). */
  p: Properties;
  place: Place | undefined;
  s: ThingState;
  was: ThingState;
  x: Record<string, number>;
  /** For a party that is a body: numbers about it that a rule may read (`b.bleeding`). */
  b?: Readonly<Record<string, number>>;
  /** Properties worked out against a later state, kept until the state moves again. */
  now?: { state: ThingState; p: Properties };
}

export interface Env {
  world: MatterWorld;
  minutes: number;
  /** The party a path is about when it names none. */
  self: string;
  parties: Record<string, Party>;
  act: Readonly<Record<string, number>>;
  /** Moves on with every write, so that what was derived before it is worked out again. */
  version: number;
  memo?: { version: number; values: Map<string, number> };
}

export function partyOf(world: MatterWorld, thing: Thing): Party {
  const place = world.places[thing.place];
  return { thing, p: effective(world, thing), place, s: thing.state, was: thing.state, x: {} };
}

export function envOf(
  world: MatterWorld,
  parties: Record<string, Party>,
  minutes: number,
  act: Readonly<Record<string, number>> = {},
): Env {
  return { world, minutes, self: Object.keys(parties)[0] ?? "self", parties, act, version: 0 };
}

/** What one rule did: what it set on each party, and what it says happened. */
export interface Ran {
  /** The party this is said about. */
  about: string;
  sets: Record<string, Partial<ThingState>>;
  because: readonly string[];
  note?: string;
  quiet?: true;
  spent?: true;
  /** Nothing came of it, and the rule says so. */
  nothing?: true;
  /** What the rule made besides moving states: signals, pieces, wounds. In order. */
  made: Change[];
}

type Num = (env: Env) => number;
type Test = (env: Env) => boolean;
type Get = (env: Env) => unknown;
type Bag = Record<string, unknown>;

const PLACE_DEFAULTS: Record<string, number> = { air: 5, temperature: 2, moisture: 2, wind: 0 };
const ROOT_SET: ReadonlySet<string> = new Set(ROOTS);

const numberOf = (v: unknown): number => {
  if (typeof v === "number") return v;
  return v === true ? 1 : 0;
};

const COMPARE = {
  "<": (a: number, b: number) => a < b,
  "<=": (a: number, b: number) => a <= b,
  ">": (a: number, b: number) => a > b,
  ">=": (a: number, b: number) => a >= b,
} as const;

/** The operators over exactly two quantities, without an array between. Same answers as `OPS`. */
const PAIRS: Partial<Record<keyof typeof OPS, (a: number, b: number) => number>> = {
  add: (a, b) => a + b,
  mul: (a, b) => a * b,
  sub: (a, b) => a - b,
  div: (a, b) => a / b,
  min: (a, b) => Math.min(a, b),
  max: (a, b) => Math.max(a, b),
  pow: (a, b) => a ** b,
};

/** A path, with the party taken off the front if it names one. */
function parse(path: string): { party: string | null; root: string; rest: string[] } {
  const segments = path.split(".");
  const named = !ROOT_SET.has(segments[0] ?? "");
  const party = named ? (segments.shift() ?? null) : null;
  const [root = "", ...rest] = segments;
  return { party, root, rest };
}

const inside = (bag: unknown, key: string, inner: string | undefined): unknown => {
  const held = (bag as Bag | undefined)?.[key];
  if (inner === undefined) return held;
  return typeof held === "object" && held !== null ? (held as Bag)[inner] : undefined;
};

/** Properties against the state as it is now. Worked out once for each state. */
function nowOf(env: Env, party: Party): Properties {
  if (party.now?.state !== party.s)
    party.now = { state: party.s, p: effective(env.world, { ...party.thing, state: party.s }) };
  return party.now.p;
}

/** Which element a row path is about. */
const ROW_OF: Record<string, (party: Party) => string | null | undefined> = {
  row: (party) => party.thing.element,
  coat: (party) => party.s.coating?.element,
  wetWith: (party) => party.s.wetWith,
};

function rowReader(which: (party: Party) => string | null | undefined, rest: readonly string[]) {
  const [kind = "", key = ""] = rest;
  return (env: Env, party: Party): unknown => {
    const row = env.world.elements[which(party) ?? ""];
    if (kind === "p") return (row?.props as Record<string, number> | undefined)?.[key] ?? 0;
    if (kind === "is") return (row?.forms as readonly string[] | undefined)?.includes(key) ?? false;
    return (row as unknown as Bag | undefined)?.[kind] ?? 0;
  };
}

/** How each root is read off a party. A new source of quantities is a row here. */
const PARTY_ROOTS: Record<
  string,
  (rest: readonly string[]) => (env: Env, party: Party) => unknown
> = {
  p:
    ([key = ""]) =>
    (_env, party) =>
      (party.p as unknown as Record<string, number>)[key] ?? 0,
  now:
    ([, key = ""]) =>
    (env, party) =>
      (nowOf(env, party) as unknown as Record<string, number>)[key] ?? 0,
  s:
    ([key = "", inner]) =>
    (_env, party) =>
      inside(party.s, key, inner),
  was:
    ([key = "", inner]) =>
    (_env, party) =>
      inside(party.was, key, inner),
  x:
    ([key = ""]) =>
    (_env, party) =>
      party.x[key] ?? 0,
  b:
    ([key = ""]) =>
    (_env, party) =>
      party.b?.[key] ?? 0,
  place:
    ([key = ""]) =>
    (_env, party) =>
      (party.place as unknown as Bag | undefined)?.[key] ?? PLACE_DEFAULTS[key] ?? 0,
  row: (rest) => rowReader(ROW_OF.row as (p: Party) => string, rest),
  coat: (rest) => rowReader(ROW_OF.coat as (p: Party) => string | undefined, rest),
  wetWith: (rest) => rowReader(ROW_OF.wetWith as (p: Party) => string | null, rest),
};

export class Kernel {
  private readonly derived: Readonly<Record<string, Expr>>;
  private readonly made = new Map<string, Num>();

  constructor(derived: Readonly<Record<string, Expr>>) {
    this.derived = derived;
  }

  read(path: string): Get {
    const { party, root, rest } = parse(path);
    if (root === "t") return (env) => env.minutes;
    if (root === "act") return (env) => env.act[rest[0] ?? ""] ?? 0;
    if (root === "d") return this.node(rest[0] ?? "");
    const reader = PARTY_ROOTS[root]?.(rest);
    if (!reader) return () => undefined;
    return (env) => {
      const who = env.parties[party ?? env.self];
      return who ? reader(env, who) : undefined;
    };
  }

  /** A derived quantity: made ready when first read, and worked out once between writes. */
  private node(name: string): Num {
    return (env) => {
      if (env.memo?.version !== env.version) env.memo = { version: env.version, values: new Map() };
      const known = env.memo.values.get(name);
      if (known !== undefined) return known;
      let fn = this.made.get(name);
      if (!fn) {
        fn = this.num(this.derived[name] ?? 0);
        this.made.set(name, fn);
      }
      const value = fn(env);
      env.memo.values.set(name, value);
      return value;
    };
  }

  num(expr: Expr): Num {
    if (typeof expr === "number") return () => expr;
    if (typeof expr === "string") {
      const get = this.read(expr);
      return (env) => numberOf(get(env));
    }
    if ("if" in expr) {
      const [test, then, otherwise] = [
        this.test(expr.if),
        this.num(expr.then),
        this.num(expr.else),
      ];
      return (env) => (test(env) ? then(env) : otherwise(env));
    }
    const args = expr.of.map((e) => this.num(e));
    const pair = PAIRS[expr.op];
    const [a, b] = args;
    if (pair && a && b && args.length === 2) return (env) => pair(a(env), b(env));
    const fn = OPS[expr.op];
    return (env) => fn(args.map((arg) => arg(env)));
  }

  test(cond: Cond): Test {
    if ("all" in cond) {
      const tests = cond.all.map((c) => this.test(c));
      return (env) => tests.every((t) => t(env));
    }
    if ("any" in cond) {
      const tests = cond.any.map((c) => this.test(c));
      return (env) => tests.some((t) => t(env));
    }
    if ("has" in cond || "lacks" in cond) {
      const get = this.read("has" in cond ? cond.has : cond.lacks);
      const wanted = "has" in cond;
      return (env) => {
        const v = get(env);
        return (v !== null && v !== undefined && v !== false) === wanted;
      };
    }
    if ("ref" in cond) {
      const get = this.read(cond.ref);
      return (env) => get(env) === cond.equals;
    }
    const [a, b, compare] = [this.num(cond.a), this.num(cond.b), COMPARE[cond.is]];
    return (env) => compare(a(env), b(env));
  }
}

interface Working {
  env: Env;
  spent: boolean;
  made: Change[];
}
type Step = (w: Working) => void;
type Put = (env: Env, value: unknown) => void;

/** Writing is to a party's state or to its scratch pad, and to nothing else. */
function writer(path: string): Put {
  const { party, root, rest } = parse(path);
  const [key = "", inner] = rest;
  return (env, value) => {
    const who = env.parties[party ?? env.self];
    if (!who) return;
    env.version++;
    if (root === "x") {
      who.x[key] = numberOf(value);
      return;
    }
    if (root !== "s") return;
    const state = who.s as unknown as Bag;
    if (inner === undefined) {
      who.s = { ...state, [key]: value } as unknown as ThingState;
      return;
    }
    const held = state[key];
    if (typeof held !== "object" || held === null) return;
    who.s = { ...state, [key]: { ...held, [inner]: value } } as unknown as ThingState;
  };
}

function bounds(k: Kernel, e: Effect): (env: Env, value: number) => number {
  const lo = e.lo === undefined ? null : k.num(e.lo);
  const hi = e.hi === undefined ? null : k.num(e.hi);
  return (env, value) => {
    const floored = lo ? Math.max(lo(env), value) : value;
    return hi ? Math.min(hi(env), floored) : floored;
  };
}

type Build<K extends Effect["kind"]> = (k: Kernel, e: Extract<Effect, { kind: K }>) => Step;

/** How each kind of effect is carried out. A new kind is a row here, and a reason to think. */
const BUILD: { [K in Effect["kind"]]: Build<K> } = {
  approach: (k, e) => {
    const [from, to, rate, fit, put] = [
      k.num(e.q),
      k.num(e.toward),
      k.num(e.rate),
      bounds(k, e),
      writer(e.q),
    ];
    const over = k.num(e.over ?? "t");
    return (w) => {
      const was = from(w.env);
      const gone = 1 - Math.exp(-rate(w.env) * over(w.env));
      put(w.env, fit(w.env, was + (to(w.env) - was) * gone));
    };
  },
  accrue: (k, e) => {
    const [from, rate, fit, put] = [k.num(e.q), k.num(e.rate), bounds(k, e), writer(e.q)];
    const over = k.num(e.over ?? "t");
    const lo = e.lo === undefined ? null : k.num(e.lo);
    const atLo = e.atLo?.map((then) => step(k, then));
    return (w) => {
      const next = from(w.env) + rate(w.env) * over(w.env);
      const floor = lo ? lo(w.env) : Number.NEGATIVE_INFINITY;
      if (atLo && next <= floor + (e.eps ?? 0)) {
        for (const then of atLo) then(w);
        w.spent ||= e.spends === true;
        return;
      }
      put(w.env, fit(w.env, next));
    };
  },
  set: (k, e) => {
    const [to, fit, put] = [k.num(e.to), bounds(k, e), writer(e.q)];
    return (w) => put(w.env, fit(w.env, to(w.env)));
  },
  put: (_k, e) => {
    const put = writer(e.q);
    const { value } = e;
    // A record is laid down afresh each time, so that no two things share one.
    return (w) => put(w.env, typeof value === "object" && value !== null ? { ...value } : value);
  },
  emit: (k, e) => {
    const strength = k.num(e.strength);
    return (w) => {
      const from = w.env.parties[e.from];
      if (!from) return;
      w.made.push({
        kind: "signal",
        place: from.thing.place,
        channel: e.channel,
        source: from.thing.id,
        strength: strength(w.env),
        because: [...e.because],
        note: e.note,
      });
    };
  },
  split: (k, e) => {
    const amount = k.num(e.amount);
    const fields = Object.entries(e.state).map(([key, to]) => {
      const literal = typeof to === "object" && to !== null && "value" in to;
      return { key, literal: literal ? to.value : null, num: literal ? null : k.num(to as Expr) };
    });
    return (w) => {
      const from = w.env.parties[e.from];
      const taken = amount(w.env);
      if (!(from && taken > 0)) return;
      const state: Bag = { ...from.was };
      for (const f of fields) state[f.key] = f.num ? f.num(w.env) : f.literal;
      state.amount = taken;
      const { id, element, place } = from.thing;
      const piece = {
        id: `${id}.${e.suffix}`,
        element,
        place,
        state: state as unknown as ThingState,
      };
      w.made.push({ kind: "create", thing: piece, because: [...e.because], note: e.note });
      // What the piece has, the parent loses.
      const less = { because: [...e.less.because], note: e.less.note };
      w.made.push({ kind: "consume", thing: id, amount: taken, ...less });
    };
  },
  wound: (k, e) => {
    const [depth, bleeding, burned] = [k.num(e.depth), k.num(e.bleeding), k.num(e.burned)];
    return (w) => {
      const on = w.env.parties[e.on];
      if (!on) return;
      const wound: Wound = {
        depth: depth(w.env),
        bleeding: bleeding(w.env),
        burned: burned(w.env),
      };
      w.made.push({
        kind: "wound",
        body: on.thing.id,
        wound,
        because: [...e.because],
        note: e.note,
      });
    };
  },
  seal: (k, e) => {
    const burned = k.num(e.burned);
    return (w) => {
      const body = w.env.world.bodies[w.env.parties[e.on]?.thing.id ?? ""];
      body?.wounds.forEach((was, index) => {
        if (was.bleeding <= 0) return;
        const set = { bleeding: 0, burned: clamp(was.burned + burned(w.env)) };
        w.made.push({
          kind: "treat",
          body: body.id,
          index,
          set,
          because: [...e.because],
          note: e.note,
        });
      });
    };
  },
};

function step(k: Kernel, effect: Effect): Step {
  const act = (BUILD[effect.kind] as Build<typeof effect.kind>)(k, effect);
  if (!effect.when) return act;
  const test = k.test(effect.when);
  return (w) => {
    if (test(w.env)) act(w);
  };
}

function noteOf(k: Kernel, note: Alternative["note"]): (env: Env) => string | undefined {
  if (typeof note !== "object") return () => note;
  const test = k.test(note.if);
  return (env) => (test(env) ? note.say : note.otherwise);
}

function alternative(k: Kernel, alt: Alternative) {
  return {
    note: noteOf(k, alt.note),
    when: alt.when ? k.test(alt.when) : null,
    steps: alt.effects.map((e) => step(k, e)),
    alt,
  };
}

/** What differs now from the states the parties were in when the rule began. */
function changed(
  env: Env,
  before: Record<string, ThingState>,
): Record<string, Partial<ThingState>> {
  const sets: Record<string, Partial<ThingState>> = {};
  for (const [name, party] of Object.entries(env.parties)) {
    const was = before[name] as unknown as Bag;
    if (party.s === (was as unknown)) continue;
    const set: Bag = {};
    for (const [key, value] of Object.entries(party.s)) if (value !== was[key]) set[key] = value;
    sets[name] = set as Partial<ThingState>;
  }
  return sets;
}

export type Ready = (env: Env) => Ran | null;

/** One rule, made ready. It writes to the env it is given, and says what it did; null if nothing held. */
export function ready(k: Kernel, rule: Rule): Ready {
  const alts = rule.first.map((a) => alternative(k, a));
  return (env) => {
    const found = alts.find((a) => !a.when || a.when(env));
    if (!found) return null;
    const before: Record<string, ThingState> = {};
    for (const [name, party] of Object.entries(env.parties)) before[name] = party.s;
    const w: Working = { env, spent: false, made: [] };
    for (const s of found.steps) s(w);
    const { because, quiet } = found.alt;
    const note = found.note(env);
    return {
      about: rule.about ?? env.self,
      sets: changed(env, before),
      because,
      ...(note === undefined ? {} : { note }),
      ...(quiet ? { quiet } : {}),
      ...(w.spent ? { spent: true as const } : {}),
      ...(found.alt.nothing ? { nothing: true as const } : {}),
      made: w.made,
    };
  };
}

/**
 * What one rule did, as the changes the world is rewritten by: the state it moved on the party
 * it is about (if it cites anything), then whatever it made, in order.
 */
export function changesOf(env: Env, ran: Ran): Change[] {
  const said = { because: [...ran.because], note: ran.note ?? "it changes" };
  if (ran.nothing) return [{ kind: "nothing", ...said }, ...ran.made];
  const about = env.parties[ran.about];
  if (!about || ran.because.length === 0) return ran.made;
  const quiet = ran.quiet ? { quiet: true as const } : {};
  const set = ran.sets[ran.about] ?? {};
  return [{ kind: "state", thing: about.thing.id, set, ...said, ...quiet }, ...ran.made];
}

export function readyAll(rules: readonly Rule[], derived: Readonly<Record<string, Expr>>): Ready[] {
  const k = new Kernel(derived);
  return rules.map((rule) => ready(k, rule));
}
